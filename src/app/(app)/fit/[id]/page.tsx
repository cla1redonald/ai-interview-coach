import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db/index';
import { jobApplications, fitAssessments } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { JobContextHeader } from '@/components/storybank/JobContextHeader';
import { RadarChart } from '@/components/storybank/RadarChart';
import { FitInteractiveSection } from '@/components/storybank/FitInteractiveSection';
import type { DimensionScore, FitWeights } from '@/lib/types';

const ARCHETYPE_LABELS: Record<string, string> = {
  exec: 'Executive',
  ic: 'Individual Contributor',
  portfolio: 'Portfolio / NED',
  advisory: 'Advisory',
  hybrid: 'Hybrid',
};

const DIMENSION_KEYS: (keyof FitWeights)[] = [
  'domain',
  'seniority',
  'scope',
  'technical',
  'mission',
  'location',
  'compensation',
  'culture',
];

const DIMENSION_LABELS: Record<keyof FitWeights, string> = {
  domain: 'Domain / Industry',
  seniority: 'Seniority',
  scope: 'Scope',
  technical: 'Technical',
  mission: 'Mission',
  location: 'Location',
  compensation: 'Compensation',
  culture: 'Culture',
};

function parseJson<T>(str: string | null | undefined, fallback: T): T {
  if (!str) return fallback;
  try {
    return JSON.parse(str) as T;
  } catch {
    return fallback;
  }
}

function overallColor(score: number): string {
  if (score >= 70) return 'var(--amber)';
  if (score >= 50) return 'var(--copper)';
  return 'var(--sage)';
}

export default async function FitDetailPage({
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

  const [assessmentRow] = await db
    .select()
    .from(fitAssessments)
    .where(
      and(
        eq(fitAssessments.jobApplicationId, params.id),
        eq(fitAssessments.userId, userId)
      )
    )
    .limit(1);

  if (!assessmentRow) {
    // Not assessed yet — redirect to start
    redirect(`/fit/new?job_id=${params.id}`);
  }

  const hasResearch = Boolean(application.researchedAt);
  const hasFit = Boolean(application.assessedAt);
  const hasMaterials = Boolean(application.materialsAt);

  // Parse JSON fields
  const redFlags: string[] = parseJson(assessmentRow.redFlags, []);
  const dismissedRedFlags: string[] = parseJson(assessmentRow.dismissedRedFlags, []);
  const dimensionAnnotations: Partial<Record<keyof FitWeights, string>> = parseJson(
    assessmentRow.dimensionAnnotations,
    {}
  );

  // Parse dimension scores
  const dimScores: Record<keyof FitWeights, DimensionScore | null> = {
    domain:       parseJson<DimensionScore | null>(assessmentRow.dimDomainIndustry, null),
    seniority:    parseJson<DimensionScore | null>(assessmentRow.dimSeniority, null),
    scope:        parseJson<DimensionScore | null>(assessmentRow.dimScope, null),
    technical:    parseJson<DimensionScore | null>(assessmentRow.dimTechnical, null),
    mission:      parseJson<DimensionScore | null>(assessmentRow.dimMission, null),
    location:     parseJson<DimensionScore | null>(assessmentRow.dimLocation, null),
    compensation: parseJson<DimensionScore | null>(assessmentRow.dimCompensation, null),
    culture:      parseJson<DimensionScore | null>(assessmentRow.dimCulture, null),
  };

  // Build radar data
  const radarDimensions = DIMENSION_KEYS.map((key) => ({
    label: DIMENSION_LABELS[key],
    score: dimScores[key]?.score ?? 0,
  }));

  const overallScore = assessmentRow.overallScore ?? 0;
  const archetype = assessmentRow.archetype;
  const archetypeLabel = ARCHETYPE_LABELS[archetype] ?? archetype;
  const archetypeIsRisk = archetype === 'advisory'; // advisory often flags higher risk — adjust per spec

  // Active (non-dismissed) red flags
  const activeRedFlags = redFlags.filter((f) => !dismissedRedFlags.includes(f));

  return (
    <div className="max-w-4xl">
      <JobContextHeader
        company={application.companyName}
        role={application.jobTitle}
        jobId={params.id}
        currentPhase="fit"
        hasResearch={hasResearch}
        hasFit={hasFit}
        hasMaterials={hasMaterials}
      />

      {/* Fit Overview */}
      <section aria-label="Fit overview" className="mb-8">
        <div
          className="p-5 rounded-lg grid grid-cols-1 md:grid-cols-2 gap-6 items-center"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        >
          {/* Radar chart */}
          <div className="flex justify-center">
            <RadarChart dimensions={radarDimensions} size={240} />
          </div>

          {/* Score summary */}
          <div>
            <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--sage)' }}>
              Overall fit score
            </p>
            <p
              className="font-mono text-6xl font-bold tabular-nums mb-3"
              style={{ color: overallColor(overallScore), letterSpacing: '-0.02em' }}
            >
              {overallScore}
            </p>

            {/* Archetype badge */}
            <div className="inline-flex mb-4">
              <span
                className="text-sm px-3 py-1 rounded-full font-medium"
                style={{
                  background: archetypeIsRisk ? 'rgba(196,90,42,0.1)' : 'var(--amber-faint)',
                  border: `1px solid ${archetypeIsRisk ? 'var(--contradiction)' : 'var(--amber)'}`,
                  color: archetypeIsRisk ? 'var(--contradiction)' : 'var(--amber)',
                }}
              >
                {archetypeLabel}
              </span>
            </div>

            {/* Rationale */}
            {assessmentRow.archetypeRationale && (
              <p className="text-sm leading-relaxed" style={{ color: 'var(--sage)' }}>
                {assessmentRow.archetypeRationale}
              </p>
            )}

            {/* Flag counts */}
            {activeRedFlags.length > 0 && (
              <p className="text-xs mt-3" style={{ color: 'var(--contradiction)' }}>
                {activeRedFlags.length} red flag{activeRedFlags.length !== 1 ? 's' : ''} to review
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Dimension rows + red flags + CTA — interactive (client) */}
      <FitInteractiveSection
        jobId={params.id}
        assessmentId={assessmentRow.id}
        dimScores={dimScores}
        dimensionAnnotations={dimensionAnnotations}
        redFlags={redFlags}
        dismissedRedFlags={dismissedRedFlags}
      />

      {/* Generate Materials CTA */}
      <div
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-lg mt-6"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
      >
        <div>
          <p className="text-sm font-medium" style={{ color: 'var(--mist)' }}>
            Ready to apply?
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--sage)' }}>
            Generate a tailored CV and cover letter from your example bank.
          </p>
        </div>
        <Link
          href={`/materials/${params.id}`}
          className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold shrink-0"
          style={{ background: 'var(--amber)', color: '#111a24' }}
        >
          Generate Materials →
        </Link>
      </div>
    </div>
  );
}
