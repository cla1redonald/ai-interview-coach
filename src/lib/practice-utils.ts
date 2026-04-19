export interface QAPair {
  question: string;
  answer: string;
  wordCount: number;
  autoSelected: boolean;
}

const FILLER_STARTS = [
  "i don't know",
  "i'm not sure",
  "i usually",
  "i haven't",
  "not really",
  "hmm",
];

/**
 * Extract Q&A pairs from a practice conversation.
 * Groups assistant questions with following user answers.
 * Filters to substantive answers only (>= 50 words).
 */
export function extractQAPairs(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
): QAPair[] {
  const pairs: QAPair[] = [];

  for (let i = 0; i < messages.length - 1; i++) {
    const msg = messages[i];
    const next = messages[i + 1];

    // Look for assistant message followed by user message
    if (msg.role === 'assistant' && next.role === 'user') {
      const answer = next.content.trim();
      const question = msg.content.trim();
      const wordCount = answer.split(/\s+/).filter(Boolean).length;

      // Skip the initial "Hello" user message and the feedback request
      if (answer.toLowerCase() === 'hello') continue;
      if (answer.toLowerCase().includes('how did i do')) continue;

      // Only include answers with >= 50 words
      if (wordCount < 50) continue;

      // Filter out error messages from the assistant
      if (question === 'Sorry, there was an error. Please try again.') continue;

      const lowerAnswer = answer.toLowerCase();
      const isFillerStart = FILLER_STARTS.some(f => lowerAnswer.startsWith(f));

      pairs.push({
        question,
        answer,
        wordCount,
        autoSelected: wordCount >= 50 && !isFillerStart,
      });
    }
  }

  return pairs;
}
