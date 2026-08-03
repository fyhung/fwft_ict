import { colorValue } from "./palette.ts";
import type { Maze } from "./maze.ts";
import type { Actor, GameSnapshot } from "./types.ts";

function angleFor(actor: Actor): number {
  return { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2, none: 0 }[actor.direction];
}

function drawPacman(context: CanvasRenderingContext2D, actor: Actor, x: number, y: number, radius: number) {
  const angle = angleFor(actor);
  const mouth = 0.28 * Math.PI;
  context.fillStyle = colorValue(actor.colorId);
  context.beginPath();
  context.moveTo(x, y);
  context.arc(x, y, radius, angle + mouth, angle + Math.PI * 2 - mouth);
  context.closePath();
  context.fill();
}

function drawGhost(context: CanvasRenderingContext2D, actor: Actor, x: number, y: number, radius: number) {
  context.fillStyle = actor.state === "frightened" ? "#526dff" : colorValue(actor.colorId);
  context.beginPath();
  context.arc(x, y, radius, Math.PI, 0);
  context.lineTo(x + radius, y + radius);
  context.lineTo(x + radius * 0.5, y + radius * 0.65);
  context.lineTo(x, y + radius);
  context.lineTo(x - radius * 0.5, y + radius * 0.65);
  context.lineTo(x - radius, y + radius);
  context.closePath();
  context.fill();

  context.fillStyle = "white";
  context.beginPath();
  context.arc(x - radius * 0.34, y - radius * 0.1, radius * 0.22, 0, Math.PI * 2);
  context.arc(x + radius * 0.34, y - radius * 0.1, radius * 0.22, 0, Math.PI * 2);
  context.fill();
}

export function renderGame(canvas: HTMLCanvasElement, snapshot: GameSnapshot, maze: Maze, localUid?: string) {
  const bounds = canvas.getBoundingClientRect();
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(320, bounds.width);
  const height = Math.max(320, bounds.height);
  if (canvas.width !== Math.round(width * pixelRatio) || canvas.height !== Math.round(height * pixelRatio)) {
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
  }
  const context = canvas.getContext("2d");
  if (!context) return;
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#050713";
  context.fillRect(0, 0, width, height);

  const localActor = localUid ? snapshot.actors[localUid] : undefined;
  const tileSize = localActor ? Math.max(30, Math.min(44, width / 10.5)) : Math.min(width / maze.width, height / maze.height);
  const mapWidth = maze.width * tileSize;
  const mapHeight = maze.height * tileSize;
  let cameraX = (mapWidth - width) / 2;
  let cameraY = (mapHeight - height) / 2;
  if (localActor) {
    cameraX = Math.max(0, Math.min(mapWidth - width, localActor.x * tileSize - width / 2));
    cameraY = Math.max(0, Math.min(mapHeight - height, localActor.y * tileSize - height / 2));
  }
  const offsetX = mapWidth < width ? (width - mapWidth) / 2 : -cameraX;
  const offsetY = mapHeight < height ? (height - mapHeight) / 2 : -cameraY;

  context.fillStyle = "#0a0d20";
  context.fillRect(offsetX, offsetY, mapWidth, mapHeight);
  context.fillStyle = "#1e3a8a";
  context.strokeStyle = "#5b7cff";
  context.lineWidth = Math.max(1, tileSize * 0.08);
  for (let y = 0; y < maze.height; y += 1) {
    for (let x = 0; x < maze.width; x += 1) {
      if (!maze.walls[y][x]) continue;
      const screenX = offsetX + x * tileSize;
      const screenY = offsetY + y * tileSize;
      context.fillRect(screenX, screenY, tileSize, tileSize);
      context.strokeRect(screenX + 1, screenY + 1, tileSize - 2, tileSize - 2);
    }
  }

  context.fillStyle = "#f8e8b5";
  snapshot.pellets.forEach((key) => {
    const [x, y] = key.split(",").map(Number);
    context.beginPath();
    context.arc(offsetX + (x + 0.5) * tileSize, offsetY + (y + 0.5) * tileSize, Math.max(1.2, tileSize * 0.08), 0, Math.PI * 2);
    context.fill();
  });
  snapshot.powerPellets.forEach((key) => {
    const [x, y] = key.split(",").map(Number);
    context.beginPath();
    context.arc(offsetX + (x + 0.5) * tileSize, offsetY + (y + 0.5) * tileSize, Math.max(2.5, tileSize * 0.2), 0, Math.PI * 2);
    context.fill();
  });

  Object.values(snapshot.actors).forEach((actor) => {
    if (actor.state === "dead") return;
    const x = offsetX + (actor.x + 0.5) * tileSize;
    const y = offsetY + (actor.y + 0.5) * tileSize;
    const radius = tileSize * 0.36;
    context.save();
    if (actor.state === "invulnerable" && Math.floor(snapshot.hostTime / 150) % 2 === 0) context.globalAlpha = 0.4;
    if (actor.state === "eaten") context.globalAlpha = 0.28;
    if (actor.role === "pacman") drawPacman(context, actor, x, y, radius);
    else drawGhost(context, actor, x, y, radius);
    if (actor.uid === localUid) {
      context.strokeStyle = "white";
      context.lineWidth = Math.max(2, tileSize * 0.07);
      context.beginPath();
      context.arc(x, y, radius * 1.35, 0, Math.PI * 2);
      context.stroke();
    }
    if (tileSize >= 20 || actor.uid === localUid) {
      context.font = `${Math.max(9, Math.min(13, tileSize * 0.34))}px system-ui`;
      context.textAlign = "center";
      context.textBaseline = "bottom";
      context.lineWidth = 3;
      context.strokeStyle = "#050713";
      context.strokeText(actor.name, x, y - radius - 3);
      context.fillStyle = "white";
      context.fillText(actor.name, x, y - radius - 3);
    }
    context.restore();
  });
}

export function scoreboardRows(snapshot: GameSnapshot, role: "pacman" | "ghost") {
  return Object.values(snapshot.actors)
    .filter((actor) => actor.role === role)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}
