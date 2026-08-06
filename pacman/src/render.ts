import { colorValue, contrastValue } from "./palette.ts";
import type { CosmeticId } from "./cosmetics.ts";
import type { Maze } from "./maze.ts";
import type { Actor, BonusFruit, GameSnapshot } from "./types.ts";

function angleFor(actor: Pick<Actor, "direction">): number {
  return { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2, none: 0 }[actor.direction];
}

function drawPacman(context: CanvasRenderingContext2D, actor: Pick<Actor, "direction" | "colorId">, x: number, y: number, radius: number) {
  const angle = angleFor(actor);
  const mouth = 0.28 * Math.PI;
  context.fillStyle = colorValue(actor.colorId);
  context.beginPath();
  context.moveTo(x, y);
  context.arc(x, y, radius, angle + mouth, angle + Math.PI * 2 - mouth);
  context.closePath();
  context.fill();
  context.strokeStyle = contrastValue(actor.colorId);
  context.lineWidth = Math.max(1, radius * 0.12);
  context.stroke();
}

function drawGhost(context: CanvasRenderingContext2D, actor: Pick<Actor, "state" | "colorId">, x: number, y: number, radius: number) {
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
  context.strokeStyle = contrastValue(actor.colorId);
  context.lineWidth = Math.max(1, radius * 0.12);
  context.stroke();

  context.fillStyle = "white";
  context.beginPath();
  context.arc(x - radius * 0.34, y - radius * 0.1, radius * 0.22, 0, Math.PI * 2);
  context.arc(x + radius * 0.34, y - radius * 0.1, radius * 0.22, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#172033";
  context.beginPath();
  context.arc(x - radius * 0.34, y - radius * 0.08, radius * 0.09, 0, Math.PI * 2);
  context.arc(x + radius * 0.34, y - radius * 0.08, radius * 0.09, 0, Math.PI * 2);
  context.fill();
}

function drawBonusFruit(context: CanvasRenderingContext2D, fruit: BonusFruit, x: number, y: number, radius: number) {
  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";
  context.strokeStyle = "#4fd36b";
  context.lineWidth = Math.max(1.5, radius * 0.16);
  context.beginPath();
  context.moveTo(x, y - radius * 0.15);
  context.quadraticCurveTo(x + radius * 0.16, y - radius * 0.85, x + radius * 0.62, y - radius * 0.82);
  context.stroke();
  context.fillStyle = "#58dc71";
  context.beginPath();
  context.ellipse(x + radius * 0.7, y - radius * 0.82, radius * 0.35, radius * 0.18, -0.35, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = fruit.kind === "cherry" ? "#ff304f" : "#ff3d65";
  context.strokeStyle = "#720c28";
  context.lineWidth = Math.max(1, radius * 0.08);
  if (fruit.kind === "cherry") {
    context.beginPath();
    context.arc(x - radius * 0.3, y + radius * 0.2, radius * 0.42, 0, Math.PI * 2);
    context.arc(x + radius * 0.3, y + radius * 0.2, radius * 0.42, 0, Math.PI * 2);
    context.fill();
    context.stroke();
  } else {
    context.beginPath();
    context.moveTo(x, y + radius * 0.65);
    context.bezierCurveTo(x - radius, y, x - radius * 0.62, y - radius * 0.55, x, y - radius * 0.42);
    context.bezierCurveTo(x + radius * 0.62, y - radius * 0.55, x + radius, y, x, y + radius * 0.65);
    context.closePath();
    context.fill();
    context.stroke();
    context.fillStyle = "#ffd95b";
    for (const [dx, dy] of [[-0.3, -0.08], [0.28, -0.12], [-0.18, 0.25], [0.2, 0.28]] as const) {
      context.beginPath();
      context.arc(x + radius * dx, y + radius * dy, Math.max(1, radius * 0.06), 0, Math.PI * 2);
      context.fill();
    }
  }
  context.restore();
}

function drawCosmetic(context: CanvasRenderingContext2D, cosmeticId: CosmeticId, x: number, y: number, radius: number) {
  const top = y - radius * 0.92;
  context.save();
  context.lineJoin = "round";
  context.lineCap = "round";
  context.lineWidth = Math.max(1, radius * 0.1);
  context.strokeStyle = "#101425";

  if (cosmeticId === "party-hat") {
    context.fillStyle = "#ff4d9d";
    context.beginPath();
    context.moveTo(x, top - radius * 0.95);
    context.lineTo(x - radius * 0.62, top + radius * 0.12);
    context.lineTo(x + radius * 0.62, top + radius * 0.12);
    context.closePath(); context.fill(); context.stroke();
    context.fillStyle = "#f8d94e";
    context.beginPath(); context.arc(x, top - radius, radius * 0.18, 0, Math.PI * 2); context.fill();
  } else if (cosmeticId === "crown") {
    context.fillStyle = "#ffd84d";
    context.beginPath();
    context.moveTo(x - radius * 0.7, top + radius * 0.08);
    context.lineTo(x - radius * 0.62, top - radius * 0.62);
    context.lineTo(x - radius * 0.2, top - radius * 0.25);
    context.lineTo(x, top - radius * 0.78);
    context.lineTo(x + radius * 0.2, top - radius * 0.25);
    context.lineTo(x + radius * 0.62, top - radius * 0.62);
    context.lineTo(x + radius * 0.7, top + radius * 0.08);
    context.closePath(); context.fill(); context.stroke();
  } else if (cosmeticId === "top-hat") {
    context.fillStyle = "#252b43";
    context.fillRect(x - radius * 0.48, top - radius * 0.78, radius * 0.96, radius * 0.78);
    context.strokeRect(x - radius * 0.48, top - radius * 0.78, radius * 0.96, radius * 0.78);
    context.fillStyle = "#ff4f72";
    context.fillRect(x - radius * 0.48, top - radius * 0.2, radius * 0.96, radius * 0.2);
    context.fillStyle = "#252b43";
    context.fillRect(x - radius * 0.75, top - radius * 0.08, radius * 1.5, radius * 0.22);
  } else if (cosmeticId === "cap") {
    context.fillStyle = "#58a6ff";
    context.beginPath(); context.arc(x, top, radius * 0.66, Math.PI, 0); context.lineTo(x - radius * 0.66, top); context.fill(); context.stroke();
    context.beginPath(); context.ellipse(x + radius * 0.55, top + radius * 0.02, radius * 0.48, radius * 0.13, 0, 0, Math.PI * 2); context.fill(); context.stroke();
  } else if (cosmeticId === "beanie") {
    context.fillStyle = "#a96cff";
    context.beginPath(); context.arc(x, top, radius * 0.64, Math.PI, 0); context.lineTo(x - radius * 0.64, top); context.fill(); context.stroke();
    context.fillRect(x - radius * 0.68, top - radius * 0.08, radius * 1.36, radius * 0.28);
    context.beginPath(); context.arc(x, top - radius * 0.7, radius * 0.2, 0, Math.PI * 2); context.fill(); context.stroke();
  } else if (cosmeticId === "cowboy") {
    context.fillStyle = "#b97836";
    context.beginPath(); context.ellipse(x, top + radius * 0.04, radius * 0.88, radius * 0.2, 0, 0, Math.PI * 2); context.fill(); context.stroke();
    context.beginPath(); context.moveTo(x - radius * 0.48, top); context.quadraticCurveTo(x - radius * 0.42, top - radius * 0.78, x, top - radius * 0.58); context.quadraticCurveTo(x + radius * 0.42, top - radius * 0.78, x + radius * 0.48, top); context.closePath(); context.fill(); context.stroke();
  } else if (cosmeticId === "halo") {
    context.strokeStyle = "#ffe66b";
    context.lineWidth = Math.max(2, radius * 0.14);
    context.beginPath(); context.ellipse(x, top - radius * 0.48, radius * 0.72, radius * 0.22, 0, 0, Math.PI * 2); context.stroke();
  } else if (cosmeticId === "antenna") {
    context.strokeStyle = "#7ef9ff";
    context.lineWidth = Math.max(2, radius * 0.11);
    context.beginPath(); context.moveTo(x, top); context.lineTo(x - radius * 0.15, top - radius * 0.72); context.stroke();
    context.fillStyle = "#ff5da2";
    context.beginPath(); context.arc(x - radius * 0.15, top - radius * 0.84, radius * 0.19, 0, Math.PI * 2); context.fill(); context.stroke();
  } else if (cosmeticId === "cat-ears") {
    context.fillStyle = "#ff9fbd";
    context.beginPath(); context.moveTo(x - radius * 0.68, top + radius * 0.1); context.lineTo(x - radius * 0.48, top - radius * 0.72); context.lineTo(x - radius * 0.05, top); context.closePath(); context.fill(); context.stroke();
    context.beginPath(); context.moveTo(x + radius * 0.68, top + radius * 0.1); context.lineTo(x + radius * 0.48, top - radius * 0.72); context.lineTo(x + radius * 0.05, top); context.closePath(); context.fill(); context.stroke();
  } else if (cosmeticId === "bow") {
    context.fillStyle = "#ff5577";
    context.beginPath(); context.moveTo(x, top - radius * 0.08); context.quadraticCurveTo(x - radius * 0.85, top - radius * 0.65, x - radius * 0.66, top + radius * 0.2); context.lineTo(x, top); context.quadraticCurveTo(x + radius * 0.85, top - radius * 0.65, x + radius * 0.66, top + radius * 0.2); context.closePath(); context.fill(); context.stroke();
    context.beginPath(); context.arc(x, top - radius * 0.02, radius * 0.18, 0, Math.PI * 2); context.fill(); context.stroke();
  }
  context.restore();
}

export function renderCharacterPreview(
  canvas: HTMLCanvasElement,
  colorId: string,
  cosmeticId: CosmeticId | "",
  role: "pacman" | "ghost" = "pacman",
  size = 190,
) {
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = size * pixelRatio;
  canvas.height = size * pixelRatio;
  const context = canvas.getContext("2d");
  if (!context) return;
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  const center = size / 2;
  const characterY = size * 0.61;
  const radius = size * 0.253;
  const gradient = context.createRadialGradient(center, center, size * 0.03, center, center, size * 0.53);
  gradient.addColorStop(0, "#172044");
  gradient.addColorStop(1, "#080b1c");
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  const actor = { colorId, direction: "right" as const, state: "normal" as const };
  if (role === "ghost") drawGhost(context, actor, center, characterY, radius);
  else drawPacman(context, actor, center, characterY, radius);
  if (cosmeticId) drawCosmetic(context, cosmeticId, center, characterY, radius);
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
  if (snapshot.fruit) {
    const fruitX = offsetX + (snapshot.fruit.x + 0.5) * tileSize;
    const fruitY = offsetY + (snapshot.fruit.y + 0.5) * tileSize;
    drawBonusFruit(context, snapshot.fruit, fruitX, fruitY, tileSize * 0.38);
    if (tileSize >= 24) {
      context.font = `800 ${Math.max(9, tileSize * 0.26)}px system-ui`;
      context.textAlign = "center";
      context.textBaseline = "top";
      context.fillStyle = "#ffd95b";
      context.fillText(String(snapshot.fruit.value), fruitX, fruitY + tileSize * 0.42);
    }
  }

  Object.values(snapshot.actors)
    .sort((first, second) => Number(first.state === "dead") - Number(second.state === "dead"))
    .forEach((actor) => {
    if (actor.state === "dead" && snapshot.status !== "results") return;
    const x = offsetX + (actor.x + 0.5) * tileSize;
    const y = offsetY + (actor.y + 0.5) * tileSize;
    const radius = tileSize * 0.36;
    context.save();
    if (actor.state === "invulnerable" && Math.floor(snapshot.hostTime / 150) % 2 === 0) context.globalAlpha = 0.4;
    if (actor.state === "eaten") context.globalAlpha = 0.28;
    if (actor.state === "dead") context.globalAlpha = 0.62;
    if (actor.role === "pacman") drawPacman(context, actor, x, y, radius);
    else drawGhost(context, actor, x, y, radius);
    drawCosmetic(context, actor.cosmeticId, x, y, radius);
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
