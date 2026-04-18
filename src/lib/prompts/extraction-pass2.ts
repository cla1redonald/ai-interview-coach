// Pass 2 — Verify and correct extracted Q&A pairs.
// Returns ONLY corrections and warnings, not the full set.

export const EXTRACTION_PASS2_SYSTEM = `You are an expert at verifying extracted Q&A pairs from interview transcripts.

You will be given:
1. The original numbered interview transcript
2. Q&A pairs extracted in Pass 1 (as a JSON array with index numbers starting at 0)

Your task is to identify problems with the extraction. Check each pair for:

**Misattributed turns**: Is what's labelled as a "question" actually a candidate answer? Is what's labelled as an "answer" actually an interviewer statement?

**Incomplete answers**: Is the answer cut off mid-thought? Does the transcript show the candidate continued speaking but the answer was truncated?

**Split answers**: Was one continuous answer incorrectly split into two separate pairs?

**Wrong line citations**: Do the source_start_line and source_end_line actually correspond to the right content in the transcript?

**Return ONLY corrections** — do not re-state pairs that are correct. If everything looks correct, return an empty corrections array.

Output ONLY the structured data — no commentary or preamble.`;

export const EXTRACTION_PASS2_SCHEMA = {
  name: 'verify_qa_pairs',
  description: 'Return corrections for any problematic Q&A pairs',
  parameters: {
    type: 'object',
    properties: {
      corrections: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            index: {
              type: 'number',
              description: 'Zero-based index of the pair to correct',
            },
            issue: {
              type: 'string',
              description: 'Brief description of the problem found',
            },
            corrected_question: {
              type: 'string',
              description: 'Corrected question text (omit if question is fine)',
            },
            corrected_answer: {
              type: 'string',
              description: 'Corrected answer text (omit if answer is fine)',
            },
            corrected_start_line: {
              type: 'number',
              description: 'Corrected source_start_line (omit if correct)',
            },
            corrected_end_line: {
              type: 'number',
              description: 'Corrected source_end_line (omit if correct)',
            },
            remove: {
              type: 'boolean',
              description: 'Set to true if this pair should be removed entirely (e.g. it is not a real Q&A)',
            },
          },
          required: ['index', 'issue'],
        },
      },
      warnings: {
        type: 'array',
        items: { type: 'string' },
        description: 'General warnings about the transcript quality or extraction limitations',
      },
    },
    required: ['corrections', 'warnings'],
  },
} as const;

export interface RawPair {
  question: string;
  answer: string;
  source_start_line: number;
  source_end_line: number;
}

export function buildPass2UserMessage(
  numberedTranscript: string,
  pairs: RawPair[]
): string {
  const pairsJson = JSON.stringify(
    pairs.map((p, i) => ({ index: i, ...p })),
    null,
    2
  );
  return `Original transcript:\n\n${numberedTranscript}\n\n---\n\nExtracted pairs (verify these):\n\n${pairsJson}`;
}
