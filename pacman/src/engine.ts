import { createMaze, isWall, MAZE_WIDTH, tileKey, TUNNEL_ROW, type Maze } from "./maze.ts";
import { COSMETIC_IDS, type CosmeticId } from "./cosmetics.ts";
import type { Actor, Direction, GameSnapshot, InputState, PlayerRecord } from "./types.ts";

const BASE_SPEED = 6.25;
const PACMAN_SPEED = BASE_SPEED * 0.8;
const POWERED_PACMAN_SPEED = BASE_SPEED * 0.9;
const GHOST_SPEED = BASE_SPEED * 0.75;
const FRIGHTENED_GHOST_SPEED = BASE_SPEED * 0.5;
const FRIGHTENED_MS = 6_000;
const START_COLLISION_GRACE_MS = 3_000;
const DEFAULT_ROUND_DURATION_MS = 5 * 60_000;
const PLAYER_RADIUS = 0.31;
const TURN_WINDOW = 0.16;

const vectors: Record<Direction, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  none: { x: 0, y: 0 },
};

export interface EngineState {
  maze: Maze;
  snapshot: GameSnapshot;
}

export function createInitialGame(
  players: Record<string, PlayerRecord>,
  now = Date.now(),
  roundDurationMs = DEFAULT_ROUND_DURATION_MS,
  roundId = 0,
  livesPerPacman = 3,
): EngineState {
  const maze = createMaze();
  const actors: Record<string, Actor> = {};
  let pacmanIndex = 0;
  let ghostIndex = 0;

  Object.entries(players).forEach(([uid, player]) => {
    if (!player.assignment) return;
    const role = player.assignment.role;
    const list = role === "pacman" ? maze.pacmanSpawns : maze.ghostSpawns;
    const index = role === "pacman" ? pacmanIndex++ : ghostIndex++;
    const spawn = list[index % list.length];
    actors[uid] = {
      uid,
      name: player.profile.name,
      colorId: player.profile.colorId,
      cosmeticId: (COSMETIC_IDS.has(player.profile.cosmeticId) ? player.profile.cosmeticId : "party-hat") as CosmeticId,
      role,
      x: spawn.x,
      y: spawn.y,
      spawnX: spawn.x,
      spawnY: spawn.y,
      direction: "none",
      wantedDirection: "none",
      lastInputSeq: 0,
      state: "normal",
      respawnAt: 0,
      invulnerableUntil: 0,
      score: 0,
      kills: 0,
      ghostsEaten: 0,
      pellets: 0,
    };
  });

  const pacmanCount = Object.values(actors).filter((actor) => actor.role === "pacman").length;
  const safeRoundDuration = Number.isFinite(roundDurationMs) && roundDurationMs >= 30_000
    ? roundDurationMs
    : DEFAULT_ROUND_DURATION_MS;
  const safeLivesPerPacman = Number.isFinite(livesPerPacman)
    ? Math.max(1, Math.min(9, Math.round(livesPerPacman)))
    : 3;
  return {
    maze,
    snapshot: {
      roundId,
      tick: 0,
      hostTime: now,
      roundStartedAt: now,
      status: "playing",
      actors,
      pellets: [...maze.pellets],
      powerPellets: [...maze.powerPellets],
      frightenedUntil: 0,
      ghostChain: 0,
      pacmanLives: Math.max(1, pacmanCount * safeLivesPerPacman),
      pacmanScore: 0,
      ghostScore: 0,
      winner: null,
      resultReason: null,
      roundEndsAt: now + safeRoundDuration,
    },
  };
}

export function canActorOccupy(maze: Maze, x: number, y: number): boolean {
  return ![
    [x - PLAYER_RADIUS, y - PLAYER_RADIUS],
    [x + PLAYER_RADIUS, y - PLAYER_RADIUS],
    [x - PLAYER_RADIUS, y + PLAYER_RADIUS],
    [x + PLAYER_RADIUS, y + PLAYER_RADIUS],
  ].some(([sampleX, sampleY]) => isWall(maze, sampleX, sampleY));
}

function directionsAreOpposite(first: Direction, second: Direction): boolean {
  return (
    (first === "up" && second === "down") ||
    (first === "down" && second === "up") ||
    (first === "left" && second === "right") ||
    (first === "right" && second === "left")
  );
}

function tryDirection(actor: Actor, maze: Maze, direction: Direction): boolean {
  if (direction === "none") return false;
  if (direction === actor.direction) return true;

  // Reversing in a corridor is always safe: the actor just travels back over
  // the space it has already crossed and does not need to reach a tile center.
  if (directionsAreOpposite(actor.direction, direction)) {
    actor.direction = direction;
    return true;
  }

  const vector = vectors[direction];
  const centerX = Math.round(actor.x);
  const centerY = Math.round(actor.y);

  // A 90-degree turn happens only while crossing a tile center. Keep an
  // unavailable request buffered instead of steering into the nearby wall.
  if (vector.x !== 0 && Math.abs(actor.y - centerY) >= TURN_WINDOW) return false;
  if (vector.y !== 0 && Math.abs(actor.x - centerX) >= TURN_WINDOW) return false;
  if (!canActorOccupy(maze, centerX + vector.x, centerY + vector.y)) return false;

  actor.x = centerX;
  actor.y = centerY;
  actor.direction = direction;
  return true;
}

function actorSpeed(actor: Actor, frightenedActive: boolean): number {
  if (actor.role === "pacman") return frightenedActive ? POWERED_PACMAN_SPEED : PACMAN_SPEED;
  if (actor.state === "frightened") return FRIGHTENED_GHOST_SPEED;
  if (actor.state === "eaten") return BASE_SPEED * 1.5;
  return GHOST_SPEED;
}

function moveActor(actor: Actor, maze: Maze, seconds: number, frightenedActive: boolean) {
  if (actor.state === "dead" || actor.state === "eaten") return;
  tryDirection(actor, maze, actor.wantedDirection);
  const vector = vectors[actor.direction];
  const distance = actorSpeed(actor, frightenedActive) * seconds;
  const nextX = actor.x + vector.x * distance;
  const nextY = actor.y + vector.y * distance;
  if (canActorOccupy(maze, nextX, nextY)) {
    actor.x = nextX;
    actor.y = nextY;
  } else {
    const centeredX = Math.round(actor.x);
    const centeredY = Math.round(actor.y);
    if (canActorOccupy(maze, centeredX, centeredY)) {
      actor.x = centeredX;
      actor.y = centeredY;
    }
    actor.direction = "none";
    // Keep the requested direction buffered. A later input can immediately
    // release the actor from the wall, and an early corner request remains
    // active until the next legal intersection.
    tryDirection(actor, maze, actor.wantedDirection);
  }
  if (Math.abs(actor.y - TUNNEL_ROW) < 0.6) {
    if (actor.x < -0.55) actor.x = MAZE_WIDTH - 0.45;
    if (actor.x > MAZE_WIDTH - 0.45) actor.x = -0.55;
  }
}

// Clients use the exact authoritative movement rules to predict only their
// own actor between host snapshots. This intentionally excludes pellets,
// collisions, scores, deaths, and respawns, which remain host-controlled.
export function predictActorMovement(
  actor: Actor,
  maze: Maze,
  wantedDirection: Direction,
  seconds: number,
  frightenedActive: boolean,
) {
  actor.wantedDirection = wantedDirection;
  let remaining = Math.max(0, Math.min(0.1, seconds));
  while (remaining > 0.000_001) {
    const step = Math.min(1 / 60, remaining);
    moveActor(actor, maze, step, frightenedActive);
    remaining -= step;
  }
}

function finish(snapshot: GameSnapshot, winner: "pacman" | "ghost", reason: string) {
  snapshot.status = "results";
  snapshot.winner = winner;
  snapshot.resultReason = reason;
  Object.values(snapshot.actors).forEach((actor) => {
    actor.direction = "none";
    actor.wantedDirection = "none";
  });
}

export function stepGame(
  state: EngineState,
  inputs: Record<string, InputState>,
  seconds: number,
  now = Date.now(),
  simulateMovement = true,
): GameSnapshot {
  const { snapshot, maze } = state;
  if (snapshot.status !== "playing") return snapshot;
  snapshot.tick += 1;
  snapshot.hostTime = now;

  const frightenedActive = now < snapshot.frightenedUntil;
  if (!frightenedActive) {
    snapshot.ghostChain = 0;
    Object.values(snapshot.actors).forEach((actor) => {
      if (actor.state === "frightened") actor.state = "normal";
    });
  }

  Object.values(snapshot.actors).forEach((actor) => {
    const input = inputs[actor.uid];
    if (input && input.seq > (actor.lastInputSeq ?? 0)) {
      actor.wantedDirection = input.direction;
      actor.lastInputSeq = input.seq;
    }
    if ((actor.state === "dead" || actor.state === "eaten") && now >= actor.respawnAt) {
      actor.x = actor.spawnX;
      actor.y = actor.spawnY;
      actor.state = actor.role === "pacman" ? "invulnerable" : "normal";
      actor.invulnerableUntil = actor.role === "pacman" ? now + 2_000 : 0;
    }
    if (actor.state === "invulnerable" && now >= actor.invulnerableUntil) actor.state = "normal";
    if (simulateMovement) moveActor(actor, maze, seconds, frightenedActive);
  });

  const pelletSet = new Set(snapshot.pellets);
  const powerSet = new Set(snapshot.powerPellets);
  Object.values(snapshot.actors)
    .filter((actor) => actor.role === "pacman" && actor.state !== "dead")
    .sort((a, b) => a.uid.localeCompare(b.uid))
    .forEach((actor) => {
      const x = Math.round(actor.x);
      const y = Math.round(actor.y);
      if ((actor.x - x) ** 2 + (actor.y - y) ** 2 > 0.22) return;
      const key = tileKey(x, y);
      if (pelletSet.delete(key)) {
        actor.score += 10;
        actor.pellets += 1;
        snapshot.pacmanScore += 10;
      }
      if (powerSet.delete(key)) {
        actor.score += 50;
        snapshot.pacmanScore += 50;
        snapshot.frightenedUntil = now + FRIGHTENED_MS;
        snapshot.ghostChain = 0;
        Object.values(snapshot.actors).forEach((ghost) => {
          if (ghost.role === "ghost" && ghost.state === "normal") ghost.state = "frightened";
        });
      }
    });
  snapshot.pellets = [...pelletSet];
  snapshot.powerPellets = [...powerSet];

  if (now - snapshot.roundStartedAt >= START_COLLISION_GRACE_MS) {
    const pacmen = Object.values(snapshot.actors).filter((actor) => actor.role === "pacman" && actor.state !== "dead");
    const ghosts = Object.values(snapshot.actors).filter((actor) => actor.role === "ghost" && actor.state !== "eaten");
    for (const pacman of pacmen) {
      if (pacman.state === "invulnerable") continue;
      for (const ghost of ghosts) {
        if ((pacman.x - ghost.x) ** 2 + (pacman.y - ghost.y) ** 2 > 0.58) continue;
        if (ghost.state === "frightened") {
          const award = [200, 400, 800, 1600][Math.min(snapshot.ghostChain, 3)];
          snapshot.ghostChain += 1;
          pacman.score += award;
          pacman.ghostsEaten += 1;
          snapshot.pacmanScore += award;
          ghost.state = "eaten";
          ghost.respawnAt = now + 1_500;
          ghost.direction = "none";
        } else if (ghost.state === "normal") {
          ghost.score += 500;
          ghost.kills += 1;
          snapshot.ghostScore += 500;
          snapshot.pacmanLives -= 1;
          pacman.state = "dead";
          pacman.respawnAt = now + 2_000;
          pacman.direction = "none";
          break;
        }
      }
    }
  }

  if (snapshot.pacmanLives <= 0) finish(snapshot, "ghost", "Pac-Man lives depleted");
  else if (snapshot.pellets.length === 0 && snapshot.powerPellets.length === 0) finish(snapshot, "pacman", "Maze cleared");
  else if (now >= snapshot.roundEndsAt) finish(snapshot, "ghost", "Time expired");
  return snapshot;
}
