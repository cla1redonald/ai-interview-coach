import { anthropic } from '@ai-sdk/anthropic';
import { streamText } from 'ai';
import { readFileSync, existsSync, readdirSync } from 'fs';
import path from 'path';
import config from '@/lib/config';
import { filenameToId, parsePersonaHeader } from '@/lib/personas';
import { checkRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const maxDuration = 30;

// Security: Input validation constants
const MAX_MESSAGE_LENGTH = 5000;
const MAX_MESSAGES_PER_REQUEST = 50;

// Dynamically scan the personas directory and build id -> filepath mapping
function buildPersonaFilenameMap(): Record<string, string> {
  const personasDir = path.join(process.cwd(), 'personas');
  const map: Record<string, string> = {};

  if (!existsSync(personasDir)) return map;

  function scanDir(dir: string) {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        const id = filenameToId(entry.name);
        map[id] = fullPath;
      }
    }
  }

  scanDir(personasDir);
  return map;
}

export async function POST(req: Request) {
  try {
    // Rate limiting
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    if (!checkRateLimit(ip)) {
      return new Response('Too many requests. Please try again later.', {
        status: 429,
        headers: { 'Retry-After': '60' },
      });
    }

    const { messages, personaId, mode } = await req.json();

    // Input validation
    if (!Array.isArray(messages) || messages.length > MAX_MESSAGES_PER_REQUEST) {
      return new Response('Invalid request: too many messages', { status: 400 });
    }

    for (const msg of messages) {
      if (!msg.content || typeof msg.content !== 'string') {
        return new Response('Invalid message format', { status: 400 });
      }
      if (msg.content.length > MAX_MESSAGE_LENGTH) {
        return new Response(`Message too long. Maximum ${MAX_MESSAGE_LENGTH} characters allowed.`, {
          status: 400,
        });
      }
    }

    if (!personaId || typeof personaId !== 'string') {
      return new Response('Persona ID required', { status: 400 });
    }

    // Scan personas directory to find the file
    const filenameMap = buildPersonaFilenameMap();
    const personaFilePath = filenameMap[personaId];

    if (!personaFilePath) {
      return new Response('Persona not found', { status: 404 });
    }

    if (!existsSync(personaFilePath)) {
      console.error(`Persona file not found at ${personaFilePath}`);
      return new Response('Persona content unavailable', { status: 500 });
    }

    // Read persona file (server-side only — never sent to client)
    const personaContent = readFileSync(personaFilePath, 'utf-8');
    const { name: personaName, title: personaTitle } = parsePersonaHeader(personaContent, personaId);

    const systemPrompt =
      mode === 'practice'
        ? `You are ${personaName}, ${personaTitle} at ${config.company}.

${personaContent}

CRITICAL INSTRUCTIONS:
- Stay in character as ${personaName} throughout the conversation
- Challenge the candidate realistically based on the red flags and priorities in your profile above
- Use the communication style, language patterns, and decision style described in your profile
- Reference the strategic context and priorities described in your persona profile
- Ask probing follow-up questions that test the candidate's thinking
- Never break character until the user explicitly asks "How did I do?" or "Give me feedback"
- Keep the tone professional and focused on business outcomes

Begin the conversation by asking a probing interview question relevant to your top priorities as described in the Strategic Priorities section above.`
        : `You are an expert interview coach analyzing a practice session with ${personaName} (${personaTitle}).

Review the conversation history and provide detailed, specific feedback:

## 1. What Worked Well (Green Flags Hit)
- Which of ${personaName}'s green flags from the profile did the candidate successfully demonstrate?
- Give specific examples from their answers that would resonate positively
- Quote exact phrases that were effective

## 2. What Didn't Work (Red Flags Triggered)
- Which red flags from ${personaName}'s profile did the candidate trigger?
- What specific things would make ${personaName} skeptical or concerned?
- Point to exact moments in the conversation where the candidate lost ground

## 3. How to Improve
- Concrete, specific suggestions for reframing answers
- Missing context, data, or ROI justification that should have been included
- Stronger opening statements or closing summaries

## 4. Alternative Framing
- Provide 1-2 complete example answers showing how the candidate could have answered the toughest question better
- Use the same level of detail and specificity that would impress ${personaName}

Be brutally honest but constructive. Reference specific priorities, red flags, and green flags from ${personaName}'s profile.`;

    const result = await streamText({
      model: anthropic('claude-sonnet-4-5-20250929'),
      messages,
      system: systemPrompt,
      temperature: 0.7,
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error('Chat API error:', error);
    return new Response('Internal server error', { status: 500 });
  }
}
