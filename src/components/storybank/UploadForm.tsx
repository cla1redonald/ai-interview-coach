'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, ChevronDown, Loader2, Upload } from 'lucide-react';

const ROUND_OPTIONS = [
  { value: '', label: 'Select round' },
  { value: 'screening', label: 'Recruiter screen' },
  { value: 'first', label: 'Hiring manager' },
  { value: 'second', label: 'Panel' },
  { value: 'final', label: 'Final' },
  { value: 'other', label: 'Other' },
];

type FormError = {
  text?: string;
  title?: string;
  file?: string;
  general?: string;
};

export function UploadForm() {
  const router = useRouter();

  const [rawText, setRawText] = useState('');
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [interviewerName, setInterviewerName] = useState('');
  const [interviewerRole, setInterviewerRole] = useState('');
  const [interviewDate, setInterviewDate] = useState(() => {
    // Default to today in YYYY-MM-DD
    return new Date().toISOString().split('T')[0];
  });
  const [interviewRound, setInterviewRound] = useState('');
  const [metaExpanded, setMetaExpanded] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormError>({});

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Line / character counts for textarea
  const lineCount = rawText ? rawText.split('\n').length : 0;
  const charCount = rawText.length;

  function validate(): boolean {
    const e: FormError = {};
    if (!title.trim()) e.title = 'Title is required';
    if (!rawText.trim()) {
      e.text = 'Add some transcript text or drop a file to continue';
    } else if (rawText.trim().length < 10) {
      e.text = 'Transcript must be at least 10 characters';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setErrors({});

    try {
      const res = await fetch('/api/transcripts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          rawText: rawText.trim(),
          company: company.trim() || undefined,
          interviewerName: interviewerName.trim() || undefined,
          interviewerRole: interviewerRole.trim() || undefined,
          interviewDate: interviewDate || undefined,
          interviewRound: interviewRound || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrors({ general: (data as { error?: string }).error ?? 'Something went wrong' });
        return;
      }

      const data = await res.json() as { transcript: { id: string } };
      router.push(`/transcripts/${data.transcript.id}`);
    } catch {
      setErrors({ general: 'Network error — please try again' });
    } finally {
      setSubmitting(false);
    }
  }

  function readFile(file: File) {
    if (!file.name.endsWith('.txt') && !file.name.endsWith('.md')) {
      setErrors({ file: 'Only .txt and .md files are supported — paste audio transcription text directly' });
      return;
    }
    setErrors((prev) => ({ ...prev, file: undefined }));
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = (ev.target?.result as string) ?? '';
      setRawText(text);
      // Pre-populate title from filename if empty
      if (!title.trim()) {
        setTitle(file.name.replace(/\.(txt|md)$/, ''));
      }
    };
    reader.readAsText(file);
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) readFile(file);
  }, [title]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = () => setDragging(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) readFile(file);
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      {/* Title */}
      <div className="mb-5">
        <label
          htmlFor="transcript-title"
          className="block text-xs font-semibold mb-1.5 uppercase tracking-wide"
          style={{ color: 'var(--mist)' }}
        >
          Title <span style={{ color: 'var(--amber)' }}>*</span>
        </label>
        <input
          id="transcript-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Airbox — Hiring Manager, April 2026"
          className="w-full rounded-md px-3 py-2 text-sm outline-none transition-colors"
          style={{
            background: 'var(--input)',
            border: errors.title ? '1px solid var(--destructive)' : '1px solid var(--border)',
            color: 'var(--mist)',
          }}
          onFocus={(e) => { e.target.style.boxShadow = '0 0 0 2px var(--amber)'; }}
          onBlur={(e) => { e.target.style.boxShadow = 'none'; }}
        />
        {errors.title && (
          <p className="mt-1 text-xs" style={{ color: 'var(--destructive)' }}>{errors.title}</p>
        )}
      </div>

      {/* Paste Area */}
      <div className="mb-4">
        <label
          htmlFor="transcript-text"
          className="block text-xs font-semibold mb-1.5 uppercase tracking-wide"
          style={{ color: 'var(--mist)' }}
        >
          Transcript <span style={{ color: 'var(--amber)' }}>*</span>
        </label>
        <div className="relative">
          <textarea
            id="transcript-text"
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="Paste your transcript here — Teams, Zoom, or any text format"
            rows={10}
            className="w-full rounded-md px-3 py-2.5 pb-6 text-sm outline-none resize-y transition-colors"
            style={{
              background: 'var(--input)',
              border: errors.text ? '1px solid var(--destructive)' : '1px solid var(--border)',
              color: 'var(--mist)',
              minHeight: '240px',
            }}
            onFocus={(e) => { e.target.style.boxShadow = '0 0 0 2px var(--amber)'; }}
            onBlur={(e) => { e.target.style.boxShadow = 'none'; }}
          />
          {rawText && (
            <span
              className="absolute bottom-2 right-3 text-xs select-none"
              style={{ color: 'var(--sage)' }}
            >
              {lineCount} lines · {charCount.toLocaleString()} chars
            </span>
          )}
        </div>
        {errors.text && (
          <p className="mt-1 text-xs" style={{ color: 'var(--destructive)' }}>{errors.text}</p>
        )}
      </div>

      {/* File Drop Zone */}
      <div
        className="mb-6 rounded-md flex flex-col items-center justify-center gap-2 py-5 px-4 cursor-pointer transition-colors"
        style={{
          border: `1.5px dashed ${dragging ? 'var(--amber)' : 'var(--border)'}`,
          background: dragging ? 'var(--amber-faint)' : 'transparent',
          borderRadius: '4px',
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
        aria-label="Drop a .txt or .md file, or click to browse"
      >
        <FileText size={24} strokeWidth={1.5} style={{ color: 'var(--sage)' }} />
        <p className="text-sm" style={{ color: 'var(--sage)' }}>
          or drop a <code>.txt</code> or <code>.md</code> file
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.md"
          onChange={handleFileChange}
          className="sr-only"
          aria-hidden="true"
        />
      </div>
      {errors.file && (
        <p className="mb-4 text-xs" style={{ color: 'var(--destructive)' }}>{errors.file}</p>
      )}

      {/* Metadata — collapsed by default */}
      <div className="mb-6">
        <button
          type="button"
          onClick={() => setMetaExpanded((v) => !v)}
          className="flex items-center gap-1.5 text-sm transition-colors"
          style={{ color: 'var(--copper)' }}
          aria-expanded={metaExpanded}
        >
          <span>{metaExpanded ? 'Hide interview details' : 'Add interview details +'}</span>
          <ChevronDown
            size={14}
            strokeWidth={1.5}
            style={{ transition: 'transform 200ms', transform: metaExpanded ? 'rotate(180deg)' : 'none' }}
          />
        </button>

        {metaExpanded && (
          <fieldset className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2" style={{ border: 'none', padding: 0 }}>
            <legend className="sr-only">Interview details</legend>

            {/* Date */}
            <div>
              <label
                htmlFor="interview-date"
                className="block text-xs font-semibold mb-1.5 uppercase tracking-wide"
                style={{ color: 'var(--mist)' }}
              >
                Date
              </label>
              <input
                id="interview-date"
                type="date"
                value={interviewDate}
                onChange={(e) => setInterviewDate(e.target.value)}
                className="w-full rounded-md px-3 py-2 text-sm outline-none"
                style={{
                  background: 'var(--input)',
                  border: '1px solid var(--border)',
                  color: 'var(--mist)',
                  colorScheme: 'dark',
                }}
                onFocus={(e) => { e.target.style.boxShadow = '0 0 0 2px var(--amber)'; }}
                onBlur={(e) => { e.target.style.boxShadow = 'none'; }}
              />
            </div>

            {/* Company */}
            <div>
              <label
                htmlFor="company"
                className="block text-xs font-semibold mb-1.5 uppercase tracking-wide"
                style={{ color: 'var(--mist)' }}
              >
                Company
              </label>
              <input
                id="company"
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="e.g. Airbox"
                className="w-full rounded-md px-3 py-2 text-sm outline-none"
                style={{
                  background: 'var(--input)',
                  border: '1px solid var(--border)',
                  color: 'var(--mist)',
                }}
                onFocus={(e) => { e.target.style.boxShadow = '0 0 0 2px var(--amber)'; }}
                onBlur={(e) => { e.target.style.boxShadow = 'none'; }}
              />
            </div>

            {/* Interviewer name / role — single field as per spec */}
            <div className="sm:col-span-2">
              <label
                htmlFor="interviewer"
                className="block text-xs font-semibold mb-1.5 uppercase tracking-wide"
                style={{ color: 'var(--mist)' }}
              >
                Interviewer name
              </label>
              <input
                id="interviewer"
                type="text"
                value={interviewerName}
                onChange={(e) => setInterviewerName(e.target.value)}
                placeholder="e.g. Kasia Kowalski"
                className="w-full rounded-md px-3 py-2 text-sm outline-none"
                style={{
                  background: 'var(--input)',
                  border: '1px solid var(--border)',
                  color: 'var(--mist)',
                }}
                onFocus={(e) => { e.target.style.boxShadow = '0 0 0 2px var(--amber)'; }}
                onBlur={(e) => { e.target.style.boxShadow = 'none'; }}
              />
            </div>

            {/* Interviewer role */}
            <div className="sm:col-span-2">
              <label
                htmlFor="interviewer-role"
                className="block text-xs font-semibold mb-1.5 uppercase tracking-wide"
                style={{ color: 'var(--mist)' }}
              >
                Interviewer role
              </label>
              <input
                id="interviewer-role"
                type="text"
                value={interviewerRole}
                onChange={(e) => setInterviewerRole(e.target.value)}
                placeholder="e.g. VP Product"
                className="w-full rounded-md px-3 py-2 text-sm outline-none"
                style={{
                  background: 'var(--input)',
                  border: '1px solid var(--border)',
                  color: 'var(--mist)',
                }}
                onFocus={(e) => { e.target.style.boxShadow = '0 0 0 2px var(--amber)'; }}
                onBlur={(e) => { e.target.style.boxShadow = 'none'; }}
              />
            </div>

            {/* Interview round */}
            <div>
              <label
                htmlFor="interview-round"
                className="block text-xs font-semibold mb-1.5 uppercase tracking-wide"
                style={{ color: 'var(--mist)' }}
              >
                Round
              </label>
              <select
                id="interview-round"
                value={interviewRound}
                onChange={(e) => setInterviewRound(e.target.value)}
                className="w-full rounded-md px-3 py-2 text-sm outline-none"
                style={{
                  background: 'var(--input)',
                  border: '1px solid var(--border)',
                  color: interviewRound ? 'var(--mist)' : 'var(--sage)',
                  colorScheme: 'dark',
                }}
                onFocus={(e) => { e.target.style.boxShadow = '0 0 0 2px var(--amber)'; }}
                onBlur={(e) => { e.target.style.boxShadow = 'none'; }}
              >
                {ROUND_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value} style={{ background: 'var(--tay)' }}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </fieldset>
        )}
      </div>

      {/* General error */}
      {errors.general && (
        <div
          className="mb-4 px-3 py-2.5 rounded-md text-sm"
          style={{ background: 'var(--card)', borderLeft: '3px solid var(--destructive)', color: 'var(--mist)' }}
        >
          {errors.general}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={submitting}
        className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          height: '44px',
          background: 'var(--primary)',
          color: 'var(--primary-foreground)',
          minWidth: '180px',
        }}
      >
        {submitting ? (
          <>
            <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />
            <span>Saving...</span>
          </>
        ) : (
          <>
            <Upload size={16} strokeWidth={1.5} />
            <span>Save transcript</span>
          </>
        )}
      </button>
      <p className="mt-2 text-xs" style={{ color: 'var(--sage)' }}>
        Q&amp;A extraction will be available once saved.
      </p>
    </form>
  );
}
