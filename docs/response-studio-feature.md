# Response Studio Feature

## Purpose

Response Studio turns an active attention slice into human-reviewed campaign communications. It uses public social/web/news signals, deep sentiment, and opposition/public-claim monitoring to produce ready-for-review content, briefing notes, and factual contrast frames.

## Safety and governance boundary

This feature must not create covert manipulation, individual voter targeting, fabricated opposition attacks, or automated publishing. Every output is draft-only until a human approves it.

Required guardrails:

- Use aggregate public attention, not individual voter scores.
- Show evidence links for the attention slice and opposition/public claims.
- Label unverified opposition claims as `needs verification`.
- Require human approval before external publishing.
- Keep contrast factual: what public claims exist, what is missing, what evidence supports the statement.
- Do not auto-send, auto-post, impersonate, or generate deceptive content.

## Core workflow

1. User selects an attention slice: topic, state, platform, sentiment, emotion, entity, or time window.
2. Backend builds a response packet:
   - lead topic and state
   - dominant emotion, urgency, intensity, and attention volume
   - supporting evidence links
   - related opposition/public claims
   - recommended posture
   - draft content variants
3. Frontend displays:
   - response posture
   - evidence pack
   - opposition/public-claim research
   - ready-for-review drafts
   - approval status and risk label
4. Human operator reviews, edits, assigns, or exports.

## v1 UI

Add a `Response Studio` panel below the war-room grid:

- Signal card: what sentiment or issue triggered the response.
- Guardrails rail: approval, evidence, no individual targeting, no fabricated claims.
- Opposition research card: public claims and verification status.
- Draft cards: X/short post, Facebook/community post, candidate briefing.

## Future build

- Add CRUD for opposition profiles and watchlists.
- Add crawler jobs for opposition websites, speeches, public social accounts, debate clips, and news mentions.
- Add claim extraction and claim verification queue.
- Add approval workflow with statuses: draft, legal review, comms review, approved, rejected, published externally.
- Add export targets after approval: copy, PDF brief, CMS handoff, or social scheduler integration.
