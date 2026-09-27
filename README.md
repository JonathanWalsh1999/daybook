# Daybook

A personal tracker for tasks, habits, freelance hours, gym and money, built as a phone-installable web app. The code is plain HTML, CSS and JavaScript with no build step. Data is stored in Supabase and locked to your login.

## What's in it
- **Today:** freelance, gym and money at a glance, what's due, routine reminders, the freelance session prompt, and this week's commitments
- **Tasks & plans:** tasks by area and date, "move to tomorrow" (anything moved twice gets flagged), and goals with milestones
- **Work (freelance):** session timer, the next-step sticky note, a bad-day 15-minute button, the never-miss-twice tracker, days away, and your roadmap
- **Account:** export all your data as a backup file, and sign out
- **Gym:** start a workout, log sets as you go (it pre-fills your last weight and reps and shows what you did last time), personal bests, and sessions per week
- **Money:** monthly budget and what's left per day, spending by category with overspend warnings, quick add expense, and one tap to re-add last month's recurring bills
- **Weekly review:** an automatic scorecard, what slipped, last week's commitments, and three commitments for next week

## Setup (one-off)

### 1. Database
Supabase → **SQL Editor** → paste `supabase/setup.sql` → **Run**. You only need to do this once; running it again is safe.

### 2. Create your login
1. Supabase → **Authentication → Users → Add user → Create new user**
2. Enter your email and a strong password, and tick **Auto Confirm User**
3. **Authentication → Sign In / Providers**: turn **off** "Allow new users to sign up". Now nobody else can create an account.

### 3. Put the code on GitHub
1. On github.com, open your repository (for example `daybook`). It must be **public** to use free GitHub Pages.
2. Click **Add file → Upload files** (or the "uploading an existing file" link on an empty repository).
3. Drag in **everything inside this folder**: `index.html`, `app.js`, `styles.css`, `config.js`, `sw.js`, `manifest.webmanifest`, the `icons` folder and the `supabase` folder.
4. Click **Commit changes**.

### 4. Turn on the website
Repository → **Settings → Pages** → Source: **Deploy from a branch** → Branch: **main**, folder **/ (root)** → **Save**.
After a minute or two your site is live at `https://YOUR-GITHUB-USERNAME.github.io/daybook/`.

### 5. Install it on your phone
- **iPhone:** open the address in **Safari** → Share → **Add to Home Screen**
- **Android:** open it in **Chrome** → ⋮ → **Install app**

Then open it from the home screen and sign in. You only need to sign in once per device.

## Updating
When there's a new version, upload the changed files the same way (**Add file → Upload files**). The files will replace the old ones, and the site updates in about a minute.

## Settings
`config.js` holds your weekly freelance target (3 hours), your planned session days (Monday and Saturday), the bad-day minimum (15 minutes) and your gym target (3 a week).
