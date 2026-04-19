/**
 * Service factory — lazy-initialised singleton getters for all external clients.
 * Each getter reads from environment variables at first call; throws if a
 * required key is missing rather than silently returning a broken client.
 */
import { CompaniesHouseClient } from './companies-house';
import { JinaReaderClient } from './jina-reader';
import { GeminiSearchClient } from './gemini-search';

export { CompaniesHouseClient } from './companies-house';
export type {
  CompanySearchResult,
  CompanyProfile,
  FilingEntry,
} from './companies-house';

export { JinaReaderClient } from './jina-reader';
export type {
  ScrapeResult,
  JobListingResult,
  CompanyPagesResult,
} from './jina-reader';

export { GeminiSearchClient } from './gemini-search';
export type { SearchResult } from './gemini-search';

// ---------------------------------------------------------------------------
// Module-level singletons (null until first use)
// ---------------------------------------------------------------------------

let _companiesHouse: CompaniesHouseClient | null = null;
let _jinaReader: JinaReaderClient | null = null;
let _geminiSearch: GeminiSearchClient | null = null;

// ---------------------------------------------------------------------------
// Factory getters
// ---------------------------------------------------------------------------

/**
 * Returns the shared CompaniesHouseClient instance.
 * Requires COMPANIES_HOUSE_API_KEY environment variable.
 */
export function getCompaniesHouseClient(): CompaniesHouseClient {
  if (!_companiesHouse) {
    const key = process.env.COMPANIES_HOUSE_API_KEY;
    if (!key) throw new Error('COMPANIES_HOUSE_API_KEY not set');
    _companiesHouse = new CompaniesHouseClient({
      apiKey: key,
      baseUrl: 'https://api.company-information.service.gov.uk',
    });
  }
  return _companiesHouse;
}

/**
 * Returns the shared JinaReaderClient instance.
 * JINA_API_KEY is optional — works without it at 20 RPM.
 */
export function getJinaReaderClient(): JinaReaderClient {
  if (!_jinaReader) {
    const key = process.env.JINA_API_KEY; // optional
    _jinaReader = new JinaReaderClient(key);
  }
  return _jinaReader;
}

/**
 * Returns the shared GeminiSearchClient instance.
 * Requires GEMINI_API_KEY environment variable.
 */
export function getGeminiSearchClient(): GeminiSearchClient {
  if (!_geminiSearch) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error('GEMINI_API_KEY not set');
    _geminiSearch = new GeminiSearchClient(key);
  }
  return _geminiSearch;
}
