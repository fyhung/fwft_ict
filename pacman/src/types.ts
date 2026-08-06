import type { CosmeticId } from "./cosmetics.ts";

export type Direction = "up" | "down" | "left" | "right" | "none";
export type Role = "pacman" | "ghost";
export type RoomStatus = "lobby" | "countdown" | "playing" | "paused" | "results" | "closed";
export type ActorState = "normal" | "frightened" | "eaten" | "dead" | "invulnerable";
export type FruitKind = "cherry" | "strawberry";
export type GameEventType =
  | "round-start"
  | "pellet"
  | "power-pellet"
  | "fruit-eaten"
  | "ghost-eaten"
  | "pacman-death"
  | "extra-life"
  | "round-end";

export interface BonusFruit {
  id: number;
  kind: FruitKind;
  x: number;
  y: number;
  value: number;
  expiresAt: number;
}

export interface GameEvent {
  id: number;
  roundId: number;
  type: GameEventType;
  at: number;
  actorId?: string;
  targetId?: string;
  value?: number;
}

export interface PlayerRecord {
  seatId: string;
  profile: {
    name: string;
    colorId: string;
    cosmeticId: CosmeticId | "";
  };
  presence: {
    online: boolean;
    lastSeenAt: number | object;
  };
  lobby: {
    ready: boolean;
    joinedAt: number | object;
  };
  assignment?: {
    role: Role;
    spawnId: string;
  };
}

export interface JoinRequest {
  name: string;
  colorId: string;
  requestedAt: number | object;
}

export interface Admission {
  status: "granted" | "rejected";
  reason: string | null;
  seatId: string | null;
}

export interface InputState {
  seq: number;
  direction: Direction;
  clientTime: number;
}

export interface Actor {
  uid: string;
  name: string;
  colorId: string;
  cosmeticId: CosmeticId;
  role: Role;
  x: number;
  y: number;
  spawnX: number;
  spawnY: number;
  direction: Direction;
  wantedDirection: Direction;
  lastInputSeq: number;
  state: ActorState;
  respawnAt: number;
  invulnerableUntil: number;
  score: number;
  kills: number;
  ghostsEaten: number;
  fruitsEaten: number;
  pellets: number;
}

export interface GameSnapshot {
  roundId: number;
  tick: number;
  hostTime: number;
  roundStartedAt: number;
  status: "playing" | "results";
  actors: Record<string, Actor>;
  pellets: string[];
  powerPellets: string[];
  fruit: BonusFruit | null;
  fruitWave: number;
  frightenedUntil: number;
  ghostChain: number;
  pacmanLives: number;
  pacmanScore: number;
  ghostScore: number;
  extraLifeAwarded: boolean;
  winner: Role | null;
  resultReason: string | null;
  roundEndsAt: number;
}

export interface RoomData {
  meta: {
    hostUid: string;
    status: RoomStatus;
    createdAt: number | object;
    roundId: number;
    joinLocked: boolean;
    clientVersion: string;
  };
  config: {
    maxPlayers: number;
    pacmanCount: number;
    roundDurationMs: number;
    mapId: string;
  };
  players?: Record<string, PlayerRecord>;
  joinRequests?: Record<string, JoinRequest>;
  admissions?: Record<string, Admission>;
  seats?: Record<string, string>;
  colorClaims?: Record<string, string>;
  inputs?: Record<string, InputState>;
  authoritative?: GameSnapshot;
}
