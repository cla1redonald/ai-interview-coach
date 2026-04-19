# StoryBank -- Strategy Review: Unified Experience Spec

**Version:** 1.0
**Date:** 2026-04-19
**Status:** Strategy review -- requires product owner sign-off before build
**Reviewer:** Product Strategist
**Spec reviewed:** `docs/UX-UNIFIED-EXPERIENCE.md` v1.0 (2026-04-18)

---

## Executive Summary

The unified experience spec identifies a real structural problem in StoryBank: the StoryBank workflow and Practice mode are disconnected experiences that should be a single preparation loop. The proposed solution -- a focus param, a save-to-bank modal, and a revised dashboard -- is correctly scoped and avoids the temptation to over-architect. The BUILD/APPLY/PRACTISE framing is sound but needs a minor reframe. The integration points are ranked and re-prioritised below; not everything marked P0 is actually P0.

The spec is good enough to build from, with five specific adjustments recommended.

---

## 1. Product Positioning Validation

### Does the "Preparation Loop" match real senior interview behaviour?

Mostly yes, with one important nuance.

The spec describes a loop: Upload real transcript, extract what worked, spot weak areas, practice those areas, save practice back to bank. This maps well to how a disciplined candidate prepares. But the spec assumes a neat sequential flow that is too tidy for how time-poor executives actually operate.

**How senior professionals really prepare:**

1. **Reactive, not systematic.** A Director juggling 4 processes does not sit down and think "today I will work on my stakeholder management weakness." They get off a call at 4pm, think "that went badly", and want to upload the transcript and quickly see what went wrong. The preparation loop exists, but it is almost always triggered by a specific event (an interview just happened, a new job spec just arrived, a next round was just scheduled) -- not by a dashboard nudge.

2. **Preparation sprints, not continuous loops.** The loop runs hot for 48-72 hours around a specific interview, then goes cold for days. The "Where to Focus" dashboard module assumes a user who checks in daily. The more likely pattern: open StoryBank the evening before an interview, look at what they have for this company, practice the gaps, go to bed. They may not see the dashboard at all.

3. **Company-centric, not category-centric.** The spec frames preparation around skill categories (stakeholder management, delivery). Senior candidates more often think company-first: "What do I need for my Hyble second round on Thursday?" The Job Match flow captures this, but it should be the primary frame, not secondary to Mirror.

### Is BUILD/APPLY/PRACTISE the right framing?

It is better than Library/Track/Prepare but could be sharper. The problem with BUILD is that it implies construction effort. For the target user, uploading a transcript is not "building" -- it is dumping raw material and letting the AI do the work. APPLY is good. PRACTISE is good.

**Alternative consideration:** CAPTURE / APPLY / PRACTISE. "Capture" better describes what the user is doing in that section -- capturing interviews and letting the system extract value. But this is a minor point and not worth blocking the build. BUILD is fine. Ship it.

### Positioning verdict

The preparation loop is the right mental model. The spec should just acknowledge that the loop is event-driven (triggered by interviews and deadlines) rather than habitual (driven by daily check-ins). This affects dashboard design: the "Where to Focus" module is more useful if it is deadline-aware ("You have a Hyble round in 2 days -- here is your readiness") rather than category-aware ("Your stakeholder management is weak"). That is a Phase 2 enhancement, not a blocker.

---

## 2. User Value Analysis: Integration Point Ranking

The spec proposes three integration points. Here they are ranked by user value, with rationale.

### Rank 1: Integration Point 2 -- Mirror/Job Match to Practice (Focus Param)

**Value: High. Effort: Low. Ship first.**

This is the single highest-value change in the spec. Right now, the user sees a gap in Job Match or a weak category in Mirror and has to manually navigate to Practice, remember what they wanted to focus on, and hope the AI asks relevant questions. The focus param eliminates all three of those friction points in one URL parameter and one system prompt append.

The reason this ranks above Save to Bank: it addresses the moment of highest user motivation. When someone sees "No examples for M&A integration" on a Job Match result, their impulse is "I need to fix this right now." A single click that takes them to a focused practice session captures that impulse before it dissipates. That is the gap-closing moment.

The effort is genuinely low -- a URL param, a banner component, and a conditional append to the system prompt. This can ship in a day.

### Rank 2: Integration Point 1 -- Practice to StoryBank (Save to Bank Modal)

**Value: High. Effort: Medium. Ship second.**

This closes the loop in the other direction. Without it, practice sessions produce ephemeral conversations that disappear. With it, good practice answers become permanent bank entries that improve Mirror analysis and Job Match results over time. This is what makes the flywheel actually fly.

The reason it ranks second, not first: the user can live without it longer. If they practice a good answer, they can manually re-upload or note it down. It is friction, not impossibility. The focus param, by contrast, is enabling a behaviour that does not happen at all today.

The Q&A pair extraction logic (Section 7.3 of the spec) is well-specified but contains one design risk: the 80-word threshold for "substantive answer" is arbitrary. Some of the most powerful interview answers are tight -- 40-50 words of specific, metric-laden response. The threshold should be configurable or replaced with an AI quality check that runs client-side on the extracted pairs. This is a small scope addition.

### Rank 3: Dashboard "Where to Focus" Module

**Value: Medium. Effort: Medium. Ship third.**

This is opinionated guidance and it is a good idea, but it has lower immediate value than the two functional integration points above. The reason: the target user does not spend time on dashboards. They land on the dashboard, glance at their numbers, and navigate to the specific thing they came to do (upload, match, practice). The "Where to Focus" module is most useful when the user does not have a specific task in mind -- and that is the minority of visits.

The logic hierarchy (consistency contradiction first, weak coverage second, unsaved practice third) is well-reasoned. But the module adds medium engineering effort for a feature that will be seen for 3 seconds per visit. Ship it, but do not let it block the two functional connections.

### Rank 4: Integration Point 3 -- Practice Sessions Count in Dashboard

**Value: Low. Effort: Medium. Correctly deferred by the spec.**

The spec already defers this. Agreed. A session count is a vanity metric for the user. What matters is whether their bank is growing and their gaps are closing. The existing three-metric stats row is sufficient.

### Missing Integration Points

Two integration points are absent from the spec and should be considered for the roadmap:

**Missing A: Job Match to Upload.** When Job Match surfaces a gap ("No examples for M&A integration"), the current CTA is "Practice this gap." But what if the user has a real M&A story from a previous career that they have not uploaded? The gap card should offer two CTAs: "Practice this gap" AND "I have a story for this -- upload it." This is a trivial link addition.

**Missing B: Consistency to Practice.** If a user has a consistency contradiction flagged (e.g. different compensation figures across companies), they should be able to practice navigating that question specifically. A CTA on the consistency contradiction card: "Practice handling this question" linking to `/practice?focus=Compensation+expectations`. Same pattern as the Mirror CTA. Trivial to add.

---

## 3. Competitive Moat Assessment

### The real competitive landscape

StoryBank does not compete with other interview prep SaaS products. There are very few purpose-built tools for this use case, and none with meaningful traction at the senior executive level. The actual competition is:

1. **Manual ChatGPT/Claude workflows.** A senior candidate opens Claude, pastes their transcript, asks it to identify Q&A pairs, saves them in a Google Doc, then opens a new conversation to practice. This is StoryBank's workflow, done manually with no persistence or cross-session intelligence.

2. **Notes apps + memory.** Many senior candidates keep a personal doc ("My Stories") with their go-to examples, and prepare by re-reading it before each interview. No AI, no gap analysis, no consistency tracking.

3. **Executive coaches.** The premium alternative. Costs $300-500/hour. The coach does what StoryBank does -- identifies patterns, flags gaps, practices delivery -- but with human judgment and relationship context.

4. **LinkedIn's AI features.** LinkedIn has interview prep tools, but they are generic (targeted at mid-career, not senior). If LinkedIn built a transcript-to-bank feature, it would be a threat -- but LinkedIn's incentive structure (ad-driven, recruiter-focused) makes deep candidate-side tooling unlikely in the near term.

### How the unified experience affects defensibility

**Strengthens the moat:**

- The preparation loop creates compounding value that manual workflows cannot replicate. Each uploaded transcript improves Mirror analysis. Each practice session can feed back into the bank. Over 3-6 months of active interviewing, the user's StoryBank becomes irreplaceable -- it contains their entire career narrative, analysed and indexed. Switching cost grows with every interaction. This is the most important moat dynamic in the product.

- The focus param specifically -- linking weakness identification to targeted practice -- is something that requires persistent data and cross-feature awareness. A ChatGPT workflow cannot do this because it has no memory of your Mirror analysis. Each conversation starts from zero.

- The Save to Bank modal creates a second data ingestion path. Users who do not have real transcripts (perhaps they are in early-stage conversations or informational interviews) can still build their bank through practice sessions. This broadens the entry funnel.

**Does not meaningfully change:**

- The nav restructuring (BUILD/APPLY/PRACTISE) is a UX improvement, not a competitive differentiator. It makes the product easier to use but does not create any new capability that a competitor could not replicate.

- The dashboard "Where to Focus" module is table-stakes for any AI productivity tool. It is expected, not differentiating.

**Risk to watch:**

- If Claude or ChatGPT ship persistent memory + projects that maintain context across conversations, the manual workflow competition gets significantly better. The user could keep a "My Interview Prep" project in Claude with all their transcripts and examples, and Claude would remember everything across sessions. StoryBank's advantage then narrows to: better UX, purpose-built analysis (Mirror, Consistency), and the structured data layer. That is still a real advantage, but less of one. The unified experience strengthens StoryBank's position against this scenario by making the structured data layer more valuable through the preparation loop.

---

## 4. Prioritisation Recommendation

The spec marks every item P0. This is incorrect. Here is the corrected prioritisation.

### Actual P0 -- Must ship together as a cohesive release

| Item | Effort | Rationale |
|------|--------|-----------|
| Focus/Gap query param on Practice page | Low | Highest value integration point |
| System prompt injection for focus topic | Low | Required for focus param to work |
| Mirror to Practice CTA link | Trivial | The link that makes focus param reachable |
| Job Match to Practice CTA link | Trivial | Same |
| "Practice session" system tag in seed | Trivial | Required for Save to Bank |
| Save to Bank post-practice modal | Medium | Closes the loop in the other direction |
| Nav section labels update (BUILD/APPLY/PRACTISE) | Trivial | Ships with the narrative |
| Practice nav icon change (MessageCircle to Mic) | Trivial | Trivial, ship with nav update |

**P0 total: 5 low/trivial items + 1 medium item. One engineering sprint, as the spec estimates.**

### Actual P1 -- Ship in the following sprint

| Item | Effort | Rationale |
|------|--------|-----------|
| Dashboard "Where to Focus" module | Medium | Valuable but not blocking the core loop |
| Dashboard quick-action update (add Practice, remove Consistency) | Trivial | Couples with the Focus module |
| Consistency to Practice CTA (missing from spec) | Trivial | Same pattern as Mirror CTA |
| Job Match gap to Upload CTA (missing from spec) | Trivial | Second path from gap identification |

### Actual P2 -- Nice to have, schedule when convenient

| Item | Effort | Rationale |
|------|--------|-----------|
| Dashboard sessions count | Medium | Vanity metric, low user value |
| Dashboard personalised greeting ("Good morning, Claire") | Trivial | Polish, not function |

### Build order rationale

The P0 bundle is the minimum set that makes the product feel unified. It takes practice from an orphaned feature to a connected experience. A user can go from Mirror weak category to focused practice to saved example in a single session. That is the pitch.

The P1 bundle adds proactive guidance (the dashboard tells you what to do) and fills in two small gaps the spec missed. It can ship a week later without diminishing the P0 release.

---

## 5. Pricing Impact

### Does the unified experience justify the proposed pricing?

**Proposed pricing:** $49/month B2C or $99/3-month sprint.

The unified experience strengthens the pricing case but does not fundamentally change it. Here is why:

**Table-stakes features (expected at any price point):**
- Transcript upload and Q&A extraction
- Example bank with filtering and tagging
- Practice mode with AI personas
- Basic analytics (counts, categories)
- The preparation loop connections (focus param, save to bank)

These are the core product. If these do not work well, the price is irrelevant.

**Premium-justifying features (what makes $49/month feel worth it):**
- Mirror analysis -- pattern recognition across your entire career narrative
- Job Match with gap analysis -- know what you are missing before you apply
- Consistency tracking -- the one feature that prevents career-damaging mistakes
- Focus-aware practice -- the AI actually targets your weak areas, not random questions

The unified experience moves the focus param and save-to-bank from "premium" to "table stakes." This is the right call -- these connections are too fundamental to gate behind a paywall. But it means the pricing justification rests more heavily on Mirror, Job Match, and Consistency.

### Pricing recommendation

The $49/month price is defensible for the target user. A Director or VP spending $200-500/month on LinkedIn Premium, executive coaches, and recruiter coffees will not blink at $49 for a tool that makes them better prepared. The question is not "is $49 too much?" but "does StoryBank save them enough time and reduce enough anxiety to justify adding another subscription?"

The 3-month sprint at $99 ($33/month effective) is the better offer for this audience. Senior interview processes typically run 8-16 weeks. A time-limited bundle aligned to that timeline ("Interview Sprint -- 3 months of full access") is psychologically easier to justify than an open-ended monthly commitment. The user is not committing to a lifestyle subscription; they are investing in a specific outcome.

**Consider:** A freemium tier with transcript upload + basic example bank (limited to 20 examples) and practice mode (limited to 3 sessions/month). The free tier gets the user invested in the data, then they upgrade when they need Mirror analysis, Job Match, or unlimited practice. The unified experience makes free-to-paid conversion stronger because the preparation loop keeps pulling the user deeper.

---

## 6. Risk Analysis

### Risk 1: Practice-to-Bank data quality pollution

**Severity: Medium. Likelihood: High.**

Practice session answers are, by definition, less polished than real interview answers. They are first drafts, often incomplete, sometimes rambling. If users save many practice answers to their bank, the overall quality of Mirror analysis and Job Match results will degrade. A bank full of practice-session-quality examples will produce misleading strength assessments.

**Mitigation:** The spec's "Practice session" tag is a good start. Mirror analysis should weight practice-sourced examples lower than transcript-sourced examples, or allow the user to filter them out. The spec does not address this -- it should.

### Risk 2: Focus param creates echo chamber practice

**Severity: Low-Medium. Likelihood: Medium.**

If the user always practices with a focus param, the AI always asks about the same topic. This can lead to over-rehearsed answers in one area while other areas remain weak. Real interviews are unpredictable -- a candidate who only practices stakeholder management questions will be caught off-guard by a technical depth probe.

**Mitigation:** The spec correctly limits the focus injection to "at least 3 of your questions probe this topic." This means the AI will still ask other questions. Consider adding a small note in the focus banner: "Your interviewer will focus on this topic but may ask other questions too."

### Risk 3: Save to Bank modal interrupts the practice flow

**Severity: Low. Likelihood: Medium.**

After receiving feedback, the user is in a reflective state -- processing what went well and what did not. A modal prompting them to save answers may feel like a chore at that moment. If they consistently click "Skip", the integration point fails silently.

**Mitigation:** The spec uses an inline prompt card (not a modal) that appears below the feedback. This is less interruptive than a true modal. But consider: instead of asking immediately after feedback, offer a persistent "Save answers to bank" action that stays available (as a small affordance, not a prompt) until the user navigates away. Less pushy, higher conversion over time.

### Risk 4: The Q&A extraction from practice conversations is unreliable

**Severity: Medium. Likelihood: Medium.**

The spec proposes client-side logic to pair assistant questions with user answers. In practice, conversations are messy. The AI might ask two questions in one message. The user might answer across multiple messages. The 80-word threshold will miss short, powerful answers. The auto-select logic ("does not start with 'I don't know'") is brittle.

**Mitigation:** Replace the client-side heuristic extraction with an AI call. Send the full conversation to Claude with a prompt: "Extract the Q&A pairs from this practice session that would make good career examples. For each, provide the question and the candidate's answer." This is a single API call, takes 2-3 seconds, and produces dramatically better results than regex-style heuristics. The additional cost per session is negligible (one Haiku call).

### Risk 5: Low adoption of the preparation loop

**Severity: Medium. Likelihood: Medium.**

The entire value proposition of the unified experience depends on users actually following the loop: upload, review, identify weakness, practice, save. If users only use one part of the product (e.g., they upload transcripts but never practice, or they practice but never upload), the integration points sit unused.

**Mitigation:** This is why the P1 dashboard "Where to Focus" module matters. It is the nudge engine that closes the loop for users who would not close it themselves. But more importantly, the product should track funnel drop-off: what percentage of users who see a weak category in Mirror click through to practice? What percentage of practice sessions result in saved examples? These metrics will tell you whether the loop is working or whether it is a theoretical construct that real users ignore.

### Risk 6: Assumption that senior execs will use practice mode at all

**Severity: High. Likelihood: Unknown.**

This is the biggest unvalidated assumption in the entire product. Many senior professionals consider practice interviews beneath them or unnecessary. They have been interviewing for 20+ years. The StoryBank (upload/review/analyse) side maps to a real workflow they already do (organising their stories). The Practice side asks them to do something many of them do not do: rehearse with an AI.

**Mitigation:** Validate this before investing heavily. Look at practice mode usage data from Phase 1. If fewer than 30% of active users have tried practice mode, the unified experience is connecting a well-used feature (StoryBank) to a feature that most users skip (Practice). In that scenario, the focus param and dashboard nudges become a user acquisition tool for Practice mode -- which is valuable, but different from the "connecting two popular features" narrative in the spec.

---

## 7. Strategic Recommendations

### Recommendation 1: Ship the Focus Param and Save to Bank as one release, without the dashboard changes

The P0 bundle (focus param + save to bank + nav restructure) should ship as a single coherent release. The dashboard "Where to Focus" module should ship separately in the following sprint. Reason: the dashboard module has the highest scope-creep risk (the logic hierarchy is complex, the API surface is broad, and it will generate edge-case bugs). Decoupling it from the core integration work protects the critical path.

### Recommendation 2: Use AI extraction for Save to Bank, not client-side heuristics

The spec proposes client-side Q&A pair extraction with word-count thresholds and filler-phrase detection. This will produce poor results on messy practice conversations. Replace it with a single Claude Haiku call that extracts and evaluates Q&A pairs from the full conversation. Cost: approximately $0.001 per practice session. Quality improvement: substantial. This is the kind of thing the AI should do, not client-side string matching.

### Recommendation 3: Add a "source weight" concept to Mirror analysis

Practice-sourced examples and transcript-sourced examples should not be treated equally in Mirror analysis. A real interview answer that was rated "strong" carries more signal than a practice answer that was saved. Mirror should either weight them differently or offer a toggle ("Include practice examples in analysis: yes/no"). This prevents bank pollution from degrading the feature that justifies the premium price.

### Recommendation 4: Track the loop completion rate from day one

Before building any of this, instrument the funnel: Mirror/Job Match page view with weak category or gap shown -> Practice page view with focus param -> Practice session completed -> Save to Bank modal shown -> Examples saved. This is the core product metric. If the loop completion rate is below 15%, the unified experience is not working and needs design iteration. If it is above 30%, it is working and justifies further investment.

### Recommendation 5: Validate Practice mode adoption before doubling down

Check the Phase 1 usage data. How many active users have completed at least one practice session? If Practice mode is underused, the immediate priority is not connecting it to StoryBank -- it is understanding why users are not practicing. The focus param might help (it gives users a reason to practice), but if the barrier is "senior execs do not want to practice with an AI," no amount of integration will fix that.

---

## Decision Summary

| Spec Element | Verdict | Notes |
|---|---|---|
| Preparation Loop mental model | Approved | Correct, with caveat that it is event-driven, not habitual |
| BUILD/APPLY/PRACTISE nav framing | Approved | Ship as-is. CAPTURE is marginally better but not worth the delay |
| Integration Point 1: Save to Bank | Approved with modification | Use AI extraction instead of client-side heuristics |
| Integration Point 2: Focus Param | Approved | Highest value, ship first |
| Integration Point 3: Dashboard Sessions Count | Approved deferral | Correctly deferred by the spec |
| Dashboard "Where to Focus" module | Downgraded to P1 | Valuable but not on critical path for loop closure |
| All items marked P0 | Rejected | Re-prioritised as P0/P1/P2 above |
| Missing: Consistency to Practice CTA | Recommended for P1 | Same pattern as Mirror CTA, trivial to add |
| Missing: Job Match gap to Upload CTA | Recommended for P1 | Second path from gap identification |

---

## Appendix: What "Done" Looks Like

The unified experience is done when a user can perform this sequence without leaving StoryBank:

1. Upload a real interview transcript
2. See that "stakeholder management" is their weakest category in Mirror
3. Click "Practice stakeholder management" from Mirror
4. Practice with an AI interviewer who probes stakeholder management
5. Save two good answers from the practice session to their Example Bank
6. Return to Mirror and see their stakeholder management strength has improved

If that works end-to-end, the product is unified. Everything else is polish.

---

*STRATEGY-REVIEW-UNIFIED-UX.md -- StoryBank v1.0*
*Next step: Product owner reviews this document and confirms P0 scope before engineer begins work.*
