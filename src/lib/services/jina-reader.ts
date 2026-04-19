/**
 * Jina AI Reader client
 * Prepend https://r.jina.ai/ to any URL to get a clean markdown version.
 * Works without an API key at 20 RPM. With a key, higher limits apply.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScrapeResult {
  markdown: string;
  sourceUrl: string;
  scrapedAt: string;
}

export interface JobListingResult {
  description: string;
  title?: string;
  company?: string;
}

export interface CompanyPagesResult {
  homepage: string;
  aboutPage?: string;
  careersPage?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const JINA_BASE = 'https://r.jina.ai/';

/**
 * Extract the first H1 heading from markdown text.
 */
function extractH1(markdown: string): string | undefined {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim();
}

/**
 * Extract the first H2 heading from markdown text.
 */
function extractH2(markdown: string): string | undefined {
  const match = markdown.match(/^##\s+(.+)$/m);
  return match?.[1]?.trim();
}

/**
 * Find links in a markdown string that match the given path patterns.
 * Returns absolute URLs resolved against the base URL.
 */
function findLinks(
  markdown: string,
  baseUrl: string,
  patterns: RegExp[]
): string[] {
  // Match both [text](url) and bare URLs in markdown
  const linkRegex = /\[.*?\]\((https?:\/\/[^)]+)\)/g;
  const results: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(markdown)) !== null) {
    const href = match[1];
    if (patterns.some((p) => p.test(href))) {
      results.push(href);
    }
  }

  // Also check for relative paths in markdown links
  const relativeRegex = /\[.*?\]\((\/[^)]+)\)/g;
  const base = new URL(baseUrl);

  while ((match = relativeRegex.exec(markdown)) !== null) {
    const href = match[1];
    if (patterns.some((p) => p.test(href))) {
      results.push(`${base.protocol}//${base.host}${href}`);
    }
  }

  return Array.from(new Set(results)); // deduplicate
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class JinaReaderClient {
  private readonly apiKey?: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey;
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private buildHeaders(): HeadersInit {
    const headers: HeadersInit = {
      Accept: 'text/markdown',
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    return headers;
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Scrape any URL via Jina Reader and return the markdown content.
   * Applies a 15-second timeout. Throws on failure — callers should catch.
   */
  async scrapeUrl(url: string): Promise<ScrapeResult> {
    const jinaUrl = `${JINA_BASE}${encodeURIComponent(url)}`;

    let response: Response;
    try {
      response = await fetch(jinaUrl, {
        headers: this.buildHeaders(),
        signal: AbortSignal.timeout(15000),
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'TimeoutError') {
        throw new Error(
          `[JinaReaderClient] Request timed out after 15s for URL: ${url}`
        );
      }
      throw new Error(
        `[JinaReaderClient] Network error scraping ${url}: ${err}`
      );
    }

    if (response.status === 403) {
      throw new Error(
        `[JinaReaderClient] Access blocked (403) for URL: ${url}`
      );
    }
    if (response.status === 429) {
      throw new Error(
        `[JinaReaderClient] Rate limited (429) by Jina Reader. Try again later.`
      );
    }
    if (!response.ok) {
      throw new Error(
        `[JinaReaderClient] HTTP ${response.status} scraping ${url}`
      );
    }

    const markdown = await response.text();

    return {
      markdown,
      sourceUrl: url,
      scrapedAt: new Date().toISOString(),
    };
  }

  /**
   * Scrape a job listing URL and extract structured fields from the markdown.
   * Title is taken from the first H1, company from the first H2 or metadata.
   */
  async scrapeJobListing(url: string): Promise<JobListingResult> {
    const { markdown } = await this.scrapeUrl(url);

    const title = extractH1(markdown);
    const company = extractH2(markdown);

    // Use the full markdown as the description (callers can truncate as needed)
    return {
      description: markdown,
      title,
      company,
    };
  }

  /**
   * Scrape a company's homepage and follow one secondary page link.
   * Looks for /about, /careers, /team, /values, /culture paths.
   * Uses 2 Jina requests total.
   */
  async scrapeCompanyPages(companyUrl: string): Promise<CompanyPagesResult> {
    const { markdown: homepage } = await this.scrapeUrl(companyUrl);

    const aboutPatterns = [/\/about/i, /\/team/i, /\/values/i];
    const careersPatterns = [/\/careers/i, /\/culture/i, /\/jobs/i];

    const aboutLinks = findLinks(homepage, companyUrl, aboutPatterns);
    const careersLinks = findLinks(homepage, companyUrl, careersPatterns);

    // Pick the most relevant secondary page: prefer careers over about
    const secondaryUrl = careersLinks[0] ?? aboutLinks[0];

    if (!secondaryUrl) {
      return { homepage };
    }

    // Determine which bucket the secondary URL belongs to
    const isCareer = careersPatterns.some((p) => p.test(secondaryUrl));

    let secondaryMarkdown: string | undefined;
    try {
      const result = await this.scrapeUrl(secondaryUrl);
      secondaryMarkdown = result.markdown;
    } catch {
      // Secondary page scrape failure is non-fatal — return what we have
      secondaryMarkdown = undefined;
    }

    return {
      homepage,
      aboutPage: !isCareer ? secondaryMarkdown : undefined,
      careersPage: isCareer ? secondaryMarkdown : undefined,
    };
  }
}
