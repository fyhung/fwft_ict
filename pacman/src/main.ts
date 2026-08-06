import { Client as ColyseusClient, type Room as ColyseusRoom } from "@colyseus/sdk";
import QRCode from "qrcode";
import packageInfo from "../package.json";
import "./styles.css";
import { gameSounds } from "./audio.ts";
import { COSMETICS, cosmeticLabel } from "./cosmetics.ts";
import { sampleSnapshot, updateInterpolation, type SnapshotInterpolation } from "./interpolation.ts";
import { createMaze } from "./maze.ts";
import { mergeNetworkSnapshot } from "./network.ts";
import { PALETTE, colorValue } from "./palette.ts";
import {
  advanceLocalPrediction,
  applyLocalPrediction,
  reconcileClientOwnedPrediction,
  type LocalPrediction,
} from "./prediction.ts";
import { ROOM_TYPE, SERVER_PORT, type LobbySnapshot, type ServerMessages } from "./protocol.ts";
import { renderCharacterPreview, renderGame, scoreboardRows } from "./render.ts";
import { mvpDetail, winningMvp } from "./stats.ts";
import type { Direction, GameSnapshot, PlayerRecord, Role } from "./types.ts";

const appElement = document.querySelector<HTMLDivElement>("#app");
if (!appElement) throw new Error("App root not found.");
const app = appElement;

type GameRoom = ColyseusRoom<any>;

let cleanup: Array<() => void> = [];
function clearSubscriptions() {
  cleanup.forEach((unsubscribe) => unsubscribe());
  cleanup = [];
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character]!);
}

function header(connection = "Local server connected") {
  return `<header class="topbar">
    <div class="brand"><span class="brand-mark" aria-hidden="true"></span><div class="brand-copy"><div class="eyebrow">TWGHs Mrs. Fung Wong Fung Ting College</div><h1>ICT Maze Chase Party <span class="version">v${escapeHtml(packageInfo.version)}</span></h1><div class="brand-credit">Information and Communication Technology · 2026 Summer · Created by fyhung with help from ChatGPT 5.6 sol</div></div></div>
    <span class="status-pill online">${escapeHtml(connection)}</span>
  </header>`;
}

function formatTime(milliseconds: number) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1_000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function serverEndpoint() {
  const explicit = new URLSearchParams(window.location.search).get("server");
  if (explicit) return explicit;
  const port = import.meta.env.DEV ? String(SERVER_PORT) : window.location.port || String(SERVER_PORT);
  return `${window.location.protocol}//${window.location.hostname}:${port}`;
}

async function joinUrl(code: string) {
  const params = new URLSearchParams(window.location.search);
  let publicBase = params.get("public") ?? window.location.origin;
  const localHostname = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  if (!params.get("public") && localHostname) {
    try {
      const response = await fetch(`${serverEndpoint()}/api/health`, { cache: "no-store" });
      const health = await response.json() as { port?: number; addresses?: string[] };
      const address = health.addresses?.[0];
      if (address) {
        const webPort = import.meta.env.DEV ? window.location.port || "5173" : String(health.port ?? SERVER_PORT);
        publicBase = `http://${address}:${webPort}`;
      }
    } catch {
      // Keep window.location.origin as the fallback and show it below the QR.
    }
  }
  const url = new URL(publicBase);
  url.searchParams.set("room", code);
  url.searchParams.set("join", "1");
  if (params.get("server")) url.searchParams.set("server", params.get("server")!);
  return url.toString();
}

async function createHostRoom() {
  const room = await new ColyseusClient(serverEndpoint()).create(ROOM_TYPE, { mode: "host" });
  const url = new URL(window.location.href);
  url.searchParams.set("host", room.roomId);
  history.replaceState(null, "", url);
  await hostApp(room);
}

function playerCards(players: Record<string, PlayerRecord>) {
  const entries = Object.entries(players).sort(([, first], [, second]) => first.seatId.localeCompare(second.seatId));
  if (!entries.length) return `<p class="muted">Waiting for players to scan the QR code.</p>`;
  return `<div class="player-grid">${entries.map(([playerId, player]) => {
    const assignment = player.assignment?.role;
    return `<article class="player-card">
      <canvas class="appearance-thumb" data-player-seat="${escapeHtml(player.seatId)}" aria-label="${escapeHtml(player.profile.name)} appearance"></canvas>
      <div><div class="player-name">${escapeHtml(player.profile.name)}</div><div class="player-meta">${player.presence.online ? "Online" : "Disconnected"} · ${player.lobby.ready ? "Ready" : "Not ready"} · ${escapeHtml(cosmeticLabel(player.profile.cosmeticId))}</div></div>
      <div class="role-picker" aria-label="Assign ${escapeHtml(player.profile.name)} to a team">
        <button class="${assignment === "pacman" ? "selected pacman" : ""}" data-assignment-player="${escapeHtml(playerId)}" data-assignment-role="pacman" aria-label="Assign ${escapeHtml(player.profile.name)} to Pac-Man">P</button>
        <button class="${assignment === "ghost" ? "selected ghost" : ""}" data-assignment-player="${escapeHtml(playerId)}" data-assignment-role="ghost" aria-label="Assign ${escapeHtml(player.profile.name)} to Ghost">G</button>
      </div>
    </article>`;
  }).join("")}</div>`;
}

function messageScreen(title: string, message: string, retry = true) {
  clearSubscriptions();
  app.innerHTML = `<main class="shell">${header("Connection problem")}
    <section class="hero"><div class="hero-card"><div class="eyebrow">Local game server</div><h2>${escapeHtml(title)}</h2>
    <p>${escapeHtml(message)}</p>${retry ? `<button class="button yellow" id="retry">Reload</button>` : ""}</div></section></main>`;
  document.querySelector<HTMLButtonElement>("#retry")?.addEventListener("click", () => window.location.reload());
}

function bindRoomFailure(room: GameRoom) {
  room.onError((code, message) => messageScreen("Server error", message || `Connection error ${code}.`));
  room.onLeave((code) => {
    if (code !== 1000 && code !== 4000) messageScreen("Disconnected", "The game server connection was closed.");
  });
  room.onMessage<ServerMessages["closed"]>("closed", ({ message }) => messageScreen("Room closed", message, false));
  room.onMessage<ServerMessages["error"]>("error", ({ message }) => {
    const target = document.querySelector<HTMLElement>("#server-error");
    if (target) target.textContent = message;
    else console.error(message);
  });
}

async function landing() {
  clearSubscriptions();
  app.innerHTML = `<main class="shell">${header("Ready to host on this computer")}
    <section class="hero"><div class="hero-card"><div class="eyebrow">Information and Communication Technology · 2026 Summer</div>
      <h2>One maze.<br>Two teams.</h2>
      <p>This computer runs the authoritative game server. Put this screen on a projector, then let players scan the room QR code.</p>
      <p class="project-credit">Created by fyhung with help from ChatGPT 5.6 sol<br>TWGHs Mrs. Fung Wong Fung Ting College</p>
      <button class="button yellow" id="create-room">Create game room</button>
      <p class="error" id="landing-error" role="alert"></p>
    </div></section></main>`;
  document.querySelector<HTMLButtonElement>("#create-room")?.addEventListener("click", async (event) => {
    const button = event.currentTarget as HTMLButtonElement;
    const error = document.querySelector<HTMLElement>("#landing-error");
    button.disabled = true;
    button.textContent = "Creating room…";
    try {
      await createHostRoom();
    } catch (reason) {
      if (error) error.textContent = reason instanceof Error ? reason.message : String(reason);
      button.disabled = false;
      button.textContent = "Create game room";
    }
  });
}

async function hostApp(room: GameRoom) {
  clearSubscriptions();
  bindRoomFailure(room);
  let latestLobby: LobbySnapshot | null = null;
  let latestSnapshot: GameSnapshot | null = null;
  let interpolation: SnapshotInterpolation | null = null;
  let screen: "none" | "lobby" | "game" = "none";
  let frameId = 0;
  const maze = createMaze();
  const playerJoinUrl = await joinUrl(room.roomId);
  const qrData = await QRCode.toDataURL(playerJoinUrl, { width: 420, margin: 1, errorCorrectionLevel: "M" });

  function stopFrame() {
    cancelAnimationFrame(frameId);
    frameId = 0;
  }

  function scoreList(snapshot: GameSnapshot, role: "pacman" | "ghost") {
    return scoreboardRows(snapshot, role).slice(0, 15).map((actor) =>
      `<div class="score-row"><span class="swatch" style="height:10px;background:${colorValue(actor.colorId)}"></span><span>${escapeHtml(actor.name)}</span><strong>${actor.score.toLocaleString()}</strong></div>`,
    ).join("");
  }

  function updateHostHud(snapshot: GameSnapshot) {
    const values: Record<string, string> = {
      "pac-score": snapshot.pacmanScore.toLocaleString(),
      "ghost-score": snapshot.ghostScore.toLocaleString(),
      "game-time": formatTime(snapshot.roundEndsAt - snapshot.hostTime),
      "game-lives": String(snapshot.pacmanLives),
      "game-dots": String(snapshot.pellets.length + snapshot.powerPellets.length),
    };
    Object.entries(values).forEach(([id, value]) => {
      const element = document.querySelector<HTMLElement>(`#${id}`);
      if (element) element.textContent = value;
    });
    const pacList = document.querySelector<HTMLElement>("#pac-list");
    const ghostList = document.querySelector<HTMLElement>("#ghost-list");
    if (pacList) pacList.innerHTML = scoreList(snapshot, "pacman");
    if (ghostList) ghostList.innerHTML = scoreList(snapshot, "ghost");
    const overlay = document.querySelector<HTMLElement>("#result-panel");
    if (!overlay) return;
    const complete = snapshot.status === "results" && snapshot.winner !== null;
    overlay.hidden = !complete;
    if (complete) {
      const title = overlay.querySelector("h2");
      const reason = overlay.querySelector<HTMLElement>("#result-reason");
      const mvp = winningMvp(snapshot);
      if (title) title.textContent = snapshot.winner === "pacman" ? "Pac-Man team wins" : "Ghost team wins";
      if (reason) reason.textContent = snapshot.resultReason ?? "Round complete";
      const mvpName = overlay.querySelector<HTMLElement>("#result-mvp-name");
      const mvpStats = overlay.querySelector<HTMLElement>("#result-mvp-stats");
      const mvpPreview = overlay.querySelector<HTMLCanvasElement>("#result-mvp-preview");
      if (mvpName) mvpName.textContent = mvp?.name ?? "—";
      if (mvpStats) mvpStats.textContent = mvpDetail(snapshot);
      if (mvpPreview && mvp) renderCharacterPreview(mvpPreview, mvp.colorId, mvp.cosmeticId, mvp.role, 76);
    }
  }

  function renderLobby(lobby: LobbySnapshot) {
    stopFrame();
    screen = "lobby";
    const players = lobby.players;
    const count = Object.keys(players).length;
    const maxPacmen = Math.max(1, count - 1);
    const pacmanCount = Math.max(1, Math.min(maxPacmen, lobby.pacmanCount));
    const livesPerPacman = lobby.livesPerPacman;
    const timeMinutes = Math.round(lobby.roundDurationMs / 60_000);
    const allReady = count >= 2 && Object.values(players).every((player) => player.presence.online && player.lobby.ready);
    const assignedPacmen = Object.values(players).filter((player) => player.assignment?.role === "pacman").length;
    const assigned = count >= 2 && Object.values(players).every((player) => player.assignment);
    const canStart = allReady && assigned && assignedPacmen === pacmanCount;
    app.innerHTML = `<main class="shell">${header()}
      <section class="lobby-grid"><aside class="panel">
        <div class="eyebrow">Room code</div><div class="room-code">${lobby.code}</div>
        <img class="qr" src="${qrData}" alt="QR code to join room ${lobby.code}">
        <p class="muted" style="overflow-wrap:anywhere">${escapeHtml(playerJoinUrl)}</p>
        <div class="actions"><button class="button secondary" id="copy-link">Copy join link</button><button class="button danger" id="close-room">Close room</button></div>
        <hr style="border:0;border-top:1px solid var(--line);margin:20px 0">
        <div class="field"><label>Number of Pac-Man players</label><div class="counter">
          <span class="muted">${count ? `${count - pacmanCount} Ghost${count - pacmanCount === 1 ? "" : "s"}` : "Waiting for players"}</span>
          <button id="pac-minus" aria-label="Fewer Pac-Man">−</button>
          <input id="pac-count" type="number" min="1" max="${maxPacmen}" value="${pacmanCount}" ${count < 2 ? "disabled" : ""}>
          <button id="pac-plus" aria-label="More Pac-Man">+</button>
        </div></div>
        <p class="muted">Assign each player with the P/G buttons, or choose a count and randomize the teams.</p>
        <div class="round-settings">
          <div class="setting-card"><label>Lives per Pac-Man</label><div class="mini-counter"><button id="lives-minus" aria-label="Fewer lives">−</button><strong>${livesPerPacman}</strong><button id="lives-plus" aria-label="More lives">+</button></div><small>${pacmanCount * livesPerPacman} team lives</small></div>
          <div class="setting-card"><label>Time limit</label><div class="mini-counter"><button id="time-minus" aria-label="Shorter game">−</button><strong>${timeMinutes}</strong><button id="time-plus" aria-label="Longer game">+</button></div><small>minutes</small></div>
        </div>
        <div class="actions"><button class="button secondary" id="randomize" ${count < 2 ? "disabled" : ""}>Randomize roles</button><button class="button yellow" id="start" ${canStart ? "" : "disabled"}>Start game</button></div>
        <p class="muted">${count < 2 ? "At least two players are required." : !allReady ? "Waiting for every player to be ready." : !assigned || assignedPacmen !== pacmanCount ? "Assign every player manually or randomize the teams." : "Ready to start."}</p>
        <p class="error" id="server-error"></p>
      </aside><section class="panel"><div class="topbar" style="margin-bottom:14px"><div><div class="eyebrow">Players</div><h2>${count} / ${lobby.maxPlayers}</h2></div><span class="status-pill">Pac-Man ${assignedPacmen} · Ghost ${count - assignedPacmen}</span></div>${playerCards(players)}</section></section>
    </main>`;
    document.querySelectorAll<HTMLCanvasElement>("[data-player-seat]").forEach((canvas) => {
      const player = Object.values(players).find(({ seatId }) => seatId === canvas.dataset.playerSeat);
      if (player) renderCharacterPreview(canvas, player.profile.colorId, player.profile.cosmeticId, player.assignment?.role ?? "pacman", 64);
    });
    document.querySelectorAll<HTMLButtonElement>("[data-assignment-player]").forEach((button) => button.addEventListener("click", () => {
      room.send("assignRole", {
        playerId: button.dataset.assignmentPlayer,
        role: button.dataset.assignmentRole as Role,
      });
    }));
    document.querySelector<HTMLButtonElement>("#copy-link")?.addEventListener("click", async (event) => {
      await navigator.clipboard.writeText(playerJoinUrl);
      (event.currentTarget as HTMLButtonElement).textContent = "Copied";
    });
    document.querySelector<HTMLButtonElement>("#close-room")?.addEventListener("click", () => room.send("close"));
    const setCount = (value: number) => room.send("pacmanCount", Math.max(1, Math.min(maxPacmen, value)));
    document.querySelector<HTMLButtonElement>("#pac-minus")?.addEventListener("click", () => setCount(pacmanCount - 1));
    document.querySelector<HTMLButtonElement>("#pac-plus")?.addEventListener("click", () => setCount(pacmanCount + 1));
    document.querySelector<HTMLInputElement>("#pac-count")?.addEventListener("change", (event) => setCount(Number((event.currentTarget as HTMLInputElement).value)));
    const setSettings = (lives: number, minutes: number) => room.send("settings", {
      livesPerPacman: Math.max(1, Math.min(9, lives)),
      roundDurationMs: Math.max(1, Math.min(15, minutes)) * 60_000,
    });
    document.querySelector<HTMLButtonElement>("#lives-minus")?.addEventListener("click", () => setSettings(livesPerPacman - 1, timeMinutes));
    document.querySelector<HTMLButtonElement>("#lives-plus")?.addEventListener("click", () => setSettings(livesPerPacman + 1, timeMinutes));
    document.querySelector<HTMLButtonElement>("#time-minus")?.addEventListener("click", () => setSettings(livesPerPacman, timeMinutes - 1));
    document.querySelector<HTMLButtonElement>("#time-plus")?.addEventListener("click", () => setSettings(livesPerPacman, timeMinutes + 1));
    document.querySelector<HTMLButtonElement>("#randomize")?.addEventListener("click", () => room.send("randomize"));
    document.querySelector<HTMLButtonElement>("#start")?.addEventListener("click", () => room.send("start"));
  }

  function renderHostGame(snapshot: GameSnapshot) {
    screen = "game";
    app.innerHTML = `<main class="shell">${header()}
      <section class="game-layout"><div class="panel game-stage"><canvas class="game-canvas" id="game-canvas" aria-label="Shared maze arena"></canvas>
      </div><aside class="game-hud">
        <div class="panel host-result" id="result-panel" hidden><div class="eyebrow">Round complete</div><h2></h2><p class="muted" id="result-reason"></p><div class="mvp-card"><div class="mvp-crown">★ Winning team MVP</div><div class="mvp-player"><canvas class="mvp-appearance" id="result-mvp-preview" aria-label="MVP appearance"></canvas><div><strong id="result-mvp-name">—</strong><small id="result-mvp-stats"></small></div></div></div><div class="result-actions"><button class="button yellow" id="replay">Play again</button><button class="button secondary" id="reroll">Randomize teams</button></div></div>
        <div class="panel score-pair"><div class="score"><span>Pac-Man</span><strong id="pac-score">0</strong></div><div class="score"><span>Ghosts</span><strong id="ghost-score">0</strong></div></div>
        <div class="panel score-triple"><div class="score"><span>Time</span><strong id="game-time">5:00</strong></div><div class="score"><span>Team lives</span><strong id="game-lives">0</strong></div><div class="score"><span>Dots left</span><strong id="game-dots">0</strong></div></div>
        <div class="panel"><h3>Pac-Man team</h3><div class="score-list" id="pac-list"></div></div><div class="panel"><h3>Ghost team</h3><div class="score-list" id="ghost-list"></div></div>
      </aside></section></main>`;
    document.querySelector<HTMLButtonElement>("#replay")?.addEventListener("click", () => room.send("reset", { keepTeams: true }));
    document.querySelector<HTMLButtonElement>("#reroll")?.addEventListener("click", () => room.send("reset", { keepTeams: false }));
    updateHostHud(snapshot);
    const frame = () => {
      frameId = requestAnimationFrame(frame);
      if (!interpolation || !latestSnapshot) return;
      const canvas = document.querySelector<HTMLCanvasElement>("#game-canvas");
      if (canvas) renderGame(canvas, sampleSnapshot(interpolation, performance.now()), maze);
    };
    frameId = requestAnimationFrame(frame);
  }

  room.onMessage<ServerMessages["lobby"]>("lobby", (lobby) => {
    latestLobby = lobby;
    if (lobby.status === "lobby") {
      latestSnapshot = null;
      interpolation = null;
      renderLobby(lobby);
    }
  });
  room.onMessage<ServerMessages["snapshot"]>("snapshot", (update) => {
    const snapshot = mergeNetworkSnapshot(latestSnapshot, update);
    const receivedAt = performance.now();
    interpolation = updateInterpolation(interpolation, snapshot, receivedAt);
    latestSnapshot = snapshot;
    if (screen !== "game") renderHostGame(snapshot);
    else updateHostHud(snapshot);
  });
  room.onMessage<ServerMessages["gameEvent"]>("gameEvent", (event) => gameSounds.handle(event));
  cleanup.push(() => stopFrame(), () => void room.leave());
  room.send("sync");
  if (latestLobby) renderLobby(latestLobby);
}

async function playerApp(code: string) {
  clearSubscriptions();
  let room: GameRoom;
  try {
    room = await new ColyseusClient(serverEndpoint()).joinById(code, { mode: "player" });
  } catch (reason) {
    messageScreen("Room not found", reason instanceof Error ? reason.message : "Check the room code and Wi-Fi connection.");
    return;
  }
  bindRoomFailure(room);
  const uid = room.sessionId;
  let lobbyState: LobbySnapshot | null = null;
  let selectedColor = "c08";
  let joinError = "";
  let styleError = "";
  let reselectingColor = false;
  let screen = "none";
  let latestSnapshot: GameSnapshot | null = null;
  let interpolation: SnapshotInterpolation | null = null;
  let localPrediction: LocalPrediction | null = null;
  let localWantedDirection: Direction = "none";
  let inputSeq = 0;
  let lastDirection: Direction = "none";
  let lastSentAt = 0;
  let predictionFrameTime = performance.now();
  let frameId = 0;
  let pingId = 0;
  let pingTimer = 0;
  let positionTimer = 0;
  const maze = createMaze();

  const sendDirection = (direction: Direction) => {
    localWantedDirection = direction;
    const now = Date.now();
    if (direction === lastDirection && now - lastSentAt < 120) return;
    lastDirection = direction;
    lastSentAt = now;
    inputSeq += 1;
    room.send("direction", { seq: inputSeq, direction, clientTime: now });
  };

  function renderJoin(lobby: LobbySnapshot) {
    screen = "join";
    const claims = new Set(Object.values(lobby.players).map((player) => player.profile.colorId));
    app.innerHTML = `<main class="shell">${header()}
      <section class="join-layout"><form class="panel join-card" id="join-form">
        <div class="eyebrow">Room ${escapeHtml(lobby.code)} · ${Object.keys(lobby.players).length}/${lobby.maxPlayers}</div><h2>Choose your player</h2>
        <div class="field"><label for="player-name">Display name</label><input id="player-name" maxlength="16" required autocomplete="nickname" placeholder="Your name"></div>
        <div class="field"><label>Unique player color</label><div class="palette">${PALETTE.map((color) => `<button type="button" class="color-button ${selectedColor === color.id ? "selected" : ""}" data-color="${color.id}" style="background:${color.hex}" aria-label="${color.label}" ${claims.has(color.id) ? "disabled" : ""}></button>`).join("")}</div></div>
        ${joinError ? `<p class="error" role="alert">${escapeHtml(joinError)}</p>` : ""}
        <button class="button yellow" type="submit">Join room</button>
      </form></section></main>`;
    document.querySelectorAll<HTMLButtonElement>("[data-color]").forEach((button) => button.addEventListener("click", () => {
      selectedColor = button.dataset.color ?? selectedColor;
      document.querySelectorAll(".color-button").forEach((item) => item.classList.remove("selected"));
      button.classList.add("selected");
    }));
    document.querySelector<HTMLFormElement>("#join-form")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const name = document.querySelector<HTMLInputElement>("#player-name")?.value.trim() ?? "";
      room.send("join", { name, colorId: selectedColor });
      const button = (event.currentTarget as HTMLFormElement).querySelector<HTMLButtonElement>("button[type=submit]");
      if (button) { button.disabled = true; button.textContent = "Joining…"; }
    });
  }

  function renderPlayerLobby(lobby: LobbySnapshot, player: PlayerRecord) {
    screen = "lobby";
    if (reselectingColor) {
      const claims = new Set(Object.entries(lobby.players).filter(([playerUid]) => playerUid !== uid).map(([, other]) => other.profile.colorId));
      const previewCosmetic = player.profile.cosmeticId;
      app.innerHTML = `<main class="shell">${header()}
        <section class="join-layout"><div class="panel join-card customization-card"><div class="eyebrow">Room ${escapeHtml(lobby.code)}</div><h2>Reselect your color</h2>
          <div class="character-preview"><canvas id="character-preview" aria-label="Character preview"></canvas><strong>${escapeHtml(player.profile.name)}</strong></div>
          <div class="field"><label>Unique player color</label><div class="palette">${PALETTE.map((color) => `<button type="button" class="color-button ${selectedColor === color.id ? "selected" : ""}" data-reselect-color="${color.id}" style="background:${color.hex}" aria-label="${color.label}" ${claims.has(color.id) ? "disabled" : ""}></button>`).join("")}</div></div>
          ${styleError ? `<p class="error" role="alert">${escapeHtml(styleError)}</p>` : ""}
          <div class="actions"><button class="button secondary" id="cancel-color">Back to cosmetics</button><button class="button yellow" id="save-color">Save color</button></div>
        </div></section></main>`;
      const preview = document.querySelector<HTMLCanvasElement>("#character-preview");
      if (preview) renderCharacterPreview(preview, selectedColor, previewCosmetic, player.assignment?.role ?? "pacman");
      document.querySelectorAll<HTMLButtonElement>("[data-reselect-color]").forEach((button) => button.addEventListener("click", () => {
        selectedColor = button.dataset.reselectColor ?? selectedColor;
        document.querySelectorAll(".color-button").forEach((item) => item.classList.remove("selected"));
        button.classList.add("selected");
        if (preview) renderCharacterPreview(preview, selectedColor, previewCosmetic, player.assignment?.role ?? "pacman");
      }));
      document.querySelector<HTMLButtonElement>("#cancel-color")?.addEventListener("click", () => {
        selectedColor = player.profile.colorId;
        reselectingColor = false;
        styleError = "";
        renderPlayerLobby(lobby, player);
      });
      document.querySelector<HTMLButtonElement>("#save-color")?.addEventListener("click", (event) => {
        room.send("style", { colorId: selectedColor });
        (event.currentTarget as HTMLButtonElement).disabled = true;
      });
      return;
    }
    const cosmeticId = player.profile.cosmeticId;
    const previewCosmetic = cosmeticId;
    app.innerHTML = `<main class="shell">${header()}
      <section class="join-layout"><div class="panel join-card customization-card"><div class="eyebrow">Room ${escapeHtml(lobby.code)} · ${Object.keys(lobby.players).length} players</div>
        <h2>${player.assignment ? `You are ${player.assignment.role === "pacman" ? "Pac-Man" : "a Ghost"}` : "Waiting for roles"}</h2>
        <div class="character-preview"><canvas id="character-preview" aria-label="Character preview"></canvas><strong>${escapeHtml(player.profile.name)}</strong><span>${escapeHtml(cosmeticLabel(cosmeticId))}</span></div>
        <div class="field"><label>Choose one cosmetic</label><div class="cosmetic-grid">${COSMETICS.map((cosmetic) => `<button type="button" class="cosmetic-button ${cosmeticId === cosmetic.id ? "selected" : ""}" data-cosmetic="${cosmetic.id}" aria-label="${cosmetic.label}"><span>${cosmetic.symbol}</span><small>${cosmetic.label}</small></button>`).join("")}</div></div>
        ${styleError ? `<p class="error" role="alert">${escapeHtml(styleError)}</p>` : ""}
        <div class="actions customization-actions"><button class="button secondary" id="reselect-color">Reselect color</button><button class="button ${player.lobby.ready ? "secondary" : "yellow"}" id="ready" ${cosmeticId ? "" : "disabled"}>${player.lobby.ready ? "Not ready" : "Ready"}</button></div>
        <p class="muted">${lobby.livesPerPacman} lives per Pac-Man · ${formatTime(lobby.roundDurationMs)} time limit</p>
      </div></section></main>`;
    const preview = document.querySelector<HTMLCanvasElement>("#character-preview");
    if (preview) renderCharacterPreview(preview, player.profile.colorId, previewCosmetic, player.assignment?.role ?? "pacman");
    document.querySelectorAll<HTMLButtonElement>("[data-cosmetic]").forEach((button) => button.addEventListener("click", () => {
      room.send("style", { cosmeticId: button.dataset.cosmetic });
    }));
    document.querySelector<HTMLButtonElement>("#reselect-color")?.addEventListener("click", () => {
      selectedColor = player.profile.colorId;
      reselectingColor = true;
      styleError = "";
      renderPlayerLobby(lobby, player);
    });
    document.querySelector<HTMLButtonElement>("#ready")?.addEventListener("click", () => room.send("ready", !player.lobby.ready));
  }

  function updateMobileHud(snapshot: GameSnapshot) {
    const actor = snapshot.actors[uid];
    if (!actor) return;
    const values: Record<string, string> = {
      "my-score": actor.score.toLocaleString(),
      "team-score": (actor.role === "pacman" ? snapshot.pacmanScore : snapshot.ghostScore).toLocaleString(),
      "mobile-time": formatTime(snapshot.roundEndsAt - snapshot.hostTime),
      "mobile-lives": String(snapshot.pacmanLives),
      "mobile-dots": String(snapshot.pellets.length + snapshot.powerPellets.length),
    };
    Object.entries(values).forEach(([id, value]) => {
      const element = document.querySelector<HTMLElement>(`#${id}`);
      if (element) element.textContent = value;
    });
    const overlay = document.querySelector<HTMLElement>("#mobile-result");
    if (!overlay) return;
    const complete = snapshot.status === "results" && snapshot.winner !== null;
    overlay.hidden = !complete;
    if (complete) {
      const heading = overlay.querySelector("h2");
      if (heading) heading.textContent = snapshot.winner === actor.role ? "Your team wins" : `${snapshot.winner === "ghost" ? "Ghost" : "Pac-Man"} team wins`;
      const reason = overlay.querySelector<HTMLElement>("#mobile-result-reason");
      if (reason) reason.textContent = snapshot.resultReason ?? "Round complete";
      const mvp = winningMvp(snapshot);
      const mvpName = overlay.querySelector<HTMLElement>("#mobile-mvp-name");
      const mvpStats = overlay.querySelector<HTMLElement>("#mobile-mvp-stats");
      const mvpPreview = overlay.querySelector<HTMLCanvasElement>("#mobile-mvp-preview");
      if (mvpName) mvpName.textContent = mvp?.name ?? "—";
      if (mvpStats) mvpStats.textContent = mvpDetail(snapshot);
      if (mvpPreview && mvp) renderCharacterPreview(mvpPreview, mvp.colorId, mvp.cosmeticId, mvp.role, 76);
    }
  }

  function renderPlayerGame(snapshot: GameSnapshot) {
    screen = "game";
    const actor = snapshot.actors[uid];
    if (!actor) return;
    app.innerHTML = `<main class="player-game">
      <div class="mobile-hud"><div class="mobile-stat">You<strong id="my-score">0</strong></div><div class="mobile-stat">Team<strong id="team-score">0</strong></div><div class="mobile-stat">Time<strong id="mobile-time">5:00</strong></div><div class="mobile-stat">Lives<strong id="mobile-lives">0</strong></div><div class="mobile-stat">Dots<strong id="mobile-dots">0</strong></div><div class="mobile-stat">Ping<strong id="network-ping">—</strong></div></div>
      <div class="game-stage"><canvas class="game-canvas" id="player-canvas" aria-label="Your centered maze view"></canvas><div class="overlay" id="mobile-result" hidden><div class="result-card"><div class="eyebrow">Round complete</div><h2></h2><p class="muted" id="mobile-result-reason"></p><div class="mvp-card"><div class="mvp-crown">★ Winning team MVP</div><div class="mvp-player"><canvas class="mvp-appearance" id="mobile-mvp-preview" aria-label="MVP appearance"></canvas><div><strong id="mobile-mvp-name">—</strong><small id="mobile-mvp-stats"></small></div></div></div><p class="muted">Look at the host screen for the full scoreboard.</p></div></div></div>
      <div class="dpad" aria-label="Movement controls"><button data-direction="up" aria-label="Move up">▲</button><button data-direction="left" aria-label="Move left">◀</button><button data-direction="down" aria-label="Move down">▼</button><button data-direction="right" aria-label="Move right">▶</button></div>
    </main>`;
    document.querySelectorAll<HTMLButtonElement>("[data-direction]").forEach((button) => button.addEventListener("pointerdown", () => sendDirection(button.dataset.direction as Direction)));
    const canvas = document.querySelector<HTMLCanvasElement>("#player-canvas");
    let startX = 0;
    let startY = 0;
    canvas?.addEventListener("pointerdown", (event) => { startX = event.clientX; startY = event.clientY; });
    canvas?.addEventListener("pointerup", (event) => {
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      if (Math.max(Math.abs(dx), Math.abs(dy)) >= 20) sendDirection(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
    });
    updateMobileHud(snapshot);
    cancelAnimationFrame(frameId);
    predictionFrameTime = performance.now();
    const frame = () => {
      frameId = requestAnimationFrame(frame);
      if (!latestSnapshot || !interpolation) return;
      const now = performance.now();
      const seconds = Math.min(0.05, Math.max(0, (now - predictionFrameTime) / 1_000));
      predictionFrameTime = now;
      if (localPrediction && latestSnapshot.status === "playing") {
        advanceLocalPrediction(localPrediction, maze, localWantedDirection, seconds, latestSnapshot.hostTime < latestSnapshot.frightenedUntil);
      }
      const target = document.querySelector<HTMLCanvasElement>("#player-canvas");
      if (target) renderGame(target, applyLocalPrediction(sampleSnapshot(interpolation, now), localPrediction), maze, uid);
    };
    frameId = requestAnimationFrame(frame);
  }

  const keyDirections: Record<string, Direction> = {
    ArrowUp: "up", w: "up", W: "up", ArrowDown: "down", s: "down", S: "down",
    ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right",
  };
  const onKeyDown = (event: KeyboardEvent) => {
    const direction = keyDirections[event.key];
    if (direction && screen === "game") { event.preventDefault(); sendDirection(direction); }
  };
  window.addEventListener("keydown", onKeyDown);

  room.onMessage<ServerMessages["joinResult"]>("joinResult", (result) => {
    if (!result.ok) {
      joinError = result.reason ?? "Could not join the room.";
      if (lobbyState) renderJoin(lobbyState);
    }
  });
  room.onMessage<ServerMessages["styleResult"]>("styleResult", (result) => {
    if (result.ok) {
      styleError = "";
      reselectingColor = false;
      return;
    }
    styleError = result.reason ?? "Could not update your character.";
    const player = lobbyState?.players[uid];
    if (lobbyState && player) renderPlayerLobby(lobbyState, player);
  });
  room.onMessage<ServerMessages["lobby"]>("lobby", (lobby) => {
    lobbyState = lobby;
    if (lobby.status !== "lobby") return;
    latestSnapshot = null;
    interpolation = null;
    localPrediction = null;
    localWantedDirection = "none";
    lastDirection = "none";
    lastSentAt = 0;
    cancelAnimationFrame(frameId);
    const player = lobby.players[uid];
    if (player) renderPlayerLobby(lobby, player);
    else renderJoin(lobby);
  });
  room.onMessage<ServerMessages["snapshot"]>("snapshot", (update) => {
    const snapshot = mergeNetworkSnapshot(latestSnapshot, update);
    const authoritative = snapshot.actors[uid];
    if (!authoritative) return;
    const receivedAt = performance.now();
    inputSeq = Math.max(inputSeq, authoritative.lastInputSeq ?? 0);
    if (!localPrediction || localPrediction.roundId !== snapshot.roundId) {
      localWantedDirection = authoritative.wantedDirection;
      predictionFrameTime = receivedAt;
    }
    interpolation = updateInterpolation(interpolation, snapshot, receivedAt);
    localPrediction = reconcileClientOwnedPrediction(localPrediction, snapshot, uid, localWantedDirection);
    latestSnapshot = snapshot;
    if (screen !== "game") renderPlayerGame(snapshot);
    else updateMobileHud(snapshot);
  });
  room.onMessage<ServerMessages["gameEvent"]>("gameEvent", (event) => gameSounds.handle(event));
  room.onMessage<ServerMessages["pong"]>("pong", (message) => {
    const latency = Math.max(0, Math.round(performance.now() - message.clientTime));
    const display = document.querySelector<HTMLElement>("#network-ping");
    if (display) display.textContent = `${latency} ms`;
  });
  room.onMessage<ServerMessages["correction"]>("correction", ({ roundId, actor }) => {
    if (actor.uid !== uid) return;
    localPrediction = {
      roundId,
      actor: { ...actor, wantedDirection: localWantedDirection },
    };
    predictionFrameTime = performance.now();
  });
  const sendPing = () => room.send("ping", { id: ++pingId, clientTime: performance.now() });
  sendPing();
  pingTimer = window.setInterval(sendPing, 2_000);
  const sendPosition = () => {
    if (!localPrediction || latestSnapshot?.status !== "playing") return;
    const actor = localPrediction.actor;
    room.send("position", {
      seq: inputSeq,
      x: actor.x,
      y: actor.y,
      direction: actor.direction,
      wantedDirection: localWantedDirection,
      clientTime: performance.now(),
    });
  };
  positionTimer = window.setInterval(sendPosition, 1_000 / 30);
  cleanup.push(
    () => window.removeEventListener("keydown", onKeyDown),
    () => cancelAnimationFrame(frameId),
    () => clearInterval(pingTimer),
    () => clearInterval(positionTimer),
    () => void room.leave(),
  );
  room.send("sync");
}

async function boot() {
  const params = new URLSearchParams(window.location.search);
  const room = params.get("room")?.toUpperCase();
  if (room && params.get("join") === "1") await playerApp(room);
  else if (params.get("host") === "1") {
    app.innerHTML = `<main class="shell">${header("Starting local game server")}<section class="hero"><div class="hero-card"><div class="eyebrow">Desktop host</div><h2>Creating game room…</h2></div></section></main>`;
    try {
      await createHostRoom();
    } catch (reason) {
      messageScreen("Could not create room", reason instanceof Error ? reason.message : String(reason));
    }
  }
  else await landing();
}

void boot();
