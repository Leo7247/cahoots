# CaHoOtS — all modes + real-time pArKoUr?

This build integrates a 2D multiplayer platformer into the existing CaHoOtS quiz arcade. It preserves Google sign-in, local quiz creation/practice, per-question points, the host-selected quiz modes, and the room PIN flow.

## pArKoUr? gameplay
Players can move left and right, jump and double-jump, land on raised platforms, avoid spike hazards, see other runners in the room, and race to a finish marker. Touch controls are included for iPad; keyboard controls are included for desktop.

## Files
- `index.html`, `style.css`, `app.js`, `multiplayer.js`: integrated CaHoOtS website
- `parkour.js`: real-time platformer client
- `config.js`: public Supabase browser configuration for the existing project
- `multiplayer.sql`: upgrade migration for an existing CaHoOtS multiplayer database
- `supabase-schema.sql`: complete schema for reference / fresh setup

See `SETUP.md` for the safe upgrade order.
