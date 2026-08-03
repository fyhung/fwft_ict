import { describe, expect, it } from "vitest";
import { createInitialGame } from "./engine.ts";
import type { PlayerRecord, Role } from "./types.ts";

function player(index: number, role: Role): PlayerRecord {
  return {
    seatId: `s0${index}`,
    profile: { name: `Player ${index}`, colorId: `c0${index}` },
    presence: { online: true, lastSeenAt: 0 },
    lobby: { ready: true, joinedAt: 0 },
    assignment: { role, spawnId: `${role[0]}${index}` },
  };
}

describe("odd-sized teams", () => {
  it("supports a host-selected Pac-Man count and assigns every other player as a Ghost", () => {
    const players = {
      a: player(0, "pacman"),
      b: player(1, "pacman"),
      c: player(2, "ghost"),
      d: player(3, "ghost"),
      e: player(4, "ghost"),
    };
    const state = createInitialGame(players, 1_000, 60_000);
    const actors = Object.values(state.snapshot.actors);
    expect(actors).toHaveLength(5);
    expect(actors.filter(({ role }) => role === "pacman")).toHaveLength(2);
    expect(actors.filter(({ role }) => role === "ghost")).toHaveLength(3);
    expect(state.snapshot.pacmanLives).toBe(6);
    expect(state.snapshot.status).toBe("playing");
    expect(state.snapshot.roundEndsAt).toBe(61_000);
    actors.forEach((actor) => {
      expect(actor.x).toBeGreaterThanOrEqual(0);
      expect(actor.x).toBeLessThan(state.maze.width);
      expect(actor.y).toBeGreaterThanOrEqual(0);
      expect(actor.y).toBeLessThan(state.maze.height);
    });
  });
});
