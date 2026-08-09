import type { Lane, PlateDifficulty, PlateView, PlayerView, QuestionLevel, RoomPhase, SectionView, SqlToken, TokenKind } from "../../src/protocol";
import { databaseDictionary, missionView, missions, type Mission } from "./missions";
import { validateMissionTokens } from "./sqlGrammar";

export interface RacePlayer extends PlayerView {
  reactions: number[];
  chosenAt: number | null;
}

const DISTRACTORS: Record<TokenKind, string[]> = {
  keyword: ["SELECT", "DISTINCT", "FROM", "WHERE", "INNER JOIN", "ON", "GROUP BY", "HAVING", "ORDER BY", "ASC", "DESC"],
  field: ["*", ...new Set(Object.values(databaseDictionary).flatMap((fields) => fields.map((field) => field[0]))), ...Object.entries(databaseDictionary).flatMap(([table, fields]) => fields.map((field) => `${table}.${field[0]}`))],
  expression: ["COUNT(*)", "AVG(MaxQuota)", "MAX(CNO)", "MIN(Pref)", "SUM(MaxQuota)", "CLS, COUNT(*)", "EID, COUNT(*)", "AYEAR, COUNT(*)", "EID, AVG(Pref)", "STD.SName, ENROLL.EID", "ELE.ENAME, ENROLL.SID"],
  table: Object.keys(databaseDictionary),
  operator: ["=", "!=", ">", "<", ">=", "<="],
  value: ["1", "2", "3", "5", "10", "20", "25", "30", "'1A'", "'2B'", "'ICT1'", "'2025-2026'"],
};

const LANE_RANGES: Record<PlateDifficulty, [number, number]> = {
  easy: [2, 2], normal: [2, 3], hard: [3, 4], nightmare: [4, 5],
};

export interface RaceSettings {
  plateDifficulty: PlateDifficulty;
  decisionSeconds: number;
  questionLevel?: QuestionLevel;
}

export class RaceEngine {
  phase: RoomPhase = "lobby";
  phaseEndsAt: number | null = null;
  mission: Mission | null = null;
  section: (SectionView & { correctPlateId: string }) | null = null;
  sectionNumber = 0;
  completedTokens: SqlToken[] = [];
  winnerId: string | null = null;
  choosingStartedAt: number | null = null;
  settings: RaceSettings = { plateDifficulty: "normal", decisionSeconds: 5 };
  readonly players = new Map<string, RacePlayer>();

  constructor(private readonly random: () => number = Math.random) {
    for (const mission of missions) {
      if (!validateMissionTokens(mission.tokens)) throw new Error(`Invalid SQL mission: ${mission.id}`);
    }
  }

  addPlayer(id: string, name: string): RacePlayer {
    const player: RacePlayer = {
      id,
      name,
      connected: true,
      ready: false,
      alive: true,
      choice: null,
      survivedSteps: 0,
      averageReactionMs: null,
      finalRank: null,
      reactions: [],
      chosenAt: null,
      x: .5,
      y: .72,
    };
    this.players.set(id, player);
    return player;
  }

  removePlayer(id: string): void {
    this.players.delete(id);
  }

  start(now = Date.now(), missionIndex?: number, settings: Partial<RaceSettings> = {}): void {
    if (this.players.size === 0) throw new Error("At least one player is required.");
    const plateDifficulty = settings.plateDifficulty && LANE_RANGES[settings.plateDifficulty] ? settings.plateDifficulty : "normal";
    const decisionSeconds = Math.max(2, Math.min(10, Math.round(settings.decisionSeconds ?? 5)));
    this.settings = { plateDifficulty, decisionSeconds, ...(settings.questionLevel ? { questionLevel: settings.questionLevel } : {}) };
    const candidates = settings.questionLevel ? missions.filter((mission) => mission.level === settings.questionLevel) : missions;
    const index = missionIndex ?? Math.floor(this.random() * candidates.length);
    this.mission = candidates[index % candidates.length] ?? candidates[0] ?? null;
    if (!this.mission) throw new Error("No SQL missions are available.");
    this.sectionNumber = 0;
    this.completedTokens = [];
    this.winnerId = null;
    this.choosingStartedAt = null;
    for (const player of this.players.values()) {
      Object.assign(player, {
        alive: true,
        choice: null,
        survivedSteps: 0,
        averageReactionMs: null,
        finalRank: null,
        reactions: [],
        chosenAt: null,
        x: .5,
        y: .72,
      });
    }
    this.section = this.createSection(0);
    this.setPhase("prepare", now + 900);
  }

  beginChoosing(now = Date.now(), durationMs = 5000): void {
    if (!this.section || this.phase !== "prepare") throw new Error("Cannot begin choosing now.");
    for (const player of this.players.values()) {
      player.choice = Math.min(this.section.plates.length - 1, Math.floor(player.x * this.section.plates.length));
      player.chosenAt = now;
    }
    this.choosingStartedAt = now;
    this.setPhase("choosing", now + durationMs);
  }

  lock(now = Date.now()): void {
    if (this.phase !== "choosing") throw new Error("Cannot lock choices now.");
    this.setPhase("locked", now + 350);
  }

  choose(playerId: string, sectionId: string, lane: Lane, now = Date.now()): boolean {
    const player = this.players.get(playerId);
    if (!player || !player.alive || this.phase !== "choosing" || this.section?.id !== sectionId || !this.section.plates.some((plate) => plate.lane === lane)) return false;
    player.choice = lane;
    player.chosenAt = now;
    return true;
  }

  move(playerId: string, sectionId: string, x: number, y: number, now = Date.now()): "moved" | "fell" | "rejected" {
    const player = this.players.get(playerId);
    if (!player || !player.alive || !this.section || this.section.id !== sectionId || !["prepare", "choosing"].includes(this.phase)) return "rejected";
    player.x = x;
    player.y = y;
    if (x < 0 || x > 1 || y < 0 || y > 1) {
      player.alive = false;
      player.choice = null;
      return "fell";
    }
    const lane = Math.min(this.section.plates.length - 1, Math.floor(x * this.section.plates.length));
    player.choice = lane;
    if (this.phase === "choosing") player.chosenAt = now;
    return "moved";
  }

  reveal(now = Date.now()): void {
    if (!this.section || !this.mission) throw new Error("No active section.");
    this.setPhase("reveal", now + 1000);
  }

  breakPlates(now = Date.now()): void {
    if (this.phase !== "reveal") throw new Error("Cannot break plates now.");
    this.setPhase("breaking", now + 700);
  }

  eliminate(now = Date.now()): string[] {
    if (!this.section || !this.mission) throw new Error("No active section.");
    const correctPlate = this.section.plates.find((plate) => plate.id === this.section?.correctPlateId);
    if (!correctPlate) throw new Error("Correct plate is missing.");
    const eliminated: string[] = [];
    for (const player of this.players.values()) {
      if (!player.alive) continue;
      if (player.choice === correctPlate.lane) {
        player.survivedSteps += 1;
        if (player.chosenAt !== null && this.choosingStartedAt !== null) player.reactions.push(Math.max(0, player.chosenAt - this.choosingStartedAt));
        player.averageReactionMs = average(player.reactions);
      } else {
        player.alive = false;
        eliminated.push(player.id);
      }
    }
    this.setPhase("eliminating", now + 1100);
    return eliminated;
  }

  advance(now = Date.now()): "next" | "results" {
    if (!this.mission || !this.section) throw new Error("No active race.");
    const correct = this.section.plates.find((plate) => plate.id === this.section?.correctPlateId);
    if (correct) this.completedTokens.push(correct.token);
    const alive = [...this.players.values()].filter((player) => player.alive);
    const queryComplete = this.completedTokens.length >= this.mission.tokens.length;
    const nobodyAlive = alive.length === 0;
    if (queryComplete || nobodyAlive) {
      this.finish(now);
      return "results";
    }
    this.sectionNumber += 1;
    this.section = this.createSection(this.sectionNumber);
    this.setPhase("prepare", now + 900);
    return "next";
  }

  reset(): void {
    this.phase = "lobby";
    this.phaseEndsAt = null;
    this.mission = null;
    this.section = null;
    this.sectionNumber = 0;
    this.completedTokens = [];
    this.winnerId = null;
    this.choosingStartedAt = null;
    this.settings = { plateDifficulty: "normal", decisionSeconds: 5 };
    for (const player of this.players.values()) {
      Object.assign(player, { ready: false, alive: true, choice: null, survivedSteps: 0, averageReactionMs: null, finalRank: null, reactions: [], chosenAt: null, x: .5, y: .72 });
    }
  }

  getMissionView() {
    return this.mission ? missionView(this.mission) : null;
  }

  getPublicSection(): SectionView | null {
    if (!this.section) return null;
    const includeAnswer = ["reveal", "breaking", "eliminating", "advance", "results"].includes(this.phase);
    return {
      id: this.section.id,
      index: this.section.index,
      plates: this.section.plates,
      ...(includeAnswer ? { correctPlateId: this.section.correctPlateId } : {}),
    };
  }

  private setPhase(phase: RoomPhase, phaseEndsAt: number | null): void {
    this.phase = phase;
    this.phaseEndsAt = phaseEndsAt;
  }

  private createSection(index: number): SectionView & { correctPlateId: string } {
    const expected = this.mission?.tokens[index];
    if (!expected) throw new Error(`Mission has no token at index ${index}.`);
    const [minimum, maximum] = LANE_RANGES[this.settings.plateDifficulty];
    const laneCount = minimum + Math.floor(this.random() * (maximum - minimum + 1));
    const allWrong = (Object.entries(DISTRACTORS) as Array<[TokenKind, string[]]>).flatMap(([kind, values]) =>
      values.map((value) => ({ kind, value })).filter((candidate) => candidate.kind !== expected.kind || candidate.value !== expected.value),
    );
    const wrongStart = Math.floor(this.random() * allWrong.length);
    const correctLane: Lane = Math.floor(this.random() * laneCount);
    let wrongIndex = 0;
    const plates: PlateView[] = Array.from({ length: laneCount }, (_, lane) => ({
      id: `s${index}-p${lane}`,
      lane,
      token: lane === correctLane ? expected : allWrong[(wrongStart + wrongIndex++) % allWrong.length] ?? { kind: "value", value: "?" },
    }));
    return { id: `section-${index}`, index, plates, correctPlateId: `s${index}-p${correctLane}` };
  }

  private finish(now: number): void {
    const ranked = [...this.players.values()].sort((a, b) =>
      b.survivedSteps - a.survivedSteps ||
      (a.averageReactionMs ?? Number.POSITIVE_INFINITY) - (b.averageReactionMs ?? Number.POSITIVE_INFINITY) ||
      a.name.localeCompare(b.name),
    );
    ranked.forEach((player, index) => { player.finalRank = index + 1; });
    this.winnerId = ranked.find((player) => player.alive)?.id ?? null;
    this.setPhase("results", now);
  }
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}
