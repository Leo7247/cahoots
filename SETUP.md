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

## Part 4 — Supabase + Google sign-in setup

The upgraded `config.js` is prefilled with the public Supabase Project URL, the publishable key you supplied, and your GitHub Pages URL. These values are designed for browser use. Never put a Supabase `service_role`/secret key, database password, or Google OAuth client secret in this repository.

### A. Configure Supabase redirect settings

1. Open your Supabase project: https://supabase.com/dashboard/project/hiumumvqxfvoywvtqvxp
2. Go to **Authentication → URL Configuration**.
3. Set **Site URL** to `https://leo7247.github.io/cahoots/`.
4. Add `https://leo7247.github.io/cahoots/` to **Redirect URLs** and save.
5. Go to **Authentication → Sign In / Providers → Google**. Find and copy the **Callback URL** shown by Supabase. It should look like `https://hiumumvqxfvoywvtqvxp.supabase.co/auth/v1/callback`.

### B. Create Google OAuth credentials

1. Open https://console.cloud.google.com/ and select or create a Google Cloud project.
2. Open **Google Auth Platform** (or **APIs & Services → OAuth consent screen**) and configure the app details and audience. For testing with an External audience, add your own Google account as a test user if Google requests it.
3. Open **Google Auth Platform → Clients** (or **APIs & Services → Credentials**) and create an **OAuth client ID**.
4. Choose **Web application**.
5. Under **Authorized JavaScript origins**, add `https://leo7247.github.io`.
6. Under **Authorized redirect URIs**, paste the exact Supabase Callback URL copied in step A.5.
7. Create the client. Copy its **Client ID** and **Client Secret**.

### C. Enable Google in Supabase

1. Return to **Supabase → Authentication → Sign In / Providers → Google**.
2. Turn Google on.
3. Paste the Google **Client ID** and **Client Secret** into the Supabase provider fields, then save.
4. Keep the Google Client Secret inside Supabase only. Do not put it in `config.js`, `app.js`, GitHub, or this chat.

### D. Publish and test

1. In your GitHub repository, replace the existing `index.html`, `app.js`, `config.js`, `README.md`, and `SETUP.md` with the upgraded versions from this ZIP. Keep `style.css` and `supabase-schema.sql` if they are unchanged.
2. Commit the changes to `main`.
3. Wait for GitHub Pages to redeploy, then open `https://leo7247.github.io/cahoots/`.
4. Tap **Sign in → Continue with Google**. Approve the consent screen. You should return to CaHoOtS signed in; the top bar should show your account and the button should become **Sign out**.

If Google sign-in fails, check that the Supabase Google provider is enabled, the Google Client ID/Secret were saved in Supabase, and the Google Authorized redirect URI exactly matches Supabase's Callback URL. Also check the browser console/network if available.

## Part 5 — Current feature limits

This upgrade implements Supabase client initialization, Google OAuth sign-in, session restoration, and sign-out. It does **not** yet implement cloud-saved quizzes, profile tables, room PIN joining, synchronized multiplayer, host controls, trusted scoring, or online leaderboards. Those require a separate database schema, RLS policies, and server-side game logic. The existing `supabase-schema.sql` is only an outline; do not treat it as production-ready security policy.

## iPad note

No folders, PC, terminal, Node.js, or build process are needed. Upload individual files from the extracted ZIP directly to the repository root.

## Live multiplayer rooms (new)
1. In `config.js`, paste the **publishable key from the `himuumvqxfvoywvtqvxp` project** into `supabaseAnonKey`. The ZIP intentionally leaves a placeholder because the previously supplied key belonged to the other project. Never use a service-role/secret key.
2. In Supabase Dashboard for that SAME project, open SQL Editor → New query.
3. Open `multiplayer.sql` from this ZIP, copy its entire contents, paste into SQL Editor, and Run.
4. Confirm the query succeeds. It creates private question/answer tables, room/player tables, and RPC functions. Do not expose a `service_role` key in the website.
5. Replace the existing root files in GitHub with all files in this ZIP (including the new `multiplayer.js` and `multiplayer.sql`). Keep every file in the repository root.
6. Sign in to CaHoOtS with Google. Create at least one quiz in Quiz Studio, then choose Host a game. Select your quiz and nickname, create the room, and share the six-digit PIN.
7. Players open the same website, enter the PIN and a nickname, then join. The host taps Start game and Next question. Players' answers and scores are validated by Supabase functions.

Notes: This is a first live-room MVP. Hosting requires Google sign-in; joining can be anonymous. The host must use a quiz saved in that browser/device. Rooms are not yet automatically deleted, there is no reconnect/resume UI, and the MVP uses polling (about every 2.2 seconds) rather than Supabase Realtime. Test with a small private group first. Do not run the old `supabase-schema.sql` for multiplayer; run `multiplayer.sql` instead.
