# Spec — Enchanted Notes

> A speaker's magic notebook (PWA, stylus-first). You scribble a half-formed thought backstage; **the page drinks your ink** and writes back — a tightened speaker note, a counter-argument to rehearse against, or a delivery tip — in flowing handwriting. The persona you summon is chosen by **drawing a glyph in the margin**.

Status: PWA. Depends on ngx-quill-ink (capture + write paths) and a Genkit/Gemini backend.
Primary user: conference speakers preparing and rehearsing a talk.

This is the original design document, kept as written so the reasoning behind
the product is visible. See the [README](./README.md) for what actually shipped.

---

## 1. Concept

Speakers don't need another notes app; they need a **rehearsal partner** that meets them in the medium they already use backstage: scribbles. Enchanted Notes keeps the entire interaction on paper — no chat UI, no send button, no bubbles. You write; it answers in ink. The AI is invisible; the notebook is enchanted.

## 2. Personas & the margin-glyph ritual (the theatrics core)

The user summons a persona by drawing a small glyph in the left margin before (or after) writing. The glyph itself animates — it "catches fire" briefly (small ink-to-ember particle flourish) to confirm the summon:

| Margin glyph | Persona | What it writes back |
|---|---|---|
| `!` | **The Editor** | The same thought, tightened to one punchy speakable line (+ optionally a 3-beat structure) |
| `?` | **The Skeptic** | The strongest counter-argument or hardest audience question your point invites |
| `~` | **The Coach** | A delivery note: pacing, pause placement, where to breathe, what to cut if over time |
| `*` | **The Storyteller** | A concrete anecdote/analogy/metaphor scaffold for the point |
| `#` | **The Timekeeper** | Estimated speaking time of the section + what to cut to hit a target |

No glyph → default persona (Editor). Glyph recognition is intentionally simple: the vision model reads it from the committed page image along with everything else — no separate recognizer needed.

### The interaction loop, exactly

1. User writes on the page (Apple Pencil / any stylus / finger). Optional margin glyph.
2. After 2.8s idle (or tapping the wax-seal button in the corner), **commit**: ink dissolves into the paper (quill-ink capture animation, ~1.2s). During this animation the request is already in flight — the dissolve *is* the loading state. This is the single most important latency trick; there is never a spinner.
3. The reply streams back and is handwritten below where the user's ink was, in a **distinct hand** per persona (different quill-ink font + ink color: Editor = blue-black Caveat; Skeptic = red-brown Shadows Into Light, slightly faster/sharper; Coach = green Dancing Script, slower; etc.). The persona's "voice" is visible before you read a word.
4. User's original text quietly re-materializes above in faint gray (30% opacity) after the reply completes — so context is never lost, but the reply owns the page. Tapping the faint text toggles full opacity.
5. Writing again continues the thread; the model receives the full page history.

### Additional theatrics

- **Page turn**: swipe left = new page with a paper-turn animation; the notebook has a spine and pages are a persistent, ordered notebook per talk.
- **Rehearsal mode**: tap the hourglass; a handwritten countdown appears top-right ("12 min"); Timekeeper persona interjects unprompted if pages exceed the time budget (writes a small margin note: "cut the demo story — 90s over").
- **The Green Room ambiance** (optional toggle): faint candle-flicker vignette + very subtle paper sounds on pen contact (Web Audio, off by default).

## 3. Architecture

### Relationship to ngx-quill-ink (read first)

Enchanted Notes is a separate repo from the ngx-quill-ink monorepo. It **consumes the published `ngx-quill-ink` npm package** as an ordinary dependency — do **not** vendor or copy the library source into this repo. The library (and its demo app) live in their own repo; this repo holds the app, backend, and prompts. Keep them separate.

- Dependency: `"@codewithahsan/ngx-quill-ink": "^0.x"` in `package.json`.
- During simultaneous co-development of the library and this app, a `file:` dependency (or `npm link`) gives live edits — a **dev-only tooling convenience**, not a repo-structure change.

### Repo layout

```
apps/
  enchanted-notes/          # Angular PWA (stylus-optimized, offline-tolerant)
  enchanted-notes-api/      # NestJS + Genkit (Railway)
packages/
  notes-domain/             # shared types: Notebook, Page, Turn, Persona
# ngx-quill-ink is NOT here — it's an external npm dependency (see above)
```

### Frontend (Angular PWA)

- Canvas page component built on quill-ink `enableCapture` + `write`.
- Notebook shell: talk list → notebook → pages. State in signals; persistence in IndexedDB (Dexie) — **offline-first**: pages and pending turns queue locally; sync when online (backstage Wi-Fi is hostile; this is a hard requirement).
- PWA: installable, landscape+portrait, `touch-action: none` on canvas, palm rejection via pointerType filtering (ignore `touch` when a `pen` pointer was seen in the last 60s — simple heuristic, document it).
- Auth: Google auth (via Supabase), with a per-user daily turn budget.

### Backend (NestJS + Genkit)

- `POST /turns` — multipart: page PNG (committed capture), notebook context (last N turns as text), persona hint (client may pre-parse none — server decides from image), talk metadata (title, target duration). Response: **SSE stream** of sentences.
- Genkit flow `enchantTurn`:
  1. **Vision pass** (Gemini Flash, image input): transcribe handwriting, detect margin glyph, detect diagrams/arrows (describe them), return structured JSON `{ transcript, glyph, sketch_description }`.
  2. **Persona pass** (Gemini Flash, text): system prompt per persona (short, opinionated, speakable-length outputs — hard cap ~60 words for Editor/Coach, ~80 for Skeptic/Storyteller; handwriting is slow, brevity is a feature). Streams sentences.
  3. Server re-chunks token stream into **sentence-sized SSE events** (quill-ink animates most naturally per sentence).
- Store turns (Postgres via Prisma) for notebook sync + a personal "insights" page later. PNG stored in Supabase storage, auto-delete after 30 days (privacy default; note in UI).
- Rate limiting + per-user token budget (BullMQ not needed v1; direct streaming).

### Prompt design notes (implement as Genkit prompts)

- All personas receive: transcript, sketch description, talk title, running notebook summary (maintained server-side, updated per turn via a cheap summarization call every 5 turns).
- Persona outputs must be **speakable text only** — no markdown, no bullets, no headers (it's going to be handwritten). Enforce with instructions + a regex strip.
- Skeptic must ask exactly one hard question OR one counter-argument, never a list.

## 4. Data model

```ts
Notebook { id, userId, title, targetMinutes?, createdAt }
Page     { id, notebookId, index }
Turn     { id, pageId, seq, userPngUrl, transcript, glyph, persona,
           replyText, createdAt, latencyMs }
```

## 5. Acceptance criteria

- Full loop (write → dissolve → streamed handwritten reply) with first reply-ink on screen **< 3.5s** after commit on conference Wi-Fi (vision+persona passes pipelined: persona pass starts on partial transcript).
- Works fully offline for writing; queued turns flush on reconnect with a small margin note ("answered late — the owl was delayed" — yes, keep this).
- iPad Safari + Android Chrome stylus tested; palm rejection acceptable.
- A stranger can understand the app with zero instructions given only the wax seal + margin glyph legend printed on page one of every new notebook (an actual handwritten legend page — onboarding *in the fiction*).

## 6. Later

- Import a post-talk audience-question snapshot as a notebook page, so the
  Skeptic can rehearse you against *real* questions. (Design the Turn model to
  allow non-pen source turns now — `Turn.source` exists for this.)

## 7. Risks

- Handwriting legibility of vision OCR on sloppy backstage scribbles → show transcript faintly on tap so users can correct; corrections feed the next turn.
- Latency on bad Wi-Fi → dissolve animation + sentence streaming hides up to ~4s gracefully; beyond that, the owl-delay note.
- Scope creep toward "notes app" features → the notebook is append-only ink; no text editing, ever. That constraint IS the product.
