# AI Hunter (Working title)

**An AI-literacy game that teaches people to tell real photographs from AI-generated images — and, more importantly, *how* to tell.**

Built by Carson Lane under Axial Studios.

## Why this exists

Scroll through any comment section and you'll find people calling real footage "AI" and sharing generated images as "real." Government accounts have posted synthetic videos as propaganda to push a narrative. Somewhere down the line, someone will be convicted or exonerated on the strength of a deepfake a jury can't decipher. The gap between how fast these images improve and how fast people learn to spot them is a real civic problem, and it's widening. And honestly, I'm scared of it.

Most "real or AI?" quizzes make it worse. They tell you *whether* you were right and stop there. It's grading a math test without letting anyone show their work. You never learn the tells, so you can't get better.

AI Hunter is built to close that loop.

## How it works

Players see two images — tap the one they believe is real. After they choose, it names which one is fake, and which one was real. It also shows how the wider crowd voted on that card through Wishbone-inspired percentage meters.This turns individual guesses into a shared, evolving picture of what's fooling people right now.

Users can then flip the card around and it displays the AI image while visually highlighting the specific tells. Whether its inconsistent lighting, broken shadows, malformed hands, physically impossible reflections. Over time, players build a real mental checklist instead of a gut feeling.

Additionally players who decide to make an account can track their perception score over time, share it with friends, and see where they stand on regional leaderboards. 

## The data and insights

The ultimate goal is to foresee insights in how regular people are interacting with AI generated image content. Whether or not they're being fooled by it, and who is fooling them. What regions are more AI fluent than others? Having sights on which image generation tools fool people the most, and which do the least, as well as the specific tells that we struggle to see is interesting data in the war of literacy.  

## What I paid attention to

This is an early build, but the parts that are hard to add later were designed in from day one:

- **Provenance on every card.** Each image carries its full origin — generating model, prompt, source, version, timestamp — so the dataset stays trustworthy and auditable rather than a bag of anonymous files.
- **Vote integrity by design.** Individual vote events are stored separately from the aggregated percentages shown to users, so the crowd signal is built on real, verifiable data rather than a display counter.
- **Consent and age scaffolding** built into the schema from the start, not bolted on.
- **Row-level security on from day one**, so data access rules are enforced at the database, not left to app-side trust.

## Stack

- **Frontend:** Expo (React Native), tested on-device via Expo Go
- **Backend / data:** Supabase (Postgres, row-level security)
- **Image generation:** multiple models across cards, tracked per-image for provenance

## Status

In active development. Core architecture, data model, and seed content pipeline are built; the game loop runs on-device. UI and visual design are in progress, App name is a working title— this repo is about the thinking and the foundation, not final polish. 

---

*Built by a human, with AI as a collaborator throughout.*