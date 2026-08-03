import QRCode from "qrcode";
import "./styles.css";
import { createInitialGame, stepGame, type EngineState } from "./engine.ts";
import {
  beginRound,
  closeRoom,
  connectBackend,
  createRoom,
  firebaseConfigured,
  processJoinRequests,
  publishSnapshot,
  randomizeRoles,
  registerPresence,
  resetToLobby,
  sendDirection,
  setReady,
  submitJoinRequest,
  updatePacmanCount,
  watchAdmission,
  watchInputs,
  watchRoom,
  type Backend,
} from "./firebase.ts";
import { createMaze } from "./maze.ts";
import { PALETTE, colorValue } from "./palette.ts";
import { renderGame, scoreboardRows } from "./render.ts";
import type { Direction, GameSnapshot, InputState, PlayerRecord, RoomData } from "./types.ts";

const app = document.querySelector<HTMLDivElement>("#app")!;
if (!app) throw new Error("App root not found.");

let cleanup: Array<() => void> = [];
const clearSubscriptions = () => {
  cleanup.forEach((unsubscribe) => unsubscribe());
  cleanup = [];
};

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]!);
}

function header(connection = "Firebase connected") {
  return `
    <header class="topbar">
      <div class="brand"><span class="brand-mark" aria-hidden="true"></span><div><div class="eyebrow">Shared arena</div><h1>Maze Chase Party</h1></div></div>
      <span class="status-pill online">${escapeHtml(connection)}</span>
    </header>`;
}

function formatTime(milliseconds: number) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function joinUrl(code: string) {
  const url = new URL(window.location.href);
  url.search = "";
  url.searchParams.set("room", code);
  url.searchParams.set("join", "1");
  return url.toString();
}

function playerCards(players: Record<string, PlayerRecord>) {
  const entries = Object.entries(players).sort(([, a], [, b]) => a.seatId.localeCompare(b.seatId));
  if (!entries.length) return `<p class="muted">Waiting for players to scan the QR code.</p>`;
  return `<div class="player-grid">${entries
    .map(([, player]) => {
      const assignment = player.assignment?.role;
      return `<article class="player-card">
        <span class="swatch" style="background:${colorValue(player.profile.colorId)}"></span>
        <div><div class="player-name">${escapeHtml(player.profile.name)}</div><div class="player-meta">${player.presence.online ? "Online" : "Reconnecting"} · ${player.lobby.ready ? "Ready" : "Not ready"}</div></div>
        <span class="role ${assignment ?? ""}">${assignment ?? "—"}</span>
      </article>`;
    })
    .join("")}</div>`;
}

function setupScreen(message?: string) {
  app.innerHTML = `<main class="shell">${header("Setup required")}
    <section class="hero"><div class="hero-card">
      <div class="eyebrow">One-time setup</div><h2>Connect Firebase</h2>
      <p>Add the Firebase Web app values to <strong>.env</strong>, enable anonymous sign-in, and publish the included database rules. Then reload this page.</p>
      ${message ? `<p class="error">${escapeHtml(message)}</p>` : ""}
    </div></section></main>`;
}

async function landing(backend: Backend) {
  clearSubscriptions();
  app.innerHTML = `<main class="shell">${header()}
    <section class="hero"><div class="hero-card">
      <div class="eyebrow">Up to 30 players</div>
      <h2>One maze.<br>Two teams.</h2>
      <p>Put this screen on a projector. Players scan, choose a unique color, and enter the same shared arena. You decide how many become Pac-Man; everyone else becomes a Ghost.</p>
      <button class="button yellow" id="create-room">Create game room</button>
      <p class="error" id="landing-error" role="alert"></p>
    </div></section></main>`;
  document.querySelector<HTMLButtonElement>("#create-room")?.addEventListener("click", async (event) => {
    const button = event.currentTarget as HTMLButtonElement;
    const error = document.querySelector<HTMLParagraphElement>("#landing-error");
    button.disabled = true;
    button.textContent = "Creating room…";
    try {
      const code = await createRoom(backend);
      const url = new URL(window.location.href);
      url.search = "";
      url.searchParams.set("host", code);
      history.replaceState(null, "", url);
      await hostApp(backend, code);
    } catch (reason) {
      if (error) error.textContent = reason instanceof Error ? reason.message : String(reason);
      button.disabled = false;
      button.textContent = "Create game room";
    }
  });
}

async function hostApp(backend: Backend, code: string) {
  clearSubscriptions();
  let roomState: RoomData | null = null;
  let screen: "none" | "lobby" | "game" = "none";
  let engine: EngineState | null = null;
  let inputs: Record<string, InputState> = {};
  let frameId = 0;
  let loopStarted = false;
  let lastFrame = performance.now();
  let accumulator = 0;
  let lastPublish = 0;
  let publishing = false;
  let resultPublished = false;
  const qrData = await QRCode.toDataURL(joinUrl(code), { width: 420, margin: 1, errorCorrectionLevel: "M" });

  const stopRequests = processJoinRequests(backend, code, (error) => console.error(error));
  const stopInputs = watchInputs(backend, code, (nextInputs) => {
    inputs = nextInputs;
  });
  cleanup.push(stopRequests, stopInputs, () => cancelAnimationFrame(frameId));

  function renderLobby(room: RoomData) {
    screen = "lobby";
    const players = room.players ?? {};
    const count = Object.keys(players).length;
    const maxPacmen = Math.max(1, count - 1);
    const pacmanCount = Math.max(1, Math.min(maxPacmen, room.config.pacmanCount));
    const allReady = count >= 2 && Object.values(players).every((player) => player.presence.online && player.lobby.ready);
    const assigned = count >= 2 && Object.values(players).every((player) => player.assignment);
    const assignedPacmen = Object.values(players).filter((player) => player.assignment?.role === "pacman").length;
    const canStart = allReady && assigned && assignedPacmen === pacmanCount;
    app.innerHTML = `<main class="shell">${header()}
      <section class="lobby-grid">
        <aside class="panel">
          <div class="eyebrow">Room code</div><div class="room-code">${code}</div>
          <img class="qr" src="${qrData}" alt="QR code to join room ${code}">
          <div class="actions">
            <button class="button secondary" id="copy-link">Copy join link</button>
            <button class="button danger" id="close-room">Close room</button>
          </div>
          <hr style="border:0;border-top:1px solid var(--line);margin:20px 0">
          <div class="field">
            <label>Number of Pac-Man players</label>
            <div class="counter">
              <span class="muted">${count ? `${count - pacmanCount} Ghost${count - pacmanCount === 1 ? "" : "s"}` : "Waiting for players"}</span>
              <button id="pac-minus" aria-label="Fewer Pac-Man">−</button>
              <input id="pac-count" type="number" min="1" max="${maxPacmen}" value="${pacmanCount}" ${count < 2 ? "disabled" : ""}>
              <button id="pac-plus" aria-label="More Pac-Man">+</button>
            </div>
          </div>
          <p class="muted">Odd totals are supported. The chosen number becomes Pac-Man; every remaining player becomes a Ghost. All players enter this one shared maze.</p>
          <div class="actions">
            <button class="button secondary" id="randomize" ${count < 2 ? "disabled" : ""}>Randomize roles</button>
            <button class="button yellow" id="start" ${canStart ? "" : "disabled"}>Start game</button>
          </div>
          <p class="muted">${count < 2 ? "At least two players are required." : !allReady ? "Waiting for every player to be ready." : !assigned || assignedPacmen !== pacmanCount ? "Randomize roles after choosing the Pac-Man count." : "Ready to start."}</p>
        </aside>
        <section class="panel"><div class="topbar" style="margin-bottom:14px"><div><div class="eyebrow">Players</div><h2>${count} / ${room.config.maxPlayers}</h2></div><span class="status-pill">Pac-Man ${assignedPacmen} · Ghost ${count - assignedPacmen}</span></div>${playerCards(players)}</section>
      </section></main>`;

    document.querySelector<HTMLButtonElement>("#copy-link")?.addEventListener("click", async (event) => {
      await navigator.clipboard.writeText(joinUrl(code));
      (event.currentTarget as HTMLButtonElement).textContent = "Copied";
    });
    document.querySelector<HTMLButtonElement>("#close-room")?.addEventListener("click", async () => {
      await closeRoom(backend, code);
      history.replaceState(null, "", window.location.pathname);
      await landing(backend);
    });
    const setPacCount = async (next: number) => updatePacmanCount(backend, code, Math.max(1, Math.min(maxPacmen, next)));
    document.querySelector<HTMLButtonElement>("#pac-minus")?.addEventListener("click", () => void setPacCount(pacmanCount - 1));
    document.querySelector<HTMLButtonElement>("#pac-plus")?.addEventListener("click", () => void setPacCount(pacmanCount + 1));
    document.querySelector<HTMLInputElement>("#pac-count")?.addEventListener("change", (event) =>
      void setPacCount(Number((event.currentTarget as HTMLInputElement).value)),
    );
    document.querySelector<HTMLButtonElement>("#randomize")?.addEventListener("click", () => void randomizeRoles(backend, code));
    document.querySelector<HTMLButtonElement>("#start")?.addEventListener("click", async () => {
      if (!roomState?.players) return;
      engine = createInitialGame(roomState.players, Date.now(), roomState.config.roundDurationMs);
      resultPublished = false;
      await beginRound(backend, code, engine.snapshot);
      if (screen !== "game") renderHostGame(engine.snapshot);
      startLoop();
    });
  }

  function scoreList(snapshot: GameSnapshot, role: "pacman" | "ghost") {
    return scoreboardRows(snapshot, role)
      .slice(0, 15)
      .map((actor) => `<div class="score-row"><span class="swatch" style="height:10px;background:${colorValue(actor.colorId)}"></span><span>${escapeHtml(actor.name)}</span><strong>${actor.score.toLocaleString()}</strong></div>`)
      .join("");
  }

  function updateHostHud(snapshot: GameSnapshot) {
    const pac = document.querySelector<HTMLElement>("#pac-score");
    const ghost = document.querySelector<HTMLElement>("#ghost-score");
    const timer = document.querySelector<HTMLElement>("#game-time");
    const lives = document.querySelector<HTMLElement>("#game-lives");
    const pacList = document.querySelector<HTMLElement>("#pac-list");
    const ghostList = document.querySelector<HTMLElement>("#ghost-list");
    if (pac) pac.textContent = snapshot.pacmanScore.toLocaleString();
    if (ghost) ghost.textContent = snapshot.ghostScore.toLocaleString();
    if (timer) timer.textContent = formatTime(snapshot.roundEndsAt - snapshot.hostTime);
    if (lives) lives.textContent = String(snapshot.pacmanLives);
    if (pacList) pacList.innerHTML = scoreList(snapshot, "pacman");
    if (ghostList) ghostList.innerHTML = scoreList(snapshot, "ghost");
    const overlay = document.querySelector<HTMLElement>("#result-overlay");
    if (overlay) {
      overlay.hidden = snapshot.status !== "results";
      const title = overlay.querySelector<HTMLElement>("h2");
      const reason = overlay.querySelector<HTMLElement>("p");
      if (title) title.textContent = snapshot.winner === "pacman" ? "Pac-Man team wins" : "Ghost team wins";
      if (reason) reason.textContent = snapshot.resultReason ?? "Round complete";
    }
  }

  function renderHostGame(snapshot: GameSnapshot) {
    screen = "game";
    app.innerHTML = `<main class="shell">${header()}
      <section class="game-layout">
        <div class="panel game-stage"><canvas class="game-canvas" id="game-canvas" aria-label="Shared maze arena"></canvas>
          <div class="overlay" id="result-overlay" ${snapshot.status === "results" ? "" : "hidden"}><div><div class="eyebrow">Round complete</div><h2></h2><p class="muted"></p><div class="actions" style="justify-content:center"><button class="button yellow" id="replay">Play again</button><button class="button secondary" id="reroll">Randomize & play again</button></div></div></div>
        </div>
        <aside class="game-hud">
          <div class="panel score-pair"><div class="score"><span>Pac-Man</span><strong id="pac-score">0</strong></div><div class="score"><span>Ghosts</span><strong id="ghost-score">0</strong></div></div>
          <div class="panel score-pair"><div class="score"><span>Time</span><strong id="game-time">5:00</strong></div><div class="score"><span>Lives</span><strong id="game-lives">0</strong></div></div>
          <div class="panel"><h3>Pac-Man team</h3><div class="score-list" id="pac-list"></div></div>
          <div class="panel"><h3>Ghost team</h3><div class="score-list" id="ghost-list"></div></div>
        </aside>
      </section></main>`;
    document.querySelector<HTMLButtonElement>("#replay")?.addEventListener("click", () => void resetToLobby(backend, code, true));
    document.querySelector<HTMLButtonElement>("#reroll")?.addEventListener("click", () => void resetToLobby(backend, code, false));
    updateHostHud(snapshot);
  }

  function startLoop() {
    if (loopStarted) return;
    loopStarted = true;
    lastFrame = performance.now();
    const frame = (time: number) => {
      frameId = requestAnimationFrame(frame);
      if (!engine) return;
      const elapsed = Math.min(0.1, (time - lastFrame) / 1000);
      lastFrame = time;
      accumulator += elapsed;
      while (accumulator >= 1 / 60 && engine.snapshot.status === "playing") {
        stepGame(engine, inputs, 1 / 60, Date.now());
        accumulator -= 1 / 60;
      }
      const canvas = document.querySelector<HTMLCanvasElement>("#game-canvas");
      if (canvas) renderGame(canvas, engine.snapshot, engine.maze);
      updateHostHud(engine.snapshot);
      if (engine.snapshot.status === "playing" && time - lastPublish >= 100 && !publishing) {
        lastPublish = time;
        publishing = true;
        void publishSnapshot(backend, code, engine.snapshot).finally(() => {
          publishing = false;
        });
      }
      if (engine.snapshot.status === "results" && !resultPublished) {
        resultPublished = true;
        void publishSnapshot(backend, code, engine.snapshot);
      }
    };
    frameId = requestAnimationFrame(frame);
  }

  const stopRoom = watchRoom(backend, code, (room) => {
    roomState = room;
    if (!room) {
      setupScreen("Room not found.");
      return;
    }
    if (room.meta.hostUid !== backend.uid) {
      setupScreen("This browser is not the host for this room.");
      return;
    }
    if (room.meta.status === "lobby") {
      if (screen === "game") {
        engine = null;
        loopStarted = false;
        cancelAnimationFrame(frameId);
      }
      renderLobby(room);
    } else if (room.authoritative) {
      if (screen !== "game") renderHostGame(engine?.snapshot ?? room.authoritative);
      if (!engine) updateHostHud(room.authoritative);
    }
  });
  cleanup.push(stopRoom);
}

async function playerApp(backend: Backend, code: string) {
  clearSubscriptions();
  let roomState: RoomData | null = null;
  let screen = "none";
  let selectedColor = "c08";
  let registered = false;
  let latestSnapshot: GameSnapshot | null = null;
  let playerFrame = 0;
  let inputSeq = 0;
  let lastDirection: Direction = "none";

  const send = (direction: Direction) => {
    if (direction === lastDirection) return;
    lastDirection = direction;
    inputSeq += 1;
    void sendDirection(backend, code, direction, inputSeq);
  };

  function renderJoin(room: RoomData, admissionMessage?: string) {
    screen = "join";
    const claims = room.colorClaims ?? {};
    const count = Object.keys(room.players ?? {}).length;
    app.innerHTML = `<main class="shell">${header()}
      <section class="join-layout"><form class="panel join-card" id="join-form">
        <div class="eyebrow">Room ${code} · ${count}/${room.config.maxPlayers}</div><h2>Choose your player</h2>
        <div class="field"><label for="player-name">Display name</label><input id="player-name" maxlength="16" required autocomplete="nickname" placeholder="Your name"></div>
        <div class="field"><label>Unique player color</label><div class="palette">${PALETTE.map((color) => `<button type="button" class="color-button ${selectedColor === color.id ? "selected" : ""}" data-color="${color.id}" style="background:${color.hex}" aria-label="${color.label}" ${claims[color.id] ? "disabled" : ""}></button>`).join("")}</div></div>
        ${admissionMessage ? `<p class="error" role="alert">${escapeHtml(admissionMessage)}</p>` : ""}
        <button class="button yellow" type="submit" ${room.meta.joinLocked || count >= room.config.maxPlayers ? "disabled" : ""}>${count >= room.config.maxPlayers ? "Room full" : room.meta.joinLocked ? "Game in progress" : "Join room"}</button>
      </form></section></main>`;
    document.querySelectorAll<HTMLButtonElement>("[data-color]").forEach((button) =>
      button.addEventListener("click", () => {
        selectedColor = button.dataset.color ?? selectedColor;
        document.querySelectorAll(".color-button").forEach((item) => item.classList.remove("selected"));
        button.classList.add("selected");
      }),
    );
    document.querySelector<HTMLFormElement>("#join-form")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const name = document.querySelector<HTMLInputElement>("#player-name")?.value.trim() ?? "";
      const submit = (event.currentTarget as HTMLFormElement).querySelector<HTMLButtonElement>("button[type=submit]");
      if (submit) {
        submit.disabled = true;
        submit.textContent = "Requesting seat…";
      }
      try {
        await submitJoinRequest(backend, code, { name, colorId: selectedColor });
      } catch (reason) {
        renderJoin(room, reason instanceof Error ? reason.message : String(reason));
      }
    });
  }

  function renderPlayerLobby(room: RoomData, player: PlayerRecord) {
    screen = "lobby";
    const count = Object.keys(room.players ?? {}).length;
    app.innerHTML = `<main class="shell">${header()}
      <section class="join-layout"><div class="panel join-card">
        <div class="eyebrow">Room ${code} · ${count} players</div><h2>${player.assignment ? `You are ${player.assignment.role === "pacman" ? "Pac-Man" : "a Ghost"}` : "Waiting for roles"}</h2>
        <div class="player-card" style="margin:18px 0"><span class="swatch" style="background:${colorValue(player.profile.colorId)}"></span><div><div class="player-name">${escapeHtml(player.profile.name)}</div><div class="player-meta">All players will spawn in the same maze</div></div><span class="role ${player.assignment?.role ?? ""}">${player.assignment?.role ?? "—"}</span></div>
        <button class="button ${player.lobby.ready ? "secondary" : "yellow"}" id="ready">${player.lobby.ready ? "Not ready" : "Ready"}</button>
        <p class="muted">The host chooses how many players are Pac-Man. Everyone else becomes a Ghost.</p>
      </div></section></main>`;
    document.querySelector<HTMLButtonElement>("#ready")?.addEventListener("click", () => void setReady(backend, code, !player.lobby.ready));
  }

  function updateMobileHud(snapshot: GameSnapshot) {
    const actor = snapshot.actors[backend.uid];
    if (!actor) return;
    const score = document.querySelector<HTMLElement>("#my-score");
    const team = document.querySelector<HTMLElement>("#team-score");
    const time = document.querySelector<HTMLElement>("#mobile-time");
    const lives = document.querySelector<HTMLElement>("#mobile-lives");
    if (score) score.textContent = actor.score.toLocaleString();
    if (team) team.textContent = (actor.role === "pacman" ? snapshot.pacmanScore : snapshot.ghostScore).toLocaleString();
    if (time) time.textContent = formatTime(snapshot.roundEndsAt - snapshot.hostTime);
    if (lives) lives.textContent = actor.role === "pacman" ? String(snapshot.pacmanLives) : String(actor.kills);
    const overlay = document.querySelector<HTMLElement>("#mobile-result");
    if (overlay) {
      overlay.hidden = snapshot.status !== "results";
      const heading = overlay.querySelector("h2");
      if (heading) heading.textContent = snapshot.winner === actor.role ? "Your team wins" : "Your team was caught";
    }
  }

  function renderPlayerGame(snapshot: GameSnapshot) {
    screen = "game";
    const actor = snapshot.actors[backend.uid];
    if (!actor) return;
    app.innerHTML = `<main class="player-game">
      <div class="mobile-hud"><div class="mobile-stat">You<strong id="my-score">0</strong></div><div class="mobile-stat">Team<strong id="team-score">0</strong></div><div class="mobile-stat">Time<strong id="mobile-time">5:00</strong></div><div class="mobile-stat">${actor.role === "pacman" ? "Lives" : "Kills"}<strong id="mobile-lives">0</strong></div></div>
      <div class="game-stage"><canvas class="game-canvas" id="player-canvas" aria-label="Your centered maze view"></canvas><div class="overlay" id="mobile-result" hidden><div><div class="eyebrow">Round complete</div><h2></h2><p class="muted">Look at the host screen for the full scoreboard.</p></div></div></div>
      <div class="dpad" aria-label="Movement controls"><button data-direction="up" aria-label="Move up">▲</button><button data-direction="left" aria-label="Move left">◀</button><button data-direction="down" aria-label="Move down">▼</button><button data-direction="right" aria-label="Move right">▶</button></div>
    </main>`;
    document.querySelectorAll<HTMLButtonElement>("[data-direction]").forEach((button) =>
      button.addEventListener("pointerdown", () => send(button.dataset.direction as Direction)),
    );
    const canvas = document.querySelector<HTMLCanvasElement>("#player-canvas");
    let startX = 0;
    let startY = 0;
    canvas?.addEventListener("pointerdown", (event) => {
      startX = event.clientX;
      startY = event.clientY;
    });
    canvas?.addEventListener("pointerup", (event) => {
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
      send(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
    });
    updateMobileHud(snapshot);
    cancelAnimationFrame(playerFrame);
    const maze = createMaze();
    const frame = () => {
      playerFrame = requestAnimationFrame(frame);
      if (!latestSnapshot) return;
      const playerCanvas = document.querySelector<HTMLCanvasElement>("#player-canvas");
      if (playerCanvas) renderGame(playerCanvas, latestSnapshot, maze, backend.uid);
      updateMobileHud(latestSnapshot);
    };
    playerFrame = requestAnimationFrame(frame);
  }

  const keyDirections: Record<string, Direction> = {
    ArrowUp: "up", w: "up", W: "up", ArrowDown: "down", s: "down", S: "down",
    ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right",
  };
  const onKeyDown = (event: KeyboardEvent) => {
    const direction = keyDirections[event.key];
    if (direction && screen === "game") {
      event.preventDefault();
      send(direction);
    }
  };
  window.addEventListener("keydown", onKeyDown);
  cleanup.push(() => window.removeEventListener("keydown", onKeyDown), () => cancelAnimationFrame(playerFrame));

  const stopAdmission = watchAdmission(backend, code, (admission) => {
    if (admission?.status === "rejected" && roomState) renderJoin(roomState, admission.reason ?? "Could not join.");
  });
  const stopRoom = watchRoom(backend, code, (room) => {
    roomState = room;
    if (!room) {
      setupScreen("Room not found. Check the code or scan the QR again.");
      return;
    }
    const player = room.players?.[backend.uid];
    if (!player) {
      if (screen !== "join") renderJoin(room);
      else {
        const claims = room.colorClaims ?? {};
        document.querySelectorAll<HTMLButtonElement>("[data-color]").forEach((button) => {
          button.disabled = Boolean(button.dataset.color && claims[button.dataset.color]);
        });
      }
      return;
    }
    if (!registered) {
      registered = true;
      void registerPresence(backend, code);
    }
    if (room.authoritative && (room.meta.status === "playing" || room.meta.status === "results")) {
      latestSnapshot = room.authoritative;
      if (screen !== "game") renderPlayerGame(room.authoritative);
      else updateMobileHud(room.authoritative);
    } else if (room.meta.status === "lobby") {
      renderPlayerLobby(room, player);
    }
  });
  cleanup.push(stopAdmission, stopRoom);
}

async function boot() {
  if (!firebaseConfigured()) {
    setupScreen();
    return;
  }
  try {
    const backend = await connectBackend();
    const params = new URLSearchParams(window.location.search);
    const room = params.get("room")?.toUpperCase();
    const host = params.get("host")?.toUpperCase();
    if (room && params.get("join") === "1") await playerApp(backend, room);
    else if (host) await hostApp(backend, host);
    else await landing(backend);
  } catch (reason) {
    setupScreen(reason instanceof Error ? reason.message : String(reason));
  }
}

void boot();
