import { Index } from '@upstash/vector';

function getVectorIndex(): Index {
  const url = process.env.UPSTASH_VECTOR_REST_URL;
  const token = process.env.UPSTASH_VECTOR_REST_TOKEN;
  if (!url || !token) {
    throw new Error('UPSTASH_VECTOR_REST_URL and UPSTASH_VECTOR_REST_TOKEN must be set');
  }
  return new Index({ url, token });
}

/**
 * Upsert an example's embedding into Upstash Vector.
 * Key = example.id, metadata = { userId } for per-user filtering.
 */
export async function upsertExampleVector(
  exampleId: string,
  userId: string,
  embedding: number[]
): Promise<void> {
  const index = getVectorIndex();
  await index.upsert({
    id: exampleId,
    vector: embedding,
    metadata: { userId },
  });
}

/**
 * Query Upstash Vector for similar examples owned by a specific user.
 */
export async function queryUserVectors(
  queryEmbedding: number[],
  userId: string,
  topK: number = 10,
  scoreThreshold: number = 0.5
): Promise<{ id: string; score: number }[]> {
  const index = getVectorIndex();
  const results = await index.query({
    vector: queryEmbedding,
    topK,
    includeMetadata: true,
    filter: `userId = '${userId}'`,
  });
  return results
    .filter(r => r.score >= scoreThreshold)
    .map(r => ({ id: String(r.id), score: r.score }));
}

/**
 * Delete a vector when its example is deleted.
 */
export async function deleteExampleVector(exampleId: string): Promise<void> {
  const index = getVectorIndex();
  await index.delete(exampleId);
}

/**
 * Batch fetch vectors by example IDs (for mirror analysis clustering).
 */
export async function batchFetchVectors(
  exampleIds: string[]
): Promise<Array<{ id: string; vector: number[] | null }>> {
  if (exampleIds.length === 0) return [];
  const index = getVectorIndex();
  const results = await index.fetch(exampleIds, { includeVectors: true });
  return results.map((r, i) => ({
    id: exampleIds[i],
    vector: r?.vector ?? null,
  }));
}

/**
 * Check which example IDs have vectors in Upstash (for backfill).
 * Returns the set of IDs that already have embeddings.
 */
export async function fetchExistingVectorIds(
  exampleIds: string[]
): Promise<Set<string>> {
  if (exampleIds.length === 0) return new Set();
  const index = getVectorIndex();
  const results = await index.fetch(exampleIds, { includeVectors: false });
  const existing = new Set<string>();
  results.forEach((r, i) => {
    if (r !== null) {
      existing.add(exampleIds[i]);
    }
  });
  return existing;
}
