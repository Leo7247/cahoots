# CaHoOtS? — iPad-only setup (no folders)

You do **not** need a PC, terminal, Node.js, or a build process for this starter.

## Part 1 — Put the website on GitHub

1. On your iPad, open Safari and sign in at https://github.com.
2. Tap **+** → **New repository**.
3. Repository name: `CaHoOtS`. Choose **Public**, then create it.
4. In the new repository, choose **Add file** → **Upload files**.
5. Upload these files from the ZIP, selecting the files themselves rather than the containing folder:
   - `index.html`
   - `style.css`
   - `app.js`
   - `config.js`
   - `README.md`
   - `SETUP.md`
   - `supabase-schema.sql`
6. Tap **Commit changes**.

If iPad Safari does not let you select multiple files at once, upload them in small batches. You can also open the ZIP in the Files app to extract it first; the extracted files are together in one folder. Open that folder and select the individual files. No nested folders are required.

## Part 2 — Turn on GitHub Pages

1. In your repository, open **Settings**.
2. Find **Pages** in the sidebar (on mobile, use the repository settings menu and scroll).
3. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
4. Select branch `main` and folder `/(root)`, then tap **Save**.
5. Wait for the page to publish. The URL usually looks like `https://YOUR-USERNAME.github.io/CaHoOtS/`.
6. Open the URL. If you see a 404, check that `index.html` is in the repository root and give Pages a little more time.

## Part 3 — What works now

- Home / Discover / Create navigation
- Create a basic one-question multiple-choice quiz
- Save quizzes in the same browser on this device
- Practice a saved quiz
- pArKoUr? local battery and jumping prototype
- BLITZ! speed quiz
- Last Brain Standing survival quiz (3 lives)
- Quiz Raid boss fight
- Streak Machine combo scoring
- Memory Flip practice challenge

## Part 4 — What is not connected yet

This starter does **not** yet have functional Google sign-in, cloud-saved quizzes, real room PIN joining, synchronized multiplayer for these modes, a live host screen, or online leaderboards. Those require connecting a backend and testing it. Do not paste secret keys into GitHub.

## Optional Part 5 — Supabase later

You can skip this entirely for the first launch. When you want accounts and online multiplayer:

1. Create a project at https://supabase.com.
2. Open **Project Settings → API** and copy the Project URL and the **publishable/anon key** only.
3. Keep private keys (including `service_role` / secret keys) out of this repository and out of `config.js`.
4. The included `supabase-schema.sql` is a starting database outline, not a finished production security policy. Do not run it on a public production project without reviewing and hardening its access policies.
5. Google OAuth also requires setup in Google Cloud and Supabase Auth, plus the correct redirect URLs. This flat demo does not yet wire the complete sign-in flow, so adding credentials alone will not enable sign-in.

## Troubleshooting on iPad

- **Can't upload a folder:** Upload individual files from inside the extracted folder.
- **No Upload files option:** Open the repository itself, not Settings. Look for **Add file**.
- **Site is 404:** Ensure `index.html` is at the repository root and Pages is enabled on `main` / `/(root)`.
- **CSS looks missing:** Make sure `style.css` and `app.js` were uploaded next to `index.html`.
- **Quizzes disappeared:** They are stored locally in that browser. Clearing site data or changing devices may remove or hide them.
