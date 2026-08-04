import { randomBytes } from "node:crypto";
import { Room, type Client } from "@colyseus/core";
import { canActorOccupy, createInitialGame, stepGame, type EngineState } from "../src/engine.ts";
import { MAZE_WIDTH, TUNNEL_ROW } from "../src/maze.ts";
import { createNetworkSnapshot } from "../src/network.ts";
import { MAX_PLAYERS, type DirectionMessage, type JoinMessage, type LobbySnapshot, type PingMessage, type PositionMessage, type ResetMessage } from "../src/protocol.ts";
import type { Direction, GameSnapshot, InputState, PlayerRecord } from "../src/types.ts";

const ROOM_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const VALID_DIRECTIONS = new Set<Direction>(["up", "down", "left", "right", "none"]);
const MAX_CLIENT_MOVEMENT_SPEED = 7;
const MAX_POSITION_STEP = 0.75;

function roomCode() {
  return [...randomBytes(6)].map((value) => ROOM_ALPHABET[value % ROOM_ALPHABET.length]).join("");
}

function shuffled<T>(values: T[]): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = randomBytes(1)[0] % (index + 1);
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

export class MazeRoom extends Room {
  maxClients = MAX_PLAYERS + 1;
  maxMessagesPerSecond = 80;
  patchRate = null;
  autoDispose = true;

  private hostSessionId = "";
  private status: LobbySnapshot["status"] = "lobby";
  private roundId = 0;
  private pacmanCount = 1;
  private players: Record<string, PlayerRecord> = {};
  private inputs: Record<string, InputState> = {};
  private engine: EngineState | null = null;
  private accumulator = 0;
  private lastBroadcastPellets: Pick<GameSnapshot, "pellets" | "powerPellets"> | null = null;
  private lastClientPositionTime: Record<string, number> = {};

  onCreate() {
    this.roomId = roomCode();
    this.setSimulationInterval((deltaMs) => this.simulate(deltaMs), 1_000 / 60);
    this.clock.setInterval(() => this.broadcastGame(), 50);

    this.onMessage("sync", (client) => this.sendCurrentState(client));
    this.onMessage<JoinMessage>("join", (client, message) => this.joinPlayer(client, message));
    this.onMessage<boolean>("ready", (client, ready) => this.setReady(client, ready));
    this.onMessage<DirectionMessage>("direction", (client, message) => this.setDirection(client, message));
    this.onMessage<PositionMessage>("position", (client, message) => this.setPosition(client, message));
    this.onMessage<number>("pacmanCount", (client, count) => this.setPacmanCount(client, count));
    this.onMessage("randomize", (client) => this.randomizeRoles(client));
    this.onMessage("start", (client) => this.startRound(client));
    this.onMessage<ResetMessage>("reset", (client, message) => this.resetRound(client, Boolean(message?.keepTeams)));
    this.onMessage<PingMessage>("ping", (client, message) => {
      if (Number.isFinite(message?.id) && Number.isFinite(message?.clientTime)) client.send("pong", message);
    });
    this.onMessage("close", (client) => this.closeRoom(client));
  }

  onJoin(client: Client, options: { mode?: string } = {}) {
    if (options.mode === "host" && !this.hostSessionId) {
      this.hostSessionId = client.sessionId;
    } else if (!this.hostSessionId) {
      client.send("error", { message: "The host has not opened this room yet." });
    }
    this.sendCurrentState(client);
  }

  onLeave(client: Client) {
    if (client.sessionId === this.hostSessionId) {
      void this.disconnect();
      return;
    }
    const player = this.players[client.sessionId];
    if (!player) return;
    player.presence.online = false;
    player.presence.lastSeenAt = Date.now();
    this.inputs[client.sessionId] = {
      seq: Math.max(this.inputs[client.sessionId]?.seq ?? 0, this.engine?.snapshot.actors[client.sessionId]?.lastInputSeq ?? 0) + 1,
      direction: "none",
      clientTime: Date.now(),
    };
    delete this.lastClientPositionTime[client.sessionId];
    this.broadcastLobby();
  }

  private isHost(client: Client) {
    return client.sessionId === this.hostSessionId;
  }

  private lobbySnapshot(): LobbySnapshot {
    return {
      code: this.roomId,
      status: this.status,
      roundId: this.roundId,
      maxPlayers: MAX_PLAYERS,
      pacmanCount: this.pacmanCount,
      players: structuredClone(this.players),
    };
  }

  private sendCurrentState(client: Client) {
    client.send("lobby", this.lobbySnapshot());
    if (this.engine) client.send("snapshot", createNetworkSnapshot(structuredClone(this.engine.snapshot), null));
  }

  private broadcastLobby() {
    this.broadcast("lobby", this.lobbySnapshot());
  }

  private joinPlayer(client: Client, message: JoinMessage) {
    if (this.status !== "lobby") return client.send("joinResult", { ok: false, reason: "The game has already started." });
    if (this.players[client.sessionId]) return client.send("joinResult", { ok: true });
    if (Object.keys(this.players).length >= MAX_PLAYERS) return client.send("joinResult", { ok: false, reason: "The room is full." });
    const name = typeof message?.name === "string" ? message.name.trim().slice(0, 16) : "";
    const colorId = typeof message?.colorId === "string" ? message.colorId : "";
    if (!name) return client.send("joinResult", { ok: false, reason: "Enter a name." });
    if (!/^c(?:0\d|[1-5]\d|6[0-3])$/.test(colorId)) {
      return client.send("joinResult", { ok: false, reason: "Choose a valid color." });
    }
    if (Object.values(this.players).some((player) => player.profile.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      return client.send("joinResult", { ok: false, reason: "That name is already in use." });
    }
    if (Object.values(this.players).some((player) => player.profile.colorId === colorId)) {
      return client.send("joinResult", { ok: false, reason: "That color was just taken." });
    }
    const usedSeats = new Set(Object.values(this.players).map((player) => player.seatId));
    const seatId = Array.from({ length: MAX_PLAYERS }, (_, index) => `s${String(index).padStart(2, "0")}`).find(
      (candidate) => !usedSeats.has(candidate),
    );
    if (!seatId) return client.send("joinResult", { ok: false, reason: "The room is full." });
    this.players[client.sessionId] = {
      seatId,
      profile: { name, colorId },
      presence: { online: true, lastSeenAt: Date.now() },
      lobby: { ready: false, joinedAt: Date.now() },
    };
    client.send("joinResult", { ok: true });
    this.broadcastLobby();
  }

  private setReady(client: Client, ready: boolean) {
    const player = this.players[client.sessionId];
    if (!player || this.status !== "lobby") return;
    player.lobby.ready = Boolean(ready);
    this.broadcastLobby();
  }

  private setDirection(client: Client, message: DirectionMessage) {
    if (!this.players[client.sessionId] || this.status !== "playing") return;
    if (!Number.isFinite(message?.seq) || !VALID_DIRECTIONS.has(message?.direction)) return;
    const previous = this.inputs[client.sessionId];
    if (previous && message.seq <= previous.seq) return;
    this.inputs[client.sessionId] = {
      seq: Math.floor(message.seq),
      direction: message.direction,
      clientTime: Number.isFinite(message.clientTime) ? message.clientTime : Date.now(),
    };
    const actor = this.engine?.snapshot.actors[client.sessionId];
    if (actor) {
      actor.wantedDirection = message.direction;
      actor.lastInputSeq = Math.floor(message.seq);
    }
  }

  private sendCorrection(client: Client) {
    const actor = this.engine?.snapshot.actors[client.sessionId];
    if (actor) client.send("correction", { roundId: this.engine!.snapshot.roundId, actor: structuredClone(actor) });
  }

  private setPosition(client: Client, message: PositionMessage) {
    const actor = this.engine?.snapshot.actors[client.sessionId];
    if (!actor || this.status !== "playing") return;
    if (
      !Number.isFinite(message?.x) ||
      !Number.isFinite(message?.y) ||
      !Number.isFinite(message?.seq) ||
      !Number.isFinite(message?.clientTime) ||
      !VALID_DIRECTIONS.has(message?.direction) ||
      !VALID_DIRECTIONS.has(message?.wantedDirection)
    ) return this.sendCorrection(client);
    if (actor.state === "dead" || actor.state === "eaten") return this.sendCorrection(client);
    if (!canActorOccupy(this.engine!.maze, message.x, message.y)) return this.sendCorrection(client);

    const previousClientTime = this.lastClientPositionTime[client.sessionId];
    if (previousClientTime !== undefined && message.clientTime <= previousClientTime) return this.sendCorrection(client);
    const elapsed = previousClientTime === undefined
      ? 1 / 30
      : Math.max(1 / 120, Math.min(0.2, (message.clientTime - previousClientTime) / 1_000));
    let deltaX = Math.abs(message.x - actor.x);
    const deltaY = Math.abs(message.y - actor.y);
    if (Math.abs(actor.y - TUNNEL_ROW) < 0.6 && Math.abs(message.y - TUNNEL_ROW) < 0.6) {
      deltaX = Math.min(deltaX, Math.abs(deltaX - MAZE_WIDTH));
    }
    const allowedDistance = Math.min(MAX_POSITION_STEP, 0.12 + MAX_CLIENT_MOVEMENT_SPEED * elapsed);
    if (deltaX * deltaX + deltaY * deltaY > allowedDistance * allowedDistance) return this.sendCorrection(client);

    actor.x = message.x;
    actor.y = message.y;
    actor.direction = message.direction;
    actor.wantedDirection = message.wantedDirection;
    actor.lastInputSeq = Math.max(actor.lastInputSeq, Math.floor(message.seq));
    this.lastClientPositionTime[client.sessionId] = message.clientTime;
  }

  private setPacmanCount(client: Client, count: number) {
    if (!this.isHost(client) || this.status !== "lobby") return;
    const playerCount = Object.keys(this.players).length;
    this.pacmanCount = Math.max(1, Math.min(Math.max(1, playerCount - 1), Math.round(Number(count) || 1)));
    this.broadcastLobby();
  }

  private randomizeRoles(client: Client) {
    if (!this.isHost(client) || this.status !== "lobby") return;
    const uids = shuffled(Object.keys(this.players));
    if (uids.length < 2) return;
    this.pacmanCount = Math.max(1, Math.min(uids.length - 1, this.pacmanCount));
    uids.forEach((uid, index) => {
      this.players[uid].assignment = {
        role: index < this.pacmanCount ? "pacman" : "ghost",
        spawnId: `${index < this.pacmanCount ? "p" : "g"}${String(index < this.pacmanCount ? index : index - this.pacmanCount).padStart(2, "0")}`,
      };
    });
    this.broadcastLobby();
  }

  private startRound(client: Client) {
    if (!this.isHost(client) || this.status !== "lobby") return;
    const players = Object.values(this.players);
    const assignedPacmen = players.filter((player) => player.assignment?.role === "pacman").length;
    const canStart =
      players.length >= 2 &&
      players.every((player) => player.presence.online && player.lobby.ready && player.assignment) &&
      assignedPacmen === this.pacmanCount;
    if (!canStart) return client.send("error", { message: "Every player must be online, ready, and assigned before starting." });
    this.engine = createInitialGame(this.players, Date.now(), 5 * 60_000, this.roundId);
    this.inputs = {};
    this.accumulator = 0;
    this.lastBroadcastPellets = null;
    this.lastClientPositionTime = {};
    this.status = "playing";
    this.broadcastLobby();
    this.broadcastGame(true);
  }

  private resetRound(client: Client, keepTeams: boolean) {
    if (!this.isHost(client) || this.status !== "results") return;
    this.roundId += 1;
    this.status = "lobby";
    this.engine = null;
    this.inputs = {};
    this.lastBroadcastPellets = null;
    this.lastClientPositionTime = {};
    Object.values(this.players).forEach((player) => {
      player.lobby.ready = false;
      if (!keepTeams) delete player.assignment;
    });
    this.broadcastLobby();
  }

  private closeRoom(client: Client) {
    if (!this.isHost(client)) return;
    this.status = "closed";
    this.broadcast("closed", { message: "The host closed the room." });
    void this.disconnect();
  }

  private simulate(deltaMs: number) {
    if (!this.engine || this.status !== "playing") return;
    this.accumulator += Math.min(100, deltaMs) / 1_000;
    while (this.accumulator >= 1 / 60 && this.engine.snapshot.status === "playing") {
      stepGame(this.engine, this.inputs, 1 / 60, Date.now(), false);
      this.accumulator -= 1 / 60;
    }
    if (this.engine.snapshot.status === "results") {
      this.status = "results";
      this.broadcastLobby();
      this.broadcastGame(true);
    }
  }

  private broadcastGame(force = false) {
    if (!this.engine || (this.status !== "playing" && this.status !== "results")) return;
    if (force || this.engine.snapshot.tick > 0) {
      const snapshot = structuredClone(this.engine.snapshot);
      this.broadcast("snapshot", createNetworkSnapshot(snapshot, force ? null : this.lastBroadcastPellets));
      this.lastBroadcastPellets = {
        pellets: [...snapshot.pellets],
        powerPellets: [...snapshot.powerPellets],
      };
    }
  }
}
