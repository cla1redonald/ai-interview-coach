const OPENAI_API_URL = 'https://api.openai.com/v1/embeddings';
const OPENAI_MODEL = 'text-embedding-3-small';
const DIMENSIONS = 1024;
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

interface OpenAIEmbeddingResponse {
  data: Array<{ embedding: number[]; index: number }>;
  model: string;
  usage: { prompt_tokens: number; total_tokens: number };
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(inputs: string[]): Promise<number[][]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set');
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
      await sleep(delay);
    }

    try {
      const response = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          input: inputs,
          dimensions: DIMENSIONS,
        }),
      });

      if (response.status === 429) {
        lastError = new Error('OpenAI rate limit hit');
        continue;
      }

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`OpenAI API error ${response.status}: ${text}`);
      }

      const json: OpenAIEmbeddingResponse = await response.json();
      const sorted = json.data.sort((a, b) => a.index - b.index);
      return sorted.map(d => d.embedding);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt === MAX_RETRIES - 1) {
        throw lastError;
      }
    }
  }

  throw lastError ?? new Error('OpenAI embedding request failed after retries');
}

/**
 * Generate a single embedding from OpenAI.
 * Input format: "Q: [question]\nA: [answer]" for examples, or raw text for queries.
 * Note: inputType param kept for API compatibility but OpenAI doesn't distinguish document/query.
 */
export async function generateEmbedding(
  text: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  inputType: 'document' | 'query' = 'document'
): Promise<number[]> {
  const results = await fetchWithRetry([text]);
  return results[0];
}

/**
 * Generate embeddings for multiple texts in batches.
 * OpenAI supports up to 2048 inputs per request, but we batch conservatively.
 */
export async function generateBatchEmbeddings(
  texts: string[],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  inputType: 'document' | 'query' = 'document',
  batchSize: number = 8
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const embeddings = await fetchWithRetry(batch);
    allEmbeddings.push(...embeddings);

    if (i + batchSize < texts.length) {
      await sleep(200);
    }
  }

  return allEmbeddings;
}

/**
 * Format a Q&A pair into the canonical embedding input string.
 */
export function formatExampleForEmbedding(question: string, answer: string): string {
  return `Q: ${question}\nA: ${answer}`;
}
