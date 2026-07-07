# AI Hunter — Build Instructions

Project plan and micro-steps will be pasted here after planning session.

# AI Hunter — MVP Build Checklist

> **How to use this file.** Feed Claude Code **one task at a time**, not the whole file. After each task: (1) run it, (2) confirm it works, (3) `git commit`. Never move to the next task until the current one is verified. This keeps the code understandable, keeps you able to roll back, and keeps you from one-shotting a tangle you can't change later.

> **Scope discipline.** This checklist covers **only** the skeleton + backend + one playable card (Phases 0–4). Anything not in here is intentionally parked (see bottom). If you feel the urge to add a parked feature mid-build, resist — write it in the parking lot and keep going.

> **Locked decisions (do not re-litigate mid-build):**
>
> - Game prompt: **"Tap the real image"** (betrayal framing)
> - Which side is real is **randomized per card**
> - **One model per card**; three generators total (gpt-image-2, a Gemini/Nano Banana model, provisional third)
> - Store **individual vote events** (event log), not just aggregate counts
> - Stack: **Expo (React Native) + Supabase**
> - MVP UI = **functional, not pretty**. Polish is a separate later pass.

---

## Phase 0 — Foundations

*Goal: clean, organized project wired to Supabase. (Real project + Supabase already exist — this phase confirms and structures.)*

- [x] **0.1 — Confirm the project runs.** Start the dev server, load the app on your iPhone via Expo Go, confirm hot-reload works (edit a text string, watch it update). ✅ *Verify: app loads on phone, edit reloads live.*
- [x] **0.2 — Set up the folder structure.** Create the modular directories: `components/` (UI primitives), `features/onboarding/`, `features/gameplay/`, `features/dashboard/`, `context/` (shared state/theme). ✅ *Verify: folders exist, app still runs.*
- [x] **0.3 — Secure the Supabase keys.** Confirm the Supabase URL + anon key live in a `.env` file, and that `.env` is listed in `.gitignore` so it never gets committed. ✅ *Verify:* `.env` *is git-ignored; no keys hardcoded anywhere.*
- [x] **0.4 — Confirm the Supabase client connects.** Have a minimal client-init file; run a trivial read against Supabase to prove the connection works from the app. ✅ *Verify: a test query returns without auth/connection errors.*
- [x] **0.5 — Commit.** `git commit` the clean foundation.

---

## Phase 0.5 — Data Rails (schema design, no UI)

*Goal: lock the schema that makes the data asset real — event log + provenance + consent. This exists as its own phase so the asset is never an afterthought.*

- [x] **0.5.1 — Design** `profiles`**.** Fields: `id` (FK → auth.users), `age_range`, `region`, `self_rated_fluency`, `tier_status`. Store age **range** and general region only — **never** IP or precise location. ✅ *Verify: schema written, reviewed, no PII beyond what's needed.*
- [x] **0.5.2 — Design** `tasks` **(cards) with provenance.** Fields: `id`, `real_image_url`, `ai_image_url`, `ai_model_engine`, `generation_prompt`, `source_attribution`, `tell_annotations` (jsonb: array of `{x, y, radius, label, description}`), `approval_status` (pending/active/rejected), `seed_real_votes`, `seed_ai_votes`, `difficulty_tier` (nullable, post-MVP), `created_at`. ✅ *Verify: every card can trace its full origin.*
- [x] **0.5.3 — Design** `votes` **(the event log — the asset).** Fields: `id`, `task_id`, `user_id`, `chose_ai` (boolean = did they believe the AI was AI), `was_correct`, `response_time_ms`, `created_at`. **One row per vote.** ✅ *Verify: percentages can always be recomputed from this log; log can never be recovered from percentages.*
- [x] **0.5.4 — Design consent/age scaffolding.** A `consent_version` + `consented_at` field on `profiles`, and a **13+ age floor** (do not knowingly collect from under-13). ✅ *Verify: schema supports honest disclosure + age gate.*
- [x] **0.5.5 — Commit** the schema design (as SQL/migration files, not yet applied if you want a review pass first).

---

## Phase 1 — Backend (create tables + security)

*Goal: the three tables live in Supabase with security locked from day one.*

- [x] **1.1 — Create the tables.** Apply `profiles`, `tasks`, `votes` to Supabase with an `approval_status` enum and the seed-vote integer columns. ✅ *Verify: tables visible in Supabase.*
- [ ] **1.2 — Enable Row-Level Security on every table.** RLS ON before any data goes in. ✅ *Verify: RLS shows enabled on all three.*
- [x] **1.3 — Write RLS policies.**
  - Public read on `tasks` **only** where `approval_status = 'active'`.
  - `votes`: insert allowed only for the user's own session (`auth.uid()`); **no** client update/delete.
  - `profiles`: read/write own row only.
  - ✅ *Verify (do this explicitly): try to read another user's data and confirm you **cannot**. Ask Claude Code to explain how each policy blocks cross-user access.*
- [ ] **1.4 — (Optional but recommended) Vote-recording RPC.** A server-side function that records a vote and returns the aggregate, so the answer key isn't fully exposed client-side. *(If this adds friction now, note it and defer — acceptable for MVP.)*
- [ ] **1.5 — Commit.**

---

## Phase 2 — App Skeleton (first UI — functional, ugly is fine)

*Goal: navigation + screens + anonymous auth, wired to the backend. Plain boxes. No polish.*

- [ ] **2.1 — Navigation shell.** Set up navigation between placeholder screens: Onboarding → Gameplay → Results. ✅ *Verify: you can move between blank screens on your phone.*
- [ ] **2.2 — Theme + haptics context.** Stub the shared `context/` providers (theme, haptics manager) — empty/minimal for now, just wired in. ✅ *Verify: app runs with providers mounted.*
- [ ] **2.3 — Anonymous auth bootstrap.** On app open, start a Supabase **anonymous session** so every user has an `auth.users` id without making an account. ✅ *Verify: opening the app creates/reuses an anonymous session; a* `profiles` *row can attach to it.*
- [ ] **2.4 — Onboarding survey (functional).** A single-step screen capturing `age_range`, `region`, `self_rated_fluency`, plus a plain-language **consent line** ("We collect anonymous gameplay + survey answers to study how people perceive AI images… ") with an "Agree & play" button. Writes to `profiles`. ✅ *Verify: submitting writes a real row; 13+ gate works.*
- [ ] **2.5 — Commit.**

---

## Phase 3 — Seed Content (hand-made, ~15 pairs)

*Goal: real cards in the DB so there's something to play. You'll make these by hand — crude is fine.*

- [ ] **3.1 — Make 15 pairs by hand.** For each: pick an Unsplash photo, generate a similar-scene AI image (same rough aspect ratio), and note 1–3 tells for the AI one. Keep them same-shape so no framing tell. *(No cropping code, no pipeline — just do it manually for these 15.)* ✅ *Verify: 15 real+AI pairs saved somewhere with their tell notes.*
- [ ] **3.2 — Write a one-off seed script.** A small script that inserts those 15 pairs into `tasks` with `approval_status = 'active'`, provenance fields filled, `tell_annotations` as jsonb, and hand-set `seed_real_votes`/`seed_ai_votes` (plausible starting numbers so early percentages aren't 0/0). ✅ *Verify: 15 active tasks appear in Supabase.*
- [ ] **3.3 — Commit.**

---

## Phase 4 — Vertical Slice (the milestone: one card playable end-to-end)

*Goal: the full loop works on your phone. Still functional-not-pretty. When this works, the MVP skeleton is DONE.*

- [ ] **4.1 — Render one card.** Pull an active task, display the real + AI images side by side, **randomize which side is real**, with the "Tap the real image" prompt. ✅ *Verify: a real card renders on your phone with correct prompt.*
- [ ] **4.2 — Capture a vote → write to event log.** On tap, determine correctness, write **one row** to `votes` (task, user, `chose_ai`, `was_correct`, `response_time_ms`). ✅ *Verify: each tap creates exactly one new votes row.*
- [ ] **4.3 — Read aggregate + show percentage meters.** Compute the percentage from seed votes + real votes, reveal the Wishbone-style bars showing what % picked each side, and show the correct/incorrect result. ✅ *Verify: bars display sensible percentages; math matches the log.*
- [ ] **4.4 — Flip card → show tells.** Tapping the info icon flips the card to the AI image with its `tell_annotations` marked. ✅ *Verify: flip works, tells render from the DB.*
- [ ] **4.5 — Advance to next card.** After the result, a way to move to the next task. ✅ *Verify: you can play several cards in a row.*
- [ ] **4.6 — 🎉 MILESTONE COMMIT.** The loop runs on your phone. This is the shippable skeleton.

---

## ✅ Definition of Done (MVP skeleton)

You can, on your iPhone: complete onboarding → see a card → tap the real image → get the right/wrong reveal → see the percentage bars → flip to see the tells → advance to the next card. Every vote lands as its own row in the event log. RLS verified. All committed to git.

---

## 🅿️ Parking Lot (post-skeleton / post-MVP — documented, NOT in the build path)

- UI/UX **polish pass** (design system, animations, custom haptics, Apple/Duolingo feel) — the next phase after 4.6
- **Admin dashboard** (Tinder-swipe approve, drag/resize tell coordinates)
- **Auto-generation pipeline** + smart center-crop + aspect-ratio automation
- **Three-bucket tell system** (model-drafted → you verify; impossible-tier = provenance, not fake tells)
- **ELO / difficulty algorithm** (nightly job stamps `difficulty_tier` from real hit-rates; cold-start seeding)
- Accounts, perception scores, regional/global leaderboards
- Subscription + ads
- **Content engine / marketing** (villain = *deception itself*, "See Through the Lies"; real people & specific companies off-limits)
- Monthly "Deception Report" from the event log
- Data-licensing outreach (detection companies, trust & safety, academia) — treat as upside, not the plan

---

## Guardrails (keep these true the whole way)

- **One task at a time. Verify. Commit.** Never one-shot.
- Keys in `.env` + `.gitignore`. **RLS on from day one** and personally verified.
- Ask Claude Code to *explain* what it built when you want to learn it — you're building the skill, not just the app.
- MVP = **it works**, not **it's beautiful**. Polish later.
- New idea shows up? → Parking lot. Finish this first.

