import { FileOutput, Plus } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db/index';
import { jobApplications } from '@/lib/db/schema';
import { eq, and, isNotNull } from 'drizzle-orm';

const MATERIAL_TYPE_LABELS: Record<string, string> = {
  cv: 'CV',
  cover_letter: 'Cover Letter',
  tracking_note: 'Tracking Note',
};

export default async function MaterialsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  const userId = session.user.id;

  const apps = await db
    .select()
    .from(jobApplications)
    .where(
      and(
        eq(jobApplications.userId, userId),
        isNotNull(jobApplications.materialsAt)
      )
    )
    .orderBy(jobApplications.materialsAt);

  // Most recent first
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
            Materials
          </h1>
          <p className="text-sm" style={{ color: 'var(--sage)' }}>
            Tailored CVs, cover letters, and tracking notes for each application.
          </p>
        </div>
        <Link
          href="/research/new"
          className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium"
          style={{ background: 'var(--copper)', color: '#111a24' }}
        >
          <Plus size={15} strokeWidth={2} />
          New application
        </Link>
      </div>

      {/* Empty state */}
      {sorted.length === 0 && (
        <div
          className="flex flex-col items-center justify-center gap-4 p-14 rounded-lg"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <FileOutput size={48} strokeWidth={1.5} style={{ color: 'var(--sage)' }} />
          <div className="text-center">
            <p
              className="font-heading text-xl font-semibold mb-2"
              style={{ color: 'var(--mist)' }}
            >
              No materials generated yet
            </p>
            <p className="text-sm mb-4" style={{ color: 'var(--sage)' }}>
              Research a company and complete a fit assessment to unlock material generation.
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

      {/* Materials list */}
      {sorted.length > 0 && (
        <section aria-label="Materials list" className="space-y-3">
          {sorted.map((app) => {
            const materialsDate = app.materialsAt
              ? new Date(app.materialsAt).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })
              : null;

            // Derive which material types exist based on flags
            // The materialsAt field indicates materials have been generated;
            // link takes user to detail page where actual types are loaded
            const typesAvailable: string[] = [];
            if (app.materialsAt) {
              typesAvailable.push('CV', 'Cover Letter', 'Tracking Note');
            }

            void MATERIAL_TYPE_LABELS;

            return (
              <div
                key={app.id}
                className="p-4 rounded-lg"
                style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3
                      className="font-heading text-base font-semibold"
                      style={{ color: 'var(--mist)' }}
                    >
                      {app.companyName}
                    </h3>
                    <p className="text-sm mt-0.5" style={{ color: 'var(--mist)', opacity: 0.7 }}>
                      {app.jobTitle}
                    </p>

                    {/* Material type badges */}
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      {typesAvailable.map((label) => (
                        <span
                          key={label}
                          className="text-xs px-2 py-0.5 rounded-full"
                          style={{
                            background: 'var(--card-raised)',
                            border: '1px solid var(--border)',
                            color: 'var(--sage)',
                          }}
                        >
                          {label}
                        </span>
                      ))}
                    </div>

                    {materialsDate && (
                      <p className="text-xs mt-2" style={{ color: 'var(--sage)' }}>
                        Generated {materialsDate}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5 shrink-0 items-end">
                    <Link
                      href={`/materials/${app.id}`}
                      className="text-sm font-medium"
                      style={{ color: 'var(--copper)' }}
                    >
                      View materials →
                    </Link>
                    <Link
                      href={`/fit/${app.id}`}
                      className="text-sm"
                      style={{ color: 'var(--sage)' }}
                    >
                      View fit assessment →
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
