# SQL Run

SQL Run is a classroom elimination game about building SQL queries one token at a time. Players run upward across a moving track made from SQL plates. Every section presents two to five choices; only one continues the mission query. Wrong plates collapse and their runners fall. A sole survivor continues playing until the complete SQL query is finished.

## Windows LAN classroom version

Run the portable `SQL-Run-1.0.1-firewall-fix-x64.exe` on the teacher computer. The app starts its own local server, opens the host dashboard through `127.0.0.1`, and shows a QR code plus LAN join address for phones on the same Wi-Fi or Ethernet network. The single-file launcher extracts to a stable `%LOCALAPPDATA%\SQL Run\1.0.1` path so the Windows Firewall authorization remains valid across launches.

Allow SQL Run through Windows Firewall on **Private networks**. Students do not install an app: they scan the QR code, enter a name, and ready up in their browser. The teacher chooses plate difficulty, answer time, and optional question level before starting.

## Gameplay prototype

Double-click `OPEN_GAMEPLAY_PROTOTYPE.cmd`, or open `prototype/index.html` directly in a browser.

The prototype is a direct-open HTML/CSS/JavaScript folder. It does not use localhost, a web server, Node.js, a LAN connection, or the packaged app. It includes:

- Four independent difficulty levels: Easy (2 plates), Normal (2–3), Hard (3–4), and Nightmare (4–5).
- A separately selectable 2–10 second answer timer, with road speed recalculated so the current row reaches the bottom as time expires.
- A local player plus 4–16 simulated runners.
- The complete prepare, choose, lock, reveal, break, eliminate, advance, and results loop.
- A continuously scrolling road made from physical ground plates.
- Longer plate sections and a slower conveyor speed for clearer movement decisions.
- Smooth free movement across and between plates—there is no lane jumping or click-to-teleport movement.
- Immediate death when the runner's feet leave every solid plate boundary.
- Animated running, collapsing wrong plates, real holes in the road, and live fall-order ranking.
- Continuous road movement through lock, reveal, and collapse; it stops only when the current plate row touches the bottom of the arena.
- A final ordered results board showing the complete correct SQL for every runner, with each wrong choice stacked above its correct token.
- Traditional Chinese gameplay instructions and interface labels; SQL keywords, table names, and executable field identifiers remain in English, with Chinese field meanings shown alongside them.
- Mixed-category distractors drawn from keywords, fields, tables, operators, and values.
- A pre-race ready screen with a large mission question and available table/field reference.
- A random 40-question bank based on ELE, STD, and ENROLL, with green, yellow, and red pre-race refresh buttons for drawing another Basic, Medium, or Hard question.
- Basic, Medium, and Hard question ratings shown in green, yellow, and red on the ready screen.
- Advanced missions covering DISTINCT, aggregates, ORDER BY, GROUP BY, HAVING, and two- or three-table INNER JOIN queries.
- English SQL field identifiers paired with their Traditional Chinese meanings in schema references and on field plates.
- Hidden labels on future plate rows; only the current and completed rows reveal their SQL tokens.
- Mission prompts, table schemas, and the accumulated SQL query.
- WASD, arrow-key, and touch direction-pad controls.
- Gameplay test controls for speed, pause, answer reveal, collision outlines, and phase skipping.

The prototype remains available for isolated gameplay testing and is also included inside the packaged host dashboard.

## Current SQL scope

The 40-question bank covers SELECT/FROM/WHERE, DISTINCT, aggregates, ORDER BY, GROUP BY, HAVING, and two- or three-table INNER JOIN queries using the ELE, STD, and ENROLL schema. Each mission has one hidden target query, so every section has exactly one correct plate.

## Source checks

Node.js 22 or newer is required only when working on the TypeScript LAN implementation:

```powershell
npm install
npm run typecheck
npm test
npm run build
```

Build the portable classroom host with `npm run package:portable`.

## LAN classroom workflow

After gameplay is approved, the intended classroom workflow is:

1. The teacher computer runs one authoritative local server.
2. The host screen displays a room code and QR join URL using its physical LAN address.
3. Phones on the same Wi-Fi open the player controller in their browser.
4. The server owns timers, correct plates, elimination, ranking, and reset.
5. The finished and verified web/server build is packaged as the final portable Windows app.

## Architecture

- `prototype/index.html`: current offline gameplay sandbox; no networking or build step.
- `src/protocol.ts`: presentation-independent network messages and public state.
- `server/game`: pure SQL grammar, missions, plate generation, elimination, and ranking.
- `server/SqlRunRoom.ts`: Colyseus room, host authorization, validation, phase timers, snapshots, and reconnect grace period.
- `server/index.ts`: Express static serving, `/api/health`, LAN discovery, and WebSocket transport.
- `src/main.ts`: separate projector and phone presentations for the LAN game.
- `electron/main.cjs`: Windows host shell that starts the local server and opens the teacher dashboard.

The networked game accepts player intentions—not score, correctness, survival, or ranking claims. The authoritative server omits the correct plate from player snapshots until the reveal phase.
