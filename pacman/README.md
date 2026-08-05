# Maze Chase Host

Maze Chase Host is a local-network multiplayer Pac-Man-style game for one teacher host and up to 30 student devices. Each phone owns its responsive movement while the teacher computer validates positions and remains authoritative for every game rule. Firebase is no longer used.

No `.env` values or Firebase repository variables are needed. An old local `.env` file can be deleted; it is ignored and is never included in the Windows application.

## Architecture

- **Host application:** Electron starts the game server and opens the projector dashboard.
- **Realtime server:** Colyseus validates client movement and evaluates authoritative game rules at 60 Hz on the teacher computer.
- **Network updates:** the server broadcasts compact game snapshots 20 times per second.
- **Player view:** each phone simulates its own movement immediately, submits position updates 30 times per second, and interpolates other actors.
- **Validation:** the server rejects positions that cross walls or exceed plausible movement speed and sends an explicit correction only when needed.
- **Rules:** the server alone decides pellets, power pellets, collisions, respawns, scores, lives, the timer, and the winner.
- **Transport:** ordinary HTTP serves the game; WebSockets carry room events and controls. No cloud service or internet connection is needed after installation.

## Development setup

Install the current Node.js LTS release on the development computer, then run:

```powershell
npm install
npm run dev
```

The two development services are:

- web interface: `http://localhost:5173`
- game server: `http://localhost:2567`

For several-window testing, open `http://localhost:5173` as the host and use its join link in private/incognito windows.

For phone testing, use the **Network** address printed by Vite, such as `http://192.168.1.25:5173`, for the host page. Do not use `localhost`, because a QR code containing `localhost` refers to each phone itself. The computer and phones must be on the same Wi-Fi.

## Automated verification

```powershell
npm run typecheck
npm test
npm run build
```

`npm test` checks movement and turning, wall recovery, client-owned prediction, position acceptance, teleport rejection, two-player room creation, joining, role assignment, round start, snapshots, and input acknowledgement.

## Production build without Electron

```powershell
npm run build
npm start
```

Then open `http://localhost:2567`. Other devices can use `http://<teacher-computer-ip>:2567`.

## Build the Windows application

Create a standalone portable executable:

```powershell
npm run package:portable
```

Create a normal Windows installer:

```powershell
npm run package:installer
```

Artifacts are written to `release/`. Electron includes its own runtime, so the teacher computer does **not** need Node.js. Use the installer for normal deployment; keep the portable build for quick tests or a USB drive.

### Build it through GitHub

After pushing the files, open the repository's **Actions** tab, select **Build Maze Chase Windows host**, choose **Run workflow**, and wait for the green check. Open that run and download the **MazeChaseHost-Windows** artifact. It contains both the installer and portable EXE. This manual workflow is separate from the existing GitHub Pages deployment, so it does not replace or remove the root page or other project folders.

## Teacher-computer test

1. Copy the installer from `release/` to the teacher computer and install it.
2. Start **Maze Chase Host**. It automatically starts the local server, creates a room, and displays its QR code.
3. When Windows Firewall asks, allow access on **Private networks**. Public-network access is unnecessary for a normal school Wi-Fi test.
4. Check that the URL printed below the QR code contains the teacher computer's Wi-Fi address, usually `192.168.x.x`, `10.x.x.x`, or `172.16-31.x.x`.
5. Scan the QR code with two phones. Confirm that both can join, choose different colors, ready up, and move.
6. If phones cannot connect, confirm they are on the same Wi-Fi and that the access point does not use client/AP isolation. Temporarily disable VPN software, which can cause the QR code to choose the wrong network adapter.

## Increasing-player test plan

Run complete three-minute rounds at each level before proceeding:

| Stage | Players | What to watch |
|---|---:|---|
| Smoke | 2 | Joining, role assignment, turns, pellets, captures, rematch |
| Small | 5 | Odd team sizes, unique colors, phone controls |
| Classroom | 10 | Smooth player cameras and stable Wi-Fi |
| Heavy | 20 | Snapshot delay, reconnects, host CPU usage |
| Maximum | 30 | Join capacity, crowded collisions, full scoreboard |

At each stage, test Pac-Man eating a power pellet and a Ghost, a Ghost catching Pac-Man, round completion, **Play again**, and **Randomize & play again**. Add players gradually; if performance changes, record the player count, device model, Wi-Fi access point, and whether the lag affected only one phone or every device.

## Implemented game rules

- One shared maze for all players; Ghost spawn slots are four tiles above Pac-Man slots.
- The host chooses the Pac-Man count, lives per Pac-Man, and round time limit; all remaining players become Ghosts. Odd totals are supported.
- Every player claims a unique color from 64 varied choices, including bright hues, whites, greys, and dark tones.
- After joining, each player chooses one of ten synchronized cosmetics and can return to reselect an available color.
- The host lobby shows every player's complete appearance and assigned Pac-Man or Ghost form.
- Small pellet: 10 Pac-Man points.
- Power pellet: 50 Pac-Man points and six seconds of frightened Ghosts.
- Frightened Ghost chain: 200, 400, 800, then 1,600 points.
- Ghost capture: 500 Ghost points.
- Pac-Man team lives are configurable from one to nine per Pac-Man player (default: three).
- Round time is configurable from one to fifteen minutes (default: five).
- The live dashboard shows dots remaining and total Pac-Man team lives.
- Pac-Man wins by clearing the maze; Ghosts win by exhausting lives or the timer.
- The result screen names the winning team and its highest-scoring MVP, with role-specific tie-breakers.
- The MVP card displays the winning player's color, role, and cosmetic appearance.
- On the host screen, results appear beside the frozen final maze so the ending positions and remaining dots stay visible.

## Important limits

- The host app must remain open for the room to exist.
- This is a local-LAN design; GitHub Pages can still hold the source/build artifacts, but it cannot run the authoritative Colyseus process.
- School guest Wi-Fi often blocks device-to-device traffic. Use a normal private LAN or a dedicated classroom router if that policy is enabled.
