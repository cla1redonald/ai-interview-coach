// Pass 1 — Extract Q&A pairs from a numbered transcript.
// Returns structured JSON via tool_use / generateObject.

export const EXTRACTION_PASS1_SYSTEM = `You are an expert at extracting structured Q&A pairs from interview transcripts.

You will be given an interview transcript with prepended line numbers in the format [NNN].

Your task:
1. Identify speaker turns — distinguish the INTERVIEWER from the CANDIDATE.
2. Group turns into Q&A pairs: one interviewer question paired with the candidate's answer that directly follows.
3. Handle messy auto-transcription gracefully:
   - Ignore filler words (um, uh, like, you know) but preserve the candidate's actual content
   - Correct obvious speaker misattribution if context makes the true speaker clear
   - If an answer continues after an interviewer interjection, keep the full answer together
4. For EVERY pair you extract, cite the exact line numbers from the transcript using source_start_line and source_end_line.
   - source_start_line: the line where the QUESTION begins
   - source_end_line: the last line of the ANSWER
5. Clean up the extracted text: remove filler words, fix obvious transcription errors, but preserve the candidate's real words and meaning.
6. If you cannot identify clear Q&A structure (e.g. very short transcript, no interviewer), return an empty pairs array.

Output ONLY the structured data — no commentary or preamble.`;

export const EXTRACTION_PASS1_SCHEMA = {
  name: 'extract_qa_pairs',
  description: 'Extract structured Q&A pairs from an interview transcript',
  parameters: {
    type: 'object',
    properties: {
      pairs: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            question: {
              type: 'string',
              description: 'The interviewer question, cleaned of filler words',
            },
            answer: {
              type: 'string',
              description: 'The candidate answer, cleaned of filler words but preserving meaning',
            },
            source_start_line: {
              type: 'number',
              description: 'Line number where the question begins',
            },
            source_end_line: {
              type: 'number',
              description: 'Line number where the answer ends',
            },
          },
          required: ['question', 'answer', 'source_start_line', 'source_end_line'],
        },
      },
    },
    required: ['pairs'],
  },
} as const;

export function buildPass1UserMessage(numberedTranscript: string): string {
  return `Extract Q&A pairs from this interview transcript:\n\n${numberedTranscript}`;
}

/**
 * Prepend line numbers to raw transcript text.
 * Format: [001] First line\n[002] Second line\n...
 */
export function prependLineNumbers(rawText: string): string {
  const lines = rawText.split('\n');
  return lines
    .map((line, i) => {
      const num = String(i + 1).padStart(3, '0');
      return `[${num}] ${line}`;
    })
    .join('\n');
}
