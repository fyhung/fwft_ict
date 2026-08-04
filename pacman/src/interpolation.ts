import type { Actor, GameSnapshot } from "./types.ts";

const DEFAULT_BLEND_MS = 100;
const MIN_BLEND_MS = 35;
const MAX_BLEND_MS = 100;
const TELEPORT_DISTANCE = 3;

interface ActorPosition {
  x: number;
  y: number;
}

export interface SnapshotInterpolation {
  fromActors: Record<string, ActorPosition>;
  target: GameSnapshot;
  startedAt: number;
  durationMs: number;
}

function positions(snapshot: GameSnapshot): Record<string, ActorPosition> {
  return Object.fromEntries(
    Object.entries(snapshot.actors).map(([uid, actor]) => [uid, { x: actor.x, y: actor.y }]),
  );
}

function blendActor(actor: Actor, from: ActorPosition | undefined, amount: number): Actor {
  if (!from) return actor;
  const deltaX = actor.x - from.x;
  const deltaY = actor.y - from.y;
  if (deltaX * deltaX + deltaY * deltaY > TELEPORT_DISTANCE * TELEPORT_DISTANCE) return actor;
  return {
    ...actor,
    x: from.x + deltaX * amount,
    y: from.y + deltaY * amount,
  };
}

export function sampleSnapshot(interpolation: SnapshotInterpolation, now: number): GameSnapshot {
  if (interpolation.durationMs <= 0) return interpolation.target;
  const amount = Math.max(0, Math.min(1, (now - interpolation.startedAt) / interpolation.durationMs));
  const actors = Object.fromEntries(
    Object.entries(interpolation.target.actors).map(([uid, actor]) => [
      uid,
      blendActor(actor, interpolation.fromActors[uid], amount),
    ]),
  );
  return { ...interpolation.target, actors };
}

export function updateInterpolation(
  current: SnapshotInterpolation | null,
  target: GameSnapshot,
  receivedAt: number,
): SnapshotInterpolation {
  if (!current || current.target.roundId !== target.roundId) {
    return { fromActors: positions(target), target, startedAt: receivedAt, durationMs: 0 };
  }

  const displayed = sampleSnapshot(current, receivedAt);
  const hostInterval = target.hostTime - current.target.hostTime;
  const durationMs = Math.max(
    MIN_BLEND_MS,
    Math.min(MAX_BLEND_MS, hostInterval > 0 ? hostInterval : DEFAULT_BLEND_MS),
  );
  return { fromActors: positions(displayed), target, startedAt: receivedAt, durationMs };
}
