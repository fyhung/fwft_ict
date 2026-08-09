import { Client, Room } from "@colyseus/core";
import { APP_VERSION, isLane, MAX_PLAYERS, type ErrorMessage, type HostCommand, type PlayerMessage, type PoseMessage, type RoomSnapshot, type WelcomeMessage } from "../src/protocol";
import { RaceEngine } from "./game/raceEngine";

interface RoomOptions {
  roomCode?: string;
  hostToken?: string;
  role?: string;
  name?: string;
}

export class SqlRunRoom extends Room {
  maxClients = MAX_PLAYERS + 1;
  private engine = new RaceEngine();
  private roomCode = "-----";
  private hostToken = "";
  private hostClientId: string | null = null;
  private lastSequence = new Map<string, number>();
  private lastActionAt = new Map<string, number>();
  private lastPoseSequence = new Map<string, number>();
  private lastPoseAt = new Map<string, number>();
  private decisionMs = 5000;

  onCreate(options: RoomOptions): void {
    this.roomCode = cleanRoomCode(options.roomCode);
    this.hostToken = typeof options.hostToken === "string" ? options.hostToken : "";
    this.autoDispose = false;
    this.onMessage("player", (client, message: PlayerMessage) => this.handlePlayerMessage(client, message));
    this.onMessage("host", (client, message: HostCommand) => this.handleHostCommand(client, message));
    this.onMessage("sync", (client) => {
      const isHost = client.sessionId === this.hostClientId;
      client.send("welcome", { playerId: isHost ? null : client.sessionId, isHost, roomCode: this.roomCode } satisfies WelcomeMessage);
      client.send("snapshot", this.snapshotFor(client));
    });
  }

  onJoin(client: Client, options: RoomOptions): void {
    const isHost = options.role === "host" && this.hostToken.length > 0 && options.hostToken === this.hostToken;
    if (isHost) {
      if (this.hostClientId && this.hostClientId !== client.sessionId) throw new Error("A host is already connected.");
      this.hostClientId = client.sessionId;
      return;
    }

    if (this.engine.phase !== "lobby") throw new Error("This race is already running.");
    const name = cleanPlayerName(options.name);
    if (!name) throw new Error("Enter a name between 1 and 18 characters.");
    if ([...this.engine.players.values()].some((player) => player.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      throw new Error("That name is already in the room.");
    }
    const player = this.engine.addPlayer(client.sessionId, name);
    player.connected = true;
    this.sendSnapshots(client.sessionId);
  }

  async onLeave(client: Client, consented?: boolean): Promise<void> {
    if (client.sessionId === this.hostClientId) {
      this.hostClientId = null;
      return;
    }
    const player = this.engine.players.get(client.sessionId);
    if (!player) return;
    player.connected = false;
    this.sendSnapshots();
    if (!consented) {
      try {
        await this.allowReconnection(client, 45);
        player.connected = true;
        this.sendSnapshots();
        return;
      } catch {
        // Reconnection window expired; cleanup depends on the current phase.
      }
    }
    if (this.engine.phase === "lobby") this.engine.removePlayer(client.sessionId);
    this.sendSnapshots();
  }

  onDispose(): void {
    this.engine.phase = "closed";
    this.clock.clear();
  }

  private handlePlayerMessage(client: Client, message: PlayerMessage): void {
    const player = this.engine.players.get(client.sessionId);
    if (!player || !message || typeof message !== "object") return;
    if (message.type === "set_ready") {
      if (this.engine.phase !== "lobby" || typeof message.ready !== "boolean") return;
      player.ready = message.ready;
      this.sendSnapshots();
      return;
    }
    if (message.type === "ping" && Number.isFinite(message.clientTime)) {
      client.send("pong", { clientTime: message.clientTime, serverTime: Date.now() });
      return;
    }
    if (message.type === "move_pose") {
      this.handlePose(client, message);
      return;
    }
    if (message.type !== "choose_plate") return;
    const now = Date.now();
    const previousSequence = this.lastSequence.get(client.sessionId) ?? -1;
    const previousActionAt = this.lastActionAt.get(client.sessionId) ?? 0;
    if (!Number.isInteger(message.sequence) || message.sequence <= previousSequence || !Number.isFinite(message.clientTime)) return;
    if (!isLane(message.lane) || typeof message.sectionId !== "string" || message.sectionId.length > 48) return;
    if (now - previousActionAt < 70) return;
    this.lastSequence.set(client.sessionId, message.sequence);
    this.lastActionAt.set(client.sessionId, now);
    if (!this.engine.choose(client.sessionId, message.sectionId, message.lane, now)) {
      this.sendError(client, "CHOICE_REJECTED", "That plate can no longer be selected.");
      return;
    }
    this.sendSnapshots();
  }

  private handlePose(client: Client, message: Extract<PlayerMessage, { type: "move_pose" }>): void {
    const player = this.engine.players.get(client.sessionId);
    if (!player || !player.alive || typeof message.sectionId !== "string" || message.sectionId.length > 48) return;
    if (![message.x, message.y, message.clientTime].every(Number.isFinite) || !Number.isInteger(message.sequence)) return;
    if (message.x < -.2 || message.x > 1.2 || message.y < -.2 || message.y > 1.2) return this.correctPose(client);

    const now = Date.now();
    const previousSequence = this.lastPoseSequence.get(client.sessionId) ?? -1;
    const previousAt = this.lastPoseAt.get(client.sessionId) ?? 0;
    if (message.sequence <= previousSequence || (previousAt > 0 && now - previousAt < 24)) return;

    const elapsedSeconds = previousAt > 0 ? Math.min(.25, (now - previousAt) / 1000) : .1;
    const distance = Math.hypot(message.x - player.x, message.y - player.y);
    const maximumDistance = .9 * elapsedSeconds + .045;
    if (distance > maximumDistance) return this.correctPose(client);

    this.lastPoseSequence.set(client.sessionId, message.sequence);
    this.lastPoseAt.set(client.sessionId, now);
    const result = this.engine.move(client.sessionId, message.sectionId, message.x, message.y, now);
    if (result === "rejected") return this.correctPose(client);
    if (result === "fell") {
      this.sendSnapshots();
      return;
    }
    const pose = { playerId: player.id, x: player.x, y: player.y, lane: player.choice } satisfies PoseMessage;
    const host = this.clients.find((candidate) => candidate.sessionId === this.hostClientId);
    host?.send("pose", pose);
  }

  private correctPose(client: Client): void {
    const player = this.engine.players.get(client.sessionId);
    if (!player) return;
    client.send("pose_correction", { playerId: player.id, x: player.x, y: player.y, lane: player.choice } satisfies PoseMessage);
  }

  private handleHostCommand(client: Client, command: HostCommand): void {
    if (client.sessionId !== this.hostClientId) {
      this.sendError(client, "HOST_ONLY", "Only the local host can control the race.");
      return;
    }
    if (!command || typeof command !== "object") return;
    if (command.type === "start_game") {
      if (this.engine.phase !== "lobby") return;
      const connected = [...this.engine.players.values()].filter((player) => player.connected);
      if (connected.length === 0) return this.sendError(client, "NO_PLAYERS", "At least one player must join.");
      if (connected.some((player) => !player.ready)) return this.sendError(client, "NOT_READY", "Every connected player must be ready.");
      for (const player of [...this.engine.players.values()]) if (!player.connected) this.engine.removePlayer(player.id);
      const decisionSeconds = Number.isFinite(command.decisionSeconds) ? Math.max(2, Math.min(10, Math.round(command.decisionSeconds ?? 5))) : 5;
      const plateDifficulty = ["easy", "normal", "hard", "nightmare"].includes(command.plateDifficulty ?? "") ? command.plateDifficulty : "normal";
      const questionLevel = ["basic", "medium", "hard"].includes(command.questionLevel ?? "") ? command.questionLevel : undefined;
      this.decisionMs = decisionSeconds * 1000;
      this.engine.start(Date.now(), undefined, { plateDifficulty, decisionSeconds, ...(questionLevel ? { questionLevel } : {}) });
      this.sendSnapshots();
      this.scheduleChoosing();
      return;
    }
    if (command.type === "reset_game") {
      this.clock.clear();
      this.lastPoseSequence.clear();
      this.lastPoseAt.clear();
      this.engine.reset();
      this.sendSnapshots();
      return;
    }
    if (command.type === "close_room") {
      this.engine.phase = "closed";
      this.sendSnapshots();
      this.disconnect();
    }
  }

  private scheduleChoosing(): void {
    this.clock.setTimeout(() => {
      this.engine.beginChoosing(Date.now(), this.decisionMs);
      this.sendSnapshots();
      this.clock.setTimeout(() => this.scheduleLock(), this.decisionMs);
    }, 900);
  }

  private scheduleLock(): void {
    this.engine.lock();
    this.sendSnapshots();
    this.clock.setTimeout(() => {
      this.engine.reveal();
      this.sendSnapshots();
      this.clock.setTimeout(() => {
        this.engine.breakPlates();
        this.sendSnapshots();
        this.clock.setTimeout(() => {
          this.engine.eliminate();
          this.sendSnapshots();
          this.clock.setTimeout(() => {
            const result = this.engine.advance();
            this.sendSnapshots();
            if (result === "next") this.scheduleChoosing();
          }, 1100);
        }, 700);
      }, 1000);
    }, 350);
  }

  private sendSnapshots(exceptClientId?: string): void {
    for (const client of this.clients) {
      if (client.sessionId !== exceptClientId) client.send("snapshot", this.snapshotFor(client));
    }
  }

  private snapshotFor(client: Client): RoomSnapshot {
    const isHost = client.sessionId === this.hostClientId;
    const choosing = this.engine.phase === "choosing";
    const players = [...this.engine.players.values()]
      .map((player) => ({
        id: player.id,
        name: player.name,
        connected: player.connected,
        ready: player.ready,
        alive: player.alive,
        choice: isHost || player.id === client.sessionId || !choosing ? player.choice : null,
        survivedSteps: player.survivedSteps,
        averageReactionMs: player.averageReactionMs,
        finalRank: player.finalRank,
        x: player.x,
        y: player.y,
      }))
      .sort((a, b) => (a.finalRank ?? 999) - (b.finalRank ?? 999) || a.name.localeCompare(b.name));
    return {
      version: APP_VERSION,
      roomCode: this.roomCode,
      phase: this.engine.phase,
      phaseEndsAt: this.engine.phaseEndsAt,
      serverTime: Date.now(),
      sectionNumber: this.engine.sectionNumber,
      completedTokens: this.engine.completedTokens,
      mission: this.engine.getMissionView(),
      section: this.engine.getPublicSection(),
      players,
      winnerId: this.engine.winnerId,
      settings: {
        plateDifficulty: this.engine.settings.plateDifficulty,
        decisionSeconds: this.engine.settings.decisionSeconds,
      },
    };
  }

  private sendError(client: Client, code: string, message: string): void {
    client.send("game_error", { code, message } satisfies ErrorMessage);
  }
}

function cleanRoomCode(value: unknown): string {
  return typeof value === "string" && /^[A-Z2-9]{5}$/.test(value) ? value : "-----";
}

function cleanPlayerName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[<>\u0000-\u001f]/g, "").replace(/\s+/g, " ").trim().slice(0, 18);
  return cleaned.length > 0 ? cleaned : null;
}
