# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Status

App is in active development. Stack: **Expo / React Native** (frontend) + **Supabase** (backend/auth/db). All app code lives in `aihunter-app/`.

## Debugging UI Behavior

Before changing logic to fix a behavior, **verify the code you are editing actually runs.**

- Confirm the file is reachable from `App.js`. All gameplay *and* results/tells UI is in
  `features/gameplay/GameplayScreen.js` — there is no separate results screen.
- Confirm the handler is firing at all (a temporary log at the top is enough) before
  tuning what it does.

If two attempts fail without producing new information, stop fixing and verify assumptions
instead — repeated identical failures mean the real problem is outside the code being edited.
An unrouted file, a missing provider, or a library that silently no-ops all look exactly like
bad logic, and no amount of iterating on the logic will fix them.

## Repository Notes

- Remote: `https://github.com/AxialStudios/AI-Hunter.git`
- Default branch: `main`

