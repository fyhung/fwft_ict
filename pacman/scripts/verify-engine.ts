import assert from "node:assert/strict";
import { createInitialGame, stepGame } from "../src/engine.ts";
import { sampleSnapshot, updateInterpolation } from "../src/interpolation.ts";
import { createMaze } from "../src/maze.ts";
import type { Direction, InputState, PlayerRecord, Role } from "../src/types.ts";

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

const wallTurnState = createInitialGame(oddPlayers, 1_000, 60_000);
const wallTurnPacman = Object.values(wallTurnState.snapshot.actors).find(({ role }) => role === "pacman")!;
wallTurnPacman.x = 39.2;
wallTurnPacman.y = 23;
wallTurnPacman.direction = "right";
wallTurnPacman.wantedDirection = "down";
stepGame(wallTurnState, {}, 1 / 60, 5_000);
assert.equal(wallTurnPacman.x, 39);
assert.equal(wallTurnPacman.direction, "down");
stepGame(wallTurnState, {}, 1 / 60, 5_017);
assert.ok(wallTurnPacman.y > 23);

function input(direction: Direction, seq = 1): Record<string, InputState> {
  return { solo: { seq, direction, clientTime: 1_000 } };
}

const soloPlayers = { solo: player(0, "pacman") };

// Pressing toward a blocked side passage must not cancel forward movement.
// Row 2 is open from x=10 through x=16, while the tiles below x=11..15 are
// walls. A buffered Down command should carry through and turn at x=16.
const bufferedTurnState = createInitialGame(soloPlayers, 1_000, 60_000);
const bufferedActor = bufferedTurnState.snapshot.actors.solo;
bufferedActor.x = 10.6;
bufferedActor.y = 2;
bufferedActor.direction = "right";
for (let tick = 0; tick < 90; tick += 1) {
  stepGame(bufferedTurnState, input("down"), 1 / 60, 5_000 + tick * (1_000 / 60));
}
assert.equal(bufferedActor.direction, "down");
assert.equal(bufferedActor.x, 16);
assert.ok(bufferedActor.y > 2);

// A reversal is allowed immediately, without waiting for a tile center.
const reverseState = createInitialGame(soloPlayers, 1_000, 60_000);
const reverseActor = reverseState.snapshot.actors.solo;
reverseActor.x = 10.4;
reverseActor.y = 2;
reverseActor.direction = "right";
stepGame(reverseState, input("left"), 1 / 60, 5_000);
assert.equal(reverseActor.direction, "left");
assert.ok(reverseActor.x < 10.4);

// Once stopped at a wall, a new valid direction must release the actor.
const wallEscapeState = createInitialGame(soloPlayers, 1_000, 60_000);
const wallEscapeActor = wallEscapeState.snapshot.actors.solo;
wallEscapeActor.x = 39.2;
wallEscapeActor.y = 23;
wallEscapeActor.direction = "right";
stepGame(wallEscapeState, input("right"), 1 / 60, 5_000);
assert.equal(wallEscapeActor.direction, "none");
stepGame(wallEscapeState, input("down", 2), 1 / 60, 5_017);
assert.equal(wallEscapeActor.direction, "down");
assert.ok(wallEscapeActor.y > 23);

// Network snapshots arrive around 10 times per second, but visual positions
// should move continuously between them at the browser's animation rate.
const firstVisual = createInitialGame(soloPlayers, 1_000, 60_000).snapshot;
firstVisual.actors.solo.x = 10;
let visualInterpolation = updateInterpolation(null, firstVisual, 0);
assert.equal(sampleSnapshot(visualInterpolation, 50).actors.solo.x, 10);

const secondVisual = structuredClone(firstVisual);
secondVisual.tick += 6;
secondVisual.hostTime += 100;
secondVisual.actors.solo.x = 11;
visualInterpolation = updateInterpolation(visualInterpolation, secondVisual, 100);
assert.equal(sampleSnapshot(visualInterpolation, 150).actors.solo.x, 10.5);
assert.equal(sampleSnapshot(visualInterpolation, 200).actors.solo.x, 11);

const teleportedVisual = structuredClone(secondVisual);
teleportedVisual.tick += 6;
teleportedVisual.hostTime += 100;
teleportedVisual.actors.solo.x = 30;
visualInterpolation = updateInterpolation(visualInterpolation, teleportedVisual, 200);
assert.equal(sampleSnapshot(visualInterpolation, 210).actors.solo.x, 30);

console.log("Engine verification passed: movement, collision grace, timer fallback, and smooth client interpolation are active.");
