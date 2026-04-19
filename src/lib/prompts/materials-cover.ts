// Cover letter prompt — generates a three-paragraph, hook-driven cover letter.
// Anti-slop blocklist and anti-fabrication are primary constraints.

export interface CoverLetterCompanyResearch {
  recentNews?: string;
  cultureSignals?: string;
  missionAndValues?: string;
  fundingStage?: string;
  industry?: string;
}

export interface CoverLetterFitAssessment {
  greenFlags: string[];
  archetype: string;
}

export interface CoverLetterExample {
  id: string;
  question: string;
  answer: string;
  tags: string[];
}

export interface BuildCoverLetterPromptInput {
  companyResearch: CoverLetterCompanyResearch | null;
  fitAssessment: CoverLetterFitAssessment;
  examples: CoverLetterExample[];
  jobDescription: string;
  companyName: string;
  jobTitle: string;
}

export interface CoverLetterPromptResult {
  system: string;
  user: string;
  toolSchema: object;
}

// ─── Token budget constants ───────────────────────────────────────────────────

const RESEARCH_FIELD_MAX_CHARS = 500;
const EXAMPLE_ANSWER_MAX_CHARS = 800;
const JOB_DESCRIPTION_MAX_CHARS = 2000;
const MAX_EXAMPLES = 5;

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + '\n[...truncated]';
}

// ─── System prompt ────────────────────────────────────────────────────────────

const COVER_LETTER_SYSTEM = `You are a cover letter writer for senior professionals applying to specific roles.

Write a three-paragraph cover letter structured as follows:

1. Opening hook tied to a specific company insight from the research (not generic). Reference a real event, announcement, or company characteristic. If company research is null, skip the company-specific hook and lead with the role's requirements instead.

2. Two proof points from the example bank, mapped directly to job requirements. Each proof point must cite a specific achievement with a concrete outcome.

3. Forward-looking close with a specific contribution statement tied to the role's challenges. One paragraph, 2-3 sentences.

ANTI-SLOP BLOCKLIST — Do NOT use any of these phrases. If you find yourself using one, rewrite the sentence with specific facts instead:
- "I am writing to express my interest"
- "leverage my experience"
- "synergize"
- "passionate about"
- "cutting-edge"
- "dynamic environment"
- "proven track record"
- "seasoned professional"
- "hit the ground running"
- "think outside the box"
- "results-driven"
- "self-starter"
- "team player"

Anti-fabrication rule: Only reference achievements present in the examples. Do not invent outcomes or metrics.

Format: Plain prose, no headers, no bullet points. Address to "Hiring Manager" unless a name is provided. Aim for 250-350 words total.`;

// ─── Tool schema ──────────────────────────────────────────────────────────────

const COVER_LETTER_TOOL_SCHEMA = {
  name: 'save_cover_letter',
  input_schema: {
    type: 'object',
    properties: {
      content: {
        type: 'string',
        description: 'Full cover letter in markdown',
      },
      companyHooksUsed: {
        type: 'array',
        items: { type: 'string' },
        description: 'Company-specific insights referenced',
      },
      exampleIdsUsed: {
        type: 'array',
        items: { type: 'string' },
        description: 'IDs of examples used as proof points',
      },
    },
    required: ['content', 'exampleIdsUsed'],
  },
};

// ─── Builder ──────────────────────────────────────────────────────────────────

export function buildCoverLetterPrompt(input: BuildCoverLetterPromptInput): CoverLetterPromptResult {
  const {
    companyResearch,
    fitAssessment,
    examples,
    jobDescription,
    companyName,
    jobTitle,
  } = input;

  // Apply token budget
  const truncatedJd = truncate(jobDescription, JOB_DESCRIPTION_MAX_CHARS);
  const cappedExamples = examples.slice(0, MAX_EXAMPLES);

  // Format company research section
  let researchSection: string;
  if (companyResearch === null) {
    researchSection = '## Company Research\n\n[NOT PROVIDED — lead with role requirements in paragraph 1]';
  } else {
    const fields: string[] = [];
    if (companyResearch.industry) {
      fields.push(`Industry: ${companyResearch.industry}`);
    }
    if (companyResearch.fundingStage) {
      fields.push(`Funding stage: ${companyResearch.fundingStage}`);
    }
    if (companyResearch.missionAndValues) {
      fields.push(`Mission & values:\n${truncate(companyResearch.missionAndValues, RESEARCH_FIELD_MAX_CHARS)}`);
    }
    if (companyResearch.cultureSignals) {
      fields.push(`Culture signals:\n${truncate(companyResearch.cultureSignals, RESEARCH_FIELD_MAX_CHARS)}`);
    }
    if (companyResearch.recentNews) {
      fields.push(`Recent news:\n${truncate(companyResearch.recentNews, RESEARCH_FIELD_MAX_CHARS)}`);
    }

    researchSection = fields.length > 0
      ? `## Company Research\n\n${fields.join('\n\n')}`
      : '## Company Research\n\n[No specific research available — lead with role requirements in paragraph 1]';
  }

  // Format green flags
  const greenFlagsStr = fitAssessment.greenFlags.length > 0
    ? fitAssessment.greenFlags.map(f => `- ${f}`).join('\n')
    : '- None identified';

  // Format examples
  const examplesSection = cappedExamples.length > 0
    ? cappedExamples
        .map(ex => {
          const truncatedAnswer = truncate(ex.answer, EXAMPLE_ANSWER_MAX_CHARS);
          const tagsStr = ex.tags.length > 0 ? `Tags: ${ex.tags.join(', ')}` : '';
          return `### Example [${ex.id}]${tagsStr ? `\n${tagsStr}` : ''}\nQ: ${ex.question}\nA: ${truncatedAnswer}`;
        })
        .join('\n\n')
    : '[NO EXAMPLES PROVIDED]';

  const user = `Write a cover letter for the following application.

## Target Role
Company: ${companyName}
Title: ${jobTitle}
Candidate archetype for this role: ${fitAssessment.archetype}

## Job Description
${truncatedJd}

---

${researchSection}

---

## Fit Assessment — Green Flags
${greenFlagsStr}

---

## Example Bank (${cappedExamples.length} examples — use up to 2 as proof points)

${examplesSection}`;

  return {
    system: COVER_LETTER_SYSTEM,
    user,
    toolSchema: COVER_LETTER_TOOL_SCHEMA,
  };
}
