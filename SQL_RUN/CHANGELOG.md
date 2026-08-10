# Changelog

All notable changes to SQL Run are documented here.

## [1.0.1] - 2026-08-09

### Fixed

- Changed the single-file launcher to extract Electron to a stable LocalAppData path so Windows Firewall authorization remains valid across launches.
- Excluded Proton/TUN/TAP and `/32` virtual adapters from student QR address selection.

## [1.0.0] - 2026-08-09

### Added

- Added the complete 40-question ELE, STD, and ENROLL bank to the authoritative LAN server.
- Added host-controlled 2–5 plate difficulty, 2–10 second timers, and optional Basic/Medium/Hard question filtering.
- Included the direct-open gameplay prototype inside the production web bundle and Windows app.
- Added production localhost hosting, LAN IPv4 discovery, room-code joining, QR joining, and same-network browser controllers.

### Changed

- Upgraded the LAN protocol and projector/player layouts from two fixed plates to dynamic 2–5 plate sections.
- A sole surviving LAN player now continues until the SQL query is complete.
- Prepared the project as the first portable Windows classroom release.

## [0.10.0] - 2026-08-09

### Changed

- Replaced the single ready-screen refresh control with three compact refresh buttons.
- Green, yellow, and red refresh buttons now draw a different Basic, Medium, or Hard question respectively.

## [0.9.0] - 2026-08-09

### Added

- Expanded the prototype bank from 20 to 40 questions with DISTINCT, aggregate functions, ORDER BY, GROUP BY, HAVING, two-table JOIN, and three-table JOIN missions.
- Added Basic, Medium, and Hard question classifications to every mission.
- Added a colour-coded question badge to the ready screen: green for Basic, yellow for Medium, and red for Hard.
- Added multi-table bilingual schema references for JOIN missions.

### Changed

- Expanded distractors with qualified fields, aggregate expressions, JOIN keywords, and sort directions.

## [0.8.0] - 2026-08-09

### Added

- Added a 20-question SQL mission bank based on the ELE, STD, and ENROLL database dictionary.
- Added a pre-race refresh button that always replaces the current mission with another random question.
- Added Traditional Chinese descriptions alongside English field identifiers in the ready screen, mission panel, and field plates.

### Changed

- Rebuilt field, table, and value distractor pools from the classroom database schema.

## [0.7.0] - 2026-08-09

### Added

- Split difficulty and answer-time settings so each can be selected independently before the ready screen.
- Added Easy (2 plates), Normal (2–3), Hard (3–4), and Nightmare (4–5) difficulty levels, plus answer times from 2 to 10 seconds.

### Changed

- Recalculate road speed at the start of every SQL section so the current plate reaches the bottom at approximately the end of the selected timer.

## [0.6.0] - 2026-08-09

### Added

- Added a dedicated ready screen before each race with a large mission question and the available English table and field names.

### Changed

- A sole surviving player now continues through every remaining section until the complete SQL query is finished.
- Hid SQL labels on future plate rows; labels appear when a row becomes current and remain visible on completed rows.

## [0.5.1] - 2026-08-09

### Fixed

- Continued road movement through lock, reveal, collapse, and advance phases.
- Stopped the conveyor only when the current plate row's bottom edge reaches the arena's bottom edge.
- Held the advance phase until that contact occurs so a new current row never starts prematurely.

## [0.5.0] - 2026-08-09

### Changed

- Lengthened ground plates and reduced the road conveyor speed, with longer decision windows to preserve fair traversal time.
- Translated all prototype instructions, controls, phase labels, feedback, and result UI into Traditional Chinese while keeping SQL tokens and schema names in English.
- Expanded distractor generation across SQL keywords, fields, tables, operators, and values, guaranteeing at least one cross-type wrong plate per section.

## [0.4.0] - 2026-08-09

### Changed

- Kept the complete active plate row inside the arena and paused road motion during lock, reveal, and collapse when necessary.
- Increased SQL token size, weight, contrast, and backing panels for clearer plate reading.
- Reduced runner body size so the ground and plate boundaries remain visible around each character.
- Rebuilt the results view as a complete ranked field with the full correct SQL shown for every player.
- Recorded each player's selected token; a wrong token is displayed directly above its correct replacement at the same SQL position.

## [0.3.0] - 2026-08-09

### Changed

- Rebuilt the offline prototype around continuous top-down movement instead of clicking or jumping between lanes.
- Made every SQL plate part of the physical ground while the complete road scrolls continuously from top to bottom.
- Added immediate foot-position collision checks: leaving all solid plate boundaries now causes a fall.
- Added smooth WASD, arrow-key, and touch-pad movement with a fixed-step simulation loop.
- Wrong plates now become true holes in the road after the lock and reveal phases.
- Added optional collision outlines for gameplay debugging.

## [0.2.0] - 2026-08-09

### Added

- Self-contained `prototype/index.html` gameplay lab that opens directly without localhost, Node.js, networking, or installation.
- Simulated opponents, 2–3 lane modes, mission schemas, animated choice/reveal/break/eliminate phases, fall-order ranking, and restart flow.
- Prototype controls for speed, pause, answer reveal, and phase skipping.
- `OPEN_GAMEPLAY_PROTOTYPE.cmd` for one-click local testing.

### Changed

- Made gameplay prototyping the documented first development stage; LAN integration and Electron packaging are explicitly deferred.
- Removed the localhost-based local launchers to avoid conflicts with other mapped projects.

## [0.1.1] - 2026-08-09

### Added

- One-click Windows launchers for local development, production-mode testing, and automated checks.

### Fixed

- Development QR codes now point phones to the Vite web port while retaining the authoritative game server connection.

## [0.1.0] - 2026-08-09

### Added

- LAN host with automatic physical IPv4 discovery, health endpoint, room code, join URL, and QR code.
- Authoritative Colyseus lobby, readiness, SQL race phases, plate selection, elimination, ranking, reset, and reconnect window.
- Separate projector/teacher and phone/player experiences.
- Beginner SQL missions covering `SELECT`, fields, `FROM`, tables, `WHERE`, operators, and values.
- Portable Windows Electron packaging and automated rule/integration checks.
