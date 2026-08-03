export const MAZE_WIDTH = 41;
export const MAZE_HEIGHT = 31;
export const TUNNEL_ROW = 15;

export interface Maze {
  width: number;
  height: number;
  walls: boolean[][];
  pellets: string[];
  powerPellets: string[];
  pacmanSpawns: Array<{ x: number; y: number }>;
  ghostSpawns: Array<{ x: number; y: number }>;
}

export const tileKey = (x: number, y: number) => `${x},${y}`;

function fillRect(walls: boolean[][], x: number, y: number, width: number, height: number) {
  for (let row = y; row < y + height; row += 1) {
    for (let column = x; column < x + width; column += 1) {
      if (row > 0 && row < MAZE_HEIGHT - 1 && column > 0 && column < MAZE_WIDTH - 1) {
        walls[row][column] = true;
      }
    }
  }
}

function clearRect(walls: boolean[][], x: number, y: number, width: number, height: number) {
  for (let row = y; row < y + height; row += 1) {
    for (let column = x; column < x + width; column += 1) {
      if (row >= 0 && row < MAZE_HEIGHT && column >= 0 && column < MAZE_WIDTH) {
        walls[row][column] = false;
      }
    }
  }
}

function nearestFloorTiles(
  walls: boolean[][],
  centerX: number,
  centerY: number,
  minY: number,
  maxY: number,
  count: number,
) {
  const candidates: Array<{ x: number; y: number; distance: number }> = [];
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = 2; x < MAZE_WIDTH - 2; x += 1) {
      if (!walls[y][x]) {
        candidates.push({ x, y, distance: Math.abs(x - centerX) + Math.abs(y - centerY) * 1.25 });
      }
    }
  }
  return candidates
    .sort((a, b) => a.distance - b.distance || Math.abs(a.x - centerX) - Math.abs(b.x - centerX))
    .slice(0, count)
    .map(({ x, y }) => ({ x, y }));
}

export function createMaze(): Maze {
  const walls = Array.from({ length: MAZE_HEIGHT }, (_, y) =>
    Array.from({ length: MAZE_WIDTH }, (_, x) => x === 0 || y === 0 || x === MAZE_WIDTH - 1 || y === MAZE_HEIGHT - 1),
  );

  walls[TUNNEL_ROW][0] = false;
  walls[TUNNEL_ROW][MAZE_WIDTH - 1] = false;

  const blocks = [
    [4, 3, 4, 3], [11, 3, 5, 3], [25, 3, 5, 3], [33, 3, 4, 3],
    [4, 9, 4, 3], [12, 9, 4, 4], [25, 9, 4, 4], [33, 9, 4, 3],
    [4, 19, 4, 3], [12, 19, 4, 4], [25, 19, 4, 4], [33, 19, 4, 3],
    [4, 25, 4, 3], [11, 25, 5, 3], [25, 25, 5, 3], [33, 25, 4, 3],
    [18, 4, 5, 2], [18, 25, 5, 2],
  ] as const;
  blocks.forEach(([x, y, width, height]) => fillRect(walls, x, y, width, height));

  // A large shared central arena and a lower spawn apron keep 30-player starts clear.
  clearRect(walls, 16, 12, 9, 6);
  clearRect(walls, 12, 14, 17, 3);
  clearRect(walls, 13, 23, 15, 2);

  const pacmanSpawns = nearestFloorTiles(walls, 20, 24, 23, 27, 15);
  const ghostSpawns = nearestFloorTiles(walls, 20, 15, 13, 17, 15);
  const spawnKeys = new Set([...pacmanSpawns, ...ghostSpawns].map(({ x, y }) => tileKey(x, y)));
  const powerCandidates = [
    { x: 2, y: 2 },
    { x: MAZE_WIDTH - 3, y: 2 },
    { x: 2, y: MAZE_HEIGHT - 3 },
    { x: MAZE_WIDTH - 3, y: MAZE_HEIGHT - 3 },
    { x: 2, y: TUNNEL_ROW },
    { x: MAZE_WIDTH - 3, y: TUNNEL_ROW },
  ];
  const powerPellets = powerCandidates.filter(({ x, y }) => !walls[y][x]).map(({ x, y }) => tileKey(x, y));
  const powerSet = new Set(powerPellets);
  const pellets: string[] = [];

  for (let y = 1; y < MAZE_HEIGHT - 1; y += 1) {
    for (let x = 1; x < MAZE_WIDTH - 1; x += 1) {
      const key = tileKey(x, y);
      if (!walls[y][x] && !spawnKeys.has(key) && !powerSet.has(key)) pellets.push(key);
    }
  }

  return { width: MAZE_WIDTH, height: MAZE_HEIGHT, walls, pellets, powerPellets, pacmanSpawns, ghostSpawns };
}

export function isWall(maze: Maze, x: number, y: number): boolean {
  const tileX = Math.floor(x + 0.5);
  const tileY = Math.floor(y + 0.5);
  if (tileY < 0 || tileY >= maze.height) return true;
  if (tileX < 0 || tileX >= maze.width) return tileY !== TUNNEL_ROW;
  return maze.walls[tileY][tileX];
}
