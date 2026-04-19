'use client';

import { useState, useEffect, useCallback } from 'react';
import { Copy, RefreshCw, Loader2 } from 'lucide-react';
import { JobContextHeader } from '@/components/storybank/JobContextHeader';
import { MaterialsEditor } from '@/components/storybank/MaterialsEditor';
import { MasterCvModal } from '@/components/storybank/MasterCvModal';
import type { MaterialType, GeneratedMaterial, JobApplication } from '@/lib/types';

// ─── Tab definitions ──────────────────────────────────────────────────────────

interface Tab {
  type: MaterialType;
  label: string;
}

const TABS: Tab[] = [
  { type: 'cv',            label: 'CV' },
  { type: 'cover_letter',  label: 'Cover Letter' },
  { type: 'tracking_note', label: 'Tracking Note' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return new Date(isoDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MaterialsDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const jobId = params.id;

  // Application + materials state
  const [application, setApplication] = useState<JobApplication | null>(null);
  const [materials, setMaterials] = useState<GeneratedMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tab state
  const [activeTab, setActiveTab] = useState<MaterialType>('cv');

  // Per-tab generation state
  const [generating, setGenerating] = useState<MaterialType | null>(null);
  const [genError, setGenError] = useState<string | null>(null);

  // Saving state
  const [saving, setSaving] = useState(false);

  // Copied state for copy button
  const [copied, setCopied] = useState(false);

  // Master CV modal
  const [masterCvModalOpen, setMasterCvModalOpen] = useState(false);
  const [pendingGenType, setPendingGenType] = useState<MaterialType | null>(null);
  const [masterCv, setMasterCv] = useState<string>('');

  // ─── Load application + materials ─────────────────────────────────────────

  const loadData = useCallback(async () => {
    try {
      const res = await fetch(`/api/applications/${jobId}`);
      if (!res.ok) {
        setError('Failed to load application.');
        return;
      }
      const data = await res.json() as {
        application: JobApplication;
        materials: GeneratedMaterial[];
      };
      setApplication(data.application);
      setMaterials(data.materials ?? []);
    } catch {
      setError('Failed to load application data.');
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // ─── Auto-generate tracking_note on first tab open ─────────────────────────

  useEffect(() => {
    if (loading) return;
    if (activeTab !== 'tracking_note') return;
    const exists = materials.find((m) => m.type === 'tracking_note');
    if (exists) return;

    // Auto-generate tracking note
    void generateMaterial('tracking_note', undefined, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, loading]);

  // ─── Generate material ─────────────────────────────────────────────────────

  async function generateMaterial(
    type: MaterialType,
    cv?: string,
    force = false
  ) {
    setGenerating(type);
    setGenError(null);
    try {
      const body: Record<string, unknown> = { types: [type], force };
      if (cv) body.masterCv = cv;
      const res = await fetch(`/api/applications/${jobId}/materials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json() as { error?: string };
        setGenError(data.error ?? 'Generation failed.');
        return;
      }

      // Reload materials
      await loadData();
    } catch {
      setGenError('Network error during generation.');
    } finally {
      setGenerating(null);
    }
  }

  // ─── Handle "Generate" click for cv / cover_letter ─────────────────────────

  function handleGenerateClick(type: MaterialType) {
    if (type === 'cv') {
      // Prompt for master CV before generating
      setPendingGenType(type);
      setMasterCvModalOpen(true);
    } else {
      void generateMaterial(type, masterCv || undefined, false);
    }
  }

  function handleMasterCvSubmit(cv: string) {
    setMasterCv(cv);
    if (pendingGenType) {
      void generateMaterial(pendingGenType, cv || undefined, false);
      setPendingGenType(null);
    }
  }

  // ─── Handle "Regenerate" click ─────────────────────────────────────────────

  function handleRegenerate(type: MaterialType) {
    if (type === 'cv') {
      setPendingGenType(type);
      setMasterCvModalOpen(true);
    } else {
      void generateMaterial(type, masterCv || undefined, true);
    }
  }

  // ─── Save material content (from editor blur) ──────────────────────────────

  async function handleSave(material: GeneratedMaterial, newContent: string) {
    setSaving(true);
    try {
      await fetch(`/api/applications/${jobId}/materials/${material.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newContent }),
      });
      // Update local state
      setMaterials((prev) =>
        prev.map((m) =>
          m.id === material.id
            ? { ...m, content: newContent, updatedAt: new Date().toISOString() }
            : m
        )
      );
    } catch {
      // Silent — content is in editor state
    } finally {
      setSaving(false);
    }
  }

  // ─── Copy to clipboard ─────────────────────────────────────────────────────

  async function handleCopy(content: string) {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2
          size={32}
          strokeWidth={1.5}
          className="animate-spin"
          style={{ color: 'var(--amber)' }}
        />
      </div>
    );
  }

  if (error || !application) {
    return (
      <div className="max-w-3xl">
        <p className="text-sm" style={{ color: 'var(--sage)' }}>
          {error ?? 'Application not found.'}
        </p>
      </div>
    );
  }

  const isGeneratingActive = generating === activeTab;

  return (
    <div className="max-w-4xl">
      <JobContextHeader
        company={application.companyName}
        role={application.jobTitle}
        jobId={jobId}
        currentPhase="materials"
        hasResearch={Boolean(application.researchedAt)}
        hasFit={Boolean(application.assessedAt)}
        hasMaterials={Boolean(application.materialsAt)}
      />

      {/* Tab bar */}
      <div
        className="flex items-center gap-1 mb-6"
        role="tablist"
        aria-label="Material types"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.type;
          const hasMaterial = materials.some((m) => m.type === tab.type);
          return (
            <button
              key={tab.type}
              role="tab"
              aria-selected={isActive}
              aria-controls={`panel-${tab.type}`}
              id={`tab-${tab.type}`}
              type="button"
              onClick={() => setActiveTab(tab.type)}
              className="px-4 py-2.5 text-sm font-medium relative transition-colors duration-100"
              style={{
                color: isActive ? 'var(--amber)' : hasMaterial ? 'var(--mist)' : 'var(--sage)',
                borderBottom: isActive ? '2px solid var(--amber)' : '2px solid transparent',
                marginBottom: '-1px',
                background: 'transparent',
              }}
            >
              {tab.label}
              {hasMaterial && !isActive && (
                <span
                  className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full align-middle"
                  style={{ background: 'var(--sage)', opacity: 0.6 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab panels */}
      {TABS.map((tab) => {
        if (activeTab !== tab.type) return null;
        const material = materials.find((m) => m.type === tab.type) ?? null;
        const isGenThis = generating === tab.type;

        return (
          <div
            key={tab.type}
            id={`panel-${tab.type}`}
            role="tabpanel"
            aria-labelledby={`tab-${tab.type}`}
          >
            {/* Generation spinner */}
            {isGenThis && (
              <div
                className="flex flex-col items-center justify-center gap-3 p-12 rounded-lg mb-4"
                style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
              >
                <Loader2
                  size={28}
                  strokeWidth={1.5}
                  className="animate-spin"
                  style={{ color: 'var(--amber)' }}
                />
                <p className="text-sm" style={{ color: 'var(--sage)' }}>
                  Generating {tab.label.toLowerCase()}…
                </p>
              </div>
            )}

            {/* Error */}
            {genError && !isGenThis && (
              <div
                className="flex items-start gap-2 px-4 py-3 rounded-lg mb-4 text-sm"
                style={{
                  background: 'rgba(196,90,42,0.08)',
                  border: '1px solid var(--copper)',
                  color: 'var(--mist)',
                }}
              >
                {genError}
              </div>
            )}

            {/* No material yet — show generate button */}
            {!material && !isGenThis && (
              <div
                className="flex flex-col items-center justify-center gap-4 p-12 rounded-lg"
                style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
              >
                <p
                  className="font-heading text-lg font-semibold"
                  style={{ color: 'var(--mist)' }}
                >
                  No {tab.label} generated yet
                </p>
                <p className="text-sm text-center" style={{ color: 'var(--sage)' }}>
                  {tab.type === 'cv'
                    ? 'Generate a tailored CV using your example bank and fit assessment.'
                    : tab.type === 'cover_letter'
                    ? 'Generate a personalised cover letter grounded in company research.'
                    : 'Generating tracking note…'}
                </p>
                {tab.type !== 'tracking_note' && (
                  <button
                    type="button"
                    onClick={() => handleGenerateClick(tab.type)}
                    className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold"
                    style={{ background: 'var(--amber)', color: '#111a24' }}
                  >
                    Generate {tab.label}
                  </button>
                )}
              </div>
            )}

            {/* Material content */}
            {material && !isGenThis && (
              <div>
                {/* Toolbar */}
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  {/* Version indicator */}
                  <p className="text-xs" style={{ color: 'var(--sage)' }}>
                    v{material.version} — last saved {relativeTime(material.updatedAt)}
                  </p>

                  <div className="flex items-center gap-2">
                    {/* Copy button */}
                    <button
                      type="button"
                      onClick={() => handleCopy(material.content)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium"
                      style={{
                        background: 'var(--card)',
                        border: '1px solid var(--border)',
                        color: copied ? 'var(--amber)' : 'var(--sage)',
                      }}
                    >
                      <Copy size={13} strokeWidth={1.5} />
                      {copied ? 'Copied!' : 'Copy text'}
                    </button>

                    {/* Regenerate button */}
                    <button
                      type="button"
                      onClick={() => handleRegenerate(tab.type)}
                      disabled={isGeneratingActive}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium"
                      style={{
                        background: 'var(--card)',
                        border: '1px solid var(--border)',
                        color: 'var(--sage)',
                        opacity: isGeneratingActive ? 0.5 : 1,
                        cursor: isGeneratingActive ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <RefreshCw size={13} strokeWidth={1.5} />
                      Regenerate
                    </button>
                  </div>
                </div>

                {/* Editor */}
                <MaterialsEditor
                  content={material.content}
                  onSave={(newContent) => handleSave(material, newContent)}
                  saving={saving}
                />
              </div>
            )}
          </div>
        );
      })}

      {/* Master CV Modal */}
      <MasterCvModal
        open={masterCvModalOpen}
        onClose={() => {
          setMasterCvModalOpen(false);
          setPendingGenType(null);
        }}
        onSubmit={handleMasterCvSubmit}
      />
    </div>
  );
}
