# Nigi

Nigi is a Places-first commercial location assistant. GPT-5.4 Mini analyses bounded, structured competitor and review evidence from the Places API; AskLizy’s deterministic KPI model remains a secondary benchmark, and server-side templates keep every numeric claim grounded.

## MVP

- Evaluate one candidate address in natural language
- Ask one clarification when the location is missing
- Analyse nearby categories, distances, ratings, review volume, opening-hour data and bounded recent review excerpts
- Use the same Maps Data / RapidAPI source and KPI weights as AskLizy for a secondary deterministic benchmark
- Return Places-based market patterns, competitor highlights, opportunities, review themes, KPI evidence and a map
- Anonymous limit of five requests per browser and best-effort hashed IP per UTC day
- No Supabase, database, account or saved history

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Set `OPENROUTER_API_KEY`, `RAPIDAPI_KEY`, and a random `NIGI_COOKIE_SECRET` of at least 24 characters.
3. Run `npm install` and `npm run dev`.

## Quality gates

```bash
npm test
npm run test:prelaunch
npm run lint
npm run build
```

## Privacy and abuse controls

Prompts and bounded review excerpts without reviewer profile fields are sent to OpenRouter for brief classification and evidence analysis. Address, business category and provider identifiers are sent to the Maps Data / RapidAPI service for location and review retrieval. Result maps are loaded in the visitor's browser from OpenStreetMap. Nigi does not require an account or save analysis history. It stores a signed daily-count cookie in the browser and keeps HMAC-hashed IP counters only in process memory for rate limiting.

The in-process IP and concurrency limiter is deliberately best-effort: serverless instances do not share memory and counters disappear when an instance is recycled. Keep the route structured behind `/api/analyze` and layer Vercel WAF rate-limit rules in production for distributed enforcement. No Supabase or database is required.

Scores are decision-support indicators based on nearby place, rating and review-activity signals, not measured visits or sales. Review coverage is exposed and analysis fails when fewer than 60% of requested review samples succeed.
