import { Client as ColyseusClient, type Room } from "colyseus.js";
import QRCode from "qrcode";
import "./styles.css";
import { APP_VERSION, ROOM_TYPE, type ErrorMessage, type HealthResponse, type Lane, type PlateDifficulty, type PoseMessage, type QuestionLevel, type RoomSnapshot, type WelcomeMessage } from "./protocol";

const root = document.querySelector<HTMLDivElement>("#app");
if (!root) throw new Error("Application root is missing.");
const app: HTMLDivElement = root;

const params = new URLSearchParams(location.search);
const hostMode = params.get("host") === "1";
const endpoint = location.port === "5173" ? `http://${location.hostname}:2567` : location.origin;
let room: Room | null = null;
let snapshot: RoomSnapshot | null = null;
let welcome: WelcomeMessage | null = null;
let health: HealthResponse | null = null;
let selectedAddress = "";
let connection: "connecting" | "connected" | "reconnecting" | "offline" = "connecting";
let serverOffsetMs = 0;
let pingMs: number | null = null;
let sequence = 0;
let notice = "";
let qrRevision = 0;
let selectedPlateDifficulty: PlateDifficulty = "normal";
let selectedDecisionSeconds = 5;
let selectedQuestionLevel: "all" | QuestionLevel = "all";
let localPose = { x: .5, y: .72 };
let localSectionId = "";
let lastMovementFrame = performance.now();
let lastPoseSentAt = 0;
const movementDirections = new Set<"up" | "down" | "left" | "right">();

void (hostMode ? startHost() : startPlayer());
requestAnimationFrame(tickTimers);
requestAnimationFrame(tickMovement);
setInterval(sendPing, 4000);
window.addEventListener("keydown", (event) => {
  const direction = keyDirection(event.code);
  if (!direction || hostMode) return;
  event.preventDefault();
  movementDirections.add(direction);
});
window.addEventListener("keyup", (event) => {
  const direction = keyDirection(event.code);
  if (!direction) return;
  movementDirections.delete(direction);
});
window.addEventListener("blur", () => movementDirections.clear());

async function startHost(): Promise<void> {
  renderHost();
  try {
    const [healthResponse, bootstrapResponse] = await Promise.all([
      fetch("/api/health").then(readJson<HealthResponse>),
      fetch("/api/host-bootstrap").then(readJson<{ roomCode: string; hostToken: string }>),
    ]);
    health = healthResponse;
    selectedAddress = health.addresses[0] ?? "";
    const client = new ColyseusClient(endpoint);
    const joined = await client.create(ROOM_TYPE, { roomCode: bootstrapResponse.roomCode, hostToken: bootstrapResponse.hostToken, role: "host" });
    connectRoom(joined);
  } catch (error) {
    connection = "offline";
    notice = friendlyError(error);
    renderHost();
  }
}

async function startPlayer(): Promise<void> {
  const roomCode = cleanCode(params.get("room") ?? "");
  const reconnectToken = roomCode ? localStorage.getItem(storageKey(roomCode)) : null;
  if (reconnectToken) {
    renderPlayerConnecting("正在讓你的角色重新加入…");
    try {
      connection = "reconnecting";
      const client = new ColyseusClient(endpoint);
      const joined = await client.reconnect(reconnectToken);
      connectRoom(joined);
      return;
    } catch {
      localStorage.removeItem(storageKey(roomCode));
    }
  }
  connection = "offline";
  renderJoin();
}

function connectRoom(joined: Room): void {
  room = joined;
  connection = "connected";
  if (!hostMode) {
    const code = cleanCode(params.get("room") ?? "");
    if (code) localStorage.setItem(storageKey(code), joined.reconnectionToken);
  }
  joined.onMessage("welcome", (message: WelcomeMessage) => {
    welcome = message;
    if (!hostMode) localStorage.setItem(storageKey(message.roomCode), joined.reconnectionToken);
    render();
  });
  joined.onMessage("snapshot", (message: RoomSnapshot) => {
    const previousSectionId = snapshot?.section?.id ?? "";
    snapshot = message;
    serverOffsetMs = message.serverTime - Date.now();
    if (!hostMode && welcome?.playerId) {
      const me = message.players.find((player) => player.id === welcome?.playerId);
      const adoptServerPose = !me?.alive || message.section?.id !== previousSectionId || !["prepare", "choosing"].includes(message.phase);
      if (me && adoptServerPose) localPose = { x: me.x, y: me.y };
      localSectionId = message.section?.id ?? "";
    }
    render();
  });
  joined.onMessage("pose", (message: PoseMessage) => {
    applyPose(message);
    updateRunnerPosition(message.playerId, message.x, message.y);
  });
  joined.onMessage("pose_correction", (message: PoseMessage) => {
    if (message.playerId !== welcome?.playerId) return;
    localPose = { x: message.x, y: message.y };
    applyPose(message);
    updateLocalRunner();
  });
  joined.onMessage("pong", (message: { clientTime: number }) => {
    pingMs = Math.max(0, Date.now() - message.clientTime);
    updateConnectionPills();
  });
  joined.onMessage("game_error", (message: ErrorMessage) => {
    notice = message.message;
    render();
  });
  joined.onLeave(() => {
    connection = "offline";
    render();
  });
  joined.onError((_code, message) => {
    notice = message || "遊戲連線發生問題。";
    render();
  });
  joined.send("sync", {});
  render();
}

function render(): void {
  if (hostMode) renderHost();
  else renderPlayer();
}

function renderHost(): void {
  const players = snapshot?.players ?? [];
  const connectedPlayers = players.filter((player) => player.connected);
  const allReady = connectedPlayers.length > 0 && connectedPlayers.every((player) => player.ready);
  const inLobby = !snapshot || snapshot.phase === "lobby";
  const joinUrl = getJoinUrl();
  const noLan = health && health.addresses.length === 0;
  app.innerHTML = `
    <main class="host-shell">
      <header class="topbar">
        <div class="brand"><span class="brand-mark">SQL</span><span>RUN</span><small>v${APP_VERSION}</small></div>
        <div class="topbar-center"><span class="phase-dot phase-${snapshot?.phase ?? "lobby"}"></span>${phaseLabel(snapshot?.phase ?? "lobby")}</div>
        <div class="connection-pill" data-connection><span></span>${connectionLabel()}</div>
      </header>
      ${notice ? `<button class="notice" data-dismiss-notice>${escapeHtml(notice)}<span>×</span></button>` : ""}
      ${noLan ? `<div class="network-warning">找不到實體 LAN 位址。請把此電腦連接 Wi-Fi 或 Ethernet，然後重新啟動 SQL Run。</div>` : ""}
      <div class="host-grid">
        <aside class="panel lobby-panel">
          <div class="panel-label">加入遊戲</div>
          <div class="qr-frame"><div class="qr-inner">${joinUrl ? `<img data-qr alt="QR code to join SQL Run" />` : `<div class="qr-loading">Preparing<br />room…</div>`}</div></div>
          <div class="room-code-label">房間代碼</div>
          <div class="room-code">${snapshot?.roomCode ?? health?.roomCode ?? "-----"}</div>
          <div class="join-url-row"><span>${escapeHtml(joinUrl || "正在尋找 LAN 位址…")}</span><button class="icon-button" data-copy-url aria-label="複製加入網址">複製</button></div>
          ${addressSelector()}
          <div class="network-hint">手機必須連接相同 Wi-Fi。Windows Firewall 詢問時，只允許 SQL Run 使用<strong>私人網絡</strong>。</div>
        </aside>

        <section class="stage">
          ${inLobby ? hostLobbyStage(players, allReady) : hostRaceStage()}
        </section>

        <aside class="panel roster-panel">
          <div class="roster-title"><span>玩家</span><strong>${connectedPlayers.length}<small>/${30}</small></strong></div>
          <div class="roster-list">${players.length ? players.map(playerRow).join("") : emptyRoster()}</div>
          <div class="host-actions">
            ${inLobby ? hostSettingsPanel() : ""}
            ${snapshot?.phase === "results" ? `<button class="primary-button" data-reset>新一局 <span>↻</span></button>` : `<button class="primary-button" data-start ${!allReady || !inLobby ? "disabled" : ""}>開始遊戲 <span>→</span></button>`}
            ${inLobby && players.length ? `<p>${allReady ? "所有玩家已準備。" : "等待所有玩家按下準備。"}</p>` : ""}
          </div>
        </aside>
      </div>
    </main>`;
  bindCommon();
  document.querySelector("[data-start]")?.addEventListener("click", () => room?.send("host", {
    type: "start_game",
    plateDifficulty: selectedPlateDifficulty,
    decisionSeconds: selectedDecisionSeconds,
    ...(selectedQuestionLevel === "all" ? {} : { questionLevel: selectedQuestionLevel }),
  }));
  document.querySelector("[data-reset]")?.addEventListener("click", () => room?.send("host", { type: "reset_game" }));
  document.querySelector<HTMLSelectElement>("[data-address]")?.addEventListener("change", (event) => {
    selectedAddress = (event.currentTarget as HTMLSelectElement).value;
    renderHost();
  });
  document.querySelector<HTMLSelectElement>("[data-plate-difficulty]")?.addEventListener("change", (event) => { selectedPlateDifficulty = (event.currentTarget as HTMLSelectElement).value as PlateDifficulty; });
  document.querySelector<HTMLSelectElement>("[data-decision-seconds]")?.addEventListener("change", (event) => { selectedDecisionSeconds = Number((event.currentTarget as HTMLSelectElement).value); });
  document.querySelector<HTMLSelectElement>("[data-question-level]")?.addEventListener("change", (event) => { selectedQuestionLevel = (event.currentTarget as HTMLSelectElement).value as "all" | QuestionLevel; });
  document.querySelector("[data-copy-url]")?.addEventListener("click", () => {
    if (joinUrl) void navigator.clipboard?.writeText(joinUrl);
    notice = "已複製加入網址。";
    renderHost();
  });
  void updateQr(joinUrl);
}

function hostLobbyStage(players: RoomSnapshot["players"], allReady: boolean): string {
  return `
    <div class="lobby-hero">
      <div class="eyebrow">CLASSROOM ELIMINATION RACE</div>
      <h1>Build the query.<br /><em>Stay on the track.</em></h1>
      <p>Choose the SQL token that completes the next step. Wrong plates collapse. Last runner standing wins.</p>
      <div class="flow-line"><span>SCAN</span><i></i><span>JOIN</span><i></i><span>READY</span><i></i><span>RUN</span></div>
      <div class="lobby-status ${allReady ? "ready" : ""}">
        <span class="pulse-ring"></span>
        <div><strong>${players.length === 0 ? "Waiting for runners" : allReady ? "Grid locked and ready" : "Runners are joining"}</strong><small>${players.length === 0 ? "Point phone cameras at the QR code" : `${players.filter((player) => player.ready).length} of ${players.length} ready`}</small></div>
      </div>
      <div class="demo-track" aria-hidden="true"><div class="demo-plate wrong">WHERE</div><div class="demo-plate correct">SELECT<span>✓</span></div><div class="runner-silhouette">▲</div></div>
    </div>`;
}

function hostRaceStage(): string {
  if (!snapshot) return loadingStage();
  if (snapshot.phase === "results") return resultsStage(true);
  const section = snapshot.section;
  const correctId = section?.correctPlateId;
  const active = snapshot.players.filter((player) => player.alive);
  const laneCount = section?.plates.length ?? 2;
  const schema = snapshot.mission?.schema.tables.map((table) => `${table.name} (${table.fields.map((field) => `${field.name}·${field.description}`).join(", ")})`).join(" + ") ?? "";
  return `
    <div class="race-stage">
      <div class="mission-card"><span class="question-badge level-${snapshot.mission?.level ?? "basic"}">${questionLevelLabel(snapshot.mission?.level)}</span><strong>${escapeHtml(snapshot.mission?.prompt ?? "準備開始")}</strong><div class="schema-chip">${escapeHtml(schema)}</div></div>
      <div class="query-strip"><span>CURRENT QUERY</span><code>${formatQuery(snapshot.completedTokens)}<b class="query-cursor">_</b></code></div>
      <div class="race-meta"><div><span>SECTION</span><strong>${snapshot.sectionNumber + 1}<small>/${snapshot.mission?.totalSteps ?? 0}</small></strong></div><div class="countdown-orb"><strong data-countdown>—</strong><span>${snapshot.phase === "choosing" ? "SECONDS" : phaseLabel(snapshot.phase)}</span></div><div><span>ALIVE</span><strong>${active.length}<small>/${snapshot.players.length}</small></strong></div></div>
      <div class="track-window phase-${snapshot.phase}">
        <div class="track-grid"></div><div class="vanish-line"></div>
        <div class="plates-row" style="--lane-count:${laneCount}">${(section?.plates ?? []).map((plate) => hostPlate(plate.id, plate.lane, plate.token.value, correctId)).join("")}</div>
        <div class="runner-row" style="--lane-count:${laneCount}">${active.map((player, index) => `<div class="runner" data-player-id="${escapeHtml(player.id)}" style="--runner-index:${index};left:${(player.x * 100).toFixed(2)}%;top:${(player.y * 100).toFixed(2)}%"><span>${initials(player.name)}</span><small>${escapeHtml(player.name)}</small></div>`).join("")}</div>
      </div>
      <div class="phase-caption">${phaseInstruction(snapshot.phase)}</div>
    </div>`;
}

function renderPlayer(): void {
  if (!room || !snapshot || !welcome) {
    if (connection === "connecting" || connection === "reconnecting") renderPlayerConnecting("Connecting to the starting grid…");
    else renderJoin();
    return;
  }
  const me = snapshot.players.find((player) => player.id === welcome?.playerId);
  if (!me) {
    renderPlayerConnecting("Restoring your runner…");
    return;
  }
  if (snapshot.phase === "lobby") renderPlayerLobby(me);
  else if (snapshot.phase === "results") renderPlayerResults(me);
  else renderPlayerGame(me);
}

function renderJoin(): void {
  const code = cleanCode(params.get("room") ?? "");
  app.innerHTML = `
    <main class="phone-shell join-screen">
      <div class="phone-brand"><span>SQL</span>RUN</div>
      <div class="join-art"><div class="track-lines"></div><div class="join-runner">▲</div><div class="join-plate">SELECT</div></div>
      <section class="phone-card">
        <div class="eyebrow">ENTER THE GRID</div><h1>Ready to run?</h1><p>Pick the next valid SQL token before the track falls away.</p>
        <form data-join-form>
          <label>YOUR NAME<input name="name" maxlength="18" autocomplete="nickname" placeholder="e.g. Alice" required /></label>
          <label>ROOM CODE<input name="roomCode" maxlength="5" value="${code}" placeholder="AB7K2" autocapitalize="characters" required /></label>
          <button class="primary-button" type="submit">JOIN RACE <span>→</span></button>
        </form>
        ${notice ? `<div class="phone-error">${escapeHtml(notice)}</div>` : ""}
      </section>
      <footer>Same Wi-Fi as the host · No app needed</footer>
    </main>`;
  document.querySelector<HTMLFormElement>("[data-join-form]")?.addEventListener("submit", (event) => void joinPlayer(event));
}

function renderPlayerConnecting(message: string): void {
  app.innerHTML = `<main class="phone-shell connecting-screen"><div class="phone-brand"><span>SQL</span>RUN</div><div class="loader"><i></i><i></i><i></i></div><h1>${escapeHtml(message)}</h1><p>Keep this screen open.</p></main>`;
}

function renderPlayerLobby(me: RoomSnapshot["players"][number]): void {
  app.innerHTML = `
    <main class="phone-shell player-lobby">
      <header class="phone-top"><div class="phone-brand"><span>SQL</span>RUN</div><div class="connection-pill" data-connection><span></span>${connectionLabel()}</div></header>
      ${notice ? `<button class="notice" data-dismiss-notice>${escapeHtml(notice)}<span>×</span></button>` : ""}
      <div class="runner-badge"><div>${initials(me.name)}</div><span>RUNNER</span></div>
      <h1>${escapeHtml(me.name)}</h1><p>You’re in room <strong>${snapshot?.roomCode}</strong></p>
      <section class="ready-card ${me.ready ? "is-ready" : ""}">
        <div class="ready-icon">${me.ready ? "✓" : "▲"}</div>
        <h2>${me.ready ? "Locked in!" : "Take your mark"}</h2>
        <p>${me.ready ? "Waiting for the host to start the race." : "Tap ready when you can see the host screen."}</p>
        <button class="primary-button" data-ready>${me.ready ? "NOT READY" : "I’M READY"}</button>
      </section>
      <div class="lobby-count"><strong>${snapshot?.players.length ?? 0}</strong><span>RUNNERS JOINED</span></div>
    </main>`;
  bindCommon();
  document.querySelector("[data-ready]")?.addEventListener("click", () => room?.send("player", { type: "set_ready", ready: !me.ready }));
}

function renderPlayerGame(me: RoomSnapshot["players"][number]): void {
  if (!snapshot) return;
  if (!me.alive) {
    app.innerHTML = `<main class="phone-shell fallen-screen"><header class="phone-top"><div class="phone-brand"><span>SQL</span>RUN</div><div class="connection-pill" data-connection><span></span>${connectionLabel()}</div></header><div class="fallen-mark">×</div><div class="eyebrow">PLATE COLLAPSED</div><h1>You fell.</h1><p>You cleared <strong>${me.survivedSteps}</strong> SQL step${me.survivedSteps === 1 ? "" : "s"}. Watch the host screen for the final order.</p><div class="query-recap"><span>QUERY BUILT</span><code>${formatQuery(snapshot.completedTokens)}</code></div></main>`;
    return;
  }
  const section = snapshot.section;
  const locked = snapshot.phase !== "choosing";
  const laneCount = section?.plates.length ?? 2;
  if (section?.id !== localSectionId) {
    localSectionId = section?.id ?? "";
    localPose = { x: me.x, y: me.y };
  }
  app.innerHTML = `
    <main class="phone-shell game-controller phase-${snapshot.phase}">
      <header class="phone-top"><div class="phone-brand"><span>SQL</span>RUN</div><div class="connection-pill" data-connection><span></span>${connectionLabel()}</div></header>
      <div class="mobile-mission"><span>MISSION</span><p>${escapeHtml(snapshot.mission?.prompt ?? "")}</p></div>
      <div class="mobile-query"><span>CURRENT SQL</span><code>${formatQuery(snapshot.completedTokens)} <b>_</b></code></div>
      <div class="mobile-timer"><strong data-countdown>—</strong><div><span>${phaseLabel(snapshot.phase)}</span><i></i></div></div>
      <div class="choice-prompt">${phaseInstruction(snapshot.phase)}</div>
      <div class="runner-control">
        <div class="phone-plates" style="--lane-count:${laneCount}">${(section?.plates ?? []).map((plate) => playerPlate(plate.id, plate.lane, plate.token.value, me.choice, section?.correctPlateId, locked)).join("")}</div>
        <div class="phone-runner" data-local-runner style="left:${(localPose.x * 100).toFixed(2)}%;top:${(localPose.y * 100).toFixed(2)}%"><span>${initials(me.name)}</span></div>
      </div>
      <div class="move-pad" aria-label="移動控制">
        <button class="move-up" data-move="up" aria-label="向上">▲</button>
        <button class="move-left" data-move="left" aria-label="向左">◀</button>
        <button class="move-down" data-move="down" aria-label="向下">▼</button>
        <button class="move-right" data-move="right" aria-label="向右">▶</button>
      </div>
      <div class="control-hint">使用方向鍵自由移動；走出地板邊界即淘汰</div>
    </main>`;
  bindMovementControls();
}

function renderPlayerResults(me: RoomSnapshot["players"][number]): void {
  if (!snapshot) return;
  const won = snapshot.winnerId === me.id;
  app.innerHTML = `<main class="phone-shell results-screen ${won ? "winner" : ""}"><div class="result-rays"></div><div class="phone-brand"><span>SQL</span>RUN</div><div class="result-rank">${won ? "★" : `#${me.finalRank ?? "—"}`}</div><div class="eyebrow">${won ? "QUERY CHAMPION" : "FINAL POSITION"}</div><h1>${won ? "You won!" : "Race complete"}</h1><p>${escapeHtml(me.name)} · ${me.survivedSteps} steps cleared</p><div class="query-recap"><span>FINAL QUERY</span><code>${formatQuery(snapshot.completedTokens)};</code></div><div class="waiting-host">Waiting for the host to open a new race…</div></main>`;
}

function resultsStage(host: boolean): string {
  if (!snapshot) return "";
  const winner = snapshot.players.find((player) => player.id === snapshot?.winnerId);
  return `<div class="host-results"><div class="eyebrow">RACE COMPLETE</div><div class="trophy">★</div><h1>${winner ? `${escapeHtml(winner.name)} wins!` : "Track cleared"}</h1><p class="result-sub">${winner ? `${winner.survivedSteps} SQL steps survived` : "No runner reached the safe plate."}</p><div class="final-query"><span>FINAL QUERY</span><code>${formatQuery(snapshot.completedTokens)};</code></div><div class="podium">${snapshot.players.slice(0, 5).map((player) => `<div class="podium-row rank-${player.finalRank}"><strong>${player.finalRank}</strong><span>${escapeHtml(player.name)}</span><small>${player.survivedSteps} steps</small></div>`).join("")}</div>${host ? "" : `<p>Waiting for the host…</p>`}</div>`;
}

async function joinPlayer(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  const form = new FormData(event.currentTarget as HTMLFormElement);
  const name = String(form.get("name") ?? "").trim().slice(0, 18);
  const roomCode = cleanCode(String(form.get("roomCode") ?? ""));
  if (!name || roomCode.length !== 5) {
    notice = "Enter your name and the 5-character room code.";
    renderJoin();
    return;
  }
  connection = "connecting";
  renderPlayerConnecting("Joining the starting grid…");
  try {
    const client = new ColyseusClient(endpoint);
    const roomId = params.get("rid");
    const joined = roomId ? await client.joinById(roomId, { name, roomCode }) : await client.joinOrCreate(ROOM_TYPE, { name, roomCode });
    history.replaceState(null, "", `/?room=${encodeURIComponent(roomCode)}&rid=${encodeURIComponent(joined.roomId)}`);
    connectRoom(joined);
  } catch (error) {
    connection = "offline";
    notice = friendlyError(error);
    renderJoin();
  }
}

function bindMovementControls(): void {
  document.querySelectorAll<HTMLButtonElement>("[data-move]").forEach((button) => {
    const direction = button.dataset.move as "up" | "down" | "left" | "right";
    const stop = (event: PointerEvent) => {
      event.preventDefault();
      movementDirections.delete(direction);
    };
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      movementDirections.add(direction);
    });
    button.addEventListener("pointerup", stop);
    button.addEventListener("pointercancel", stop);
    button.addEventListener("lostpointercapture", () => movementDirections.delete(direction));
  });
}

function keyDirection(code: string): "up" | "down" | "left" | "right" | null {
  if (code === "ArrowUp" || code === "KeyW") return "up";
  if (code === "ArrowDown" || code === "KeyS") return "down";
  if (code === "ArrowLeft" || code === "KeyA") return "left";
  if (code === "ArrowRight" || code === "KeyD") return "right";
  return null;
}

function tickMovement(now: number): void {
  const deltaSeconds = Math.min(.05, Math.max(0, (now - lastMovementFrame) / 1000));
  lastMovementFrame = now;
  const canMove = Boolean(room && snapshot?.section && ["prepare", "choosing"].includes(snapshot.phase) && movementDirections.size > 0);
  if (canMove) {
    let dx = (movementDirections.has("right") ? 1 : 0) - (movementDirections.has("left") ? 1 : 0);
    let dy = (movementDirections.has("down") ? 1 : 0) - (movementDirections.has("up") ? 1 : 0);
    const length = Math.hypot(dx, dy) || 1;
    dx /= length;
    dy /= length;
    localPose.x += dx * .55 * deltaSeconds;
    localPose.y += dy * .55 * deltaSeconds;
    updateLocalRunner();
    if (now - lastPoseSentAt >= 34 && snapshot?.section) {
      lastPoseSentAt = now;
      room?.send("player", { type: "move_pose", sectionId: snapshot.section.id, x: localPose.x, y: localPose.y, sequence: ++sequence, clientTime: Date.now() });
    }
    if (localPose.x < -.02 || localPose.x > 1.02 || localPose.y < -.02 || localPose.y > 1.02) movementDirections.clear();
  }
  requestAnimationFrame(tickMovement);
}

function applyPose(message: PoseMessage): void {
  const player = snapshot?.players.find((candidate) => candidate.id === message.playerId);
  if (!player) return;
  player.x = message.x;
  player.y = message.y;
  player.choice = message.lane;
}

function updateLocalRunner(): void {
  const runner = document.querySelector<HTMLElement>("[data-local-runner]");
  if (!runner) return;
  runner.style.left = `${(localPose.x * 100).toFixed(2)}%`;
  runner.style.top = `${(localPose.y * 100).toFixed(2)}%`;
}

function updateRunnerPosition(playerId: string, x: number, y: number): void {
  const runner = [...document.querySelectorAll<HTMLElement>("[data-player-id]")].find((candidate) => candidate.dataset.playerId === playerId);
  if (!runner) return;
  runner.style.left = `${(x * 100).toFixed(2)}%`;
  runner.style.top = `${(y * 100).toFixed(2)}%`;
}

function getJoinUrl(): string {
  if (!health || !selectedAddress || !room) return "";
  const publicPort = location.port === "5173" ? 5173 : health.port;
  const url = new URL(`http://${selectedAddress}:${publicPort}/`);
  url.searchParams.set("room", health.roomCode);
  url.searchParams.set("rid", room.roomId);
  return url.toString();
}

async function updateQr(url: string): Promise<void> {
  const image = document.querySelector<HTMLImageElement>("[data-qr]");
  if (!image || !url) return;
  const revision = ++qrRevision;
  const dataUrl = await QRCode.toDataURL(url, { width: 440, margin: 1, color: { dark: "#10162b", light: "#ffffff" }, errorCorrectionLevel: "M" });
  if (revision === qrRevision && document.contains(image)) image.src = dataUrl;
}

function hostPlate(id: string, lane: Lane, value: string, correctId?: string): string {
  const correct = correctId === id;
  const broken = snapshot?.phase === "breaking" && !correct;
  return `<div class="track-plate lane-${lane} ${correct ? "correct" : ""} ${broken ? "broken" : ""}"><span>${escapeHtml(value)}</span>${correct ? "<i>SAFE</i>" : ""}</div>`;
}

function playerPlate(id: string, lane: Lane, value: string, choice: Lane | null, correctId: string | undefined, _locked: boolean): string {
  const correct = correctId === id;
  const wrongReveal = Boolean(correctId) && !correct;
  return `<div class="phone-plate ${choice === lane ? "selected" : ""} ${correct ? "correct" : ""} ${wrongReveal ? "wrong" : ""}" data-lane="${lane}"><small>選項 ${lane + 1}</small><strong>${escapeHtml(value)}</strong><span>${correct ? "✓ 安全" : wrongReveal ? "× 崩塌" : choice === lane ? "你" : "選擇"}</span></div>`;
}

function hostSettingsPanel(): string {
  const options = (values: Array<[string, string]>, selected: string) => values.map(([value, label]) => `<option value="${value}" ${value === selected ? "selected" : ""}>${label}</option>`).join("");
  return `<div class="host-settings"><label>踏板難度<select data-plate-difficulty>${options([["easy","簡單 · 2"],["normal","普通 · 2–3"],["hard","困難 · 3–4"],["nightmare","惡夢 · 4–5"]], selectedPlateDifficulty)}</select></label><label>作答時間<select data-decision-seconds>${Array.from({ length: 9 }, (_, index) => { const value = String(index + 2); return `<option value="${value}" ${Number(value) === selectedDecisionSeconds ? "selected" : ""}>${value} 秒</option>`; }).join("")}</select></label><label>題目級別<select data-question-level>${options([["all","隨機混合"],["basic","基礎 · 綠"],["medium","中等 · 黃"],["hard","困難 · 紅"]], selectedQuestionLevel)}</select></label><a class="prototype-link" href="/prototype/index.html" target="_blank">開啟本機玩法測試</a></div>`;
}

function playerRow(player: RoomSnapshot["players"][number]): string {
  return `<div class="roster-row ${!player.connected ? "offline" : ""} ${!player.alive ? "eliminated" : ""}"><div class="avatar">${initials(player.name)}</div><div><strong>${escapeHtml(player.name)}</strong><small>${player.finalRank ? `#${player.finalRank} · ${player.survivedSteps} steps` : !player.connected ? "Reconnecting…" : player.ready ? "Ready to run" : "Getting ready"}</small></div><span class="status-mark">${player.finalRank ? player.finalRank : player.ready ? "✓" : "·"}</span></div>`;
}

function emptyRoster(): string {
  return `<div class="empty-roster"><div>＋</div><strong>No runners yet</strong><span>Scan the code to join</span></div>`;
}

function addressSelector(): string {
  if (!health || health.addresses.length <= 1) return "";
  return `<label class="address-select">JOIN NETWORK<select data-address>${health.addresses.map((address) => `<option ${address === selectedAddress ? "selected" : ""}>${address}</option>`).join("")}</select></label>`;
}

function bindCommon(): void {
  document.querySelector("[data-dismiss-notice]")?.addEventListener("click", () => { notice = ""; render(); });
  updateConnectionPills();
}

function sendPing(): void {
  if (room && connection === "connected") room.send("player", { type: "ping", clientTime: Date.now() });
}

function tickTimers(): void {
  const remaining = snapshot?.phaseEndsAt ? Math.max(0, snapshot.phaseEndsAt - (Date.now() + serverOffsetMs)) : 0;
  document.querySelectorAll<HTMLElement>("[data-countdown]").forEach((element) => {
    element.textContent = snapshot?.phase === "choosing" ? (remaining / 1000).toFixed(1) : phaseGlyph(snapshot?.phase);
  });
  document.documentElement.style.setProperty("--time-progress", snapshot?.phase === "choosing" ? String(Math.min(1, remaining / ((snapshot.settings.decisionSeconds || 5) * 1000))) : "0");
  requestAnimationFrame(tickTimers);
}

function updateConnectionPills(): void {
  document.querySelectorAll<HTMLElement>("[data-connection]").forEach((element) => {
    element.className = `connection-pill connection-${connection}`;
    element.innerHTML = `<span></span>${connectionLabel()}`;
  });
}

function connectionLabel(): string {
  if (connection === "connected") return pingMs === null ? "CONNECTED" : `${pingMs} MS`;
  if (connection === "reconnecting") return "RECONNECTING";
  if (connection === "connecting") return "CONNECTING";
  return "OFFLINE";
}

function phaseLabel(phase: RoomSnapshot["phase"]): string {
  return ({ lobby: "LOBBY", prepare: "NEXT SECTION", choosing: "CHOOSE NOW", locked: "CHOICES LOCKED", reveal: "ANSWER REVEALED", breaking: "TRACK BREAKING", eliminating: "RUNNERS FALLING", advance: "ADVANCING", results: "FINAL RESULTS", closed: "ROOM CLOSED" })[phase];
}

function phaseInstruction(phase: RoomSnapshot["phase"]): string {
  return ({ lobby: "Wait for the host", prepare: "Read the mission. New plates incoming.", choosing: "Move to the token that continues the query!", locked: "Movement locked — hold on.", reveal: "The safe route is revealed.", breaking: "Wrong plates are falling!", eliminating: "Updating the survivor order…", advance: "Track moving — next section ahead.", results: "Race complete", closed: "The host closed the room." })[phase];
}

function phaseGlyph(phase?: RoomSnapshot["phase"]): string {
  return phase === "locked" ? "◆" : phase === "reveal" ? "✓" : phase === "breaking" ? "⚡" : phase === "eliminating" ? "↓" : "·";
}

function questionLevelLabel(level?: QuestionLevel): string {
  return level === "hard" ? "困難" : level === "medium" ? "中等" : "基礎";
}

function formatQuery(tokens: RoomSnapshot["completedTokens"]): string {
  return tokens.length ? tokens.map((token) => escapeHtml(token.value)).join(" ") : "SELECT the safe path";
}

function cleanCode(value: string): string {
  return value.toUpperCase().replace(/[^A-Z2-9]/g, "").slice(0, 5);
}

function initials(name: string): string {
  return name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function storageKey(roomCode: string): string {
  return `sql-run.reconnect.${roomCode}`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" })[character] ?? character);
}

function friendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/fetch|network|connect|ECONNREFUSED/i.test(message)) return "Could not reach the host. Check Wi-Fi, the join address, and the host firewall.";
  return message.replace(/^Error:\s*/, "") || "Could not join this race.";
}

function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) throw new Error(`Server returned ${response.status}.`);
  return response.json() as Promise<T>;
}

function loadingStage(): string {
  return `<div class="stage-loading"><div class="loader"><i></i><i></i><i></i></div><p>Starting LAN room…</p></div>`;
}
