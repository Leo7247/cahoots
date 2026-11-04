# CaHoOtS deployment instructions

## 1. Back up first
Download a copy of your current GitHub repository before replacing files.

## 2. Update the website
1. Extract this ZIP and open `cahoots_release`.
2. Upload the files from that folder into the GitHub repository root (the same folder as `index.html`).
3. Replace `index.html`, `style.css`, `app.js`, `multiplayer.js`, `parkour.js`, and `config.js` with the supplied versions. Keep the supplied `config.js` values together; never paste a Supabase service-role key or Google client secret into browser code.
4. Commit to `main` and wait for GitHub Pages to deploy.

## 3. Update Supabase safely
Because your existing CaHoOtS database already has the original room tables and previous game-mode upgrade, run **only the included `multiplayer.sql`** as an upgrade. Do not run the full `supabase-schema.sql` as well. The migration adds parkour/timer columns, adds private per-player answer tokens, and replaces the older answer RPC. It does not delete room or quiz data. Existing active rooms should be finished before applying the migration; players should rejoin after the update.

`supabase-schema.sql` is included for reference / a fresh complete setup. Do not run it on top of the migration as a second step.

## 4. Test pArKoUr?
1. Open the site on the host device and sign in with Google.
2. Create or select a saved quiz.
3. Open pArKoUr? from the home arcade or choose it in the host game-mode selector.
4. Create the room and share the PIN.
5. Join from a second device, then press Start game on the host.

## Controls
- iPad / touch: hold ◀ / ▶ to move; tap JUMP for a normal jump or a second mid-air jump.
- Keyboard: A/D or Left/Right arrows to move; Space, W, or Up arrow to jump (double-jump supported).
- Avoid red spikes, land on raised platforms, and reach the yellow finish marker. Other players' runners are shown through Supabase Realtime Broadcast.

## Safety and testing notes
- The migration gives each player a private random token. Answer submissions must include that token; the token is not included in the public room snapshot and direct player-table access is revoked.
- The platformer positions are client-simulated and broadcast for display. They are not server-authoritative, so this is suitable for a casual friend race, not competitive anti-cheat play.
- JavaScript syntax checks are included in the build process, but the site has not been exercised against your live Supabase project from here. Test with two devices before inviting a large group.
- Rejoining or refreshing resets a runner's position.
