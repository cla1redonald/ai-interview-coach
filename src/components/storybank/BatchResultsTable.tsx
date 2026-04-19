'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Download, Check } from 'lucide-react';
import type { JobApplication, MaterialType } from '@/lib/types';

interface BatchResultsTableProps {
  applications: (JobApplication & { materialsGenerated?: MaterialType[] })[];
  fitThreshold: number;
}

type SortKey = 'company' | 'fitScore' | 'status';

const MATERIAL_LABELS: Record<MaterialType, string> = {
  cv: 'CV',
  cover_letter: 'Cover',
  tracking_note: 'Note',
};

function fitScoreColor(score: number): string {
  if (score >= 70) return 'var(--amber)';
  if (score >= 50) return 'var(--copper)';
  return 'var(--sage)';
}

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

function buildCsv(
  apps: BatchResultsTableProps['applications']
): string {
  const headers = ['Company', 'Role', 'Fit Score', 'Archetype', 'Materials Generated', 'URL'];
  const rows = apps.map((app) => [
    escapeCsvField(app.companyName),
    escapeCsvField(app.jobTitle),
    String(app.fitScoreOverall ?? ''),
    escapeCsvField(app.fitArchetype ?? ''),
    escapeCsvField((app.materialsGenerated ?? []).join(' | ')),
    escapeCsvField(app.jobUrl ?? ''),
  ]);
  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

export function BatchResultsTable({
  applications,
  fitThreshold,
}: BatchResultsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('fitScore');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'fitScore' ? 'desc' : 'asc');
    }
  }

  const sorted = [...applications].sort((a, b) => {
    let cmp = 0;
    if (sortKey === 'company') {
      cmp = a.companyName.localeCompare(b.companyName);
    } else if (sortKey === 'fitScore') {
      cmp = (a.fitScoreOverall ?? 0) - (b.fitScoreOverall ?? 0);
    } else if (sortKey === 'status') {
      cmp = a.status.localeCompare(b.status);
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });

  function downloadCsv() {
    const csv = buildCsv(applications);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'batch-results.csv';
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  function SortIndicator({ col }: { col: SortKey }) {
    if (sortKey !== col) return <span style={{ color: 'var(--border)' }}> ↕</span>;
    return (
      <span style={{ color: 'var(--amber)' }}>
        {' '}{sortDir === 'asc' ? '↑' : '↓'}
      </span>
    );
  }

  const thStyle: React.CSSProperties = {
    padding: '10px 12px',
    textAlign: 'left',
    fontSize: '0.75rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--sage)',
    cursor: 'pointer',
    userSelect: 'none',
    whiteSpace: 'nowrap',
    borderBottom: '1px solid var(--border)',
  };

  return (
    <div>
      {/* Download button */}
      <div className="flex justify-end mb-3">
        <button
          type="button"
          onClick={downloadCsv}
          className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium"
          style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--mist)' }}
        >
          <Download size={14} strokeWidth={1.5} />
          Download CSV
        </button>
      </div>

      {/* Desktop table */}
      <div
        className="hidden md:block rounded-lg overflow-hidden"
        style={{ border: '1px solid var(--border)' }}
      >
        <table className="w-full" style={{ borderCollapse: 'collapse' }}>
          <thead style={{ background: 'var(--card-raised)' }}>
            <tr>
              <th style={thStyle} onClick={() => handleSort('company')}>
                Company <SortIndicator col="company" />
              </th>
              <th style={{ ...thStyle, cursor: 'default' }}>Role</th>
              <th style={thStyle} onClick={() => handleSort('fitScore')}>
                Fit Score <SortIndicator col="fitScore" />
              </th>
              <th style={{ ...thStyle, cursor: 'default' }}>Materials</th>
              <th style={thStyle} onClick={() => handleSort('status')}>
                Status <SortIndicator col="status" />
              </th>
              <th style={{ ...thStyle, cursor: 'default' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((app, idx) => {
              const score = app.fitScoreOverall;
              const isBelow = score !== null && score !== undefined && score < fitThreshold;
              return (
                <tr
                  key={app.id}
                  style={{
                    background: idx % 2 === 0 ? 'var(--card)' : 'var(--card-raised)',
                    borderTop: '1px solid var(--border)',
                  }}
                >
                  <td
                    style={{ padding: '10px 12px', color: 'var(--mist)', fontWeight: 500, fontSize: '0.875rem' }}
                  >
                    {app.companyName}
                  </td>
                  <td
                    style={{ padding: '10px 12px', color: 'var(--sage)', fontSize: '0.875rem' }}
                  >
                    {app.jobTitle}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    {score !== null && score !== undefined ? (
                      <span
                        className="font-mono font-bold tabular-nums text-sm"
                        style={{ color: isBelow ? 'var(--sage)' : fitScoreColor(score) }}
                      >
                        {score}
                        {isBelow && (
                          <span
                            className="ml-1.5 text-xs font-normal"
                            style={{ color: 'var(--sage)' }}
                          >
                            ↓
                          </span>
                        )}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--sage)', fontSize: '0.875rem' }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {(['cv', 'cover_letter', 'tracking_note'] as MaterialType[]).map((type) => {
                        const generated = (app.materialsGenerated ?? []).includes(type);
                        return (
                          <span
                            key={type}
                            className="flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded"
                            style={{
                              background: generated ? 'rgba(196,152,42,0.1)' : 'var(--card-raised)',
                              color: generated ? 'var(--amber)' : 'var(--border)',
                              border: `1px solid ${generated ? 'var(--amber)' : 'var(--border)'}`,
                            }}
                          >
                            {generated && <Check size={10} strokeWidth={2.5} />}
                            {MATERIAL_LABELS[type]}
                          </span>
                        );
                      })}
                    </div>
                  </td>
                  <td
                    style={{ padding: '10px 12px', fontSize: '0.875rem', color: 'var(--sage)', textTransform: 'capitalize' }}
                  >
                    {app.status}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <Link
                      href={`/research/${app.id}`}
                      className="text-sm font-medium"
                      style={{ color: 'var(--copper)' }}
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile card list (< md) */}
      <div className="flex flex-col gap-3 md:hidden">
        {sorted.map((app) => {
          const score = app.fitScoreOverall;
          const isBelow = score !== null && score !== undefined && score < fitThreshold;
          return (
            <div
              key={app.id}
              className="rounded-lg p-4"
              style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p
                    className="font-medium text-sm truncate"
                    style={{ color: 'var(--mist)' }}
                  >
                    {app.companyName}
                  </p>
                  <p
                    className="text-xs mt-0.5 truncate"
                    style={{ color: 'var(--sage)' }}
                  >
                    {app.jobTitle}
                  </p>
                </div>
                {score !== null && score !== undefined && (
                  <span
                    className="font-mono font-bold text-base tabular-nums shrink-0"
                    style={{ color: isBelow ? 'var(--sage)' : fitScoreColor(score) }}
                  >
                    {score}
                  </span>
                )}
              </div>

              {/* Materials */}
              <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                {(['cv', 'cover_letter', 'tracking_note'] as MaterialType[]).map((type) => {
                  const generated = (app.materialsGenerated ?? []).includes(type);
                  return (
                    <span
                      key={type}
                      className="flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded"
                      style={{
                        background: generated ? 'rgba(196,152,42,0.1)' : 'var(--card-raised)',
                        color: generated ? 'var(--amber)' : 'var(--border)',
                        border: `1px solid ${generated ? 'var(--amber)' : 'var(--border)'}`,
                      }}
                    >
                      {generated && <Check size={10} strokeWidth={2.5} />}
                      {MATERIAL_LABELS[type]}
                    </span>
                  );
                })}
              </div>

              <div className="flex items-center justify-between mt-3">
                <span
                  className="text-xs capitalize"
                  style={{ color: 'var(--sage)' }}
                >
                  {app.status}
                </span>
                <Link
                  href={`/research/${app.id}`}
                  className="text-sm font-medium"
                  style={{ color: 'var(--copper)' }}
                >
                  View →
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
