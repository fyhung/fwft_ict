import { describe, expect, it } from "vitest";
import { createMaze } from "./maze.ts";

describe("shared crowd maze", () => {
  it("provides 30 legal, paired spawns for each role in the same arena", () => {
    const maze = createMaze();
    expect(maze.pacmanSpawns).toHaveLength(30);
    expect(maze.ghostSpawns).toHaveLength(30);
    const all = [...maze.pacmanSpawns, ...maze.ghostSpawns];
    expect(new Set(all.map(({ x, y }) => `${x},${y}`)).size).toBe(60);
    all.forEach(({ x, y }) => expect(maze.walls[y][x]).toBe(false));
    maze.pacmanSpawns.forEach((pacman, index) => {
      const ghost = maze.ghostSpawns[index];
      expect(ghost.x).toBe(pacman.x);
      expect(pacman.y - ghost.y).toBe(4);
    });
  });

  it("places pellets and power pellets only on walkable tiles", () => {
    const maze = createMaze();
    [...maze.pellets, ...maze.powerPellets].forEach((key) => {
      const [x, y] = key.split(",").map(Number);
      expect(maze.walls[y][x]).toBe(false);
    });
  });
});
