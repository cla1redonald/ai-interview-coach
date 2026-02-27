export interface Message {
  role: 'user' | 'assistant';
  content: string;
  id?: string;
}

export interface Session {
  id: string;
  personaId: string;
  messages: Message[];
  timestamp: Date;
}

export interface Persona {
  id: string;
  name: string;
  title: string;
  icon?: string;
  content?: string; // Optional - loaded server-side only in API route
}
