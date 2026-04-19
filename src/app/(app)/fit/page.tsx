import { BarChart3 } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db/index';
import { jobApplications } from '@/lib/db/schema';
import { eq, and, isNotNull } from 'drizzle-orm';

function scoreColor(score: number): string {
  if (score >= 70) return 'var(--amber)';
  if (score >= 50) return 'var(--copper)';
  return 'var(--sage)';
}

const ARCHETYPE_LABELS: Record<string, string> = {
  exec: 'Executive',
  ic: 'Individual Contributor',
  portfolio: 'Portfolio / NED',
  advisory: 'Advisory',
  hybrid: 'Hybrid',
};

export default async function FitPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  const userId = session.user.id;

  const apps = await db
    .select()
    .from(jobApplications)
    .where(
      and(
        eq(jobApplications.userId, userId),
        isNotNull(jobApplications.assessedAt)
      )
    )
    .orderBy(jobApplications.createdAt);

  const sorted = [...apps].reverse();

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1
            className="font-heading text-3xl font-bold mb-1"
            style={{ color: 'var(--mist)', letterSpacing: '-0.01em' }}
          >
            Fit Assessments
          </h1>
          <p className="text-sm" style={{ color: 'var(--sage)' }}>
            Scored across 8 dimensions against your career story.
          </p>
        </div>
      </div>

      {/* Empty state */}
      {sorted.length === 0 && (
        <div
          className="flex flex-col items-center justify-center gap-4 p-14 rounded-lg"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <BarChart3 size={48} strokeWidth={1.5} style={{ color: 'var(--sage)' }} />
          <div className="text-center">
            <p
              className="font-heading text-xl font-semibold mb-2"
              style={{ color: 'var(--mist)' }}
            >
              No fit assessments yet
            </p>
            <p className="text-sm mb-4" style={{ color: 'var(--sage)' }}>
              Research a company first, then run a fit assessment to score how
              well the role matches your experience and goals.
            </p>
          </div>
          <Link
            href="/research/new"
            className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium"
            style={{ background: 'var(--copper)', color: '#111a24' }}
          >
            Research a company
          </Link>
        </div>
      )}

      {/* Fit list */}
      {sorted.length > 0 && (
        <section aria-label="Fit assessments" className="space-y-3">
          {sorted.map((app) => {
            const score = app.fitScoreOverall ?? 0;
            const color = scoreColor(score);
            const pct = score + '%';
            const archetype = app.fitArchetype
              ? (ARCHETYPE_LABELS[app.fitArchetype] ?? app.fitArchetype)
              : null;
            const assessedDate = app.assessedAt
              ? new Date(app.assessedAt).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })
              : null;

            return (
              <div
                key={app.id}
                className="p-4 rounded-lg"
                style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3
                        className="font-heading text-base font-semibold"
                        style={{ color: 'var(--mist)' }}
                      >
                        {app.companyName}
                      </h3>
                      {archetype && (
                        <span
                          className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{
                            background: 'var(--amber-faint)',
                            border: '1px solid var(--amber)',
                            color: 'var(--amber)',
                          }}
                        >
                          {archetype}
                        </span>
                      )}
                    </div>
                    <p className="text-sm mt-0.5" style={{ color: 'var(--mist)', opacity: 0.7 }}>
                      {app.jobTitle}
                    </p>

                    {/* Score bar */}
                    <div className="flex items-center gap-3 mt-3">
                      <div
                        className="flex-1 rounded-full"
                        style={{ height: '6px', background: 'var(--border)' }}
                      >
                        <div
                          style={{
                            height: '100%',
                            width: pct,
                            background: color,
                            borderRadius: '9999px',
                          }}
                        />
                      </div>
                      <span
                        className="font-mono text-sm font-bold tabular-nums"
                        style={{ color, minWidth: '3rem', textAlign: 'right' }}
                      >
                        {score}
                      </span>
                    </div>

                    {assessedDate && (
                      <p className="text-xs mt-2" style={{ color: 'var(--sage)' }}>
                        Assessed {assessedDate}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5 shrink-0 items-end">
                    <Link
                      href={`/fit/${app.id}`}
                      className="text-sm font-medium"
                      style={{ color: 'var(--copper)' }}
                    >
                      View assessment →
                    </Link>
                    <Link
                      href={`/research/${app.id}`}
                      className="text-sm"
                      style={{ color: 'var(--sage)' }}
                    >
                      View research →
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
