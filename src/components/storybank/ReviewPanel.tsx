'use client';

import { useState, useRef, useCallback } from 'react';
import { Trash2, Tag, X, ThumbsUp, Minus, ThumbsDown, CheckCircle2, AlertTriangle, Plus } from 'lucide-react';

interface TagData {
  id: string;
  name: string;
  isSystem: boolean;
  userId: string | null;
}

interface SourcePosition {
  start_line: number;
  end_line: number;
}

interface ExampleData {
  id: string;
  question: string;
  answer: string;
  sourcePosition: string | null; // JSON string
  qualityRating: string | null;
  tags: TagData[];
}

interface ReviewPanelProps {
  transcriptLines: string[];
  initialExamples: ExampleData[];
  availableTags: TagData[];
  warnings: string[];
  transcriptId: string;
}

type QualityRating = 'strong' | 'weak' | 'neutral';

function parseSourcePosition(raw: string | null): SourcePosition | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SourcePosition;
  } catch {
    return null;
  }
}

function QualityButton({
  rating,
  current,
  onClick,
}: {
  rating: QualityRating;
  current: string | null;
  onClick: () => void;
}) {
  const isActive = current === rating;
  const configs: Record<QualityRating, { icon: React.ReactNode; label: string; color: string; activeColor: string }> = {
    strong: {
      icon: <ThumbsUp size={14} strokeWidth={1.5} />,
      label: 'Strong',
      color: 'var(--sage)',
      activeColor: 'var(--quality-strong)',
    },
    neutral: {
      icon: <Minus size={14} strokeWidth={1.5} />,
      label: 'Neutral',
      color: 'var(--sage)',
      activeColor: 'var(--sage)',
    },
    weak: {
      icon: <ThumbsDown size={14} strokeWidth={1.5} />,
      label: 'Weak',
      color: 'var(--sage)',
      activeColor: 'var(--quality-weak)',
    },
  };
  const cfg = configs[rating];

  return (
    <button
      type="button"
      onClick={onClick}
      title={cfg.label}
      aria-label={`Rate as ${cfg.label}`}
      aria-pressed={isActive}
      className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-all"
      style={{
        color: isActive ? cfg.activeColor : cfg.color,
        background: isActive ? `${cfg.activeColor}18` : 'transparent',
        border: `1px solid ${isActive ? cfg.activeColor : 'var(--border)'}`,
      }}
    >
      {cfg.icon}
      {cfg.label}
    </button>
  );
}

function ExampleCard({
  example,
  availableTags,
  highlightedLines,
  onHover,
  onUpdate,
  onDelete,
}: {
  example: ExampleData;
  availableTags: TagData[];
  highlightedLines: Set<number> | null;
  onHover: (pos: SourcePosition | null) => void;
  onUpdate: (id: string, updates: Partial<ExampleData> & { tagIds?: string[] }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [question, setQuestion] = useState(example.question);
  const [answer, setAnswer] = useState(example.answer);
  const [saving, setSaving] = useState(false);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [tagError, setTagError] = useState<string | null>(null);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sourcePos = parseSourcePosition(example.sourcePosition);
  const isHighlighted = highlightedLines != null && sourcePos != null &&
    sourcePos.start_line <= (Math.max(...Array.from(highlightedLines)) || 0) &&
    sourcePos.end_line >= (Math.min(...Array.from(highlightedLines)) || 0);

  async function saveField(field: 'question' | 'answer', value: string) {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(async () => {
      setSaving(true);
      await onUpdate(example.id, { [field]: value });
      setSaving(false);
    }, 800);
  }

  async function setQuality(rating: QualityRating) {
    const newRating = example.qualityRating === rating ? null : rating;
    await onUpdate(example.id, { qualityRating: newRating as string | null });
  }

  async function removeTag(tagId: string) {
    const remaining = example.tags.filter(t => t.id !== tagId).map(t => t.id);
    await onUpdate(example.id, { tagIds: remaining });
  }

  async function addTag(tagId: string) {
    if (example.tags.find(t => t.id === tagId)) return;
    const updated = [...example.tags.map(t => t.id), tagId];
    await onUpdate(example.id, { tagIds: updated });
    setShowTagPicker(false);
  }

  async function createAndAddTag() {
    setTagError(null);
    const name = newTagName.trim();
    if (!name) return;

    try {
      const res = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setTagError(data.error ?? 'Failed to create tag');
        return;
      }
      const data = await res.json();
      await addTag(data.tag.id);
      setNewTagName('');
    } catch {
      setTagError('Network error');
    }
  }

  const unassignedTags = availableTags.filter(
    t => !example.tags.find(et => et.id === t.id)
  );

  return (
    <article
      onMouseEnter={() => sourcePos && onHover(sourcePos)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => sourcePos && onHover(sourcePos)}
      className="rounded-lg p-4 flex flex-col gap-3"
      style={{
        background: 'var(--card)',
        border: `1px solid ${isHighlighted ? 'var(--amber)' : 'var(--border)'}`,
        transition: 'border-color 0.15s',
      }}
    >
      {/* Question */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--copper)' }}>
          Question
        </label>
        <textarea
          value={question}
          onChange={e => {
            setQuestion(e.target.value);
            saveField('question', e.target.value);
          }}
          rows={2}
          className="w-full rounded px-2 py-1.5 text-sm resize-y"
          style={{
            background: 'var(--background)',
            border: '1px solid var(--border)',
            color: 'var(--foreground)',
            fontFamily: 'var(--font-sans)',
            lineHeight: '1.5',
          }}
          aria-label="Edit question"
        />
      </div>

      {/* Answer */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--sage)' }}>
          Answer
        </label>
        <textarea
          value={answer}
          onChange={e => {
            setAnswer(e.target.value);
            saveField('answer', e.target.value);
          }}
          rows={4}
          className="w-full rounded px-2 py-1.5 text-sm resize-y"
          style={{
            background: 'var(--background)',
            border: '1px solid var(--border)',
            color: 'var(--foreground)',
            fontFamily: 'var(--font-sans)',
            lineHeight: '1.5',
          }}
          aria-label="Edit answer"
        />
      </div>

      {/* Source citation */}
      {sourcePos && (
        <p className="text-xs" style={{ color: 'var(--sage)' }}>
          Lines {sourcePos.start_line}–{sourcePos.end_line}
        </p>
      )}

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5 items-center">
        {example.tags.map(tag => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
            style={{ background: 'var(--amber-faint)', color: 'var(--amber)', border: '1px solid var(--amber-glow)' }}
          >
            {tag.name}
            <button
              type="button"
              onClick={() => removeTag(tag.id)}
              aria-label={`Remove tag ${tag.name}`}
              className="hover:opacity-70 transition-opacity"
            >
              <X size={10} strokeWidth={2} />
            </button>
          </span>
        ))}

        {/* Add tag button */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowTagPicker(v => !v)}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-colors"
            style={{
              background: 'transparent',
              border: '1px dashed var(--border)',
              color: 'var(--sage)',
            }}
            aria-label="Add tag"
          >
            <Tag size={10} strokeWidth={1.5} />
            Add tag
          </button>

          {showTagPicker && (
            <div
              className="absolute left-0 top-full mt-1 z-20 rounded-lg shadow-xl p-2 min-w-48"
              style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
            >
              {/* Existing tags autocomplete */}
              {unassignedTags.length > 0 && (
                <div className="mb-2 max-h-40 overflow-y-auto">
                  {unassignedTags.map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => addTag(t.id)}
                      className="w-full text-left px-2 py-1 rounded text-xs hover:opacity-80 transition-opacity"
                      style={{ color: 'var(--foreground)' }}
                    >
                      {t.name}
                      {t.isSystem && (
                        <span className="ml-1 text-xs" style={{ color: 'var(--sage)' }}>(system)</span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Create new tag */}
              <div className="flex gap-1">
                <input
                  type="text"
                  value={newTagName}
                  onChange={e => setNewTagName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') createAndAddTag(); }}
                  placeholder="New tag…"
                  className="flex-1 rounded px-2 py-1 text-xs"
                  style={{
                    background: 'var(--background)',
                    border: '1px solid var(--border)',
                    color: 'var(--foreground)',
                  }}
                  aria-label="New tag name"
                />
                <button
                  type="button"
                  onClick={createAndAddTag}
                  className="px-2 py-1 rounded text-xs"
                  style={{ background: 'var(--amber)', color: '#111a24' }}
                  aria-label="Create tag"
                >
                  <Plus size={12} strokeWidth={2} />
                </button>
              </div>
              {tagError && (
                <p className="text-xs mt-1" style={{ color: 'var(--quality-weak)' }}>{tagError}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Quality rating + delete */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-xs" style={{ color: 'var(--sage)' }}>Quality:</span>
          {(['strong', 'neutral', 'weak'] as QualityRating[]).map(r => (
            <QualityButton
              key={r}
              rating={r}
              current={example.qualityRating}
              onClick={() => setQuality(r)}
            />
          ))}
        </div>

        <div className="flex items-center gap-2">
          {saving && (
            <span className="text-xs" style={{ color: 'var(--sage)' }}>Saving…</span>
          )}
          <button
            type="button"
            onClick={() => onDelete(example.id)}
            className="p-1.5 rounded hover:opacity-70 transition-opacity"
            style={{ color: 'var(--quality-weak)' }}
            aria-label="Delete this Q&A pair"
          >
            <Trash2 size={14} strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </article>
  );
}

export function ReviewPanel({
  transcriptLines,
  initialExamples,
  availableTags,
  warnings,
}: ReviewPanelProps) {
  const [exampleList, setExampleList] = useState<ExampleData[]>(initialExamples);
  const [hoveredPos, setHoveredPos] = useState<SourcePosition | null>(null);
  const [allApproved, setAllApproved] = useState(false);

  const highlightedLines = hoveredPos
    ? new Set(
        Array.from(
          { length: hoveredPos.end_line - hoveredPos.start_line + 1 },
          (_, i) => hoveredPos.start_line + i
        )
      )
    : null;

  const handleUpdate = useCallback(async (id: string, updates: Partial<ExampleData> & { tagIds?: string[] }) => {
    const res = await fetch(`/api/examples/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      const data = await res.json();
      setExampleList(list =>
        list.map(e => e.id === id ? { ...e, ...data.example } : e)
      );
    }
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    const res = await fetch(`/api/examples/${id}`, { method: 'DELETE' });
    if (res.ok || res.status === 204) {
      setExampleList(list => list.filter(e => e.id !== id));
    }
  }, []);

  return (
    <div className="flex flex-col lg:flex-row gap-0 h-[calc(100vh-120px)]" style={{ minHeight: 600 }}>
      {/* LEFT: Transcript with line highlights */}
      <div
        className="lg:w-1/2 overflow-auto flex-shrink-0"
        style={{
          borderRight: '1px solid var(--border)',
          background: 'var(--card)',
        }}
      >
        <div
          className="px-4 py-2.5 sticky top-0 z-10"
          style={{ background: 'var(--card)', borderBottom: '1px solid var(--border)' }}
        >
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--sage)' }}>
            Transcript — hover a pair to highlight
          </span>
        </div>
        <table className="w-full text-sm" style={{ fontFamily: 'var(--font-mono)', borderCollapse: 'collapse' }}>
          <tbody>
            {transcriptLines.map((line, i) => {
              const lineNum = i + 1;
              const isHighlightedLine = highlightedLines?.has(lineNum) ?? false;
              return (
                <tr
                  key={i}
                  id={`tl-${lineNum}`}
                  style={{ background: isHighlightedLine ? 'var(--amber-faint)' : 'transparent' }}
                >
                  <td
                    className="select-none text-right pr-4 pl-4 py-0.5 align-top shrink-0"
                    style={{
                      color: isHighlightedLine ? 'var(--amber)' : 'var(--sage)',
                      fontSize: '12px',
                      width: '3.5rem',
                      userSelect: 'none',
                      borderRight: `1px solid ${isHighlightedLine ? 'var(--amber-glow)' : 'var(--border)'}`,
                      transition: 'color 0.1s, background 0.1s',
                    }}
                  >
                    {lineNum}
                  </td>
                  <td
                    className="pl-4 pr-4 py-0.5 align-top whitespace-pre-wrap break-words"
                    style={{
                      color: isHighlightedLine ? 'var(--mist)' : 'var(--sage)',
                      fontSize: '13px',
                      lineHeight: '1.6',
                      transition: 'color 0.1s',
                    }}
                  >
                    {line || ' '}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* RIGHT: Extracted Q&A pairs */}
      <div className="lg:w-1/2 overflow-auto flex flex-col">
        {/* Warnings */}
        {warnings.length > 0 && (
          <div
            className="m-4 p-3 rounded-lg flex gap-2"
            style={{ background: 'rgba(226, 160, 57, 0.08)', border: '1px solid var(--amber-glow)' }}
          >
            <AlertTriangle size={16} strokeWidth={1.5} className="shrink-0 mt-0.5" style={{ color: 'var(--amber)' }} />
            <div>
              <p className="text-xs font-semibold mb-1" style={{ color: 'var(--amber)' }}>
                Extraction warnings
              </p>
              <ul className="text-xs space-y-0.5" style={{ color: 'var(--mist)' }}>
                {warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          </div>
        )}

        {/* Header */}
        <div
          className="px-4 py-2.5 flex items-center justify-between sticky top-0 z-10"
          style={{ background: 'var(--background)', borderBottom: '1px solid var(--border)' }}
        >
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--sage)' }}>
            {exampleList.length} pair{exampleList.length !== 1 ? 's' : ''} extracted
          </span>
          {!allApproved && exampleList.length > 0 && (
            <button
              type="button"
              onClick={() => setAllApproved(true)}
              className="flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold transition-opacity hover:opacity-80"
              style={{ background: 'var(--amber)', color: '#111a24' }}
            >
              <CheckCircle2 size={13} strokeWidth={2} />
              Approve All
            </button>
          )}
          {allApproved && (
            <span
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded"
              style={{ background: 'rgba(90, 114, 71, 0.18)', color: '#7fa85a' }}
            >
              <CheckCircle2 size={13} strokeWidth={2} />
              All approved
            </span>
          )}
        </div>

        {/* Example cards */}
        <div className="p-4 flex flex-col gap-4">
          {exampleList.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: 'var(--sage)' }}>
              All pairs have been deleted.
            </p>
          ) : (
            exampleList.map(example => (
              <ExampleCard
                key={example.id}
                example={example}
                availableTags={availableTags}
                highlightedLines={highlightedLines}
                onHover={setHoveredPos}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
