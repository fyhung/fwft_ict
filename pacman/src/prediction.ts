import { predictActorMovement } from "./engine.ts";
import type { Maze } from "./maze.ts";
import type { Actor, Direction, GameSnapshot } from "./types.ts";

const MAX_PREDICTION_ERROR = 0.6;
const ACKNOWLEDGED_CORRECTION = 0.2;
const UNACKNOWLEDGED_CORRECTION = 0;

export interface LocalPrediction {
  roundId: number;
  actor: Actor;
}

function exactPrediction(roundId: number, actor: Actor, wantedDirection: Direction): LocalPrediction {
  return {
    roundId,
    actor: { ...actor, lastInputSeq: actor.lastInputSeq ?? 0, wantedDirection },
  };
}

export function reconcileLocalPrediction(
  current: LocalPrediction | null,
  snapshot: GameSnapshot,
  uid: string,
  wantedDirection: Direction,
  lastSentInputSeq: number,
): LocalPrediction | null {
  const authoritative = snapshot.actors[uid];
  if (!authoritative) return null;
  if (snapshot.status !== "playing") {
    return exactPrediction(snapshot.roundId, authoritative, "none");
  }
  if (!current || current.roundId !== snapshot.roundId) {
    return exactPrediction(snapshot.roundId, authoritative, wantedDirection);
  }

  const predicted = current.actor;
  const deltaX = authoritative.x - predicted.x;
  const deltaY = authoritative.y - predicted.y;
  const errorSquared = deltaX * deltaX + deltaY * deltaY;
  const stateJump =
    authoritative.state === "dead" ||
    authoritative.state === "eaten" ||
    (authoritative.state === "invulnerable" && predicted.state !== "invulnerable") ||
    predicted.state === "dead" ||
    predicted.state === "eaten" ||
    authoritative.role !== predicted.role;
  if (stateJump) {
    return exactPrediction(snapshot.roundId, authoritative, wantedDirection);
  }

  // Prediction must be responsive but bounded. A client is never allowed to
  // build up a multi-tile alternate reality, even if the server accepted the
  // same buffered direction. On a healthy LAN this leash represents roughly
  // 120 ms of travel and should only be reached after an invalid prediction.
  if (errorSquared > MAX_PREDICTION_ERROR * MAX_PREDICTION_ERROR) {
    return exactPrediction(snapshot.roundId, authoritative, wantedDirection);
  }

  // While an input is travelling to the server, keep the locally predicted
  // lead. Once acknowledged, converge gently along the same corridor. A large
  // distance by itself is not a teleport: under load it can simply represent
  // several still-unacknowledged input frames.
  const acknowledged = (authoritative.lastInputSeq ?? 0) >= lastSentInputSeq;
  const serverAcceptedTurn = acknowledged && authoritative.wantedDirection === wantedDirection;
  const pathsAreAligned = Math.abs(deltaX) < 0.05 || Math.abs(deltaY) < 0.05;
  if (!pathsAreAligned) {
    // The predicted actor can reach an intersection before the authoritative
    // actor. If the server accepted the same buffered turn, this is temporary
    // path divergence—not a rejected move—and must not snap backwards.
    if (acknowledged && !serverAcceptedTurn) return exactPrediction(snapshot.roundId, authoritative, wantedDirection);
    return {
      roundId: snapshot.roundId,
      actor: {
        ...authoritative,
        x: predicted.x,
        y: predicted.y,
        direction: predicted.direction,
        wantedDirection,
        lastInputSeq: authoritative.lastInputSeq ?? 0,
      },
    };
  }
  const correction = acknowledged ? ACKNOWLEDGED_CORRECTION : UNACKNOWLEDGED_CORRECTION;
  return {
    roundId: snapshot.roundId,
    actor: {
      ...authoritative,
      x: predicted.x + deltaX * correction,
      y: predicted.y + deltaY * correction,
      direction: predicted.direction,
      wantedDirection,
      lastInputSeq: authoritative.lastInputSeq ?? 0,
    },
  };
}

export function reconcileClientOwnedPrediction(
  current: LocalPrediction | null,
  snapshot: GameSnapshot,
  uid: string,
  wantedDirection: Direction,
): LocalPrediction | null {
  const authoritative = snapshot.actors[uid];
  if (!authoritative) return null;
  if (snapshot.status !== "playing") return exactPrediction(snapshot.roundId, authoritative, "none");
  if (!current || current.roundId !== snapshot.roundId) {
    return exactPrediction(snapshot.roundId, authoritative, wantedDirection);
  }

  const predicted = current.actor;
  const requiresServerPosition =
    authoritative.state === "dead" ||
    authoritative.state === "eaten" ||
    (authoritative.state === "invulnerable" && predicted.state !== "invulnerable") ||
    predicted.state === "dead" ||
    predicted.state === "eaten" ||
    authoritative.role !== predicted.role;
  if (requiresServerPosition) return exactPrediction(snapshot.roundId, authoritative, wantedDirection);

  // Normal movement belongs to this client. Copy authoritative rule state,
  // scores, and acknowledgements without replacing the locally owned pose.
  // Invalid poses receive a separate explicit `correction` message.
  return {
    roundId: snapshot.roundId,
    actor: {
      ...authoritative,
      x: predicted.x,
      y: predicted.y,
      direction: predicted.direction,
      wantedDirection,
    },
  };
}

export function advanceLocalPrediction(
  prediction: LocalPrediction,
  maze: Maze,
  wantedDirection: Direction,
  seconds: number,
  frightenedActive: boolean,
) {
  predictActorMovement(prediction.actor, maze, wantedDirection, seconds, frightenedActive);
}

export function applyLocalPrediction(snapshot: GameSnapshot, prediction: LocalPrediction | null): GameSnapshot {
  if (!prediction || prediction.roundId !== snapshot.roundId || !snapshot.actors[prediction.actor.uid]) return snapshot;
  return {
    ...snapshot,
    actors: { ...snapshot.actors, [prediction.actor.uid]: prediction.actor },
  };
}
