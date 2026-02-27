import type { Persona } from './types';

// Icon mapping by title keywords — use word-boundary checks for short acronyms
function deriveIcon(title: string): string {
  const t = title.toLowerCase();
  // Check full-word acronyms using regex to avoid substring false matches
  // e.g. "director" contains "cto" as a substring
  const hasWord = (word: string) => new RegExp(`\\b${word}\\b`).test(t);

  if (t.includes('chief executive') || hasWord('ceo')) return '👔';
  if (t.includes('analytics') || t.includes('data science')) return '📊';
  if (t.includes('chief technology') || hasWord('cto')) return '💻';
  if (t.includes('chief product') || hasWord('cpo')) return '🚀';
  if (t.includes('chief financial') || hasWord('cfo')) return '💰';
  if (t.includes('chief people') || hasWord('chro')) return '👥';
  if (t.includes('chief customer') || hasWord('cco')) return '⭐';
  if (t.includes('chief operating') || hasWord('coo')) return '⚙️';
  if (t.includes('vp product') || t.includes('vice president product')) return '🎯';
  if (t.includes('product')) return '📦';
  if (t.includes('people') || hasWord('hr') || t.includes('talent')) return '👥';
  if (t.includes('engineering') || t.includes('platform')) return '🔧';
  if (t.includes('design') || t.includes('ux')) return '🎨';
  if (t.includes('marketing') || t.includes('growth')) return '📈';
  if (t.includes('finance') || t.includes('commercial') || t.includes('data')) return '💼';
  return '👤';
}

// Convert a filename to a persona ID
// e.g. "CEO_Generic.md" -> "ceo-generic"
export function filenameToId(filename: string): string {
  return filename
    .replace(/\.md$/i, '')
    .replace(/_/g, '-')
    .toLowerCase();
}

// Parse persona name and title from markdown content
// Expects first line: "# Name - Title"
export function parsePersonaHeader(content: string, fallbackId: string): { name: string; title: string } {
  const firstLine = content.split('\n')[0] || '';
  const headerMatch = firstLine.match(/^#\s+(.+?)\s+-\s+(.+)$/);
  if (headerMatch) {
    return { name: headerMatch[1].trim(), title: headerMatch[2].trim() };
  }
  // Fallback: use the filename
  const parts = fallbackId.split('-');
  return { name: parts.join(' '), title: 'Interviewer' };
}

// Client-side metadata only - NO persona content included.
// Actual persona markdown files are loaded server-side only in /api/chat.
// This module dynamically reads the personas/ directory at build time via
// the server-side API route. On the client, we export the personas object
// which is populated via the /api/personas endpoint or bundled at startup.

// Default example personas (always available)
export const defaultPersonas: Record<string, Persona> = {
  'ceo-generic': {
    id: 'ceo-generic',
    name: 'Alex Rivera',
    title: 'Chief Executive Officer',
    icon: '👔',
  },
  'cto-generic': {
    id: 'cto-generic',
    name: 'Jordan Chen',
    title: 'Chief Technology Officer',
    icon: '💻',
  },
  'vp-product-generic': {
    id: 'vp-product-generic',
    name: 'Morgan Taylor',
    title: 'VP Product',
    icon: '🎯',
  },
};

// Active personas — populated from config or defaults
// In production, this is the client-side registry used by the UI.
// The server-side API route scans the filesystem for actual persona files.
export const personas: Record<string, Persona> = { ...defaultPersonas };

export type PersonaId = keyof typeof personas;

// Utility: get icon for a title
export { deriveIcon };
