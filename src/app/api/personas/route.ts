import { existsSync, readdirSync, readFileSync } from 'fs';
import path from 'path';
import { filenameToId, parsePersonaHeader, deriveIcon } from '@/lib/personas';
import type { Persona } from '@/lib/types';

export const runtime = 'nodejs';

function scanPersonasDir(): Persona[] {
  const personasDir = path.join(process.cwd(), 'personas');
  const personas: Persona[] = [];

  if (!existsSync(personasDir)) return personas;

  function scanDir(dir: string) {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        const id = filenameToId(entry.name);
        try {
          const content = readFileSync(fullPath, 'utf-8');
          const { name, title } = parsePersonaHeader(content, id);
          personas.push({
            id,
            name,
            title,
            icon: deriveIcon(title),
          });
        } catch {
          // Skip unreadable files
        }
      }
    }
  }

  scanDir(personasDir);
  return personas;
}

export async function GET() {
  const personas = scanPersonasDir();
  return Response.json(personas);
}
