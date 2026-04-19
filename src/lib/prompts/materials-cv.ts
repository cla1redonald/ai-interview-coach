// CV tailoring prompt — generates a tailored CV from a master CV + example bank.
// Anti-fabrication is the primary constraint: only use what is explicitly present.

export interface CvExample {
  id: string;
  question: string;
  answer: string;
  tags: string[];
  qualityRating?: string;
}

export interface CvFitAssessment {
  archetype: string;
  greenFlags: string[];
  overallScore: number;
}

export interface BuildCvPromptInput {
  masterCv?: string;
  examples: CvExample[];
  jobDescription: string;
  fitAssessment: CvFitAssessment;
  companyName: string;
  jobTitle: string;
}

export interface CvPromptResult {
  system: string;
  user: string;
  toolSchema: object;
}

// ─── Token budget constants ───────────────────────────────────────────────────

const MASTER_CV_MAX_CHARS = 4000;
const EXAMPLE_ANSWER_MAX_CHARS = 800;
const JOB_DESCRIPTION_MAX_CHARS = 2000;
const MAX_EXAMPLES = 10;

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + '\n[...truncated]';
}

// ─── System prompt ────────────────────────────────────────────────────────────

const CV_SYSTEM = `You are a CV tailoring specialist for senior professionals (Director/VP/C-level).

ANTI-FABRICATION — THIS IS THE MOST IMPORTANT INSTRUCTION:
You may ONLY use roles, companies, dates, titles, and achievements that are explicitly present in the master CV template or the provided examples. Do NOT add, imply, infer, or extrapolate any experience that is not explicitly stated. If you cannot improve a section with available data, leave it as-is from the master CV. NEVER invent quantified achievements, metrics, or outcomes.

Tailoring rules:
- Reorder and emphasise sections relevant to this role. De-prioritise irrelevant sections — move them lower, do not remove them.
- Where examples contain stronger phrasing or quantified outcomes for an existing bullet, replace that bullet with language drawn directly from the example. Cite the example ID in the exampleIdsUsed output.
- If no master CV is provided, construct from examples only. Add a warning note at the top: "[Note: Generated from example bank only — review carefully]"

Writing style:
- Write in a direct, professional voice. No "dynamic leader", "passionate about", "leveraged expertise".
- Every bullet must contain a concrete fact, number, or outcome from the source material.
- Use past tense for previous roles, present tense for current role.
- Keep bullets to one line where possible; two lines maximum.`;

// ─── Tool schema ──────────────────────────────────────────────────────────────

const CV_TOOL_SCHEMA = {
  name: 'save_cv',
  input_schema: {
    type: 'object',
    properties: {
      content: {
        type: 'string',
        description: 'Full CV in markdown format',
      },
      sectionsReordered: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of sections that were reordered or emphasised',
      },
      exampleIdsUsed: {
        type: 'array',
        items: { type: 'string' },
        description: 'IDs of examples used in bullet points',
      },
      warnings: {
        type: 'array',
        items: { type: 'string' },
        description: 'Any warnings about the generation',
      },
    },
    required: ['content', 'exampleIdsUsed'],
  },
};

// ─── Builder ──────────────────────────────────────────────────────────────────

export function buildCvPrompt(input: BuildCvPromptInput): CvPromptResult {
  const {
    masterCv,
    examples,
    jobDescription,
    fitAssessment,
    companyName,
    jobTitle,
  } = input;

  // Apply token budget
  const truncatedCv = masterCv ? truncate(masterCv, MASTER_CV_MAX_CHARS) : null;
  const truncatedJd = truncate(jobDescription, JOB_DESCRIPTION_MAX_CHARS);
  const cappedExamples = examples.slice(0, MAX_EXAMPLES);

  // Format master CV section
  const cvSection = truncatedCv
    ? `## Master CV\n\n${truncatedCv}`
    : '## Master CV\n\n[NOT PROVIDED — generate from example bank only]';

  // Format examples
  const examplesSection = cappedExamples.length > 0
    ? cappedExamples
        .map(ex => {
          const truncatedAnswer = truncate(ex.answer, EXAMPLE_ANSWER_MAX_CHARS);
          const tagsStr = ex.tags.length > 0 ? `Tags: ${ex.tags.join(', ')}` : '';
          const ratingStr = ex.qualityRating ? `Quality: ${ex.qualityRating}` : '';
          const meta = [tagsStr, ratingStr].filter(Boolean).join(' | ');
          return `### Example [${ex.id}]${meta ? `\n${meta}` : ''}\nQ: ${ex.question}\nA: ${truncatedAnswer}`;
        })
        .join('\n\n')
    : '[NO EXAMPLES PROVIDED]';

  // Format fit assessment
  const greenFlagsStr = fitAssessment.greenFlags.length > 0
    ? fitAssessment.greenFlags.map(f => `- ${f}`).join('\n')
    : '- None identified';

  const user = `Tailor the master CV below for the following role.

## Target Role
Company: ${companyName}
Title: ${jobTitle}
Fit score: ${fitAssessment.overallScore}/100
Candidate archetype for this role: ${fitAssessment.archetype}

## Green Flags (emphasise these)
${greenFlagsStr}

## Job Description
${truncatedJd}

---

${cvSection}

---

## Example Bank (${cappedExamples.length} examples)

${examplesSection}`;

  return {
    system: CV_SYSTEM,
    user,
    toolSchema: CV_TOOL_SCHEMA,
  };
}
