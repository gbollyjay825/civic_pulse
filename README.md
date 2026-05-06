# Civic Pulse 2027

AI-powered attention intelligence war room for tracking public online attention across social, web, news, video, and field inputs.

## Project structure

```text
CivicPulse2027/
├── backend/   # Standalone Node API for attention data, filters, sentiment, recommendations
└── frontend/  # War-room dashboard frontend
```

## Run locally

Terminal 1:

```bash
cd /Users/gbolahan.salami/Documents/CivicPulse2027/backend
npm run dev
```

Terminal 2:

```bash
cd /Users/gbolahan.salami/Documents/CivicPulse2027/frontend
npm run dev
```

Open:

```text
http://localhost:5177
```

## Current build

- Total online attention dashboard
- Campaign geography control with `All Nigeria` command view or a locked single-state room
- Filterable attention by topic, state, platform, sentiment, emotion
- Web/news and social source model
- Deep sentiment dimensions: emotion, stance, trust, intensity, urgency, confidence
- War-room recommendations for where to push, pause, clarify, or investigate
- Backend-first API shape ready for live connectors
- Actual Nigeria state boundary map using local GeoJSON
- State drilldown with LGA attention rows and ward-point coverage where data is available
- Response Studio with ready-for-review content drafts, evidence guardrails, and opposition/public-claim research

## Next build phase

1. Add persistent database schema.
2. Add live web/news crawler.
3. Add X API connector.
4. Add YouTube connector.
5. Add AI classifier service for deep sentiment.
6. Replace seeded data with ingestion jobs.
7. Replace modeled LGA/ward attention with real geo-coded social, web, and field signals.
8. Add approval persistence and external publishing handoff after human review.
