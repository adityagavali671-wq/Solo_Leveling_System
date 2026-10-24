# THE SYSTEM — Real-Life Leveling

A free, local-first Solo Leveling-inspired habit/quest dashboard. It uses HTML, CSS, JavaScript and browser `localStorage`; it does not require a server account, database, subscription, API key or paid hosting.

## Included files

- `index.html` — app structure and dialogs
- `style.css` — dark blue sci-fi interface, responsive layout and animations
- `app.js` — quests, XP, levels, ranks, attributes, streaks, achievements, backup import/export
- `README.md` — these instructions

## Run it on Windows

### Option A (recommended): Python's built-in local web server

1. Extract `real_life_system.zip` into a folder, for example `Desktop\real_life_system`.
2. Open that folder in File Explorer.
3. Click the address bar, type `cmd`, and press Enter. A Command Prompt opens in that folder.
4. Run:

   ```bat
   py -m http.server 8000
   ```

   If `py` is not recognized, try:

   ```bat
   python -m http.server 8000
   ```

5. Keep that black Command Prompt window open while using the app.
6. Open Chrome and visit `http://localhost:8000`.
7. To stop the local server, go back to the Command Prompt and press `Ctrl+C`.

No Python package installation is required. The app itself runs in the browser.

### Option B: open the file directly

Double-click `index.html`. This may work in many browsers, but Option A is more reliable for browser storage and local file behavior.

## Data and backups

- Progress is saved automatically in this browser's local storage on this device.
- Use the down-arrow button in the top-right corner to export a JSON backup regularly.
- Use the up-arrow button to import a backup. Importing replaces the currently saved state, so export first if you want to preserve it.
- Browser data can be lost if you clear site data, use a different browser/profile, or reset the app. Keep a backup outside the app.
- This version does not sync between devices and does not send your progress to a server.
- If you use private/incognito browsing, the browser may clear the saved data when that session ends.

## How XP and levels work

- Each quest awards its listed XP when first completed on that date.
- Level 1 needs 100 XP to reach level 2; the XP needed rises by 50 per level.
- Ranks are based on level: E (1–4), D (5–8), C (9–13), B (14–19), A (20–29), S (30+).
- Attribute XP goes to the attribute selected by the quest.
- Completing at least one quest on a new day builds the streak. Rest days are allowed; missed days do not remove total XP or completed history.
- Unchecking a completed quest only changes today's checklist. It does not reverse XP already earned. This prevents accidental taps from silently deleting progress.

## Troubleshooting

- If the page says it cannot be reached, make sure the Command Prompt server is still running and use exactly `http://localhost:8000`.
- If the page has no styling, confirm `style.css` is in the same folder as `index.html`.
- If buttons do nothing, confirm `app.js` is in the same folder as `index.html`, then refresh with `Ctrl+F5`.
- If port 8000 is busy, run `py -m http.server 8001` and open `http://localhost:8001`.
- If progress is important, export a backup before clearing browser data or moving the app to another folder/browser.
