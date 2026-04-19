/**
 * Best-effort heuristic: extract the company homepage URL from a job URL or
 * company name.
 *
 * Examples:
 *   https://boards.greenhouse.io/airbox/jobs/123 → https://airbox.com
 *   https://jobs.lever.co/stripe/abc            → https://stripe.com
 *   https://careers.monzo.com/jobs/123          → https://monzo.com
 *   "Airbox"                                    → https://airbox.com
 */
export function extractCompanyUrl(
  jobUrl: string | null,
  companyName: string
): string | null {
  if (jobUrl) {
    try {
      const url = new URL(jobUrl);
      const host = url.hostname;

      // Known ATS path-based patterns: slug is in the URL path
      const atsPathPatterns = [
        /boards\.greenhouse\.io\/([^/]+)/,
        /jobs\.lever\.co\/([^/]+)/,
        /apply\.workable\.com\/([^/]+)/,
      ];

      for (const pattern of atsPathPatterns) {
        const match = jobUrl.match(pattern);
        if (match?.[1]) {
          const slug = match[1].toLowerCase().replace(/[^a-z0-9-]/g, '');
          if (slug) return `https://${slug}.com`;
        }
      }

      // Known ATS subdomain patterns: company slug is the subdomain
      const atsSubdomainPatterns = [
        /^([^.]+)\.greenhouse\.io$/,
        /^([^.]+)\.workable\.com$/,
        /^([^.]+)\.lever\.co$/,
        /^([^.]+)\.bamboohr\.com$/,
        /^([^.]+)\.recruitee\.com$/,
      ];

      for (const pattern of atsSubdomainPatterns) {
        const match = host.match(pattern);
        if (match?.[1]) {
          const slug = match[1].toLowerCase().replace(/[^a-z0-9-]/g, '');
          if (slug) return `https://${slug}.com`;
        }
      }

      // For direct company career sites (e.g. careers.airbox.com/jobs/123),
      // strip known career-path subdomains and return the root domain
      const careerSubdomains = ['careers', 'jobs', 'apply', 'hire', 'talent', 'work'];
      const parts = host.split('.');
      if (parts.length > 2 && careerSubdomains.includes(parts[0])) {
        const rootDomain = parts.slice(1).join('.');
        return `https://${rootDomain}`;
      }

      // For a direct company domain, return its root
      return `${url.protocol}//${url.host}`;
    } catch {
      // jobUrl was not a valid URL — fall through to company name heuristic
    }
  }

  // Fallback: construct from company name
  if (companyName) {
    const slug = companyName.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
    if (slug) return `https://${slug}.com`;
  }

  return null;
}
