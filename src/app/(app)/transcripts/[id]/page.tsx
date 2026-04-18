import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db/index';
import { transcripts } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { ChevronLeft, CheckCircle2 } from 'lucide-react';
import { DeleteTranscriptButton } from '@/components/storybank/DeleteTranscriptButton';
import { ExtractButton } from '@/components/storybank/ExtractButton';

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

const ROUND_LABELS: Record<string, string> = {
  screening: 'Recruiter screen',
  first: 'Hiring manager',
  second: 'Panel',
  final: 'Final',
  other: 'Other',
};

export default async function TranscriptDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  const userId = session.user.id;

  const [transcript] = await db.select()
    .from(transcripts)
    .where(and(
      eq(transcripts.id, params.id),
      eq(transcripts.userId, userId)
    ))
    .limit(1);

  if (!transcript) notFound();

  // Build numbered lines for display
  const lines = transcript.rawText.split('\n');

  return (
    <div className="max-w-4xl">
      {/* Back link */}
      <Link
        href="/transcripts"
        className="inline-flex items-center gap-1.5 text-sm mb-6 transition-colors"
        style={{ color: 'var(--sage)' }}
      >
        <ChevronLeft size={14} strokeWidth={1.5} />
        All transcripts
      </Link>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <h1
            className="font-heading text-3xl font-bold mb-2"
            style={{ color: 'var(--mist)', letterSpacing: '-0.01em' }}
          >
            {transcript.title}
          </h1>
          {/* Extraction status */}
          {transcript.extractedAt ? (
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold shrink-0"
              style={{ background: 'rgba(90, 114, 71, 0.18)', color: '#7fa85a' }}
            >
              <CheckCircle2 size={14} strokeWidth={2} />
              Extracted
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold shrink-0"
              style={{ background: 'rgba(106, 138, 138, 0.12)', color: 'var(--sage)' }}
            >
              Not extracted
            </span>
          )}
        </div>

        {/* Metadata row */}
        <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {transcript.company && (
            <div className="flex items-center gap-1.5">
              <dt className="sr-only">Company</dt>
              <dd style={{ color: 'var(--copper)', fontWeight: 600 }}>{transcript.company}</dd>
            </div>
          )}
          {transcript.interviewRound && (
            <div className="flex items-center gap-1.5">
              <dt className="sr-only">Round</dt>
              <dd style={{ color: 'var(--mist)' }}>
                {ROUND_LABELS[transcript.interviewRound] ?? transcript.interviewRound}
              </dd>
            </div>
          )}
          {transcript.interviewDate && (
            <div className="flex items-center gap-1.5">
              <dt className="sr-only">Date</dt>
              <dd style={{ color: 'var(--sage)' }}>{formatDate(transcript.interviewDate)}</dd>
            </div>
          )}
          {transcript.interviewerName && (
            <div className="flex items-center gap-1.5">
              <dt className="sr-only">Interviewer</dt>
              <dd style={{ color: 'var(--sage)' }}>
                {transcript.interviewerName}
                {transcript.interviewerRole ? ` · ${transcript.interviewerRole}` : ''}
              </dd>
            </div>
          )}
        </dl>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-3 mb-8">
        <ExtractButton
          transcriptId={transcript.id}
          alreadyExtracted={!!transcript.extractedAt}
        />

        {transcript.extractedAt && (
          <Link
            href={`/transcripts/${transcript.id}/review`}
            className="flex items-center gap-2 px-4 rounded-md text-sm font-medium transition-opacity hover:opacity-80"
            style={{ height: '40px', background: 'var(--card)', color: 'var(--mist)', border: '1px solid var(--border)' }}
          >
            View Review
          </Link>
        )}

        <DeleteTranscriptButton transcriptId={transcript.id} />
      </div>

      {/* Raw transcript with line numbers */}
      <div
        className="rounded-lg overflow-hidden"
        style={{ border: '1px solid var(--border)' }}
      >
        <div
          className="px-4 py-2.5 flex items-center justify-between"
          style={{ background: 'var(--card)', borderBottom: '1px solid var(--border)' }}
        >
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--sage)' }}>
            Transcript
          </span>
          <span className="text-xs" style={{ color: 'var(--sage)' }}>
            {lines.length} lines
          </span>
        </div>

        <div
          className="overflow-auto"
          style={{
            maxHeight: '600px',
            background: 'var(--card)',
          }}
        >
          <table className="w-full text-sm" style={{ fontFamily: 'var(--font-mono)', borderCollapse: 'collapse' }}>
            <tbody>
              {lines.map((line, i) => (
                <tr key={i} id={`line-${i + 1}`}>
                  <td
                    className="select-none text-right pr-4 pl-4 py-0.5 align-top shrink-0"
                    style={{
                      color: 'var(--sage)',
                      fontSize: '12px',
                      width: '3.5rem',
                      userSelect: 'none',
                      borderRight: '1px solid var(--border)',
                    }}
                  >
                    {i + 1}
                  </td>
                  <td
                    className="pl-4 pr-4 py-0.5 align-top whitespace-pre-wrap break-words"
                    style={{ color: 'var(--mist)', fontSize: '13px', lineHeight: '1.6' }}
                  >
                    {line || ' '}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
