/**
 * Markdown listing parser for batch job applications.
 *
 * Format:
 *   ## Head of Product — Moonpig
 *   https://example.com/job/123
 *   London / hybrid, £120-140k
 *
 *   ## Senior PM — Deliveroo
 *   Pasted job description here...
 *
 * Rules:
 *   - Each ## heading starts a new listing
 *   - Heading parsed as "JobTitle — Company" (em dash, en dash, or hyphen)
 *   - First body line: if it looks like a URL, stored as jobUrl
 *   - Remaining body: stored as jobDescription
 */

const URL_PATTERN = /^https?:\/\//;

export interface ParsedListing {
  jobTitle: string;
  companyName: string;
  jobUrl: string | null;
  jobDescription: string;
  salary: string | null;
  location: string | null;
}

/**
 * Parse a markdown string containing ## headings into structured job listings.
 * Returns an array of ParsedListing — the caller enforces any count limits.
 */
export function parseMarkdownListings(markdown: string): ParsedListing[] {
  const listings: ParsedListing[] = [];

  // Split on ## headings but keep the heading content
  const sections = markdown.split(/^##\s+/m).slice(1); // drop content before first ##

  for (const section of sections) {
    const lines = section.split('\n');
    const heading = (lines[0] ?? '').trim();

    // Parse "JobTitle — Company" — support em dash (—), en dash (–), plain hyphen (-)
    // The regex is greedy on the left so hyphenated role names are preserved.
    const separatorMatch = heading.match(/^(.+?)(?:\s+[—–-]\s+)(.+)$/);
    let jobTitle: string;
    let companyName: string;

    if (separatorMatch) {
      jobTitle = separatorMatch[1].trim();
      companyName = separatorMatch[2].trim();
    } else {
      // No separator found — use full heading as title, empty company
      jobTitle = heading;
      companyName = '';
    }

    if (!jobTitle) continue;

    // Process body lines (everything after the heading line)
    const bodyLines = lines.slice(1);

    let jobUrl: string | null = null;
    let salary: string | null = null;
    let location: string | null = null;

    // Walk body: first non-empty line may be a URL
    let bodyStart = 0;
    for (let i = 0; i < bodyLines.length; i++) {
      const line = bodyLines[i].trim();
      if (line === '') continue;

      if (URL_PATTERN.test(line) && jobUrl === null) {
        // First non-empty line is a URL — store as jobUrl
        jobUrl = line;
        bodyStart = i + 1;
      } else {
        // First non-empty non-URL line — start of job description
        bodyStart = i;
      }
      break;
    }

    // Process remaining lines — try to extract metadata from a short first line
    const remaining = bodyLines.slice(bodyStart);
    const descParts: string[] = [];

    for (const line of remaining) {
      const trimmed = line.trim();

      // Heuristic: short line with salary/location pattern before any description lines
      const hasSalaryPattern = /[£$€][\d,k\-\s]+/i.test(trimmed);
      const hasLocationPattern = /(remote|hybrid|on-site|london|manchester|edinburgh|leeds|bristol|new york|san francisco)/i.test(trimmed);
      const isMetadataCandidate = (hasSalaryPattern || hasLocationPattern) && trimmed.length < 120;

      if (!salary && !location && isMetadataCandidate && descParts.length === 0) {
        // Try to extract salary from this line
        const salaryMatch = trimmed.match(/[£$€][\d,k\-\s]+(?:per\s+annum|pa|p\.a\.|k)?/i);
        if (salaryMatch) salary = salaryMatch[0].trim();

        // Try to extract location (text before first comma, slash, or dash)
        const locationMatch = trimmed.match(/^([^,]+?)(?:,|\s*\/\s*|\s*-\s*)/);
        if (locationMatch) location = locationMatch[1].trim();
      } else {
        descParts.push(line);
      }
    }

    const jobDescription = descParts.join('\n').trim();

    listings.push({
      jobTitle,
      companyName,
      jobUrl,
      jobDescription,
      salary,
      location,
    });
  }

  return listings;
}
