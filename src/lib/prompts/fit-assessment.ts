// Fit Assessment Prompts
// Two-call flow:
//   1. buildArchetypeDetectionPrompt — classifies the role into one of five archetypes
//   2. buildFitScoringPrompt — scores 8 dimensions using an archetype-adjusted rubric
//
// Both return { system, user, toolSchema } for use with callWithTool<T>().

import type { RoleArchetype } from '@/lib/types';

// ─── Constants ───────────────────────────────────────────────────────────────

const CHARS_PER_EXAMPLE_ANSWER = 800; // ~200 tokens
const MAX_EXAMPLES = 20;
const CHARS_JOB_DESCRIPTION = 2000;

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface PromptBundle {
  system: string;
  user: string;
  toolSchema: {
    name: string;
    description: string;
    parameters: object;
  };
}

export interface ExampleForFitScoring {
  id: string;
  question: string;
  answer: string;
  tags: string[];
  qualityRating?: string;
}

export interface ConsistencyEntryForScoring {
  topic: string;
  claim: string;
}

// ─── Call 1: Archetype detection ─────────────────────────────────────────────

const ARCHETYPE_DETECTION_TOOL_SCHEMA = {
  name: 'detect_archetype',
  description: 'Classify the role into one of five archetypes',
  parameters: {
    type: 'object',
    properties: {
      archetype: {
        type: 'string',
        enum: ['exec', 'ic', 'portfolio', 'advisory', 'hybrid'],
        description:
          'exec = senior leadership/P&L; ic = individual contributor/deep specialist; portfolio = NED/trustee/multiple roles; advisory = fractional/consulting/board advisor; hybrid = significant elements of two or more archetypes',
      },
      rationale: {
        type: 'string',
        description:
          '1-2 sentences explaining the classification. Cite specific signals from the job description (e.g. "reports to CEO", "manages a team of 10", "fractional commitment").',
      },
    },
    required: ['archetype', 'rationale'],
  },
} as const;

const ARCHETYPE_DETECTION_SYSTEM = `You are a career classification specialist.

Your task is to read a job description and classify the role into one of five archetypes:
- exec: senior leadership role, typically manages teams and budgets, reports to C-suite or board. Examples: VP Product, Director of Engineering, CPO.
- ic: individual contributor, evaluated on specialist output rather than management. Examples: Staff Engineer, Principal PM, Lead Designer.
- portfolio: multiple-mandate role or governance role. Examples: NED (Non-Executive Director), trustee, board member, portfolio advisor.
- advisory: fractional, consulting, or non-operational advisory engagement. Examples: Fractional CPO, interim consultant, board advisor (paid or unpaid).
- hybrid: the role genuinely spans two or more archetypes — for example, a player-coach VP who also contributes individually.

Rules:
- Read the FULL job description. Do not guess from the job title alone.
- Prefer the most specific archetype over hybrid. Only use hybrid if the role genuinely cannot be classified otherwise.
- Use rationale to cite the specific signals that drove your decision.

Output ONLY the structured data via the detect_archetype tool. No commentary.`;

/**
 * Build the archetype detection prompt.
 * This is Call 1 of the two-call fit assessment flow.
 */
export function buildArchetypeDetectionPrompt(input: {
  jobDescription: string;
}): PromptBundle {
  const jdTruncated = input.jobDescription.slice(0, CHARS_JOB_DESCRIPTION);
  const wasTruncated = input.jobDescription.length > CHARS_JOB_DESCRIPTION;

  const user = [
    'Classify this role into one of the five archetypes.',
    '',
    '## Job Description',
    '',
    jdTruncated + (wasTruncated ? '\n[... truncated]' : ''),
  ].join('\n');

  return {
    system: ARCHETYPE_DETECTION_SYSTEM,
    user,
    toolSchema: ARCHETYPE_DETECTION_TOOL_SCHEMA,
  };
}

// ─── Call 2: Fit scoring ──────────────────────────────────────────────────────

// Dimension score object — reused across all eight dimensions
const DIMENSION_SCORE_OBJECT = {
  type: 'object',
  properties: {
    score: {
      type: 'number',
      description: 'Integer from 1 (severe misalignment) to 10 (exceptional fit)',
    },
    evidence: {
      type: 'string',
      description:
        '1-3 sentences of evidence. Only cite information present in the provided data. If data is absent, write "Insufficient data to assess."',
    },
    confidence: {
      type: 'string',
      enum: ['high', 'medium', 'low'],
      description:
        'high = multiple strong data points; medium = 1-2 data points; low = inference only or no data',
    },
  },
  required: ['score', 'evidence', 'confidence'],
} as const;

const FIT_SCORING_TOOL_SCHEMA = {
  name: 'save_fit_assessment',
  description: 'Save structured fit assessment scores across eight dimensions',
  parameters: {
    type: 'object',
    properties: {
      dimDomainIndustry: {
        ...DIMENSION_SCORE_OBJECT,
        description:
          'How well does the candidate\'s industry/domain background match the role? Consider sector, business model, and buyer context.',
      },
      dimSeniority: {
        ...DIMENSION_SCORE_OBJECT,
        description:
          'Does the candidate\'s seniority level and career stage match what the role requires?',
      },
      dimScope: {
        ...DIMENSION_SCORE_OBJECT,
        description:
          'Does the scale of the candidate\'s previous scope (team size, budget, revenue impact) match role requirements?',
      },
      dimTechnical: {
        ...DIMENSION_SCORE_OBJECT,
        description:
          'Do the candidate\'s technical skills, tools, and methodologies match what the role requires?',
      },
      dimMission: {
        ...DIMENSION_SCORE_OBJECT,
        description:
          'Does the candidate\'s stated motivation and career direction align with the company\'s mission and purpose?',
      },
      dimLocation: {
        ...DIMENSION_SCORE_OBJECT,
        description:
          'Is the candidate\'s location and work-arrangement preferences compatible with the role\'s requirements?',
      },
      dimCompensation: {
        ...DIMENSION_SCORE_OBJECT,
        description:
          'Is the candidate\'s compensation expectation compatible with the role\'s likely range?',
      },
      dimCulture: {
        ...DIMENSION_SCORE_OBJECT,
        description:
          'Do the candidate\'s working-style signals align with the company\'s culture signals?',
      },
      redFlags: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Specific, articulable mismatches between the candidate and the role. Each entry must name the gap explicitly (e.g. "Role requires 5+ years people management; examples show 2 years as a team lead"). Do not generate generic low-score statements.',
      },
      greenFlags: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Specific, articulable strengths that make this candidate a strong fit for this role. Each entry must cite the specific evidence (e.g. "Four examples show board-level stakeholder management directly relevant to this NED role").',
      },
    },
    required: [
      'dimDomainIndustry',
      'dimSeniority',
      'dimScope',
      'dimTechnical',
      'dimMission',
      'dimLocation',
      'dimCompensation',
      'dimCulture',
      'redFlags',
      'greenFlags',
    ],
  },
} as const;

// ─── Archetype-adjusted rubric guidance ──────────────────────────────────────

function buildArchetypeRubricGuidance(archetype: RoleArchetype): string {
  switch (archetype) {
    case 'exec':
      return `Archetype: EXEC (senior leadership)
Weighting guidance: Seniority and Scope carry the most weight for this archetype. Evidence of P&L ownership, large team management, board or C-suite interaction, and cross-functional leadership should score significantly higher than technical depth. A highly technical IC profile with no management track record should score 3-4 on Seniority even if domain knowledge is excellent.`;

    case 'ic':
      return `Archetype: IC (individual contributor / deep specialist)
Weighting guidance: Technical dimension carries the most weight for this archetype. Depth of craft, demonstrable specialist output, and hands-on delivery matter more than management experience. An exec profile without hands-on evidence should score 3-5 on Technical even if domain knowledge is strong.`;

    case 'portfolio':
      return `Archetype: PORTFOLIO (NED / trustee / multiple-mandate)
Weighting guidance: Domain diversity, governance experience, and independence of perspective are most relevant. Look for evidence of advisory, board-level, or non-executive contributions. Operational execution track record is less important than breadth and governance credibility. Mission alignment should carry extra weight — trustees and NEDs self-select by conviction.`;

    case 'advisory':
      return `Archetype: ADVISORY (fractional / consulting / board advisor)
Weighting guidance: Mission and Culture carry extra weight — advisory engagements are typically short and values-alignment drives success more than skills transfer. Evidence of operating as a trusted advisor, pattern-matching across organisations, and working without positional authority are strong positive signals.`;

    case 'hybrid':
      return `Archetype: HYBRID (player-coach / dual mandate)
Weighting guidance: Use balanced weighting across all eight dimensions. There is no dominant dimension — the candidate must demonstrate both leadership/advisory capability AND hands-on specialist credibility. A purely managerial profile without hands-on evidence should score 4-5 on Technical; a purely technical profile without any leadership evidence should score 4-5 on Seniority.`;

    default:
      return `Archetype: HYBRID (defaulting to balanced weighting)
Weighting guidance: Use balanced weighting across all eight dimensions.`;
  }
}

// ─── Fit scoring system prompt ─────────────────────────────────────────────────

function buildFitScoringSystem(
  archetype: RoleArchetype,
  hasCompanyResearch: boolean
): string {
  const rubricGuidance = buildArchetypeRubricGuidance(archetype);

  const researchCaveat = hasCompanyResearch
    ? ''
    : `
IMPORTANT: Company research was not available for this assessment. You must automatically assign confidence: 'low' to the Culture, Mission, and Technical dimensions (unless the job description itself provides sufficient data). Do not infer culture or mission from the company name alone.`;

  return `You are a career fit assessment specialist scoring a senior professional's alignment with a specific role.

## Scoring rules

Score each dimension 1-10 using the full range:
- 1-2: Severe misalignment — a real blocker to this role
- 3-4: Material gap — significant development needed
- 5-6: Moderate fit — meets some requirements, gaps in others
- 7-8: Strong fit — clear evidence of alignment
- 9-10: Exceptional fit — standout match with specific evidence

Do NOT cluster all scores at 6-8. If the evidence does not support a high score, assign the lower score. A score of 2 means genuine misalignment. A score of 9 means exceptional, specific evidence.

## Evidence rules

- Only cite evidence that exists in the provided examples or company research. Do not invent experience or qualifications.
- If you lack sufficient data for a dimension, assign confidence: 'low' and write "Insufficient data to assess" in the evidence field.
- Do not fabricate job history, team sizes, or achievements that are not stated in the examples.

## Red flag and green flag rules

Red flags must be SPECIFIC mismatches you can articulate clearly:
  GOOD: "Role requires 5+ years people management; examples show 2 years as a team lead."
  BAD: "Limited management experience." (too vague)
  BAD: "Score of 4/10 on Seniority." (not a red flag — that is a score)

A dimension scoring 4/10 does NOT automatically generate a red flag. Only generate a flag when the gap is material and specific.

Green flags must cite specific evidence from the examples or research:
  GOOD: "Four examples demonstrate board-level stakeholder navigation directly relevant to this NED role."
  BAD: "Strong leadership skills." (too generic)
${researchCaveat}

## ${rubricGuidance}

Output ONLY the structured data via the save_fit_assessment tool. No preamble or commentary.`;
}

// ─── User message builder ─────────────────────────────────────────────────────

function buildExamplesSection(examples: ExampleForFitScoring[]): string {
  const capped = examples.slice(0, MAX_EXAMPLES);

  if (capped.length === 0) {
    return '## Examples from Story Bank\n\nNo examples provided.';
  }

  const formatted = capped
    .map((ex, i) => {
      const truncatedAnswer = ex.answer.slice(0, CHARS_PER_EXAMPLE_ANSWER);
      const wasTruncated = ex.answer.length > CHARS_PER_EXAMPLE_ANSWER;
      const tagsStr = ex.tags.length > 0 ? `Tags: ${ex.tags.join(', ')}` : '';
      const qualityStr = ex.qualityRating ? `Quality: ${ex.qualityRating}` : '';
      const meta = [tagsStr, qualityStr].filter(Boolean).join(' | ');

      return [
        `[Example ${i + 1}] ID: ${ex.id}`,
        meta ? meta : null,
        `Q: ${ex.question}`,
        `A: ${truncatedAnswer}${wasTruncated ? ' [...]' : ''}`,
      ]
        .filter((line): line is string => line !== null)
        .join('\n');
    })
    .join('\n\n');

  const truncationNote =
    examples.length > MAX_EXAMPLES
      ? `\n\n(${examples.length - MAX_EXAMPLES} additional examples omitted to stay within token budget)`
      : '';

  return `## Examples from Story Bank (${capped.length} examples)\n\n${formatted}${truncationNote}`;
}

function buildConsistencySection(
  entries: ConsistencyEntryForScoring[]
): string {
  if (entries.length === 0) return '';

  const formatted = entries
    .map(e => `- **${e.topic}**: ${e.claim}`)
    .join('\n');

  return `## Consistency Tracker — Tracked Claims\n\n${formatted}`;
}

/**
 * Build the fit scoring prompt (Call 2).
 * Requires the archetype from Call 1 (buildArchetypeDetectionPrompt).
 */
export function buildFitScoringPrompt(input: {
  jobDescription: string;
  archetype: RoleArchetype;
  companyResearch: object | null;
  examples: ExampleForFitScoring[];
  consistencyEntries?: ConsistencyEntryForScoring[];
}): PromptBundle {
  const {
    jobDescription,
    archetype,
    companyResearch,
    examples,
    consistencyEntries = [],
  } = input;

  const hasCompanyResearch = companyResearch !== null;

  const jdTruncated = jobDescription.slice(0, CHARS_JOB_DESCRIPTION);
  const jdWasTruncated = jobDescription.length > CHARS_JOB_DESCRIPTION;

  const sections: string[] = [
    `# Fit Assessment Request\n\nRole archetype: **${archetype}**`,
    `## Job Description\n\n${jdTruncated}${jdWasTruncated ? '\n[... truncated]' : ''}`,
  ];

  if (hasCompanyResearch) {
    const researchStr = JSON.stringify(companyResearch, null, 2);
    sections.push(`## Company Research\n\n\`\`\`json\n${researchStr}\n\`\`\``);
  } else {
    sections.push(
      `## Company Research\n\nNot available. Apply confidence: 'low' to Culture, Mission, and Technical dimensions automatically.`
    );
  }

  sections.push(buildExamplesSection(examples));

  const consistencySection = buildConsistencySection(consistencyEntries);
  if (consistencySection) {
    sections.push(consistencySection);
  }

  sections.push(
    `## Instructions\n\nScore all eight fit dimensions using the rubric above. Use the full 1-10 range. Only cite evidence from the data above. Assign null for fields where data is absent — do not guess.`
  );

  const user = sections.join('\n\n');

  return {
    system: buildFitScoringSystem(archetype, hasCompanyResearch),
    user,
    toolSchema: FIT_SCORING_TOOL_SCHEMA,
  };
}
