/**
 * Companies House API client
 * Docs: https://developer-specs.company-information.service.gov.uk/
 * Auth: HTTP Basic Auth — API key as username, empty password
 * Rate limit: 2 requests per second
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CompanySearchResult {
  company_number: string;
  title: string;
  company_status: string;
  date_of_creation: string;
  address_snippet: string;
}

export interface CompanyProfile {
  company_number: string;
  company_name: string;
  type: string;
  company_status: string;
  date_of_creation: string;
  registered_office_address: Record<string, string>;
  sic_codes?: string[];
  accounts?: {
    next_due?: string;
    last_accounts?: { made_up_to: string; type: string };
  };
  confirmation_statement?: {
    next_due?: string;
    last_made_up_to?: string;
  };
}

export interface FilingEntry {
  date: string;
  description: string;
  type: string;
}

interface ClientConfig {
  apiKey: string;
  baseUrl: string;
}

// ---------------------------------------------------------------------------
// Rate limiter — token bucket capped at 2 req/s (500ms minimum interval)
// ---------------------------------------------------------------------------

class RateLimiter {
  private lastRequestTime = 0;
  private readonly minInterval = 500; // 2 req/sec = 500ms between requests

  async waitForSlot(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.minInterval) {
      await new Promise<void>((r) =>
        setTimeout(r, this.minInterval - elapsed)
      );
    }
    this.lastRequestTime = Date.now();
  }
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class CompaniesHouseClient {
  private readonly authHeader: string;
  private readonly baseUrl: string;
  private readonly rateLimiter = new RateLimiter();

  constructor({ apiKey, baseUrl }: ClientConfig) {
    this.authHeader =
      'Basic ' + Buffer.from(apiKey + ':').toString('base64');
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private buildHeaders(): HeadersInit {
    return {
      Authorization: this.authHeader,
      Accept: 'application/json',
    };
  }

  /**
   * Perform a rate-limited GET request.
   * Returns the parsed JSON body or null on non-fatal errors (404, 5xx).
   * Retries once on 429 after a 1s delay.
   */
  private async get<T>(path: string, attempt = 1): Promise<T | null> {
    await this.rateLimiter.waitForSlot();

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        headers: this.buildHeaders(),
      });
    } catch (err) {
      console.warn(`[CompaniesHouseClient] Network error on ${path}:`, err);
      return null;
    }

    if (response.ok) {
      return (await response.json()) as T;
    }

    if (response.status === 404) {
      // Not found — not an error, just no result
      return null;
    }

    if (response.status === 429 && attempt === 1) {
      // Rate-limited — wait 1s and retry once
      await new Promise<void>((r) => setTimeout(r, 1000));
      return this.get<T>(path, 2);
    }

    if (response.status >= 500) {
      console.warn(
        `[CompaniesHouseClient] Server error ${response.status} on ${path}`
      );
      return null;
    }

    console.warn(
      `[CompaniesHouseClient] Unexpected status ${response.status} on ${path}`
    );
    return null;
  }

  // -------------------------------------------------------------------------
  // Public API methods
  // -------------------------------------------------------------------------

  /**
   * Search for companies by name. Returns up to 5 results.
   */
  async searchCompany(name: string): Promise<CompanySearchResult[]> {
    const encoded = encodeURIComponent(name);
    const data = await this.get<{
      items?: CompanySearchResult[];
    }>(`/search/companies?q=${encoded}&items_per_page=5`);

    return data?.items ?? [];
  }

  /**
   * Fetch the full profile for a company by its Companies House number.
   * Returns null if not found or on error.
   */
  async getCompanyProfile(
    companyNumber: string
  ): Promise<CompanyProfile | null> {
    return this.get<CompanyProfile>(`/company/${companyNumber}`);
  }

  /**
   * Fetch recent filing history for a company.
   * Returns up to `limit` entries (default 5).
   */
  async getFilingHistory(
    companyNumber: string,
    limit = 5
  ): Promise<FilingEntry[]> {
    const data = await this.get<{ items?: FilingEntry[] }>(
      `/company/${companyNumber}/filing-history?items_per_page=${limit}`
    );

    return data?.items ?? [];
  }
}
