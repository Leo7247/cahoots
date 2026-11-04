# CaHoOtS — Quiz Arcade + Live Rooms

Mobile-first quiz maker and game platform for GitHub Pages, designed to be maintained from an iPad.

## Included
- Google sign-in through Supabase (existing project config preserved)
- Multi-question Quiz Studio (up to 40 questions)
- Per-question point values: 100–2,000
- Local practice across every question
- Arcade modes: BLITZ!, Last Brain Standing, Quiz Raid, Streak Machine, Memory Flip, and pArKoUr?
- Live multiplayer rooms with host-selected mode, six-digit PIN, player list, and server-side scoring
- Mobile-responsive interface

## Files
Upload every file in this ZIP to the repository root. Keep `config.js` as supplied; its public publishable key is configured for the existing Supabase project.

## Important
This is an upgraded beta, not a commercial-grade service. Memory Flip and pArKoUr? are themed quiz rulesets in live rooms; their richer standalone arcade versions remain local practice experiences. Test with a small group first. Never expose Supabase secret/service-role keys or Google OAuth client secrets.
