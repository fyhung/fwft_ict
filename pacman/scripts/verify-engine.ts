import assert from "node:assert/strict";
import { createInitialGame, stepGame } from "../src/engine.ts";
import { createMaze } from "../src/maze.ts";
import type { PlayerRecord, Role } from "../src/types.ts";

const maze = createMaze();
assert.equal(maze.pacmanSpawns.length, 30);
assert.equal(maze.ghostSpawns.length, 30);
const sharedSpawns = [...maze.pacmanSpawns, ...maze.ghostSpawns];
assert.equal(new Set(sharedSpawns.map(({ x, y }) => `${x},${y}`)).size, 60);
sharedSpawns.forEach(({ x, y }) => assert.equal(maze.walls[y][x], false));
maze.pacmanSpawns.forEach((pacman, index) => {
  const ghost = maze.ghostSpawns[index];
  assert.equal(ghost.x, pacman.x);
  assert.equal(pacman.y - ghost.y, 4);
});

function player(index: number, role: Role): PlayerRecord {
  return {
    seatId: `s${String(index).padStart(2, "0")}`,
    profile: { name: `Player ${index + 1}`, colorId: `c${String(index).padStart(2, "0")}` },
    presence: { online: true, lastSeenAt: 0 },
    lobby: { ready: true, joinedAt: 0 },
    assignment: { role, spawnId: `${role[0]}${index}` },
  };
}

const oddPlayers: Record<string, PlayerRecord> = {};
for (let index = 0; index < 13; index += 1) oddPlayers[`u${index}`] = player(index, index < 5 ? "pacman" : "ghost");
const state = createInitialGame(oddPlayers, 1_000, 60_000);
const actors = Object.values(state.snapshot.actors);
assert.equal(actors.length, 13);
assert.equal(actors.filter(({ role }) => role === "pacman").length, 5);
assert.equal(actors.filter(({ role }) => role === "ghost").length, 8);
assert.equal(state.snapshot.pacmanLives, 15);
stepGame(state, {}, 1 / 60, 1_017);
assert.equal(state.snapshot.status, "playing");
assert.equal(state.snapshot.pacmanLives, 15);
const pacman = actors.find(({ role }) => role === "pacman")!;
const ghost = actors.find(({ role }) => role === "ghost")!;
ghost.x = pacman.x;
ghost.y = pacman.y;
stepGame(state, {}, 1 / 60, 2_999);
assert.equal(state.snapshot.pacmanLives, 15);
stepGame(state, {}, 1 / 60, 4_001);
assert.equal(state.snapshot.pacmanLives, 14);

const invalidTimerState = createInitialGame(oddPlayers, 1_000, 0);
stepGame(invalidTimerState, {}, 1 / 60, 1_017);
assert.equal(invalidTimerState.snapshot.status, "playing");
assert.equal(invalidTimerState.snapshot.roundEndsAt, 301_000);
console.log("Engine verification passed: separated starts, collision grace, round IDs, and timer fallback are active.");
