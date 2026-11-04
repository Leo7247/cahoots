# CaHoOtS real-time multiplayer parkour upgrade

This upgrade is built on the retrieved CaHoOtS `index(2).html` + `app.js` + `multiplayer.js` source. It adds a selectable Parkour room mode, a canvas platformer, touch + keyboard controls, gravity/jumping, platforms, spikes, checkpoints, respawns, finish detection, a local opponent leaderboard, and Supabase Realtime Broadcast player position updates. The host is inserted as a normal room player and can play.

## Upload to GitHub root
Replace `index.html` and `multiplayer.js`; add `parkour.js` and `parkour.css`. Keep your existing `app.js`, `style.css`, and `config.js`. Do not replace `config.js` or put a service-role key in it.

## Database
This frontend expects the `supabase-schema-FULL-PARKOUR.sql` version with the 4-argument `cahoots_create_room`, `player_token` returned by create/join, and 4-argument `cahoots_submit_answer`. The current multiplayer code now sends the token. The parkour movement itself is ephemeral Supabase Realtime Broadcast; it does not add movement rows to SQL.

## How to play
1. Sign in, open Host a game, choose a quiz, choose `pArKoUr? Multiplayer Race`, and create the room.
2. Friends enter the PIN and nicknames.
3. Host presses Start game. Host and all joined players are taken into the same race.
4. Use the on-screen ◀ ▶ and JUMP controls on iPad/phone, or A/D / arrow keys + Space on a keyboard.

## Important limitations
- Broadcast positions are real-time visual updates, not server-authoritative physics. A modified client can spoof its displayed position or finish message. Do not use this for prizes or trusted competitive rankings without server-side movement validation.
- Broadcast messages are ephemeral; late join/reconnect does not restore a player's exact position.
- Supabase Realtime must be available for the project. Test with two separate browsers/devices.
- The room's host and joined players can all control their own characters. Host still controls when the race begins.
