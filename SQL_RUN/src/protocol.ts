export const APP_VERSION = "1.0.1";
export const ROOM_TYPE = "sql_run";
export const MAX_PLAYERS = 30;

export type RoomPhase =
  | "lobby"
  | "prepare"
  | "choosing"
  | "locked"
  | "reveal"
  | "breaking"
  | "eliminating"
  | "advance"
  | "results"
  | "closed";

export type Lane = number;
export type TokenKind = "keyword" | "field" | "expression" | "table" | "operator" | "value";
export type PlateDifficulty = "easy" | "normal" | "hard" | "nightmare";
export type QuestionLevel = "basic" | "medium" | "hard";

export interface SqlToken {
  kind: TokenKind;
  value: string;
}

export interface PlateView {
  id: string;
  lane: Lane;
  token: SqlToken;
}

export interface SectionView {
  id: string;
  index: number;
  plates: PlateView[];
  correctPlateId?: string;
}

export interface PlayerView {
  id: string;
  name: string;
  connected: boolean;
  ready: boolean;
  alive: boolean;
  choice: Lane | null;
  survivedSteps: number;
  averageReactionMs: number | null;
  finalRank: number | null;
  x: number;
  y: number;
  mistakes: Array<{
    sectionIndex: number;
    chosen: SqlToken | null;
    correct: SqlToken;
  }>;
}

export interface MissionView {
  id: string;
  prompt: string;
  level: QuestionLevel;
  schema: {
    tables: Array<{
      name: string;
      fields: Array<{ name: string; description: string }>;
    }>;
  };
  totalSteps: number;
}

export interface RoomSnapshot {
  version: string;
  roomCode: string;
  phase: RoomPhase;
  phaseEndsAt: number | null;
  serverTime: number;
  sectionNumber: number;
  completedTokens: SqlToken[];
  mission: MissionView | null;
  section: SectionView | null;
  players: PlayerView[];
  winnerId: string | null;
  correctTokens: SqlToken[] | null;
  settings: {
    plateDifficulty: PlateDifficulty;
    decisionSeconds: number;
  };
}

export interface WelcomeMessage {
  playerId: string | null;
  isHost: boolean;
  roomCode: string;
}

export interface ErrorMessage {
  code: string;
  message: string;
}

export interface HealthResponse {
  ok: boolean;
  version: string;
  port: number;
  addresses: string[];
  publicUrl: string;
  roomCode: string;
}

export type PlayerMessage =
  | { type: "set_ready"; ready: boolean }
  | { type: "choose_plate"; sectionId: string; lane: Lane; sequence: number; clientTime: number }
  | { type: "move_pose"; sectionId: string; x: number; y: number; sequence: number; clientTime: number }
  | { type: "ping"; clientTime: number };

export interface PoseMessage {
  playerId: string;
  x: number;
  y: number;
  lane: Lane | null;
}

export type HostCommand =
  | { type: "start_game"; plateDifficulty?: PlateDifficulty; decisionSeconds?: number; questionLevel?: QuestionLevel }
  | { type: "refresh_question"; questionLevel: QuestionLevel }
  | { type: "reset_game" }
  | { type: "close_room" };

export const isLane = (value: unknown): value is Lane => Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 4;
