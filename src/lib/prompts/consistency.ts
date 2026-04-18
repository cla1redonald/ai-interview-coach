// Extract consistency claims from Q&A pairs.
// Tracks: compensation, reasons for leaving, start date availability, role scope.

export type ConsistencyTopic = 'compensation' | 'leaving_reason' | 'start_date' | 'role_scope';

export const CONSISTENCY_TOPICS: ConsistencyTopic[] = [
  'compensation',
  'leaving_reason',
  'start_date',
  'role_scope',
];

export const CONSISTENCY_SYSTEM = `You are an expert at extracting factual claims that candidates make during job interviews, specifically claims that could be cross-checked for consistency across different interviews.

You will be given one or more Q&A pairs, along with the company name for these interviews.

For each pair, look ONLY for explicit claims about these four topics:
1. **compensation** — any claim about current salary, salary expectations, target range, or minimum acceptable pay
2. **leaving_reason** — any claim about why the candidate is leaving or left their current/previous role
3. **start_date** — any claim about when the candidate could start, availability, or notice period length
4. **role_scope** — any explicit claim about the candidate's current role scope (team size, budget, P&L ownership, headcount managed)

Rules:
- Only extract EXPLICIT claims — not hints or implications
- Quote the actual claim briefly and precisely
- If a pair has no claims for these four topics, return null for that pair
- Do not extract general career story content — only the four tracked topics above

Output ONLY the structured data.`;

export const CONSISTENCY_SCHEMA = {
  name: 'extract_consistency_claims',
  description: 'Extract consistency-trackable claims from Q&A pairs',
  parameters: {
    type: 'object',
    properties: {
      results: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            index: {
              type: 'number',
              description: 'The pair index (matches the input array index)',
            },
            claims: {
              type: 'array',
              description: 'Explicit claims found in this pair, or empty array if none',
              items: {
                type: 'object',
                properties: {
                  topic: {
                    type: 'string',
                    enum: ['compensation', 'leaving_reason', 'start_date', 'role_scope'],
                  },
                  claim: {
                    type: 'string',
                    description: 'A brief precise quote or summary of the claim',
                  },
                },
                required: ['topic', 'claim'],
              },
            },
          },
          required: ['index', 'claims'],
        },
      },
    },
    required: ['results'],
  },
} as const;

export interface PairForConsistency {
  index: number;
  question: string;
  answer: string;
}

export function buildConsistencyUserMessage(
  pairs: PairForConsistency[],
  company: string | null
): string {
  const companyStr = company ? `Company: ${company}` : 'Company: unknown';
  const formatted = pairs
    .map(p => `[${p.index}] Q: ${p.question}\nA: ${p.answer}`)
    .join('\n\n');
  return `${companyStr}\n\nExtract consistency claims from these Q&A pairs:\n\n${formatted}`;
}
