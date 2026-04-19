import Link from 'next/link';
import { Building2 } from 'lucide-react';

interface JobContextHeaderProps {
  company: string;
  role: string;
  jobId: string;
  currentPhase: 'research' | 'fit' | 'materials';
  hasResearch: boolean;
  hasFit: boolean;
  hasMaterials: boolean;
}

type Phase = {
  key: 'research' | 'fit' | 'materials';
  label: string;
  href: (id: string) => string;
};

const PHASES: Phase[] = [
  { key: 'research', label: 'Research', href: (id) => `/research/${id}` },
  { key: 'fit',      label: 'Fit',      href: (id) => `/fit/${id}` },
  { key: 'materials', label: 'Materials', href: (id) => `/materials/${id}` },
];

function phaseComplete(phase: Phase['key'], hasResearch: boolean, hasFit: boolean, hasMaterials: boolean): boolean {
  if (phase === 'research') return hasResearch;
  if (phase === 'fit')      return hasFit;
  if (phase === 'materials') return hasMaterials;
  return false;
}

export function JobContextHeader({
  company,
  role,
  jobId,
  currentPhase,
  hasResearch,
  hasFit,
  hasMaterials,
}: JobContextHeaderProps) {
  // Truncate "Company — Role" to 40 chars total
  const fullLabel = `${company} — ${role}`;
  const displayLabel = fullLabel.length > 40 ? fullLabel.slice(0, 37) + '…' : fullLabel;

  return (
    <div
      className="flex items-center justify-between px-4 mb-6 -mx-0 rounded-lg"
      style={{
        height: '48px',
        background: 'var(--tay)',
        borderBottom: '1px solid var(--border)',
        border: '1px solid var(--border)',
      }}
    >
      {/* Left: company + role */}
      <div className="flex items-center gap-2 min-w-0">
        <Building2
          size={16}
          strokeWidth={1.5}
          style={{ color: 'var(--sage)', flexShrink: 0 }}
        />
        <span
          className="text-sm font-medium truncate"
          style={{ color: 'var(--mist)' }}
          title={fullLabel}
        >
          {displayLabel}
        </span>
      </div>

      {/* Right: phase pills */}
      <nav aria-label="Application phases" className="flex items-center gap-1.5 shrink-0">
        {PHASES.map((phase) => {
          const isActive = currentPhase === phase.key;
          const isDone = phaseComplete(phase.key, hasResearch, hasFit, hasMaterials) && !isActive;

          let pillStyle: React.CSSProperties = {};
          if (isActive) {
            pillStyle = {
              background: 'var(--amber)',
              color: '#111a24',
              border: '1px solid var(--amber)',
            };
          } else if (isDone) {
            pillStyle = {
              background: 'transparent',
              color: 'var(--copper)',
              border: '1px solid var(--copper)',
            };
          } else {
            pillStyle = {
              background: 'transparent',
              color: 'var(--sage)',
              border: '1px solid var(--border)',
            };
          }

          return (
            <Link
              key={phase.key}
              href={phase.href(jobId)}
              className="px-2.5 py-0.5 rounded-full text-xs font-medium transition-opacity duration-100"
              style={pillStyle}
              aria-current={isActive ? 'page' : undefined}
            >
              {phase.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
