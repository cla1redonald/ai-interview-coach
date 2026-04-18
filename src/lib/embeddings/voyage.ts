const VOYAGE_API_URL = 'https://api.voyageai.com/v1/embeddings';
const VOYAGE_MODEL = 'voyage-3';
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

interface VoyageResponse {
  data: Array<{ embedding: number[]; index: number }>;
  model: string;
  usage: { total_tokens: number };
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(
  inputs: string[],
  inputType: 'document' | 'query'
): Promise<number[][]> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) {
    throw new Error('VOYAGE_API_KEY is not set');
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
      await sleep(delay);
    }

    try {
      const response = await fetch(VOYAGE_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: VOYAGE_MODEL,
          input: inputs,
          input_type: inputType,
        }),
      });

      if (response.status === 429) {
        // Rate limited — always retry
        lastError = new Error('Voyage AI rate limit hit');
        continue;
      }

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Voyage AI API error ${response.status}: ${text}`);
      }

      const json: VoyageResponse = await response.json();
      // Sort by index to ensure correct order
      const sorted = json.data.sort((a, b) => a.index - b.index);
      return sorted.map(d => d.embedding);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt === MAX_RETRIES - 1) {
        throw lastError;
      }
    }
  }

  throw lastError ?? new Error('Voyage AI request failed after retries');
}

/**
 * Generate a single embedding from Voyage AI.
 * Input format: "Q: [question]\nA: [answer]" for examples, or raw text for queries.
 */
export async function generateEmbedding(
  text: string,
  inputType: 'document' | 'query' = 'document'
): Promise<number[]> {
  const results = await fetchWithRetry([text], inputType);
  return results[0];
}

/**
 * Generate embeddings for multiple texts in batches.
 * Voyage AI free tier: 2 RPS — batching reduces request count.
 */
export async function generateBatchEmbeddings(
  texts: string[],
  inputType: 'document' | 'query' = 'document',
  batchSize: number = 8
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const embeddings = await fetchWithRetry(batch, inputType);
    allEmbeddings.push(...embeddings);

    // Respect 2 RPS free tier — add delay between batches (not after last)
    if (i + batchSize < texts.length) {
      await sleep(600);
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
