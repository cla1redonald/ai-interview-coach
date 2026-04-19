'use client';

import { Suspense, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { PersonaSelector } from '@/components/PersonaSelector';
import { ChatInterface } from '@/components/ChatInterface';
import { Button } from '@/components/ui/button';
import { PracticeContextBanner } from '@/components/storybank/PracticeContextBanner';
import { SaveToBankPrompt } from '@/components/storybank/SaveToBankPrompt';
import { SaveToBankModal } from '@/components/storybank/SaveToBankModal';
import { extractQAPairs, type QAPair } from '@/lib/practice-utils';
import config from '@/lib/config';

// ─── Inner component — reads useSearchParams (needs Suspense boundary) ─────────

function PracticeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const focusParam = searchParams.get('focus');
  const gapParam = searchParams.get('gap');

  const focusTopic = focusParam ?? gapParam ?? null;
  const focusType: 'focus' | 'gap' | null = focusParam ? 'focus' : gapParam ? 'gap' : null;

  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null);
  const [selectedPersonaName, setSelectedPersonaName] = useState<string>('');
  const [selectedPersonaTitle, setSelectedPersonaTitle] = useState<string>('');
  const [mode, setMode] = useState<'practice' | 'feedback'>('practice');
  const [focusCleared, setFocusCleared] = useState(false);

  // Save-to-Bank state
  const [showSavePrompt, setShowSavePrompt] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveSkipped, setSaveSkipped] = useState(false);
  const [savedCount, setSavedCount] = useState<number | null>(null);
  const [qaPairs, setQaPairs] = useState<QAPair[]>([]);

  const activeFocus = focusCleared ? null : focusTopic;

  const handleClear = () => {
    setFocusCleared(true);
    router.replace('/practice');
  };

  const handlePersonaSelect = async (id: string) => {
    try {
      const res = await fetch('/api/personas');
      const personas = await res.json();
      const found = personas.find((p: { id: string; name: string; title: string }) => p.id === id);
      if (found) {
        setSelectedPersonaName(found.name);
        setSelectedPersonaTitle(found.title);
      }
    } catch {
      setSelectedPersonaName(id);
      setSelectedPersonaTitle('');
    }
    setSelectedPersonaId(id);
    setMode('practice');
  };

  const handleChangeInterviewer = () => {
    setSelectedPersonaId(null);
    setSaveSkipped(false);
    setSavedCount(null);
    setShowSavePrompt(false);
    setShowSaveModal(false);
    setQaPairs([]);
  };

  const handleModeChange = (newMode: 'practice' | 'feedback') => {
    setMode(newMode);
  };

  const handleFeedbackComplete = (messages: Array<{ role: 'user' | 'assistant'; content: string }>) => {
    // The last 2 messages are: user "How did I do?" + assistant feedback response
    // Extract Q&A pairs from everything before that
    const practiceMessages = messages.slice(0, -2);
    const pairs = extractQAPairs(practiceMessages);
    setQaPairs(pairs);
    if (pairs.length > 0 && !saveSkipped) {
      setShowSavePrompt(true);
    }
  };

  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h1
          className="font-heading text-3xl font-bold mb-1"
          style={{ color: 'var(--mist)', letterSpacing: '-0.01em' }}
        >
          Mock Interview Practice
        </h1>
        <p className="text-sm" style={{ color: 'var(--sage)' }}>
          Practice with AI-powered interviewer personas tailored to {config.company}
        </p>
      </div>

      {!selectedPersonaId ? (
        <div>
          {/* Context banner — full width, shown before persona selection */}
          {activeFocus && focusType && (
            <div className="mb-5">
              <PracticeContextBanner
                type={focusType}
                topic={activeFocus}
                onClear={handleClear}
              />
            </div>
          )}

          <h2
            className="font-heading text-lg font-semibold mb-4"
            style={{ color: 'var(--mist)' }}
          >
            Select an interviewer to practice with:
          </h2>
          <PersonaSelector onSelect={handlePersonaSelect} />

          <div
            className="mt-8 p-6 rounded-lg"
            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
          >
            <h3 className="font-semibold mb-2" style={{ color: 'var(--mist)' }}>How it works:</h3>
            <ul className="space-y-2 text-sm" style={{ color: 'var(--sage)' }}>
              <li>Select an interviewer persona to practice with</li>
              <li>They will stay in character and challenge you realistically</li>
              <li>Answer their questions just like in a real interview</li>
              <li>Click &quot;Get Feedback&quot; to get detailed coaching on your answers</li>
            </ul>
          </div>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2
                className="font-heading text-xl font-semibold"
                style={{ color: 'var(--mist)' }}
              >
                Interviewing with {selectedPersonaName}
              </h2>
              <p className="text-sm" style={{ color: 'var(--sage)' }}>{selectedPersonaTitle}</p>
            </div>
            <div className="flex items-center gap-3">
              {/* Collapsed chip when persona is active */}
              {activeFocus && focusType && (
                <PracticeContextBanner
                  type={focusType}
                  topic={activeFocus}
                  onClear={handleClear}
                  collapsed
                />
              )}
              <Button variant="outline" onClick={handleChangeInterviewer}>
                Change Interviewer
              </Button>
            </div>
          </div>

          <ChatInterface
            personaId={selectedPersonaId}
            mode={mode}
            onModeChange={handleModeChange}
            focusTopic={activeFocus}
            onFeedbackComplete={handleFeedbackComplete}
          />

          {/* Save-to-Bank prompt — shown after feedback completes */}
          {showSavePrompt && !showSaveModal && savedCount === null && (
            <SaveToBankPrompt
              onReview={() => setShowSaveModal(true)}
              onSkip={() => {
                setShowSavePrompt(false);
                setSaveSkipped(true);
              }}
            />
          )}

          {/* Success message */}
          {savedCount !== null && (
            <div
              className="mt-4 p-4 rounded-lg text-sm"
              style={{
                background: 'var(--card)',
                border: '1px solid var(--amber)',
                color: 'var(--mist)',
              }}
            >
              {savedCount} answer{savedCount !== 1 ? 's' : ''} saved to your Example Bank.
            </div>
          )}

          {/* Save-to-Bank modal */}
          {showSaveModal && (
            <SaveToBankModal
              pairs={qaPairs}
              focusTopic={activeFocus}
              onClose={() => setShowSaveModal(false)}
              onSaved={(count) => {
                setShowSaveModal(false);
                setShowSavePrompt(false);
                setSavedCount(count);
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page — wraps in Suspense for useSearchParams ──────────────────────────────

export default function PracticePage() {
  return (
    <Suspense>
      <PracticeContent />
    </Suspense>
  );
}
