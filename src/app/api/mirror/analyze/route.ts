import { auth } from '@/lib/auth';
import { db } from '@/lib/db/index';
import { examples, exampleTags, tags } from '@/lib/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { batchFetchVectors } from '@/lib/vector/upstash';
import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import { decryptExampleFields, isEncryptionEnabled } from '@/lib/encryption';

const MIN_EXAMPLES = 5;
const COSINE_DISTANCE_THRESHOLD = 0.25; // cluster if cosine similarity > 0.75

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExampleWithTags {
  id: string;
  question: string;
  answer: string;
  qualityRating: string | null;
  createdAt: string;
  tags: { id: string; name: string; isSystem: boolean | null }[];
}

export interface StoryCluster {
  label: string;
  example_ids: string[];
  count: number;
  quality_breakdown: { strong: number; weak: number; neutral: number; unrated: number };
  preview_question: string;
}

export interface PhraseCount {
  phrase: string;
  count: number;
  appears_in_strong: boolean;
}

export interface PatternInsight {
  tag_name: string;
  pattern: string;
  example_ids: string[];
}

export interface StrengthCategory {
  tag_name: string;
  strong: number;
  weak: number;
  neutral: number;
  unrated: number;
  total: number;
  strength_score: number; // 0-1, for sort order
}

export interface MirrorAnalysis {
  recurring_stories: StoryCluster[];
  phrase_analysis: PhraseCount[];
  top_phrase_insight: string | null; // callout box text
  pattern_recognition: PatternInsight[];
  strength_map: StrengthCategory[];
}

// ─── Cosine similarity ────────────────────────────────────────────────────────

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// ─── Clustering ───────────────────────────────────────────────────────────────

interface Cluster {
  exampleIds: string[];
  centroid: number[];
}

function clusterByVectors(
  items: Array<{ id: string; vector: number[] }>
): Cluster[] {
  if (items.length === 0) return [];

  const clusters: Cluster[] = [];

  for (const item of items) {
    let bestCluster: Cluster | null = null;
    let bestSim = 1 - COSINE_DISTANCE_THRESHOLD; // similarity threshold

    for (const cluster of clusters) {
      const sim = cosineSimilarity(item.vector, cluster.centroid);
      if (sim >= bestSim) {
        bestSim = sim;
        bestCluster = cluster;
      }
    }

    if (bestCluster) {
      bestCluster.exampleIds.push(item.id);
      // Update centroid as running average
      const n = bestCluster.exampleIds.length;
      bestCluster.centroid = bestCluster.centroid.map(
        (v, i) => (v * (n - 1) + item.vector[i]) / n
      );
    } else {
      clusters.push({ exampleIds: [item.id], centroid: [...item.vector] });
    }
  }

  // Return clusters with 2+ examples (singletons are not "recurring stories")
  return clusters.filter(c => c.exampleIds.length >= 2);
}

// Fall back: group by shared tags when no vectors available
function clusterByTags(exs: ExampleWithTags[]): Array<{ ids: string[]; tagName: string }> {
  const tagGroups = new Map<string, string[]>();

  for (const ex of exs) {
    for (const tag of ex.tags) {
      if (!tagGroups.has(tag.name)) tagGroups.set(tag.name, []);
      tagGroups.get(tag.name)!.push(ex.id);
    }
  }

  return Array.from(tagGroups.entries())
    .filter(([, ids]) => ids.length >= 2)
    .map(([tagName, ids]) => ({ ids, tagName }));
}

// ─── TF-IDF phrase extraction ─────────────────────────────────────────────────

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'was', 'are', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'that', 'this', 'these', 'those',
  'i', 'we', 'you', 'he', 'she', 'they', 'it', 'my', 'our', 'your',
  'his', 'her', 'their', 'its', 'me', 'us', 'him', 'them', 'what',
  'which', 'who', 'when', 'where', 'how', 'so', 'if', 'then', 'than',
  'as', 'about', 'up', 'out', 'just', 'also', 'very', 'really', 'quite',
  'able', 'going', 'get', 'got', 'make', 'made', 'into', 'through',
  'not', 'no', 'can', 'really', 'there', 'their', 'more', 'some', 'all',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOPWORDS.has(w));
}

function extractNgrams(tokens: string[], n: number): string[] {
  const ngrams: string[] = [];
  for (let i = 0; i <= tokens.length - n; i++) {
    ngrams.push(tokens.slice(i, i + n).join(' '));
  }
  return ngrams;
}

function extractTopPhrases(
  exs: ExampleWithTags[],
  minOccurrences = 2,
  topN = 20
): PhraseCount[] {
  const phraseFreq = new Map<string, { count: number; strongDocs: number }>();
  const docCount = exs.length;

  for (const ex of exs) {
    const text = `${ex.question} ${ex.answer}`;
    const tokens = tokenize(text);
    const bigrams = extractNgrams(tokens, 2);
    const trigrams = extractNgrams(tokens, 3);
    const allPhrases = Array.from(new Set([...bigrams, ...trigrams]));

    for (const phrase of allPhrases) {
      const entry = phraseFreq.get(phrase) ?? { count: 0, strongDocs: 0 };
      entry.count++;
      if (ex.qualityRating === 'strong') entry.strongDocs++;
      phraseFreq.set(phrase, entry);
    }
  }

  // TF-IDF score: penalise very common phrases (appear in >60% of docs)
  const results: PhraseCount[] = [];
  for (const [phrase, { count, strongDocs }] of Array.from(phraseFreq.entries())) {
    if (count < minOccurrences) continue;
    const idf = Math.log(docCount / count);
    if (idf < 0.2) continue; // too common
    results.push({
      phrase,
      count,
      appears_in_strong: strongDocs > 0,
    });
  }

  // Sort by count desc, then idf
  results.sort((a, b) => b.count - a.count);
  return results.slice(0, topN);
}

// ─── Strength map ─────────────────────────────────────────────────────────────

function buildStrengthMap(exs: ExampleWithTags[]): StrengthCategory[] {
  const tagMap = new Map<string, StrengthCategory>();

  for (const ex of exs) {
    for (const tag of ex.tags) {
      if (!tagMap.has(tag.name)) {
        tagMap.set(tag.name, {
          tag_name: tag.name,
          strong: 0, weak: 0, neutral: 0, unrated: 0,
          total: 0, strength_score: 0,
        });
      }
      const entry = tagMap.get(tag.name)!;
      entry.total++;
      if (ex.qualityRating === 'strong') entry.strong++;
      else if (ex.qualityRating === 'weak') entry.weak++;
      else if (ex.qualityRating === 'neutral') entry.neutral++;
      else entry.unrated++;
    }
  }

  // Compute strength score: (strong - weak) / total, normalized 0-1
  for (const entry of Array.from(tagMap.values())) {
    entry.strength_score = entry.total > 0
      ? Math.max(0, (entry.strong - entry.weak) / entry.total)
      : 0;
  }

  return Array.from(tagMap.values())
    .filter(e => e.total > 0)
    .sort((a, b) => b.strength_score - a.strength_score || b.total - a.total);
}

// ─── Claude helpers ───────────────────────────────────────────────────────────

async function labelClusters(
  clusters: Cluster[],
  exampleMap: Map<string, ExampleWithTags>
): Promise<string[]> {
  const prompt = clusters.map((cluster, i) => {
    const exs = cluster.exampleIds.slice(0, 3).map(id => {
      const ex = exampleMap.get(id);
      return ex ? `Q: ${ex.question.slice(0, 100)}` : '';
    }).filter(Boolean).join('\n');
    return `Cluster ${i + 1}:\n${exs}`;
  }).join('\n\n');

  const systemPrompt = `You label clusters of interview Q&A pairs with short, memorable story titles.
For each cluster, output a short label (3-6 words) that captures the common theme.
Format: one label per line, in order. No numbering, no punctuation.`;

  try {
    const { text } = await generateText({
      model: anthropic('claude-haiku-4-5-20251001'),
      system: systemPrompt,
      messages: [{ role: 'user', content: `Label these clusters:\n\n${prompt}` }],
      maxOutputTokens: 200,
    });
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    return clusters.map((_, i) => lines[i] ?? `Story cluster ${i + 1}`);
  } catch {
    return clusters.map((_, i) => `Story cluster ${i + 1}`);
  }
}

async function buildPatternInsights(
  exs: ExampleWithTags[]
): Promise<PatternInsight[]> {
  // Group by tag, then ask Claude for a pattern summary per tag with 3+ examples
  const tagGroups = new Map<string, ExampleWithTags[]>();
  for (const ex of exs) {
    for (const tag of ex.tags) {
      if (!tagGroups.has(tag.name)) tagGroups.set(tag.name, []);
      tagGroups.get(tag.name)!.push(ex);
    }
  }

  const eligibleTags = Array.from(tagGroups.entries())
    .filter(([, group]) => group.length >= 3)
    .slice(0, 5); // cap at 5 to limit Claude calls

  if (eligibleTags.length === 0) return [];

  const allTagsPrompt = eligibleTags.map(([tagName, group]) => {
    const sample = group.slice(0, 3).map(
      ex => `Q: ${ex.question.slice(0, 80)}\nA: ${ex.answer.slice(0, 120)}`
    ).join('\n---\n');
    return `Category: ${tagName}\n${sample}`;
  }).join('\n\n===\n\n');

  const systemPrompt = `You identify patterns in how a candidate answers interview questions.
For each category, write ONE sentence starting with "When asked about [category], you consistently..."
Focus on what they lead with, recurring themes, or notable phrases.
Output one insight per line, in the same order as the categories.`;

  try {
    const { text } = await generateText({
      model: anthropic('claude-haiku-4-5-20251001'),
      system: systemPrompt,
      messages: [{ role: 'user', content: allTagsPrompt }],
      maxOutputTokens: 400,
    });

    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    return eligibleTags.map(([tagName, group], i) => ({
      tag_name: tagName,
      pattern: lines[i] ?? `When asked about ${tagName}, you draw on consistent examples.`,
      example_ids: group.map(ex => ex.id),
    }));
  } catch {
    return eligibleTags.map(([tagName, group]) => ({
      tag_name: tagName,
      pattern: `When asked about ${tagName}, you draw on consistent examples.`,
      example_ids: group.map(ex => ex.id),
    }));
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  // 1. Load all user examples + tags
  const rawExamples = await db.select().from(examples).where(eq(examples.userId, userId));
  const allExamples = rawExamples.map(e =>
    isEncryptionEnabled()
      ? { ...e, ...decryptExampleFields({ question: e.question, answer: e.answer }) }
      : e
  );

  if (allExamples.length < MIN_EXAMPLES) {
    return Response.json({
      insufficient_data: true,
      examples_count: allExamples.length,
      min_required: MIN_EXAMPLES,
    });
  }

  const exampleIds = allExamples.map(e => e.id);

  // Load tags for all examples
  const tagJoins = exampleIds.length > 0
    ? await db.select({
        exampleId: exampleTags.exampleId,
        tagId: exampleTags.tagId,
        name: tags.name,
        isSystem: tags.isSystem,
      })
      .from(exampleTags)
      .innerJoin(tags, eq(exampleTags.tagId, tags.id))
      .where(inArray(exampleTags.exampleId, exampleIds))
    : [];

  const tagsByExampleId = new Map<string, typeof tagJoins>();
  for (const tj of tagJoins) {
    if (!tagsByExampleId.has(tj.exampleId)) tagsByExampleId.set(tj.exampleId, []);
    tagsByExampleId.get(tj.exampleId)!.push(tj);
  }

  const enrichedExamples: ExampleWithTags[] = allExamples.map(ex => ({
    id: ex.id,
    question: ex.question,
    answer: ex.answer,
    qualityRating: ex.qualityRating,
    createdAt: ex.createdAt ?? '',
    tags: (tagsByExampleId.get(ex.id) ?? []).map(tj => ({
      id: tj.tagId,
      name: tj.name,
      isSystem: tj.isSystem,
    })),
  }));

  const exampleMap = new Map(enrichedExamples.map(ex => [ex.id, ex]));

  // 2. Try vector-based clustering (graceful fallback if no vectors)
  let recurringStories: StoryCluster[] = [];

  try {
    const vectorResults = await batchFetchVectors(exampleIds);
    const withVectors = vectorResults.filter(r => r.vector !== null) as Array<{ id: string; vector: number[] }>;

    if (withVectors.length >= 3) {
      const rawClusters = clusterByVectors(withVectors);
      if (rawClusters.length > 0) {
        const labels = await labelClusters(rawClusters, exampleMap);
        recurringStories = rawClusters.slice(0, 10).map((cluster, i) => {
          const clusterExs = cluster.exampleIds.map(id => exampleMap.get(id)!).filter(Boolean);
          const qb = { strong: 0, weak: 0, neutral: 0, unrated: 0 };
          for (const ex of clusterExs) {
            if (ex.qualityRating === 'strong') qb.strong++;
            else if (ex.qualityRating === 'weak') qb.weak++;
            else if (ex.qualityRating === 'neutral') qb.neutral++;
            else qb.unrated++;
          }
          return {
            label: labels[i],
            example_ids: cluster.exampleIds,
            count: cluster.exampleIds.length,
            quality_breakdown: qb,
            preview_question: clusterExs[0]?.question ?? '',
          };
        });
      }
    }
  } catch {
    // Vector fetch failed — fall through to tag-based fallback
  }

  // Tag-based fallback if vector clustering yielded nothing
  if (recurringStories.length === 0) {
    const tagClusters = clusterByTags(enrichedExamples);
    recurringStories = tagClusters.slice(0, 10).map(({ ids, tagName }) => {
      const clusterExs = ids.map(id => exampleMap.get(id)!).filter(Boolean);
      const qb = { strong: 0, weak: 0, neutral: 0, unrated: 0 };
      for (const ex of clusterExs) {
        if (ex.qualityRating === 'strong') qb.strong++;
        else if (ex.qualityRating === 'weak') qb.weak++;
        else if (ex.qualityRating === 'neutral') qb.neutral++;
        else qb.unrated++;
      }
      return {
        label: tagName,
        example_ids: ids,
        count: ids.length,
        quality_breakdown: qb,
        preview_question: clusterExs[0]?.question ?? '',
      };
    });
  }

  // 3. Phrase extraction
  const phrases = extractTopPhrases(enrichedExamples);

  // Build top phrase callout if notable
  let topPhraseInsight: string | null = null;
  if (phrases.length > 0) {
    const top = phrases[0];
    // Only flag if the phrase appears in a meaningful proportion
    if (top.count >= 3) {
      const relevantExCount = enrichedExamples.filter(ex =>
        `${ex.question} ${ex.answer}`.toLowerCase().includes(top.phrase)
      ).length;
      topPhraseInsight = `You use "${top.phrase}" in ${relevantExCount} of your ${enrichedExamples.length} answers. Is this intentional?`;
    }
  }

  // 4. Pattern recognition via Claude
  const patternInsights = await buildPatternInsights(enrichedExamples);

  // 5. Strength map
  const strengthMap = buildStrengthMap(enrichedExamples);

  const analysis: MirrorAnalysis = {
    recurring_stories: recurringStories,
    phrase_analysis: phrases,
    top_phrase_insight: topPhraseInsight,
    pattern_recognition: patternInsights,
    strength_map: strengthMap,
  };

  return Response.json({
    analysis,
    examples_analyzed: enrichedExamples.length,
    generated_at: new Date().toISOString(),
  });
}
