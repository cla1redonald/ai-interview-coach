import Link from 'next/link';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db/index';
import { transcripts } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { FileText, CheckCircle2, Plus } from 'lucide-react';
import { redirect } from 'next/navigation';

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
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

export default async function TranscriptsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  const userId = session.user.id;

  const rows = await db.select()
    .from(transcripts)
    .where(eq(transcripts.userId, userId))
    .orderBy(desc(transcripts.createdAt));

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1
            className="font-heading text-3xl font-bold mb-1"
            style={{ color: 'var(--mist)', letterSpacing: '-0.01em' }}
          >
            Transcripts
          </h1>
          <p className="text-sm" style={{ color: 'var(--sage)' }}>
            All your uploaded interview transcripts.
          </p>
        </div>
        <Link
          href="/upload"
          className="flex items-center gap-2 px-4 rounded-md text-sm font-medium transition-colors"
          style={{
            height: '40px',
            background: 'var(--primary)',
            color: 'var(--primary-foreground)',
          }}
        >
          <Plus size={16} strokeWidth={1.5} />
          <span>Upload new</span>
        </Link>
      </div>

      {/* Empty state */}
      {rows.length === 0 && (
        <div
          className="flex flex-col items-center justify-center gap-4 p-12 rounded-lg"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <FileText size={48} strokeWidth={1.5} style={{ color: 'var(--sage)' }} />
          <p className="text-base font-semibold font-heading" style={{ color: 'var(--mist)' }}>
            No transcripts yet
          </p>
          <p className="text-sm text-center max-w-xs" style={{ color: 'var(--sage)' }}>
            Upload your first interview transcript to start building your example bank.
          </p>
          <Link
            href="/upload"
            className="flex items-center gap-2 px-4 rounded-md text-sm font-medium mt-2"
            style={{ height: '40px', background: 'var(--primary)', color: 'var(--primary-foreground)' }}
          >
            Upload transcript
          </Link>
        </div>
      )}

      {/* Transcript list */}
      {rows.length > 0 && (
        <div className="flex flex-col gap-3">
          {rows.map((t) => (
            <Link
              key={t.id}
              href={`/transcripts/${t.id}`}
              className="block rounded-lg p-4 transition-colors group"
              style={{
                background: 'var(--card)',
                border: '1px solid var(--border)',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow =
                  '0 0 0 1px var(--amber-faint), 0 4px 16px rgba(226,160,57,0.06)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow = 'none';
              }}
            >
              <div className="flex items-start justify-between gap-4">
                {/* Left: title + meta */}
                <div className="min-w-0">
                  <p
                    className="font-heading font-semibold text-base mb-1 truncate"
                    style={{ color: 'var(--mist)' }}
                  >
                    {t.title}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    {t.company && (
                      <span className="text-xs" style={{ color: 'var(--copper)' }}>
                        {t.company}
                      </span>
                    )}
                    {t.interviewRound && (
                      <span className="text-xs" style={{ color: 'var(--sage)' }}>
                        {ROUND_LABELS[t.interviewRound] ?? t.interviewRound}
                      </span>
                    )}
                    {t.interviewDate && (
                      <span className="text-xs" style={{ color: 'var(--sage)' }}>
                        {formatDate(t.interviewDate)}
                      </span>
                    )}
                    {t.interviewerName && (
                      <span className="text-xs" style={{ color: 'var(--sage)' }}>
                        {t.interviewerName}
                        {t.interviewerRole ? `, ${t.interviewerRole}` : ''}
                      </span>
                    )}
                  </div>
                </div>

                {/* Right: extraction status badge */}
                <div className="shrink-0">
                  {t.extractedAt ? (
                    <span
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                      style={{ background: 'rgba(90, 114, 71, 0.18)', color: '#7fa85a' }}
                    >
                      <CheckCircle2 size={12} strokeWidth={2} />
                      Extracted
                    </span>
                  ) : (
                    <span
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                      style={{ background: 'rgba(106, 138, 138, 0.12)', color: 'var(--sage)' }}
                    >
                      Not extracted
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
