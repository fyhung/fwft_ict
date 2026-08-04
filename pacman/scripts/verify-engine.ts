import assert from "node:assert/strict";
import { createInitialGame, predictActorMovement, stepGame } from "../src/engine.ts";
import { sampleSnapshot, updateInterpolation } from "../src/interpolation.ts";
import { createMaze } from "../src/maze.ts";
import { createNetworkSnapshot, mergeNetworkSnapshot } from "../src/network.ts";
import {
  advanceLocalPrediction,
  applyLocalPrediction,
  reconcileClientOwnedPrediction,
  reconcileLocalPrediction,
} from "../src/prediction.ts";
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

// The host acknowledges each input sequence exactly once and ignores stale
// direction records that arrive after a newer command.
const inputAckState = createInitialGame(soloPlayers, 1_000, 60_000);
const inputAckActor = inputAckState.snapshot.actors.solo;
stepGame(inputAckState, input("right", 7), 1 / 60, 5_000);
assert.equal(inputAckActor.lastInputSeq, 7);
assert.equal(inputAckActor.wantedDirection, "right");

// In client-owned movement mode, the server advances rules and acknowledges
// input without independently moving the actor a second time.
const clientOwnedState = createInitialGame(soloPlayers, 1_000, 60_000);
const clientOwnedActor = clientOwnedState.snapshot.actors.solo;
const clientOwnedStartX = clientOwnedActor.x;
stepGame(clientOwnedState, input("right", 3), 1 / 60, 5_000, false);
assert.equal(clientOwnedActor.x, clientOwnedStartX);
assert.equal(clientOwnedActor.lastInputSeq, 3);

// With identical inputs, client prediction and the authoritative fixed-step
// simulation must follow the same route exactly.
const parityState = createInitialGame(soloPlayers, 1_000, 60_000);
const predictedParityActor = structuredClone(parityState.snapshot.actors.solo);
for (let tick = 0; tick < 120; tick += 1) {
  const direction: Direction = tick < 60 ? "right" : "down";
  const seq = tick < 60 ? 1 : 2;
  stepGame(parityState, input(direction, seq), 1 / 60, 5_000 + tick * (1_000 / 60));
  predictActorMovement(predictedParityActor, maze, direction, 1 / 60, false);
}
assert.ok(Math.abs(predictedParityActor.x - parityState.snapshot.actors.solo.x) < 0.000_001);
assert.ok(Math.abs(predictedParityActor.y - parityState.snapshot.actors.solo.y) < 0.000_001);
stepGame(inputAckState, input("left", 6), 1 / 60, 5_017);
assert.equal(inputAckActor.lastInputSeq, 7);
assert.equal(inputAckActor.wantedDirection, "right");

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

// The local actor moves immediately before the host acknowledges the input,
// then receives a gentle correction instead of a visible backwards snap.
const predictionSnapshot = createInitialGame(soloPlayers, 1_000, 60_000).snapshot;
predictionSnapshot.actors.solo.x = 10;
let localPrediction = reconcileLocalPrediction(null, predictionSnapshot, "solo", "right", 1)!;
advanceLocalPrediction(localPrediction, maze, "right", 0.1, false);
assert.ok(localPrediction.actor.x > 10.49);
const positionBeforeCorrection = localPrediction.actor.x;
const delayedConfirmation = structuredClone(predictionSnapshot);
delayedConfirmation.tick += 6;
delayedConfirmation.hostTime += 100;
delayedConfirmation.actors.solo.x = 10.3;
delayedConfirmation.actors.solo.lastInputSeq = 0;
localPrediction = reconcileLocalPrediction(localPrediction, delayedConfirmation, "solo", "right", 1)!;
assert.equal(localPrediction.actor.x, positionBeforeCorrection);
assert.equal(applyLocalPrediction(delayedConfirmation, localPrediction).actors.solo.x, localPrediction.actor.x);

// Even an unacknowledged input is bounded: a multi-tile disagreement is an
// invalid local reality and must be corrected immediately.
const heavilyDelayedConfirmation = structuredClone(delayedConfirmation);
heavilyDelayedConfirmation.actors.solo.x = 6;
const boundedDelayedPrediction = reconcileLocalPrediction(localPrediction, heavilyDelayedConfirmation, "solo", "right", 1)!;
assert.equal(boundedDelayedPrediction.actor.x, heavilyDelayedConfirmation.actors.solo.x);

// After acknowledgement, positions on the same corridor converge gradually.
const acknowledgedConfirmation = structuredClone(delayedConfirmation);
acknowledgedConfirmation.actors.solo.lastInputSeq = 1;
localPrediction = reconcileLocalPrediction(localPrediction, acknowledgedConfirmation, "solo", "right", 1)!;
assert.ok(localPrediction.actor.x < positionBeforeCorrection);
assert.ok(localPrediction.actor.x > acknowledgedConfirmation.actors.solo.x);

// Receiving an acknowledgement before the server reaches an intersection
// must not snap a locally predicted turn back to the previous corridor.
const acceptedTurnSnapshot = structuredClone(predictionSnapshot);
acceptedTurnSnapshot.actors.solo.x = 15.7;
acceptedTurnSnapshot.actors.solo.y = 2;
acceptedTurnSnapshot.actors.solo.direction = "right";
acceptedTurnSnapshot.actors.solo.wantedDirection = "down";
acceptedTurnSnapshot.actors.solo.lastInputSeq = 2;
const predictedTurn = {
  roundId: acceptedTurnSnapshot.roundId,
  actor: {
    ...acceptedTurnSnapshot.actors.solo,
    x: 16,
    y: 2.4,
    direction: "down" as const,
    wantedDirection: "down" as const,
  },
};
const preservedTurn = reconcileLocalPrediction(predictedTurn, acceptedTurnSnapshot, "solo", "down", 2)!;
assert.equal(preservedTurn.actor.x, 16);
assert.equal(preservedTurn.actor.y, 2.4);
assert.equal(preservedTurn.actor.direction, "down");

// Even an accepted direction cannot preserve an incorrect prediction beyond
// the leash; this prevents a later multi-tile rollback.
const runawayTurn = {
  ...predictedTurn,
  actor: { ...predictedTurn.actor, y: 4 },
};
const boundedTurn = reconcileLocalPrediction(runawayTurn, acceptedTurnSnapshot, "solo", "down", 2)!;
assert.equal(boundedTurn.actor.x, acceptedTurnSnapshot.actors.solo.x);
assert.equal(boundedTurn.actor.y, acceptedTurnSnapshot.actors.solo.y);

// Routine snapshots update scores and state but never pull back a valid pose
// owned by the client. Explicit correction messages handle invalid movement.
const clientOwnedPrediction = reconcileClientOwnedPrediction(
  predictedTurn,
  acceptedTurnSnapshot,
  "solo",
  "down",
)!;
assert.equal(clientOwnedPrediction.actor.x, predictedTurn.actor.x);
assert.equal(clientOwnedPrediction.actor.y, predictedTurn.actor.y);
const clientOwnedDeath = structuredClone(acceptedTurnSnapshot);
clientOwnedDeath.actors.solo.state = "dead";
clientOwnedDeath.actors.solo.x = 12;
const resetDeadPrediction = reconcileClientOwnedPrediction(predictedTurn, clientOwnedDeath, "solo", "down")!;
assert.equal(resetDeadPrediction.actor.x, 12);
assert.equal(resetDeadPrediction.actor.state, "dead");

// Pellet locations are sent once; routine snapshots carry only removals.
const fullNetworkSnapshot = createNetworkSnapshot(predictionSnapshot, null);
const mergedFullSnapshot = mergeNetworkSnapshot(null, fullNetworkSnapshot);
assert.deepEqual(mergedFullSnapshot.pellets, predictionSnapshot.pellets);
const pelletUpdateSnapshot = structuredClone(predictionSnapshot);
const removedPellet = pelletUpdateSnapshot.pellets.shift()!;
const pelletDelta = createNetworkSnapshot(pelletUpdateSnapshot, predictionSnapshot);
assert.equal(pelletDelta.pellets, undefined);
assert.deepEqual(pelletDelta.removedPellets, [removedPellet]);
const mergedPelletDelta = mergeNetworkSnapshot(mergedFullSnapshot, pelletDelta);
assert.deepEqual(mergedPelletDelta.pellets, pelletUpdateSnapshot.pellets);

const respawnConfirmation = structuredClone(delayedConfirmation);
respawnConfirmation.actors.solo.x = 30;
respawnConfirmation.actors.solo.state = "invulnerable";
localPrediction = reconcileLocalPrediction(localPrediction, respawnConfirmation, "solo", "right", 1)!;
assert.equal(localPrediction.actor.x, 30);

console.log("Engine verification passed: authoritative movement, input acknowledgements, client prediction, reconciliation, and interpolation are active.");
