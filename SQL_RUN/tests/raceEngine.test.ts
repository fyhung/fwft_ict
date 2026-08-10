import { describe, expect, it } from "vitest";
import { RaceEngine } from "../server/game/raceEngine";

describe("RaceEngine", () => {
  it("keeps elimination and ranking authoritative", () => {
    const engine = new RaceEngine(() => 0);
    engine.addPlayer("alice", "Alice");
    engine.addPlayer("bob", "Bob");
    engine.start(1_000, 0);
    engine.beginChoosing(2_000, 5_000);
    expect(engine.section?.plates.find((plate) => plate.lane === 0)?.token.value).toBe("SELECT");
    expect(engine.choose("alice", "section-0", 0, 2_400)).toBe(true);
    expect(engine.choose("bob", "section-0", 1, 2_500)).toBe(true);
    engine.lock(7_000);
    expect(engine.choose("bob", "section-0", 0, 7_001)).toBe(false);
    engine.reveal(7_350);
    engine.breakPlates(8_350);
    expect(engine.eliminate(9_050)).toEqual(["bob"]);
    expect(engine.players.get("alice")?.alive).toBe(true);
    expect(engine.players.get("bob")?.alive).toBe(false);
    expect(engine.players.get("bob")?.mistakes[0]?.correct.value).toBe("SELECT");
    expect(engine.players.get("bob")?.mistakes[0]?.chosen).not.toBeNull();
    expect(engine.advance(10_150)).toBe("next");
    let now = 11_000;
    while (engine.phase !== "results") {
      engine.beginChoosing(now, 2_000);
      const correctLane = engine.section?.plates.find((plate) => plate.id === engine.section?.correctPlateId)?.lane;
      expect(correctLane).toBeDefined();
      expect(engine.choose("alice", engine.section!.id, correctLane!, now + 200)).toBe(true);
      engine.lock(now + 2_000);
      engine.reveal(now + 2_350);
      engine.breakPlates(now + 3_350);
      engine.eliminate(now + 4_050);
      engine.advance(now + 5_150);
      now += 6_000;
    }
    expect(engine.winnerId).toBe("alice");
    expect(engine.players.get("alice")?.finalRank).toBe(1);
  });

  it("creates the configured two-to-five plate ranges", () => {
    const expected: Record<string, [number, number]> = { easy: [2, 2], normal: [2, 3], hard: [3, 4], nightmare: [4, 5] };
    for (const [plateDifficulty, [minimum, maximum]] of Object.entries(expected)) {
      const engine = new RaceEngine(() => .999);
      engine.addPlayer("solo", "Solo");
      engine.start(1_000, 0, { plateDifficulty: plateDifficulty as any });
      expect(engine.section?.plates.length).toBeGreaterThanOrEqual(minimum);
      expect(engine.section?.plates.length).toBeLessThanOrEqual(maximum);
    }
  });

  it("does not reveal the safe plate while choices are open", () => {
    const engine = new RaceEngine(() => 0);
    engine.addPlayer("solo", "Solo");
    engine.start(1_000, 0);
    engine.beginChoosing(2_000, 5_000);
    expect(engine.getPublicSection()?.correctPlateId).toBeUndefined();
    engine.lock(7_000);
    engine.reveal(7_350);
    expect(engine.getPublicSection()?.correctPlateId).toBe("s0-p0");
  });

  it("does not crown a runner who missed the safe plate", () => {
    const engine = new RaceEngine(() => 0);
    engine.addPlayer("solo", "Solo");
    engine.start(1_000, 0);
    engine.beginChoosing(2_000, 5_000);
    engine.lock(7_000);
    engine.reveal(7_350);
    engine.breakPlates(8_350);
    engine.eliminate(9_050);
    engine.advance(10_150);
    expect(engine.winnerId).toBeNull();
    expect(engine.players.get("solo")?.finalRank).toBe(1);
  });

  it("maps free movement to a plate and eliminates a runner outside the ground", () => {
    const engine = new RaceEngine(() => 0);
    engine.addPlayer("runner", "Runner");
    engine.start(1_000, 0, { plateDifficulty: "easy" });
    expect(engine.move("runner", "section-0", .75, .5, 1_100)).toBe("moved");
    expect(engine.players.get("runner")?.choice).toBe(1);
    engine.beginChoosing(1_900, 5_000);
    expect(engine.move("runner", "section-0", .25, .5, 2_000)).toBe("moved");
    expect(engine.players.get("runner")?.choice).toBe(0);
    expect(engine.move("runner", "section-0", -.01, .5, 2_100)).toBe("fell");
    expect(engine.players.get("runner")?.alive).toBe(false);
    expect(engine.players.get("runner")?.mistakes[0]).toMatchObject({ sectionIndex: 0, chosen: null, correct: { value: "SELECT" } });
  });
});
