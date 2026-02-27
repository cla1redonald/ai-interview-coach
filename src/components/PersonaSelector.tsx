'use client';

import { useEffect, useState } from 'react';
import type { Persona } from '@/lib/types';
import { Card } from '@/components/ui/card';

interface PersonaSelectorProps {
  selectedId?: string;
  onSelect: (id: string) => void;
}

export function PersonaSelector({ selectedId, onSelect }: PersonaSelectorProps) {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/personas')
      .then((res) => res.json())
      .then((data: Persona[]) => {
        setPersonas(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSurpriseMe = () => {
    if (personas.length === 0) return;
    const random = personas[Math.floor(Math.random() * personas.length)];
    onSelect(random.id);
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="p-4 animate-pulse bg-gray-50 h-20" />
        ))}
      </div>
    );
  }

  if (personas.length === 0) {
    return (
      <div className="p-6 text-center text-gray-500 border border-dashed border-gray-300 rounded-lg">
        <p className="font-medium">No personas found</p>
        <p className="text-sm mt-1">
          Add persona markdown files to the <code>personas/</code> directory and restart the server.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Persona cards */}
      {personas.map((persona) => (
        <Card
          key={persona.id}
          className={`p-4 cursor-pointer hover:shadow-lg transition-all ${
            selectedId === persona.id
              ? 'border-blue-500 border-2 bg-blue-50'
              : 'hover:border-gray-300'
          }`}
          onClick={() => onSelect(persona.id)}
        >
          <div className="flex items-center gap-2 mb-1">
            {persona.icon && <span className="text-2xl">{persona.icon}</span>}
            <h3 className="font-bold text-lg">{persona.name}</h3>
          </div>
          <p className="text-sm text-gray-600">{persona.title}</p>
        </Card>
      ))}

      {/* Surprise Me card */}
      <Card
        className="p-4 cursor-pointer hover:shadow-lg transition-all border-2 border-blue-200 bg-blue-50 hover:border-blue-400"
        onClick={handleSurpriseMe}
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="text-2xl">🎲</span>
          <h3 className="font-bold text-lg">Surprise Me</h3>
        </div>
        <p className="text-sm text-gray-600">Random interviewer selection</p>
      </Card>
    </div>
  );
}
