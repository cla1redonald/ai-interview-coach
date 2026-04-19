// Research Synthesis Prompt
// Takes raw data from Jina Reader, Companies House, and Gemini grounded search,
// and synthesises into a structured CompanyResearch object via callWithTool.

// ─── Constants ───────────────────────────────────────────────────────────────

const CHARS_PER_SCRAPED_PAGE = 3000;
const CHARS_COMPANIES_HOUSE = 1000;
const CHARS_PER_SEARCH_RESULT = 400;
const MAX_SEARCH_RESULTS_EACH = 5;
const CHARS_JOB_DESCRIPTION = 2000;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ResearchSynthesisInput {
  companyName: string;
  jobDescription: string;
  scrapedPages?: { url: string; markdown: string }[];
  companiesHouseData?: {
    profile?: object;
    filings?: object[];
  };
  searchResults?: {
    news: { title: string; url: string; text: string; publishedDate?: string }[];
    culture: { title: string; url: string; text: string }[];
  };
}

export interface ResearchSynthesisPrompt {
  system: string;
  user: string;
  toolSchema: {
    name: string;
    description: string;
    parameters: object;
  };
}

// ─── Tool schema ─────────────────────────────────────────────────────────────

const RESEARCH_SYNTHESIS_TOOL_SCHEMA = {
  name: 'save_research',
  description: 'Save structured company research',
  parameters: {
    type: 'object',
    properties: {
      companySize: {
        type: 'string',
        description: 'Employee count range, e.g. "51-200 employees"',
        nullable: true,
      },
      fundingStage: {
        type: 'string',
        description: 'e.g. "Series B", "Public", "Bootstrapped"',
        nullable: true,
      },
      revenue: {
        type: 'string',
        description: 'Revenue range, e.g. "£10-50M ARR"',
        nullable: true,
      },
      foundedYear: {
        type: 'string',
        description: 'e.g. "2019"',
        nullable: true,
      },
      headquarters: {
        type: 'string',
        description: 'e.g. "London, UK"',
        nullable: true,
      },
      industry: {
        type: 'string',
        description: 'e.g. "EdTech", "B2B SaaS"',
        nullable: true,
      },
      recentNews: {
        type: 'string',
        description: 'Markdown, 3-5 bullet points of recent news',
        nullable: true,
      },
      techStack: {
        type: 'string',
        description: 'Markdown, known technologies',
        nullable: true,
      },
      cultureSignals: {
        type: 'string',
        description: 'Markdown, workplace culture signals from reviews/careers pages',
        nullable: true,
      },
      keyPeople: {
        type: 'string',
        description: 'Markdown, CEO/CPO/hiring manager if found',
        nullable: true,
      },
      missionAndValues: {
        type: 'string',
        description: 'Markdown, company mission/purpose',
        nullable: true,
      },
    },
    required: [],
  },
} as const;

// ─── System prompt ────────────────────────────────────────────────────────────

const RESEARCH_SYNTHESIS_SYSTEM = `You are a company research analyst preparing a briefing for a senior professional evaluating a job opportunity.

Your task is to synthesise raw research data from multiple sources into a structured company profile.

Rules:
- If you lack data for a field, return null. Do not fabricate company details. Say "Insufficient data" rather than guessing.
- Write in a direct, factual style. No marketing language. State facts with sources where available (e.g. "per Companies House", "per job description", "per news article from [date]").
- Do not copy boilerplate marketing copy from company websites — extract facts only.
- For recentNews, prioritise concrete events: funding rounds, product launches, leadership changes, layoffs. Skip PR fluff.
- For cultureSignals, cite specific signals (e.g. "Glassdoor 3.8/5", "mentions flexible working in JD", "engineering blog active since 2023"). Do not characterise culture from brand copy alone.
- For keyPeople, only include names you found in the data. Do not guess from job titles.
- Numbers matter: if you have a headcount figure, include it. If you have a revenue range from a press release, include it with the source date.

Output ONLY the structured data via the save_research tool. No preamble or commentary.`;

// ─── User message builder ─────────────────────────────────────────────────────

function buildScrapedPagesSection(
  pages: { url: string; markdown: string }[]
): string {
  if (pages.length === 0) return '';
  const formatted = pages
    .map((p, i) => {
      const truncated = p.markdown.slice(0, CHARS_PER_SCRAPED_PAGE);
      const wasTruncated = p.markdown.length > CHARS_PER_SCRAPED_PAGE;
      return `[Page ${i + 1}] ${p.url}\n${truncated}${wasTruncated ? '\n[... truncated]' : ''}`;
    })
    .join('\n\n---\n\n');
  return `## Scraped Website Content\n\n${formatted}`;
}

function buildCompaniesHouseSection(
  data: { profile?: object; filings?: object[] }
): string {
  const raw = JSON.stringify(data);
  const truncated = raw.slice(0, CHARS_COMPANIES_HOUSE);
  const wasTruncated = raw.length > CHARS_COMPANIES_HOUSE;
  return `## Companies House Data\n\n${truncated}${wasTruncated ? '\n[... truncated]' : ''}`;
}

function buildSearchResultsSection(searchResults: {
  news: { title: string; url: string; text: string; publishedDate?: string }[];
  culture: { title: string; url: string; text: string }[];
}): string {
  const sections: string[] = [];

  const newsResults = searchResults.news.slice(0, MAX_SEARCH_RESULTS_EACH);
  if (newsResults.length > 0) {
    const formatted = newsResults
      .map((r, i) => {
        const truncated = r.text.slice(0, CHARS_PER_SEARCH_RESULT);
        const wasTruncated = r.text.length > CHARS_PER_SEARCH_RESULT;
        const dateStr = r.publishedDate ? ` (${r.publishedDate})` : '';
        return `[News ${i + 1}] ${r.title}${dateStr}\nURL: ${r.url}\n${truncated}${wasTruncated ? ' [...]' : ''}`;
      })
      .join('\n\n');
    sections.push(`### News Results\n\n${formatted}`);
  }

  const cultureResults = searchResults.culture.slice(0, MAX_SEARCH_RESULTS_EACH);
  if (cultureResults.length > 0) {
    const formatted = cultureResults
      .map((r, i) => {
        const truncated = r.text.slice(0, CHARS_PER_SEARCH_RESULT);
        const wasTruncated = r.text.length > CHARS_PER_SEARCH_RESULT;
        return `[Culture ${i + 1}] ${r.title}\nURL: ${r.url}\n${truncated}${wasTruncated ? ' [...]' : ''}`;
      })
      .join('\n\n');
    sections.push(`### Culture Results\n\n${formatted}`);
  }

  if (sections.length === 0) return '';
  return `## Search Results\n\n${sections.join('\n\n')}`;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Build the system prompt, user message, and tool schema for the research
 * synthesis call. Pass the returned values directly to callWithTool<T>().
 */
export function buildResearchSynthesisPrompt(
  input: ResearchSynthesisInput
): ResearchSynthesisPrompt {
  const {
    companyName,
    jobDescription,
    scrapedPages = [],
    companiesHouseData,
    searchResults,
  } = input;

  const jdTruncated = jobDescription.slice(0, CHARS_JOB_DESCRIPTION);
  const jdWasTruncated = jobDescription.length > CHARS_JOB_DESCRIPTION;

  const sections: string[] = [
    `# Research Synthesis Request\n\nCompany: **${companyName}**`,
    `## Job Description\n\n${jdTruncated}${jdWasTruncated ? '\n[... truncated]' : ''}`,
  ];

  if (scrapedPages.length > 0) {
    sections.push(buildScrapedPagesSection(scrapedPages));
  }

  if (companiesHouseData) {
    sections.push(buildCompaniesHouseSection(companiesHouseData));
  }

  if (searchResults) {
    const searchSection = buildSearchResultsSection(searchResults);
    if (searchSection) {
      sections.push(searchSection);
    }
  }

  sections.push(
    `## Instructions\n\nUsing all the data above, populate the save_research tool with what you can reliably establish about ${companyName}. Return null for any field where you do not have a credible data source. Do not invent facts.`
  );

  const user = sections.join('\n\n');

  return {
    system: RESEARCH_SYNTHESIS_SYSTEM,
    user,
    toolSchema: RESEARCH_SYNTHESIS_TOOL_SCHEMA,
  };
}
