// Auto-tag Q&A pairs with 1-3 categories from the predefined taxonomy.

export const SYSTEM_TAG_NAMES = [
  'Tell me about yourself',
  'Why are you leaving?',
  'Why this role?',
  'Product strategy & prioritisation',
  'Delivery & execution',
  'OKRs & planning',
  'Stakeholder management & conflict',
  'Leadership style & team development',
  'AI adoption & hands-on experience',
  'Compensation expectations',
  'Technical depth',
  'Cross-functional / matrix working',
  'Research & discovery approach',
] as const;

export type SystemTagName = typeof SYSTEM_TAG_NAMES[number];

export const TAGGING_SYSTEM = `You are an expert at categorising interview Q&A pairs.

You will be given one or more Q&A pairs to categorise. For each pair, assign 1-3 tags from this exact list:

${SYSTEM_TAG_NAMES.map((t, i) => `${i + 1}. ${t}`).join('\n')}

Rules:
- Only use tag names from the list above — exact spelling and capitalisation
- Assign the most specific tag first
- Assign 1 tag minimum, 3 maximum
- If a pair genuinely spans multiple categories, use up to 3
- Do not invent new tags

Output ONLY the structured data.`;

export const TAGGING_SCHEMA = {
  name: 'tag_qa_pairs',
  description: 'Assign category tags to Q&A pairs',
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
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: '1-3 tag names from the taxonomy',
              minItems: 1,
              maxItems: 3,
            },
          },
          required: ['index', 'tags'],
        },
      },
    },
    required: ['results'],
  },
} as const;

export interface PairForTagging {
  index: number;
  question: string;
  answer: string;
}

export function buildTaggingUserMessage(pairs: PairForTagging[]): string {
  const formatted = pairs
    .map(p => `[${p.index}] Q: ${p.question}\nA: ${p.answer}`)
    .join('\n\n');
  return `Categorise these Q&A pairs:\n\n${formatted}`;
}
