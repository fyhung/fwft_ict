import type { Direction, GameEvent, GameSnapshot, PlayerRecord, Role, RoomStatus } from "./types.ts";

export const ROOM_TYPE = "maze_chase";
export const SERVER_PORT = 2567;
export const MAX_PLAYERS = 30;

export interface LobbySnapshot {
  code: string;
  status: RoomStatus;
  roundId: number;
  maxPlayers: number;
  pacmanCount: number;
  livesPerPacman: number;
  roundDurationMs: number;
  players: Record<string, PlayerRecord>;
}

export interface RoundSettingsMessage {
  livesPerPacman: number;
  roundDurationMs: number;
}

export interface JoinMessage {
  name: string;
  colorId: string;
}

export interface PlayerStyleMessage {
  colorId?: string;
  cosmeticId?: string;
}

export interface AssignRoleMessage {
  playerId: string;
  role: Role;
}

export interface DirectionMessage {
  seq: number;
  direction: Direction;
  clientTime: number;
}

export interface PositionMessage {
  seq: number;
  x: number;
  y: number;
  direction: Direction;
  wantedDirection: Direction;
  clientTime: number;
}

export interface ResetMessage {
  keepTeams: boolean;
}

export interface PingMessage {
  id: number;
  clientTime: number;
}

export type NetworkSnapshot = Omit<GameSnapshot, "pellets" | "powerPellets"> & {
  pellets?: string[];
  powerPellets?: string[];
  removedPellets?: string[];
  removedPowerPellets?: string[];
};

export type ServerMessages = {
  lobby: LobbySnapshot;
  snapshot: NetworkSnapshot;
  gameEvent: GameEvent;
  joinResult: { ok: boolean; reason?: string };
  styleResult: { ok: boolean; reason?: string };
  error: { message: string };
  closed: { message: string };
  pong: PingMessage;
  correction: { roundId: number; actor: GameSnapshot["actors"][string] };
};
