// ─── POST /api/match — matching prompt helpers ───────────────────────────────

export const MATCHING_SYSTEM = `You are an expert career coach reviewing a candidate's example bank against a job specification.`;

// ─── Match explanation ────────────────────────────────────────────────────────

export interface PairForExplanation {
  index: number;
  question: string;
  answer: string;
  score: number;
}

export function buildExplanationUserMessage(
  jobSpecSummary: string,
  pairs: PairForExplanation[]
): string {
  const pairsText = pairs
    .map(
      p =>
        `[${p.index}] Score: ${Math.round(p.score * 100)}%\nQ: ${p.question}\nA: ${p.answer}`
    )
    .join('\n\n');

  return `Job specification summary:\n${jobSpecSummary}\n\nFor each matched example below, write one sentence (max 20 words) explaining why it matches the job spec. Be specific — mention what requirement it maps to.\n\n${pairsText}`;
}

export const EXPLANATION_SCHEMA = {
  name: 'match_explanations',
  description: 'One-sentence explanation of why each example matches the job spec',
  parameters: {
    type: 'object',
    properties: {
      explanations: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            index: { type: 'number' },
            explanation: { type: 'string' },
          },
          required: ['index', 'explanation'],
        },
      },
    },
    required: ['explanations'],
  },
};

// ─── Gap analysis ─────────────────────────────────────────────────────────────

export function buildGapAnalysisUserMessage(
  jobSpec: string,
  matchedQuestions: string[]
): string {
  const matchedList =
    matchedQuestions.length > 0
      ? matchedQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')
      : 'None';

  return `Job specification:\n${jobSpec}\n\nThe candidate already has strong examples covering these interview topics:\n${matchedList}\n\nIdentify key requirements or competencies from the job spec that are NOT well-covered by the matched examples. Return only genuine gaps — skills or experiences that the job requires but the candidate has no evident story for. Do not flag requirements already covered.`;
}

export const GAP_ANALYSIS_SCHEMA = {
  name: 'gap_analysis',
  description: 'Key requirements in the job spec not covered by matched examples',
  parameters: {
    type: 'object',
    properties: {
      job_spec_summary: {
        type: 'string',
        description: 'One-paragraph summary of the role and its key requirements (max 80 words)',
      },
      gaps: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            requirement: {
              type: 'string',
              description: 'The specific requirement from the job spec (max 10 words)',
            },
            gap_description: {
              type: 'string',
              description: 'Why this is a gap and what story to prepare (max 30 words)',
            },
          },
          required: ['requirement', 'gap_description'],
        },
      },
    },
    required: ['job_spec_summary', 'gaps'],
  },
};
