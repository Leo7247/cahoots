# CaHoOtS? — setup guide

CaHoOtS? is a Next.js + Supabase starter for a multiplayer quiz platform. It includes a custom responsive interface, Google OAuth wiring, quiz creation, room creation/joining, a pArKoUr? practice prototype, and a database schema designed for live multiplayer expansion.

## 1. Install the tools

Install:
- Node.js 20.9 or newer: https://nodejs.org/
- VS Code: https://code.visualstudio.com/
- A Supabase account: https://supabase.com/

Unzip this project, open the `cahoots` folder in VS Code, then open Terminal → New Terminal.

Run:

```bash
npm install
```

## 2. Create the Supabase project

1. Create a new project at https://supabase.com/dashboard.
2. Open **Project Settings → API**.
3. Copy the Project URL and the `anon` / publishable key.
4. In the project folder, make a copy of `.env.example` named `.env.local`.
5. Paste the values:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

Never put a Supabase `service_role` key in browser code or in a `NEXT_PUBLIC_` variable.

## 3. Create the database

1. In Supabase, open **SQL Editor**.
2. Choose **New query**.
3. Open `supabase/schema.sql` in VS Code.
4. Copy all of it into the Supabase SQL Editor.
5. Click **Run**.

This creates profiles, quizzes, rooms, players, answers, indexes, row-level security policies, and a profile-creation trigger.

## 4. Enable Google sign-in

1. Open Google Cloud Console: https://console.cloud.google.com/
2. Create/select a Google Cloud project.
3. Configure the OAuth consent screen.
4. Create an OAuth Client ID with application type **Web application**.
5. In Supabase, open **Authentication → Providers → Google** and enable it.
6. Copy the Google Client ID and Client Secret from Google Cloud into Supabase.
7. In Supabase **Authentication → URL Configuration**, set:
   - Site URL: `http://localhost:3000`
   - Redirect URL: `http://localhost:3000/auth/callback`
8. Add your production domain and its `/auth/callback` URL later when deployed.

Google OAuth setup changes occasionally; follow the current prompts in Google Cloud and Supabase if their labels differ.

## 5. Run CaHoOtS?

```bash
npm run dev
```

Open http://localhost:3000.

To create and save quizzes or host rooms, sign in with Google. Guests can try the join flow, but persistent progress requires an account.

## What works in this starter

- Responsive CaHoOtS? dashboard and custom visual identity
- Google sign-in integration through Supabase Auth
- Profile creation on first sign-in
- Create and save a multiple-choice quiz
- Create a room with a six-character game PIN
- Join a room by PIN (prototype flow)
- pArKoUr? practice arena with battery, movement costs, recharge question, and finish progression
- Supabase tables for rooms, players, answers, quizzes, profiles, and realtime publication

## Important: prototype vs production

This is a runnable foundation, not yet a finished Kahoot-scale service. The current room creation and join screens write to the database, but the full host/player game loop is not implemented yet: live question broadcasting, answer timers, scoring validation, room moderation, reconnect handling, and synchronized parkour movement still need to be built. The pArKoUr? screen is currently a local practice prototype, not yet a synchronized multiplayer platformer. The leaderboard currently shows sample entries; global ranking queries are a next milestone.

Before public launch, tighten the room/player row-level security policies and move sensitive game actions into trusted server-side functions. Add rate limits, nickname moderation, quiz input validation, abuse reporting, and privacy/age-appropriate safeguards. Do not expose service-role credentials to the browser.

## Suggested build roadmap

1. **Live game engine:** host starts/advances questions; players submit answers; timer, scoring, results, reconnect.
2. **True multiplayer pArKoUr?:** shared positions, authoritative movement validation, obstacle maps, checkpoints, finish detection.
3. **Quiz Studio 2.0:** true/false, type answer, puzzle, slider, pin answer, poll, word cloud, open response, scale, media slides.
4. **Homework and study:** assignments, flashcards, learn mode, independent sessions.
5. **Progression:** real XP, streaks, badges, avatars, friends, global and classroom leaderboards.
6. **Special experiences:** Marble Race, Color Kingdoms, Treasure Trove, Submarine Squad, Unplugged mode.

The schema and component structure are intentionally small enough to extend without starting over.
