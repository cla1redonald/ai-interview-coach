/**
 * Gemini Search client — wraps @google/generative-ai with Google Search grounding.
 * Uses gemini-2.5-flash with tools: [{ googleSearch: {} }] to get grounded results.
 */
import { GoogleGenerativeAI } from '@google/generative-ai';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SearchResult {
  title: string;
  url: string;
  text: string;
  publishedDate?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Attempt to parse JSON from the text response.
 * Gemini sometimes wraps the JSON in a markdown code fence; strip it first.
 */
function parseJsonArray(raw: string): unknown[] {
  // Strip optional markdown code fence (```json ... ```)
  const stripped = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();

  const parsed: unknown = JSON.parse(stripped);
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed;
}

/**
 * Coerce an unknown object from the parsed JSON into a SearchResult.
 * Unknown / missing fields are defaulted to empty strings.
 */
function toSearchResult(raw: unknown): SearchResult | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const obj = raw as Record<string, unknown>;

  const title = typeof obj.title === 'string' ? obj.title : '';
  const url = typeof obj.url === 'string' ? obj.url : '';
  const text =
    typeof obj.text === 'string'
      ? obj.text
      : typeof obj.snippet === 'string'
      ? obj.snippet
      : typeof obj.summary === 'string'
      ? obj.summary
      : '';
  const publishedDate =
    typeof obj.publishedDate === 'string'
      ? obj.publishedDate
      : typeof obj.date === 'string'
      ? obj.date
      : undefined;

  if (!title && !url) return null;
  return { title, url, text, publishedDate };
}

/**
 * Extract structured SearchResults from grounding metadata when available.
 * The grounding chunks contain source URLs and supporting text snippets.
 */
function extractFromGrounding(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  groundingMetadata: Record<string, any>
): SearchResult[] {
  const chunks: unknown[] = groundingMetadata?.groundingChunks ?? [];
  const results: SearchResult[] = [];

  for (const chunk of chunks) {
    if (typeof chunk !== 'object' || chunk === null) continue;
    const c = chunk as Record<string, unknown>;
    const web = c.web as Record<string, unknown> | undefined;
    if (!web) continue;

    const url = typeof web.uri === 'string' ? web.uri : '';
    const title = typeof web.title === 'string' ? web.title : '';
    if (!url) continue;

    results.push({ title, url, text: '' });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class GeminiSearchClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly model: any;

  constructor(apiKey: string) {
    const genAI = new GoogleGenerativeAI(apiKey);
    this.model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      // Enable Google Search grounding tool
      tools: [{ googleSearch: {} }] as never,
    });
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private async runSearch(prompt: string): Promise<SearchResult[]> {
    let result;
    try {
      result = await this.model.generateContent(prompt);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (/quota|rate.?limit/i.test(message)) {
        throw new Error(
          `[GeminiSearchClient] Rate limit exceeded: ${message}`
        );
      }
      throw new Error(`[GeminiSearchClient] API error: ${message}`);
    }

    const response = result.response;
    const textContent = response.text();

    // First, try to extract from grounding metadata (most reliable source URLs)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const candidates: any[] = response.candidates ?? [];
    let groundingResults: SearchResult[] = [];

    for (const candidate of candidates) {
      const metadata = candidate?.groundingMetadata;
      if (metadata) {
        groundingResults = extractFromGrounding(metadata);
        break;
      }
    }

    // Then try to parse structured JSON from the text response
    let jsonResults: SearchResult[] = [];
    try {
      const rawArray = parseJsonArray(textContent);
      jsonResults = rawArray
        .map(toSearchResult)
        .filter((r): r is SearchResult => r !== null);
    } catch {
      // Text was not valid JSON — this is common when grounding is active
    }

    // Merge: prefer JSON results (more structured), augmented by grounding URLs
    if (jsonResults.length > 0) {
      return jsonResults;
    }

    // Fall back to grounding metadata results if no JSON was parseable
    if (groundingResults.length > 0) {
      return groundingResults;
    }

    // Nothing usable — return empty array (expected for small/obscure companies)
    return [];
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Search for recent news about a company using Google Search grounding.
   * Returns an array of structured results; empty array if the company is small
   * or has no recent coverage.
   */
  async searchCompanyNews(companyName: string): Promise<SearchResult[]> {
    const prompt =
      `Find recent news about '${companyName}' from the last 12 months. ` +
      `Focus on: funding rounds, acquisitions, product launches, partnerships, leadership changes. ` +
      `Return as structured JSON array with fields: title, url, text, publishedDate.`;

    return this.runSearch(prompt);
  }

  /**
   * Search for culture signals, employee reviews, and workplace information.
   * Returns an array of structured results; empty array when nothing is found.
   */
  async searchCompanyCulture(companyName: string): Promise<SearchResult[]> {
    const prompt =
      `Find employee reviews, culture signals, and workplace information about '${companyName}'. ` +
      `Search Glassdoor, LinkedIn, and company careers pages. ` +
      `Return as structured JSON array with fields: title, url, text.`;

    return this.runSearch(prompt);
  }
}
