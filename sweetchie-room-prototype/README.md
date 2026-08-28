# Sweetchie's ICT Quiz Room — Stage 1

The build produces two self-contained offline files:

- `sweetchie-room.html` — the real learner-facing room, with no animation-test buttons.
- `sweetchie-room-test.html` — the testing room, with all 27 movement and animation buttons expanded.

Open either file directly in Safari, Chrome, Edge, or Firefox. Each contains the room engine, all character artwork, 1,000 Topic E questions, answer history and actions.

## What the prototype includes

- Pokémon-like top-down/three-quarter ICT quiz-lab perspective
- responsive learner UI for mobile portrait, mobile landscape, iPad/tablet and desktop
- touch-sized mobile controls, safe-area support and scrollable quiz/dashboard bottom sheets
- autonomous roaming and weighted activity choices
- collision-aware A* pathfinding around furniture
- front-facing left/right walking for southward travel
- rear-facing left/right walking for northward travel
- quiz console, live progress dashboard and mistake-review shelf interactions
- random questions drawn from the supplied 1,000-question Topic E bank
- local answer history, accuracy, topic breakdown and unresolved-mistake review
- progress saved in the current browser with `localStorage`
- larger Sweetchie presentation while a question is open
- correct-answer reactions: clap, cheer, dance, heart hands and streak twirls
- wrong-answer reactions: oops, read, write and review
- idle-question reactions: think, wait, yawn and stretch with gentle prompts
- all 16 extra Sweetchie actions plus her original action atlas
- click-to-walk and object buttons
- a separate testing HTML with 27 buttons for four walk directions, seven original actions, and all 16 extra actions
- pause/resume and speed control
- exportable progress JSON
- no network requests, libraries, server, account or installation

The saved record belongs to the browser and local file origin. Clearing browser storage clears it; use **Export progress** first if a backup is needed.

## Responsive layouts

- **Desktop:** full-width room with a single compact command bar.
- **iPad/tablet:** wrapped two-row command bar and a wider in-room question panel.
- **Mobile portrait:** compact touch dock; questions and progress appear in a scrollable bottom sheet.
- **Mobile landscape:** the room and controls use a side-by-side layout to preserve game space.

The canvas keeps a fixed 1152×832 logical coordinate system, so character movement and object hit areas remain consistent while the browser scales the presentation.

## Put it on another website

Upload `sweetchie-room.html`, then embed it with an iframe:

```html
<iframe
  src="/pets/sweetchie-room.html?embed=1&speed=1"
  title="Sweetchie's Room"
  style="width:min(100%,1152px);aspect-ratio:1152/832;border:0;border-radius:18px;overflow:hidden"
></iframe>
```

The query parameters are optional:

- `embed=1` hides the demo title and controls.
- `speed=0.65` to `1.7` changes movement and animation speed.
- `paused=1` starts paused.
- `debug=1` shows the current path for testing.

The parent page can control an embedded room:

```js
const room = document.querySelector("iframe");

room.contentWindow.postMessage({ type: "sweetchie-room", action: "pause" }, "*");
room.contentWindow.postMessage({ type: "sweetchie-room", action: "resume" }, "*");
room.contentWindow.postMessage({ type: "sweetchie-room", action: "quizDesk" }, "*");
room.contentWindow.postMessage({ type: "sweetchie-room", action: "dashboard", speed: 1.35 }, "*");
```

Available room actions are `pause`, `resume`, `roam`, `quizDesk`, `dashboard`, and `reviewShelf`.

## Rebuild after changing artwork or code

Both HTML files are generated from `src/sweetchie-room.template.html`. Run `scripts/build-prototype.py` with the bundled Codex Python runtime after changing the template or embedded assets. Keeping one template ensures animation and quiz behavior cannot drift between the real and testing versions.
