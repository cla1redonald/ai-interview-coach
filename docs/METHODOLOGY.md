# Interview Coach Methodology

This document explains how the persona-based approach works, why it produces better interview practice than generic tools, and how to create effective personas.

---

## The Core Problem with Standard Interview Prep

Generic interview prep treats all interviews as equivalent: read common questions, memorise STAR-format answers, practice with a friend using the same questions. This approach has a fundamental flaw: real interviews are not generic. They are shaped by the specific person sitting across from you.

A CEO who came up through finance will probe your business case rigour in ways a CEO with a product background will not. A CPO who has shipped at scale has different red flags than a CPO who has mostly operated in early-stage environments. Rehearsing the same answer for both is approximately as useful as rehearsing a speech without knowing your audience.

The persona-based approach inverts this. Instead of preparing general answers, you prepare for specific interviewers. The quality of your practice depends entirely on how well the persona reflects the real person.

---

## The Persona Creation Methodology

### Step 1: Research

Good personas require real research. The goal is to understand three things:

1. **What does this person care about most?** Look for their public writing, talks, and interviews. What themes appear repeatedly? What problems have they dedicated their career to solving?

2. **What language do they use?** "Customer value" and "customer centricity" signal different things. "Shipping fast" and "velocity" and "iteration cadence" reflect different cultures. The specific words matter.

3. **What have they built and what have they failed at?** Past decisions reveal priorities. A leader who cut a product line because it was growing but unprofitable will probe commercial rigour. One who rebuilt a culture after a toxic period will probe leadership instincts.

### Step 2: Profile

Convert research into structured profiles with four critical sections:

**Strategic Priorities** are what the interviewer is trying to solve right now. Not generic values -- specific problems. "Scale the platform to support 10x current load" is useful. "Technical excellence" is not.

**Red Flags** are the specific things that would make this interviewer doubt the candidate. These should be concrete enough that the AI can recognise them in an answer. "Talks about features without connecting to outcomes" is useful. "Not business-focused enough" is not.

**Green Flags** are the specific things that would make this interviewer genuinely excited. Same principle -- specific enough to recognise. "Cites retention metrics before acquisition metrics when discussing growth" is useful.

**Communication Style** shapes how the AI plays the character. Does this person ask one probing question and wait, or do they rapid-fire? Are they blunt or diplomatic? Do they challenge assumptions or explore them collaboratively?

### Step 3: System Prompt

The structured profile becomes a system prompt that shapes the AI's behaviour. The AI uses the Strategic Priorities to select what to probe, the Red Flags to calibrate scepticism, and the Green Flags to recognise when an answer resonates. The Communication Style determines pacing and tone.

The key constraint is specificity. Vague profiles produce generic behaviour. Specific profiles produce recognisably different interviewers.

---

## The Two-Mode Architecture

### Practice Mode

In practice mode, the AI adopts the persona fully. It opens with a probing question drawn from the persona's Strategic Priorities, challenges answers based on Red Flags, follows up on weak points, and stays in character until explicitly asked for feedback.

The design goal is productive discomfort. The best practice sessions are the ones where you get stuck -- where the AI presses on a point you cannot support, or asks a follow-up you did not anticipate. That discomfort reveals the gaps you need to close before the real interview.

### Feedback Mode

In feedback mode, the AI drops the persona and becomes an analyst. It reviews the conversation against the persona profile and provides:

- **Green Flags Hit**: specific things the candidate said that would resonate with this interviewer, with direct quotes
- **Red Flags Triggered**: specific moments where the candidate lost ground, with analysis of why
- **How to Improve**: concrete reframing suggestions, not generic advice
- **Alternative Framing**: complete example answers showing how a stronger candidate might have responded

The feedback is persona-specific, which is what makes it useful. "You should have been more data-driven" is generic. "You cited team engagement as your primary success metric, but Morgan Taylor's profile shows she tracks 90-day retention cohorts -- leading with retention numbers would have resonated more strongly" is actionable.

---

## What Makes a Good Persona File

The quality of the simulation depends almost entirely on the quality of the persona file. A few principles:

**Specificity beats comprehensiveness.** Five specific red flags are more useful than ten generic ones. The AI needs enough detail to make a judgment about a particular answer.

**Red flags should describe behaviour, not traits.** "Arrogant" is a trait and the AI cannot reliably detect it. "Takes credit for team results without acknowledging the team's role" is a behaviour the AI can observe in an answer.

**Green flags should be about what the interviewer responds to, not what makes a good candidate generally.** A CFO and a CPO may both want to see data-driven thinking, but they care about different data -- financial metrics vs. product metrics. The green flags should reflect the interviewer's specific domain.

**Communication style should describe what the interviewer does, not what they value.** "Blunt and direct; will ask 'so what?' to any answer that lacks a clear business outcome" tells the AI how to behave. "Values directness" does not.

---

## The Research Swarm Concept

For well-known executives, AI tools can significantly accelerate persona creation. The approach:

1. Search for public material: LinkedIn posts, conference talks, company blog posts, press interviews, board letters
2. Feed the material to an AI with instructions to identify recurring themes, priorities, and language patterns
3. Use the AI analysis as a starting draft for the persona file
4. Edit for accuracy and specificity

This is particularly useful when the persona subject has a large public footprint. A CEO who regularly publishes LinkedIn essays or speaks at industry conferences has effectively told you what they care about. You just have to synthesise it into the persona format.

The limitation is that public material shows a curated version of the person. What they say publicly about leadership may differ from how they actually behave in interviews. Where possible, supplement AI-assisted research with input from people who have interviewed with the person directly.

---

## Iterating on Personas

Personas improve with use. After each practice session:

1. Note any moments where the AI's behaviour felt unrealistic or generic
2. Review the persona file for vague language that might have caused it
3. Add more specific details in the relevant section

Good personas evolve through iteration. The first version is based on research; subsequent versions incorporate what you learn from the practice sessions themselves.
