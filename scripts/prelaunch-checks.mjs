import fs from 'node:fs'
import assert from 'node:assert/strict'

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const page = read('app/page.js')
const route = read('app/api/analyze/route.js')
const layout = read('app/layout.js')
const css = read('app/globals.css')

assert.match(layout, /Nigi — Know where your business belongs/, 'Metadata must use the Nigi identity')
assert.match(page, /Ask anything about a location/, 'The homepage must expose a natural-language location prompt')
assert.match(page, /\/api\/analyze/, 'The client must call the server-side Nigi analysis route')
assert.match(page, /How Nigi reached this conclusion/, 'Results must explain their evidence')
assert.match(page, /placeIntelligence/, 'Places-first intelligence must drive the primary recommendation')
assert.match(page, /Places intelligence/, 'Results must expose a dedicated Places intelligence section')
assert.match(page, /Places API \+ GPT-5\.4/, 'The UI must identify the primary Places and GPT engines')
assert.match(page, /Places-led analysis/, 'The primary hero must be labelled as Places-led rather than an AskLizy fit verdict')
assert.match(page, /Original request:/, 'Clarification answers must remain first while retaining bounded original context')
assert.match(page, /AskLizy KPI benchmark/, 'AskLizy must be presented as a secondary deterministic benchmark')
assert.match(page, /No account required/, 'The no-Supabase MVP must be clear to users')
assert.match(route, /OPENROUTER_API_KEY/, 'OpenRouter must be called server-side')
assert.match(route, /RAPIDAPI_KEY/, 'AskLizy map data must be called server-side')
assert.match(route, /calculateAskLizyScore/, 'The route must use deterministic AskLizy scoring')
assert.match(route, /createUsageToken/, 'Anonymous usage must be limited without Supabase')
assert.doesNotMatch(route, /SUPABASE|DATABASE_URL/, 'Nigi MVP must not depend on Supabase or a database')
assert.match(css, /--nigi-blue:\s*#315ef4/i, 'Visual identity must use the PratiVal/Omachart electric blue')
assert.match(css, /--nigi-navy:\s*#111827/i, 'Visual identity must use the PratiVal/Omachart navy')
assert.match(css, /--nigi-pale:\s*#f5f9ff/i, 'Visual identity must use a pale-blue background')
assert.match(css, /IBM Plex Mono/i, 'KPI labels must use the requested mono typography')

console.log('Nigi prelaunch checks passed')
