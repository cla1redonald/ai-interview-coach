'use client';

import { useState } from 'react';
import { PersonaSelector } from '@/components/PersonaSelector';
import { ChatInterface } from '@/components/ChatInterface';
import { Button } from '@/components/ui/button';
import config from '@/lib/config';

export default function Home() {
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null);
  const [selectedPersonaName, setSelectedPersonaName] = useState<string>('');
  const [selectedPersonaTitle, setSelectedPersonaTitle] = useState<string>('');
  const [mode, setMode] = useState<'practice' | 'feedback'>('practice');

  const handlePersonaSelect = async (id: string) => {
    // Fetch persona metadata to display the name
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
    <main className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="container mx-auto p-4 max-w-6xl">
        <header className="mb-8 pt-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-lg select-none">
              AI
            </div>
            <div className="border-l-2 border-blue-200 pl-4">
              <h1 className="text-3xl font-bold text-gray-900">AI Interview Coach</h1>
              <p className="text-sm text-gray-600">{config.role} Role Preparation</p>
            </div>
          </div>
          <p className="text-gray-600">
            Practice with AI-powered interviewer personas tailored to {config.company}
          </p>
        </header>

        {!selectedPersonaId ? (
          <div>
            <h2 className="text-2xl font-semibold mb-4 text-gray-800">
              Select an interviewer to practice with:
            </h2>
            <PersonaSelector onSelect={handlePersonaSelect} />

            <div className="mt-8 p-6 bg-blue-50 rounded-lg border border-blue-200">
              <h3 className="font-semibold text-blue-900 mb-2">How it works:</h3>
              <ul className="space-y-2 text-sm text-gray-700">
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
                <h2 className="text-2xl font-semibold text-gray-800">
                  Interviewing with {selectedPersonaName}
                </h2>
                <p className="text-gray-600">{selectedPersonaTitle}</p>
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

        <footer className="mt-12 pt-8 border-t border-blue-100 text-center text-sm text-gray-500">
          <p>
            AI Interview Coach — open-source interview preparation tool
          </p>
        </footer>
      </div>
    </main>
  );
}
