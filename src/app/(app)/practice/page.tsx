'use client';

import { useState } from 'react';
import { PersonaSelector } from '@/components/PersonaSelector';
import { ChatInterface } from '@/components/ChatInterface';
import { Button } from '@/components/ui/button';
import config from '@/lib/config';

export default function PracticePage() {
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null);
  const [selectedPersonaName, setSelectedPersonaName] = useState<string>('');
  const [selectedPersonaTitle, setSelectedPersonaTitle] = useState<string>('');
  const [mode, setMode] = useState<'practice' | 'feedback'>('practice');

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

  const handleModeChange = (newMode: 'practice' | 'feedback') => {
    setMode(newMode);
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
            <Button variant="outline" onClick={() => setSelectedPersonaId(null)}>
              Change Interviewer
            </Button>
          </div>

          <ChatInterface
            personaId={selectedPersonaId}
            mode={mode}
            onModeChange={handleModeChange}
          />
        </div>
      )}
    </div>
  );
}
