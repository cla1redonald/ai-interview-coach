// Tracking note prompt — generates an Obsidian-compatible markdown note
// with YAML frontmatter for pasting directly into a vault.
// This is template-driven; minimal LLM creativity needed.

export interface TrackingNoteCompanyResearch {
  fundingStage?: string;
  companySize?: string;
  headquarters?: string;
  industry?: string;
  recentNews?: string;
}

export interface DimensionScore {
  dimension: string;
  score: number;
  evidence: string;
}

export interface MatchedExample {
  question: string;
  tags: string[];
}

export interface BuildTrackingNotePromptInput {
  companyName: string;
  jobTitle: string;
  fitScore: number;
  archetype: string;
  companyResearch?: TrackingNoteCompanyResearch;
  dimensionScores: DimensionScore[];
  redFlags: string[];
  greenFlags: string[];
  matchedExamples: MatchedExample[];
  userAnnotations?: string;
}

export interface TrackingNotePromptResult {
  system: string;
  user: string;
  toolSchema: object;
}

// ─── System prompt ────────────────────────────────────────────────────────────

const TRACKING_NOTE_SYSTEM = `You are generating an Obsidian-compatible markdown tracking note for a job application.

Output requirements:
- Start with YAML frontmatter (between --- delimiters)
- Follow with a markdown body using the exact structure specified in the input
- The note should be ready to paste into an Obsidian vault with no edits needed
- Keep it concise — this is a reference document, not a narrative
- Use markdown tables for dimension scores
- Use bullet lists for flags and examples
- Do not add headers, sections, or content beyond what is specified in the structure
- Leave placeholder fields (applied_date, next_step) blank — do not fill them in`;

// ─── Tool schema ──────────────────────────────────────────────────────────────

const TRACKING_NOTE_TOOL_SCHEMA = {
  name: 'save_tracking_note',
  input_schema: {
    type: 'object',
    properties: {
      content: {
        type: 'string',
        description: 'Full tracking note in Obsidian-compatible markdown with YAML frontmatter',
      },
    },
    required: ['content'],
  },
};

// ─── Builder ──────────────────────────────────────────────────────────────────

export function buildTrackingNotePrompt(input: BuildTrackingNotePromptInput): TrackingNotePromptResult {
  const {
    companyName,
    jobTitle,
    fitScore,
    archetype,
    companyResearch,
    dimensionScores,
    redFlags,
    greenFlags,
    matchedExamples,
    userAnnotations,
  } = input;

  // Format company research for the prompt
  const researchLines: string[] = [];
  if (companyResearch) {
    if (companyResearch.industry) researchLines.push(`Industry: ${companyResearch.industry}`);
    if (companyResearch.fundingStage) researchLines.push(`Funding stage: ${companyResearch.fundingStage}`);
    if (companyResearch.companySize) researchLines.push(`Company size: ${companyResearch.companySize}`);
    if (companyResearch.headquarters) researchLines.push(`Headquarters: ${companyResearch.headquarters}`);
    if (companyResearch.recentNews) researchLines.push(`Recent news: ${companyResearch.recentNews}`);
  }
  const researchBlock = researchLines.length > 0
    ? researchLines.join('\n')
    : '[No company research available]';

  // Format dimension scores
  const dimensionBlock = dimensionScores.length > 0
    ? dimensionScores
        .map(d => `| ${d.dimension} | ${d.score}/100 | ${d.evidence} |`)
        .join('\n')
    : '| No dimensions scored | — | — |';

  // Format red flags
  const redFlagsBlock = redFlags.length > 0
    ? redFlags.map(f => `- ${f}`).join('\n')
    : '- None identified';

  // Format green flags (for reference in the note structure prompt)
  const greenFlagsBlock = greenFlags.length > 0
    ? greenFlags.map(f => `- ${f}`).join('\n')
    : '- None identified';

  // Format matched examples
  const examplesBlock = matchedExamples.length > 0
    ? matchedExamples
        .map(ex => {
          const tagsStr = ex.tags.length > 0 ? ` [${ex.tags.join(', ')}]` : '';
          return `- ${ex.question}${tagsStr}`;
        })
        .join('\n')
    : '- No matched examples';

  // Format user annotations
  const annotationsBlock = userAnnotations && userAnnotations.trim().length > 0
    ? userAnnotations.trim()
    : '[No notes yet]';

  const user = `Generate an Obsidian tracking note using EXACTLY this structure:

---
company: "${companyName}"
role: "${jobTitle}"
fit_score: ${fitScore}
archetype: "${archetype}"
status: researching
applied_date:
next_step:
---

# ${companyName} — ${jobTitle}

## Company Overview
[Write 2-3 sentences summarising the company using only the research data below. If insufficient data, write what is known.]

Company research data:
${researchBlock}

## Fit Assessment
Overall: ${fitScore}/100 · ${redFlags.length} red flag${redFlags.length !== 1 ? 's' : ''}

| Dimension | Score | Evidence |
|-----------|-------|----------|
${dimensionBlock}

### Green Flags
${greenFlagsBlock}

## Key Examples to Use
${examplesBlock}

## Red Flags to Address
${redFlagsBlock}

## My Notes
${annotationsBlock}`;

  return {
    system: TRACKING_NOTE_SYSTEM,
    user,
    toolSchema: TRACKING_NOTE_TOOL_SCHEMA,
  };
}
