# OA drills

Mental math, number sequence and probability practice for online assessments. It runs in the browser and installs as an app.

**Open it:** https://albinberg.github.io/Mental-Math-Training-App/

On Android, open the link in Chrome and tap **Install app**. The app then gets a home-screen icon, opens full screen and works offline.

## What is in it

- **Three ladders.** Arithmetic (A1 to A11), sequences (S0 to S8) and probability (P0 to P10). Each level drills one skill and comes with a "How to think" card.
- **Mastery rule.** A run passes with 90% right and a median answer time under the level's limit. Two passes on different days master the level.
- **Speed matrix.** The Progress tab colours every ×, +, − and ÷ fact from 1 to 13 by your speed. You can select cells, rows or squares and drill only those.
- **Re-asked misses.** A wrong answer comes back 2 or 3 questions later and again at the start of the next session.
- **Daily warm-up.** Five minutes of recent misses, your slowest facts and one mastered level.
- **Test formats.** 80 in 8, Sprint, mixed sequences, Beat the odds and the Zap-N games.

Progress is stored in the browser on each phone, so two people using the same link never share progress. Updating the app keeps your progress. Use Progress → Backup to export or import it.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | The whole app |
| `sw.js` | Offline cache. Bump `VERSION` on every release |
| `manifest.webmanifest`, `icons/` | Install as an app |
| `fonts/` | Schibsted Grotesk (SIL Open Font License), bundled so the app works offline |
| `test/check.mjs` | Answer check |

## Answer check

```
node test/check.mjs
```

The check generates thousands of questions per level and recomputes every answer independently, by brute-force counting for probability and exact arithmetic for the rest. It also checks every equation in the info cards and the worked solutions. Run it after any change to the questions.
