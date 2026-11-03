# CaHoOtS?

A colorful, mobile-friendly quiz playground designed to be edited and uploaded from an iPad.

## Upload on iPad (no computer)

1. Create a GitHub repository named `CaHoOtS`.
2. In the repository, tap **Add file → Upload files**.
3. Upload these files from this ZIP: `index.html`, `style.css`, `app.js`, `config.js`, `README.md`, `SETUP.md`, and `supabase-schema.sql`.
4. Commit the files to the `main` branch.
5. Open **Settings → Pages** and select **Deploy from a branch**, branch `main`, folder `/ (root)**, then Save.
6. Wait a minute or two, then open the Pages URL shown in Settings → Pages.

This is a flat static site: no folders, Node.js, terminal, build step, or computer required.

## What's included

- Responsive dark neon design
- Home, Discover, Create, and pArKoUr? pages
- Create and save a one-question multiple-choice quiz in this browser
- Local practice and battery-based parkour prototype
- Optional Supabase database schema for a future backend

## Important limits

This version is a front-end starter. Room PIN entry is not yet connected to real rooms; Google sign-in, cloud-saved quizzes, synchronized multiplayer, live host controls, secure scoring, and real online leaderboards are not implemented yet. All arcade modes, including parkour, are local practice prototypes only; they are not synchronized multiplayer. Do not advertise it as a complete multiplayer service until a backend is connected and tested.

## Security

Only public browser credentials may be placed in `config.js`. Never put passwords, Google OAuth client secrets, Supabase service-role keys, or other private secrets into files uploaded to GitHub.
