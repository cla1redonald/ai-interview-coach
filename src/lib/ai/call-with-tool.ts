import { anthropic } from '@ai-sdk/anthropic';
import { generateText, jsonSchema, tool } from 'ai';

const MODEL = 'claude-sonnet-4-5-20250929';

/**
 * Call Claude with a structured tool and parse the result.
 * Used by extraction, enrichment, and matching routes.
 */
export async function callWithTool<T>(
  systemPrompt: string,
  userMessage: string,
  toolDef: { name: string; description: string; parameters: object },
  maxOutputTokens: number = 8000
): Promise<T> {
  const toolInstance = tool({
    description: toolDef.description,
    inputSchema: jsonSchema(toolDef.parameters as Parameters<typeof jsonSchema>[0]),
  });

  const result = await generateText({
    model: anthropic(MODEL),
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
    tools: { [toolDef.name]: toolInstance },
    toolChoice: { type: 'tool', toolName: toolDef.name },
    maxOutputTokens,
  });

  const toolCall = result.toolCalls.find(tc => tc.toolName === toolDef.name);
  if (!toolCall) {
    throw new Error(`Claude did not call the ${toolDef.name} tool`);
  }
  const callAsAny = toolCall as unknown as { input?: T; args?: T };
  return (callAsAny.input ?? callAsAny.args) as T;
}
