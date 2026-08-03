import { predictActorMovement } from "./engine.ts";
import type { Maze } from "./maze.ts";
import type { Actor, Direction, GameSnapshot } from "./types.ts";

const SNAP_DISTANCE = 1.5;
const ACKNOWLEDGED_CORRECTION = 0.35;
const UNACKNOWLEDGED_CORRECTION = 0.08;

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
  const stateJump =
    authoritative.state === "dead" ||
    authoritative.state === "eaten" ||
    predicted.state === "dead" ||
    predicted.state === "eaten" ||
    authoritative.role !== predicted.role;
  if (stateJump || deltaX * deltaX + deltaY * deltaY > SNAP_DISTANCE * SNAP_DISTANCE) {
    return exactPrediction(snapshot.roundId, authoritative, wantedDirection);
  }

  // While an input is still travelling to the host, preserve most of the
  // responsive local prediction. Once acknowledged, converge more quickly.
  const acknowledged = (authoritative.lastInputSeq ?? 0) >= lastSentInputSeq;
  const pathsAreAligned = Math.abs(deltaX) < 0.05 || Math.abs(deltaY) < 0.05;
  if (!pathsAreAligned) {
    if (acknowledged) return exactPrediction(snapshot.roundId, authoritative, wantedDirection);
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
