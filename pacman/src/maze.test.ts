import { describe, expect, it } from "vitest";
import { createMaze } from "./maze.ts";

describe("shared crowd maze", () => {
  it("provides 15 legal, unique spawns for each role in the same arena", () => {
    const maze = createMaze();
    expect(maze.pacmanSpawns).toHaveLength(15);
    expect(maze.ghostSpawns).toHaveLength(15);
    const all = [...maze.pacmanSpawns, ...maze.ghostSpawns];
    expect(new Set(all.map(({ x, y }) => `${x},${y}`)).size).toBe(30);
    all.forEach(({ x, y }) => expect(maze.walls[y][x]).toBe(false));
  });

  it("places pellets and power pellets only on walkable tiles", () => {
    const maze = createMaze();
    [...maze.pellets, ...maze.powerPellets].forEach((key) => {
      const [x, y] = key.split(",").map(Number);
      expect(maze.walls[y][x]).toBe(false);
    });
  });
});
