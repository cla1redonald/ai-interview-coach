'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { ChevronDown, Link as LinkIcon, Trash2, Copy, MoreHorizontal } from 'lucide-react';
import { QualityBadge } from './QualityBadge';
import { StarBreakdown } from './StarBreakdown';
import { TagPicker } from './TagPicker';

type Quality = 'strong' | 'weak' | 'neutral' | null;

interface Tag {
  id: string;
  name: string;
  isSystem: boolean;
  userId?: string | null;
}

interface StarFields {
  starSituation: string;
  starTask: string;
  starAction: string;
  starResult: string;
  starReflection: string;
}

export interface ExampleData {
  id: string;
  question: string;
  answer: string;
  qualityRating: Quality;
  transcriptId: string | null;
  sourcePosition: string | null;
  company: string | null;
  tags: Tag[];
  createdAt: string;
  starSituation: string | null;
  starTask: string | null;
  starAction: string | null;
  starResult: string | null;
  starReflection: string | null;
}

interface ExampleCardProps {
  example: ExampleData;
  allTags: Tag[];
  onUpdate: (id: string, updates: Partial<ExampleData> & { tagIds?: string[] }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onCreateTag: (name: string) => Promise<Tag | null>;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

export function ExampleCard({ example, allTags, onUpdate, onDelete, onCreateTag }: ExampleCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [qualityLoading, setQualityLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const visibleTags = example.tags.slice(0, 2);
  const overflowCount = example.tags.length - 2;

  const handleQualityChange = useCallback(async (q: Quality) => {
    setQualityLoading(true);
    try {
      await onUpdate(example.id, { qualityRating: q });
    } finally {
      setQualityLoading(false);
    }
  }, [example.id, onUpdate]);

  const handleTagChange = useCallback(async (tagIds: string[]) => {
    await onUpdate(example.id, { tagIds });
  }, [example.id, onUpdate]);

  const handleStarSave = useCallback(async (fields: StarFields) => {
    await onUpdate(example.id, {
      starSituation:  fields.starSituation,
      starTask:       fields.starTask,
      starAction:     fields.starAction,
      starResult:     fields.starResult,
      starReflection: fields.starReflection,
    });
  }, [example.id, onUpdate]);

  const handleCopy = () => {
    navigator.clipboard.writeText(example.answer).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDelete = async () => {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      setTimeout(() => setDeleteConfirm(false), 3000);
      return;
    }
    await onDelete(example.id);
  };

  const selectedTagIds = example.tags.map(t => t.id);

  return (
    <article
      className="rounded-lg transition-all duration-150"
      style={{
        background: 'var(--tay)',
        border: '1px solid var(--border)',
        boxShadow: expanded
          ? '0 0 0 1px var(--amber-faint), 0 4px 16px rgba(226,160,57,0.06)'
          : 'none',
      }}
      onMouseEnter={e => {
        if (!expanded) {
          (e.currentTarget as HTMLElement).style.boxShadow =
            '0 0 0 1px var(--amber-faint), 0 4px 16px rgba(226,160,57,0.06)';
        }
      }}
      onMouseLeave={e => {
        if (!expanded) {
          (e.currentTarget as HTMLElement).style.boxShadow = 'none';
        }
      }}
    >
      {/* Card header */}
      <div className="px-4 pt-4 pb-3">
        {/* Top row: tags + company + menu */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
            {visibleTags.map(t => (
              <span
                key={t.id}
                className="px-2 py-0.5 rounded-full text-xs"
                style={{
                  background: 'var(--tay)',
                  border: '1px solid var(--border)',
                  color: 'var(--sage)',
                }}
              >
                {t.name}
              </span>
            ))}
            {overflowCount > 0 && (
              <span
                className="px-2 py-0.5 rounded-full text-xs"
                style={{
                  background: 'var(--tay)',
                  border: '1px solid var(--border)',
                  color: 'var(--sage)',
                }}
              >
                +{overflowCount} more
              </span>
            )}
            {example.company && (
              <span
                className="px-2 py-0.5 rounded text-xs font-medium"
                style={{
                  background: 'var(--amber-faint)',
                  color: 'var(--amber)',
                }}
              >
                {example.company}
              </span>
            )}
          </div>

          {/* Overflow menu */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setMenuOpen(m => !m)}
              aria-label="More options"
              aria-expanded={menuOpen}
              className="p-1.5 rounded-md transition-colors"
              style={{ color: 'var(--sage)' }}
            >
              <MoreHorizontal size={16} strokeWidth={1.5} />
            </button>
            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setMenuOpen(false)}
                />
                <div
                  className="absolute right-0 top-7 z-20 rounded-md overflow-hidden"
                  style={{
                    background: 'var(--card)',
                    border: '1px solid var(--border-strong)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                    minWidth: '160px',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => { handleCopy(); setMenuOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors hover:bg-white/5"
                    style={{ color: 'var(--mist)' }}
                  >
                    <Copy size={13} strokeWidth={1.5} />
                    {copied ? 'Copied!' : 'Copy answer'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { handleDelete(); setMenuOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors hover:bg-white/5"
                    style={{ color: deleteConfirm ? '#a04040' : 'var(--mist)' }}
                  >
                    <Trash2 size={13} strokeWidth={1.5} />
                    {deleteConfirm ? 'Click again to confirm' : 'Delete'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Question */}
        <h3
          className="font-heading font-semibold text-sm leading-snug mb-2 cursor-pointer"
          style={{ color: 'var(--mist)', letterSpacing: '-0.01em' }}
          onClick={() => setExpanded(e => !e)}
        >
          {example.question}
        </h3>

        {/* Answer preview (collapsed) */}
        {!expanded && (
          <p
            className="text-xs leading-relaxed mb-3 line-clamp-3 cursor-pointer"
            style={{ color: 'var(--sage)' }}
            onClick={() => setExpanded(true)}
          >
            {example.answer}
          </p>
        )}

        {/* Footer row */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-3">
            <QualityBadge quality={example.qualityRating} />
            {example.transcriptId && (
              <Link
                href={`/transcripts/${example.transcriptId}`}
                className="flex items-center gap-1 text-xs transition-colors hover:opacity-80"
                style={{ color: 'var(--copper)' }}
                aria-label="View source in transcript"
              >
                <LinkIcon size={12} strokeWidth={1.5} />
                View in transcript
              </Link>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: 'var(--sage)' }}>
              {formatDate(example.createdAt)}
            </span>
            <button
              type="button"
              onClick={() => setExpanded(e => !e)}
              aria-expanded={expanded}
              aria-label={expanded ? 'Collapse example' : 'Expand example'}
              className="p-0.5 rounded transition-all"
              style={{ color: 'var(--sage)' }}
            >
              <ChevronDown
                size={16}
                strokeWidth={1.5}
                style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 200ms ease-out' }}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div
          className="px-4 pb-4 space-y-4"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          {/* Full answer */}
          <div className="pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--sage)' }}>
              Full answer
            </p>
            <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--mist)' }}>
              {example.answer}
            </p>
          </div>

          {/* Quality rating */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--sage)' }}>
              Quality rating
            </p>
            <QualityBadge
              quality={example.qualityRating}
              interactive
              onSelect={handleQualityChange}
              loading={qualityLoading}
            />
          </div>

          {/* Tag management */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--sage)' }}>
              Tags
            </p>
            <TagPicker
              selected={selectedTagIds}
              options={allTags}
              onChange={handleTagChange}
              onCreateTag={onCreateTag}
            />
          </div>

          {/* STAR breakdown */}
          <div
            className="rounded-md p-4"
            style={{ background: 'var(--card-raised)', border: '1px solid var(--border)' }}
          >
            <StarBreakdown
              exampleId={example.id}
              initial={{
                starSituation:  example.starSituation  ?? '',
                starTask:       example.starTask        ?? '',
                starAction:     example.starAction      ?? '',
                starResult:     example.starResult      ?? '',
                starReflection: example.starReflection  ?? '',
              }}
              onSave={handleStarSave}
            />
          </div>
        </div>
      )}
    </article>
  );
}
