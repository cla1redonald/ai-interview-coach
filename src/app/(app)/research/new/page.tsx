'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

const PROGRESS_STEPS = [
  { label: 'Company overview', delayMs: 0 },
  { label: 'Funding and growth stage', delayMs: 8000 },
  { label: 'Recent news and announcements', delayMs: 16000 },
  { label: 'Tech stack and engineering culture', delayMs: 22000 },
  { label: 'Key people', delayMs: 28000 },
];

type StepState = 'pending' | 'active' | 'done';

interface FormErrors {
  content?: string;
  jobUrl?: string;
  jobTitle?: string;
}

export default function NewResearchPage() {
  const router = useRouter();

  // Form state
  const [jobUrl, setJobUrl] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});

  // Loading state
  const [loading, setLoading] = useState(false);
  const [stepStates, setStepStates] = useState<StepState[]>(PROGRESS_STEPS.map(() => 'pending'));
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);

  // Error/failure state
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [failedJobId, setFailedJobId] = useState<string | null>(null);

  // Textarea auto-expand
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  function autoResize() {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.max(200, el.scrollHeight) + 'px';
    }
  }

  // Kick off simulated progress timers
  function startProgressTimers() {
    // Clear any existing timers
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];

    // Mark step 0 as active immediately
    setStepStates(PROGRESS_STEPS.map((_, i) => (i === 0 ? 'active' : 'pending')));

    PROGRESS_STEPS.forEach((step, i) => {
      // Each step becomes "done" after the NEXT step's delay (or after a fixed time for the last)
      const nextDelay = PROGRESS_STEPS[i + 1]?.delayMs ?? step.delayMs + 6000;

      const activateNext = setTimeout(() => {
        setStepStates((prev) => {
          const next = [...prev];
          next[i] = 'done';
          if (i + 1 < next.length) next[i + 1] = 'active';
          return next;
        });
      }, nextDelay);

      timersRef.current.push(activateNext);
    });
  }

  function clearProgressTimers() {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => clearProgressTimers();
  }, []);

  function validate(): boolean {
    const errs: FormErrors = {};

    if (!jobUrl.trim() && !jobDescription.trim()) {
      errs.content = 'Please provide a job URL or paste the job description.';
    }

    if (jobUrl.trim()) {
      try {
        new URL(jobUrl.trim());
      } catch {
        errs.jobUrl = 'Please enter a valid URL (e.g. https://example.com/jobs/123).';
      }
    }

    if (!jobTitle.trim()) {
      errs.jobTitle = 'Job title is required.';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSubmitError(null);
    setLoading(true);
    startProgressTimers();

    const displayName = companyName.trim() || 'the company';

    try {
      // Step 1: Create the application
      const createRes = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobTitle: jobTitle.trim(),
          companyName: companyName.trim() || 'Unknown',
          jobDescription: jobDescription.trim() || undefined,
          jobUrl: jobUrl.trim() || undefined,
        }),
      });

      if (!createRes.ok) {
        const data = await createRes.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? 'Failed to create application');
      }

      const createData = (await createRes.json()) as { application: { id: string } };
      const appId = createData.application.id;
      setCurrentJobId(appId);

      // Step 2: Run research
      const researchRes = await fetch(`/api/applications/${appId}/research`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      clearProgressTimers();

      if (!researchRes.ok) {
        const data = await researchRes.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? 'Research failed');
      }

      // Mark all steps done
      setStepStates(PROGRESS_STEPS.map(() => 'done'));

      // Short pause so user sees completion, then redirect
      await new Promise((r) => setTimeout(r, 600));
      router.push(`/research/${appId}`);
    } catch (err) {
      clearProgressTimers();
      setLoading(false);
      setStepStates(PROGRESS_STEPS.map(() => 'pending'));
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      if (currentJobId) setFailedJobId(currentJobId);
    }

    void displayName; // used in template literal below but linter may flag otherwise
  }

  const researchingFor = companyName.trim() || 'the company';

  // ── Loading/progress view ───────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-lg mx-auto flex flex-col items-center justify-center min-h-[60vh] gap-8">
        <Loader2
          size={32}
          strokeWidth={1.5}
          className="animate-spin"
          style={{ color: 'var(--amber)' }}
        />
        <h3
          className="font-heading text-xl font-semibold text-center"
          style={{ color: 'var(--mist)' }}
        >
          Researching {researchingFor}…
        </h3>

        <ul className="space-y-3 w-full max-w-xs" aria-live="polite" aria-label="Research progress">
          {PROGRESS_STEPS.map((step, i) => {
            const state = stepStates[i];
            return (
              <li key={step.label} className="flex items-center gap-3">
                {state === 'done' ? (
                  <CheckCircle2
                    size={14}
                    strokeWidth={1.5}
                    style={{ color: 'var(--match-high)', flexShrink: 0 }}
                    aria-label="Complete"
                  />
                ) : state === 'active' ? (
                  <Loader2
                    size={14}
                    strokeWidth={1.5}
                    className="animate-spin"
                    style={{ color: 'var(--amber)', flexShrink: 0 }}
                    aria-label="In progress"
                  />
                ) : (
                  <span
                    style={{ color: 'var(--sage)', width: 14, flexShrink: 0, textAlign: 'center' }}
                    aria-label="Pending"
                  >
                    ·
                  </span>
                )}
                <span
                  className="text-sm"
                  style={{
                    color: state === 'done' ? 'var(--mist)' : state === 'active' ? 'var(--mist)' : 'var(--sage)',
                  }}
                >
                  {step.label}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  // ── Error view ──────────────────────────────────────────────────────────────
  if (submitError) {
    return (
      <div className="max-w-lg mx-auto flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center">
        <div
          className="rounded-lg p-6"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <p className="text-sm font-medium mb-2" style={{ color: 'var(--mist)' }}>
            Research failed
          </p>
          <p className="text-sm mb-6" style={{ color: 'var(--sage)' }}>
            {submitError}
          </p>
          <div className="flex flex-col gap-2 items-center">
            <button
              type="button"
              onClick={() => {
                setSubmitError(null);
                setFailedJobId(null);
              }}
              className="px-4 py-2 rounded-md text-sm font-medium"
              style={{ background: 'var(--copper)', color: '#111a24' }}
            >
              Try again
            </button>
            {failedJobId && (
              <Link
                href={`/fit/new?job_id=${failedJobId}`}
                className="text-sm"
                style={{ color: 'var(--sage)' }}
              >
                Continue without research →
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Form view ───────────────────────────────────────────────────────────────
  return (
    <div className="max-w-[680px] mx-auto">
      <div className="mb-8">
        <h1
          className="font-heading text-3xl font-bold mb-1"
          style={{ color: 'var(--mist)', letterSpacing: '-0.01em' }}
        >
          Research a company
        </h1>
        <p className="text-sm" style={{ color: 'var(--sage)' }}>
          Paste the job listing and we&apos;ll research the company for you.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {/* Job URL */}
        <div>
          <label
            htmlFor="jobUrl"
            className="block text-sm font-medium mb-1.5"
            style={{ color: 'var(--mist)' }}
          >
            Job listing URL
            <span className="ml-1 font-normal" style={{ color: 'var(--sage)' }}>
              (optional)
            </span>
          </label>
          <input
            id="jobUrl"
            type="url"
            value={jobUrl}
            onChange={(e) => setJobUrl(e.target.value)}
            placeholder="https://company.com/jobs/head-of-product"
            className="w-full rounded-md px-3 py-2 text-sm"
            style={{
              background: 'var(--card)',
              border: `1px solid ${errors.jobUrl ? 'var(--contradiction)' : 'var(--border)'}`,
              color: 'var(--mist)',
              outline: 'none',
            }}
          />
          {errors.jobUrl && (
            <p className="text-xs mt-1" style={{ color: 'var(--contradiction)' }}>
              {errors.jobUrl}
            </p>
          )}
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <span className="text-xs" style={{ color: 'var(--sage)' }}>
            or paste the full job description
          </span>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>

        {/* Job description textarea */}
        <div>
          <label
            htmlFor="jobDescription"
            className="block text-sm font-medium mb-1.5"
            style={{ color: 'var(--mist)' }}
          >
            Job description
          </label>
          <div className="relative">
            <textarea
              id="jobDescription"
              ref={textareaRef}
              value={jobDescription}
              onChange={(e) => {
                setJobDescription(e.target.value);
                autoResize();
              }}
              placeholder="Paste the full job description here…"
              className="w-full rounded-md px-3 py-2 text-sm resize-none"
              style={{
                minHeight: '200px',
                background: 'var(--card)',
                border: `1px solid ${errors.content ? 'var(--contradiction)' : 'var(--border)'}`,
                color: 'var(--mist)',
                outline: 'none',
              }}
            />
            <p
              className="absolute bottom-2 right-3 text-xs pointer-events-none"
              style={{ color: 'var(--sage)' }}
            >
              {jobDescription.length.toLocaleString()} chars
            </p>
          </div>
          {errors.content && (
            <p className="text-xs mt-1" style={{ color: 'var(--contradiction)' }}>
              {errors.content}
            </p>
          )}
        </div>

        {/* Company name */}
        <div>
          <label
            htmlFor="companyName"
            className="block text-sm font-medium mb-1.5"
            style={{ color: 'var(--mist)' }}
          >
            Company name
            <span className="ml-1 font-normal" style={{ color: 'var(--sage)' }}>
              (optional — auto-filled from URL)
            </span>
          </label>
          <input
            id="companyName"
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Acme Corp"
            className="w-full rounded-md px-3 py-2 text-sm"
            style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              color: 'var(--mist)',
              outline: 'none',
            }}
          />
        </div>

        {/* Job title */}
        <div>
          <label
            htmlFor="jobTitle"
            className="block text-sm font-medium mb-1.5"
            style={{ color: 'var(--mist)' }}
          >
            Job title
            <span className="ml-1" style={{ color: 'var(--contradiction)' }}>
              *
            </span>
          </label>
          <input
            id="jobTitle"
            type="text"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            placeholder="Head of Product"
            required
            className="w-full rounded-md px-3 py-2 text-sm"
            style={{
              background: 'var(--card)',
              border: `1px solid ${errors.jobTitle ? 'var(--contradiction)' : 'var(--border)'}`,
              color: 'var(--mist)',
              outline: 'none',
            }}
          />
          {errors.jobTitle && (
            <p className="text-xs mt-1" style={{ color: 'var(--contradiction)' }}>
              {errors.jobTitle}
            </p>
          )}
        </div>

        {/* Submit */}
        <div>
          <button
            type="submit"
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-md text-sm font-semibold"
            style={{ background: 'var(--copper)', color: '#111a24' }}
          >
            Research this company →
          </button>
          <p className="text-xs mt-2" style={{ color: 'var(--sage)' }}>
            This takes 20–40 seconds
          </p>
        </div>
      </form>
    </div>
  );
}
