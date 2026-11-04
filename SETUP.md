# CaHoOtS — iPad setup

## 1. Upload to GitHub
1. Open your repository: https://github.com/leo7247/cahoots
2. Open the repository root and choose **Add file → Upload files**.
3. Extract this ZIP in the iPad Files app. Upload all files inside it to the root (same level as `index.html`).
4. Commit the changes to `main`. Do not upload the ZIP itself as a single file.
5. Wait for GitHub Pages to finish deploying.

## 2. Update Supabase database
1. Open https://supabase.com/dashboard/project/himuumvqxfvoywvtqvxp/sql/new
2. Open `multiplayer.sql` from the extracted ZIP in Files.
3. Copy its entire contents and paste into Supabase SQL Editor.
4. Tap **Run**. This is an upgrade migration: it adds per-question points, game-mode metadata, survival lives, streak tracking, and raid boss health to the existing live-room schema.
5. Confirm the SQL Editor reports success.

## 3. Test
1. Open https://leo7247.github.io/cahoots/ in Safari. If an older copy appears, open a new tab or refresh after deployment.
2. Sign in with Google.
3. Open **Create**. Add multiple questions, select the correct answer and point value for each, then save.
4. Open **Host a game**. Choose a quiz, choose a game mode, enter your nickname, and create a room.
5. Share the six-digit PIN. Players join from the same site with a nickname.
6. Host taps **Start game**, then **Next question** after the group has answered.

## Modes
- **Classic:** each correct answer earns that question's point value.
- **BLITZ!:** 1.5× question points.
- **Last Brain Standing:** three lives; a wrong answer costs one life and the third wrong answer eliminates the player.
- **Quiz Raid:** correct answers damage the shared boss while earning question points.
- **Streak Machine:** each consecutive correct answer increases the award, up to a 2× multiplier.
- **Memory Flip:** focus-themed live quiz ruleset.
- **pArKoUr?:** energy-run themed live quiz ruleset; standalone parkour arcade remains local.

## Security and notes
- Keep the existing `config.js` publishable key unchanged unless you intentionally rotate it. It must match the Supabase URL.
- Never put a Supabase service-role/secret key, database password, or Google OAuth client secret in GitHub.
- Hosting requires Google sign-in; joining can be guest nickname-based.
- Rooms use polling, not Supabase Realtime. The host advances questions manually.
