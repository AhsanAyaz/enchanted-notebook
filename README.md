# ✒️ Enchanted Notes

> Your notebook writes back.

A speaker's magic notebook. You scribble a half-formed thought backstage — **the page drinks your ink** and writes back in flowing handwriting: a tightened line, the hardest question your point invites, a delivery note. There is no chat UI, no message bubbles, and no send button. The AI is invisible; the notebook is enchanted.

Built with **Angular 22**, **NestJS + Genkit (Gemini)**, and [`@codewithahsan/ngx-quill-ink`](https://www.npmjs.com/package/@codewithahsan/ngx-quill-ink) — the handwriting engine that renders streaming text as animated ink ([source](https://github.com/AhsanAyaz/ngx-quill-ink)).

## How it works

You write on the page. When you pause for 2.8 seconds (or tap the wax seal), the ink dissolves into the paper — and that dissolve *is* the loading state, because the request is already in flight. Your words come back transcribed into the manuscript, and a persona annotates them in the margin, in its own hand.

### The five personas

Summon one by drawing its glyph in the left margin, or by pressing a wax stamp on the rail.

| Glyph | Persona | Writes back |
| --- | --- | --- |
| `!` | **The Editor** | Your thought, tightened to one punchy speakable line |
| `?` | **The Skeptic** | The hardest question your point invites — exactly one |
| `~` | **The Coach** | A delivery note: pacing, pauses, what to cut |
| `*` | **The Storyteller** | An anecdote or metaphor scaffold that makes it land |
| `#` | **The Timekeeper** | Speaking-time estimate and what to trim |

Each persona writes in a distinct hand and ink colour, so you know who answered before you read a word.

### What you can do with a beat

- **Accept a rewrite** — tap the ✓ on the Editor's line and it replaces yours (struck through, re-inked). The Storyteller's scaffold weaves in below your words instead. Both are reversible with **↩ restore**; your original transcript is never lost.
- **Replay it** — export the moment as a 1080×1920 video: your beat written out, then the persona's reply, in animated handwriting. Made for sharing.
- **Copy** your own words, or **burn** the beat entirely.

### Writing without a stylus

On a laptop, hit the ⌨ toggle for a typing desk. Typed turns skip the vision pass entirely (~1s to first reply versus ~8s for ink), and the reply still arrives as handwriting.

## Run it

Requires Node 20+, Docker (or OrbStack), and a [Gemini API key](https://aistudio.google.com/apikey).

```bash
npm install

# 1. Postgres
docker compose up -d

# 2. env — fill in GEMINI_API_KEY
cp .env.example .env

# 3. db schema
npx prisma migrate dev

# 4. API (:3333) and app (:4400), in two terminals
npx nx serve enchanted-notes-api
npx nx serve enchanted-notes
```

Open http://localhost:4400, create a notebook, and write on the page with a stylus, finger, or mouse.

> **Note on the database host.** `.env.example` points at `enchanted-notes-db.orb.local` (OrbStack's container DNS) because a host Postgres often already owns `localhost:5432`. On plain Docker Desktop, change it to `localhost:5432`.

## Layout

```
apps/
  enchanted-notes/       # Angular 22 PWA — signals, standalone, zoneless-ready
  enchanted-notes-api/   # NestJS + Genkit: vision pass → persona pass → SSE
packages/
  notes-domain/          # shared types: Notebook, Page, Turn, Persona, events
```

The API streams **sentence-sized** SSE events rather than tokens, because handwriting animates most naturally a sentence at a time.

## Tests

```bash
npx nx run-many -t test build
```

## Working on ngx-quill-ink alongside this app

Point the three `@codewithahsan/*` dependencies at your local build:

```bash
npm i @codewithahsan/quill-ink-core@file:../ngx-quill-ink/dist/packages/quill-ink-core \
      @codewithahsan/ngx-quill-ink@file:../ngx-quill-ink/dist/packages/ngx-quill-ink \
      @codewithahsan/quill-ink-fonts@file:../ngx-quill-ink/dist/packages/quill-ink-fonts
```

After rebuilding the library, Vite keeps serving the **old** cached bundle — it doesn't watch symlinked `file:` deps. Always clear the cache and restart the dev server:

```bash
rm -rf .angular node_modules/.vite
```

## Not built yet

Offline turn queue and sync, service worker, rehearsal-mode countdown, ambient page sounds, rate limiting, and real auth (there's a dev-user stub). PNG storage uses a local-disk driver behind a `StorageService` interface.

## Notes

- Committed page images are uploaded for the vision pass and stored on disk; turns keep only the transcript.
- Latency is ~8s per ink turn on `gemini-2.5-flash`. Try `GEMINI_MODEL=gemini-2.5-flash-lite` for something closer to the 3.5s target.
- Five personas share three handwriting packs, differentiated by ink colour and pen speed.

## License

MIT — see [LICENSE](./LICENSE). The original design document is in [spec.md](./spec.md).
