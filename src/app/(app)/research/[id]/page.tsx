import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db/index';
import { jobApplications, companyResearch, fitAssessments } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import {
  isEncryptionEnabled,
  decryptJobDescription,
  decryptResearchFields,
} from '@/lib/encryption';
import { JobContextHeader } from '@/components/storybank/JobContextHeader';
import { ResearchAnnotations } from '@/components/storybank/ResearchAnnotations';
import { ResearchRerunButton } from '@/components/storybank/ResearchRerunButton';

export default async function ResearchDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  const userId = session.user.id;

  const [application] = await db
    .select()
    .from(jobApplications)
    .where(and(eq(jobApplications.id, params.id), eq(jobApplications.userId, userId)))
    .limit(1);

  if (!application) notFound();

  const [researchRow] = await db
    .select()
    .from(companyResearch)
    .where(
      and(
        eq(companyResearch.jobApplicationId, params.id),
        eq(companyResearch.userId, userId)
      )
    )
    .limit(1);

  const [assessmentRow] = await db
    .select({ id: fitAssessments.id })
    .from(fitAssessments)
    .where(
      and(
        eq(fitAssessments.jobApplicationId, params.id),
        eq(fitAssessments.userId, userId)
      )
    )
    .limit(1);

  // Decrypt sensitive research fields
  const research = researchRow ?? null;
  const decrypted = research && isEncryptionEnabled()
    ? {
        ...research,
        ...decryptResearchFields({
          recentNews: research.recentNews,
          cultureSignals: research.cultureSignals,
          keyPeople: research.keyPeople,
        }),
      }
    : research;

  // Decrypt job description (not displayed but needed for annotations context)
  void isEncryptionEnabled;
  void decryptJobDescription;

  const hasResearch = Boolean(application.researchedAt);
  const hasFit = Boolean(application.assessedAt);
  const hasMaterials = Boolean(application.materialsAt);

  // Metric grid values
  const metrics: { label: string; value: string | null }[] = [
    { label: 'Stage', value: decrypted?.fundingStage ?? null },
    { label: 'Raised', value: decrypted?.revenue ?? null },
    { label: 'Founded', value: decrypted?.foundedYear ?? null },
    { label: 'People', value: decrypted?.companySize ?? null },
  ];

  function Section({ title, content }: { title: string; content: string | null }) {
    return (
      <div
        className="p-4 rounded-lg"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
      >
        <h4
          className="text-xs font-semibold uppercase tracking-wider mb-3"
          style={{ color: 'var(--mist)' }}
        >
          {title}
        </h4>
        {content ? (
          <div className="text-sm leading-relaxed" style={{ color: 'var(--sage)' }}>
            {content}
          </div>
        ) : (
          <p className="text-sm italic" style={{ color: 'var(--sage)' }}>
            No information found
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <JobContextHeader
        company={application.companyName}
        role={application.jobTitle}
        jobId={params.id}
        currentPhase="research"
        hasResearch={hasResearch}
        hasFit={hasFit}
        hasMaterials={hasMaterials}
      />

      {/* Company overview */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4 mb-2">
          <div>
            <h2
              className="font-heading text-2xl font-bold"
              style={{
                color: 'var(--mist)',
                fontFamily: 'Georgia, Times New Roman, serif',
                letterSpacing: '-0.01em',
              }}
            >
              {application.companyName}
            </h2>
            <p className="text-sm mt-1" style={{ color: 'var(--sage)' }}>
              {[decrypted?.fundingStage, decrypted?.industry, decrypted?.headquarters]
                .filter(Boolean)
                .join(' · ') || 'Research complete'}
            </p>
          </div>
          <ResearchRerunButton jobId={params.id} />
        </div>

        {/* 4-up metric grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          {metrics.map(({ label, value }) => (
            <div
              key={label}
              className="p-3 rounded-lg text-center"
              style={{ background: 'var(--card-raised)', border: '1px solid var(--border)' }}
            >
              <p
                className="font-mono text-lg font-bold"
                style={{
                  color: 'var(--amber)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {value ?? '—'}
              </p>
              <p
                className="text-xs uppercase tracking-wider mt-0.5"
                style={{ color: 'var(--sage)' }}
              >
                {label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Research sections — 2-col on desktop */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Section title="Recent News" content={decrypted?.recentNews ?? null} />
        <Section title="Tech Stack" content={decrypted?.techStack ?? null} />
        <Section title="Mission & Culture" content={decrypted?.missionAndValues ?? null} />
        <Section title="Key People" content={decrypted?.keyPeople ?? null} />
      </div>

      {/* Culture signals (full width) */}
      {decrypted?.cultureSignals && (
        <div className="mb-6">
          <Section title="Culture Signals" content={decrypted.cultureSignals} />
        </div>
      )}

      {/* Red flag callout — shown if research flags something */}
      {decrypted?.recentNews?.includes('⚠') && (
        <div
          className="flex items-start gap-3 p-4 rounded-lg mb-6"
          style={{
            border: '1px solid var(--amber)',
            background: 'var(--amber-faint)',
          }}
        >
          <AlertTriangle
            size={16}
            strokeWidth={1.5}
            className="shrink-0 mt-0.5"
            style={{ color: 'var(--contradiction)' }}
          />
          <p className="text-sm" style={{ color: 'var(--contradiction)' }}>
            Some research flags may warrant closer review.
          </p>
        </div>
      )}

      {/* User annotations */}
      <div className="mb-8">
        <ResearchAnnotations jobId={params.id} initialNotes={application.notes ?? ''} />
      </div>

      {/* Next step CTA */}
      <div
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-lg"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
      >
        <div>
          <p className="text-sm font-medium" style={{ color: 'var(--mist)' }}>
            Ready to assess your fit?
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--sage)' }}>
            Score 8 dimensions against your career story.
          </p>
        </div>
        <Link
          href={assessmentRow ? `/fit/${params.id}` : `/fit/new?job_id=${params.id}`}
          className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold shrink-0"
          style={{ background: 'var(--amber)', color: '#111a24' }}
        >
          {assessmentRow ? 'View Fit Assessment' : 'Start Fit Assessment'} →
        </Link>
      </div>
    </div>
  );
}
