# Maze Chase Party

A browser-based realtime maze chase game for one shared host screen and up to 30 phone players.

## Current vertical slice

- The host creates a room and displays a QR code.
- Up to 30 players join anonymously, choose a name, and claim one of 64 unique colors.
- Odd player totals are allowed.
- Before each round, the host chooses how many players become Pac-Man. Every remaining player becomes a Ghost.
- Roles are randomized, and all Pac-Man and Ghost players spawn in the same large maze arena.
- The host browser runs movement, pellets, power pellets, collisions, lives, scoring, and the round timer.
- The host sees the whole maze and team dashboard. Each phone keeps its own character centered and moves the maze background.
- Keyboard, swipe, and on-screen direction controls are included.
- GitHub Pages deployment is included.

This is the first playable implementation. Host recovery, compact 30-player snapshots, audio, pausing, player removal, and full browser load testing remain follow-up work.

## Firebase setup

1. Create a Firebase project and Web app.
2. Enable **Authentication → Sign-in method → Anonymous**.
3. Create a Realtime Database, preferably in a region close to the players.
4. Copy `.env.example` to `.env` and add the Web app configuration values.
5. Publish `database.rules.json` with the Firebase CLI or Firebase console.

The Firebase Web configuration is not an authorization secret. `database.rules.json` is what prevents players from writing positions, scores, roles, seats, or other players' data.

## Local development

```powershell
npm install
npm run dev
```

Open the printed local address as the host. Phone joining requires the page to be reachable from the phone; for reliable cross-device testing, use the deployed GitHub Pages URL.

## Test and build

```powershell
npm test
npm run test:unit
npm run build
```

## GitHub Pages

In the repository settings:

1. Select **Pages → Source → GitHub Actions**.
2. Add these repository variables:
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_DATABASE_URL`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_APP_ID`
3. Add `VITE_FIREBASE_API_KEY` as a repository secret.
4. Add the final `*.github.io` hostname to Firebase Authentication's authorized domains.

A push to `main` runs tests and builds Pac-Man through the repository-level `.github/workflows/deploy-pages.yml`. The workflow preserves the root front page and every existing project folder, replaces only the published `pacman/` folder with the compiled game, and deploys the combined site.

## Party rules implemented

- Small pellet: 10 Pac-Man points.
- Power pellet: 50 Pac-Man points and six seconds of frightened Ghosts.
- Frightened Ghost chain: 200, 400, 800, then 1,600 points.
- Ghost capture: 500 Ghost points.
- Pac-Man team lives: three per Pac-Man player.
- Pac-Man wins by clearing the maze; Ghosts win by exhausting lives or running out the five-minute timer.
