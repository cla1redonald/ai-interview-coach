import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db/index';
import { transcripts, examples, exampleTags, tags } from '@/lib/db/schema';
import { eq, and, inArray, isNull, or } from 'drizzle-orm';
import { ChevronLeft } from 'lucide-react';
import { ReviewPanel } from '@/components/storybank/ReviewPanel';
import { EnrichTrigger } from '@/components/storybank/EnrichTrigger';
import { decryptTranscriptFields, decryptExampleFields, isEncryptionEnabled } from '@/lib/encryption';

export default async function ReviewPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  const userId = session.user.id;

  // Load transcript
  const [transcript] = await db.select()
    .from(transcripts)
    .where(and(
      eq(transcripts.id, params.id),
      eq(transcripts.userId, userId)
    ))
    .limit(1);

  if (!transcript) notFound();

  const decryptedTranscript = isEncryptionEnabled()
    ? { ...transcript, ...decryptTranscriptFields({ rawText: transcript.rawText }) }
    : transcript;

  // Load extracted examples for this transcript
  const exampleRows = await db.select()
    .from(examples)
    .where(and(
      eq(examples.transcriptId, params.id),
      eq(examples.userId, userId)
    ));

  // Load tags for all examples
  const exampleIds = exampleRows.map(e => e.id);
  const tagJoins = exampleIds.length > 0
    ? await db
        .select({
          exampleId: exampleTags.exampleId,
          tagId: exampleTags.tagId,
          name: tags.name,
          isSystem: tags.isSystem,
          userId: tags.userId,
        })
        .from(exampleTags)
        .innerJoin(tags, eq(exampleTags.tagId, tags.id))
        .where(inArray(exampleTags.exampleId, exampleIds))
    : [];

  const tagsByExampleId = new Map<string, typeof tagJoins>();
  for (const tj of tagJoins) {
    if (!tagsByExampleId.has(tj.exampleId)) {
      tagsByExampleId.set(tj.exampleId, []);
    }
    tagsByExampleId.get(tj.exampleId)!.push(tj);
  }

  const decryptedExamples = exampleRows.map(e =>
    isEncryptionEnabled()
      ? { ...e, ...decryptExampleFields({ question: e.question, answer: e.answer }) }
      : e
  );

  const enrichedExamples = decryptedExamples.map(e => ({
    id: e.id,
    question: e.question,
    answer: e.answer,
    sourcePosition: e.sourcePosition,
    qualityRating: e.qualityRating,
    tags: (tagsByExampleId.get(e.id) ?? []).map(tj => ({
      id: tj.tagId,
      name: tj.name,
      isSystem: tj.isSystem ?? false,
      userId: tj.userId,
    })),
  }));

  // Load all available tags (system + user)
  const availableTags = await db.select()
    .from(tags)
    .where(or(
      isNull(tags.userId),
      eq(tags.userId, userId)
    ));

  const sortedTags = [...availableTags].sort((a, b) => {
    if (a.isSystem && !b.isSystem) return -1;
    if (!a.isSystem && b.isSystem) return 1;
    return a.name.localeCompare(b.name);
  });

  const transcriptLines = decryptedTranscript.rawText.split('\n');

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 2rem)' }}>
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
        <div>
          <Link
            href={`/transcripts/${params.id}`}
            className="inline-flex items-center gap-1.5 text-sm mb-2 transition-colors hover:opacity-80"
            style={{ color: 'var(--sage)' }}
          >
            <ChevronLeft size={14} strokeWidth={1.5} />
            Back to transcript
          </Link>
          <h1
            className="font-heading text-2xl font-bold"
            style={{ color: 'var(--mist)', letterSpacing: '-0.01em' }}
          >
            Review — {transcript.title}
          </h1>
          {transcript.company && (
            <p className="text-sm mt-0.5" style={{ color: 'var(--copper)' }}>
              {transcript.company}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <EnrichTrigger transcriptId={params.id} />
          <div className="text-sm" style={{ color: 'var(--sage)' }}>
            {enrichedExamples.length} pair{enrichedExamples.length !== 1 ? 's' : ''} extracted
          </div>
        </div>
      </div>

      {/* Split panel */}
      <ReviewPanel
        transcriptLines={transcriptLines}
        initialExamples={enrichedExamples}
        availableTags={sortedTags.map(t => ({
          id: t.id,
          name: t.name,
          isSystem: t.isSystem ?? false,
          userId: t.userId,
        }))}
        warnings={[]}
        transcriptId={params.id}
      />
    </div>
  );
}
