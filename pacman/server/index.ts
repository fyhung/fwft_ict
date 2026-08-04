import express from "express";
import { networkInterfaces } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { SERVER_PORT, ROOM_TYPE } from "../src/protocol.ts";
import { MazeRoom } from "./MazeRoom.ts";

export interface GameServerOptions {
  port?: number;
  hostname?: string;
  staticDir?: string;
  devMode?: boolean;
}

export function localIPv4Addresses(): string[] {
  const preferredAdapter = /wi-?fi|wireless|wlan|ethernet/i;
  const virtualAdapter = /virtual|vmware|vbox|hyper-v|wsl|tailscale|zerotier|vpn|loopback/i;
  return Object.entries(networkInterfaces())
    .flatMap(([adapter, entries]) => (entries ?? []).map((entry) => ({ adapter, entry })))
    .filter(({ entry }) => entry.family === "IPv4" && !entry.internal && !entry.address.startsWith("169.254."))
    .sort((first, second) => {
      const score = (adapter: string) => (preferredAdapter.test(adapter) ? 2 : 0) - (virtualAdapter.test(adapter) ? 4 : 0);
      return score(second.adapter) - score(first.adapter);
    })
    .map(({ entry }) => entry.address);
}

export async function startGameServer(options: GameServerOptions = {}) {
  const port = options.port ?? SERVER_PORT;
  const hostname = options.hostname ?? "0.0.0.0";
  const staticDir = options.staticDir ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../dist");
  const transport = new WebSocketTransport();
  const gameServer = new Server({
    transport,
    devMode: options.devMode ?? false,
    greet: false,
    express: (app) => {
      app.disable("x-powered-by");
      app.get("/api/health", (_request, response) => {
        const addresses = localIPv4Addresses();
        response.setHeader("Access-Control-Allow-Origin", "*");
        response.json({
          ok: true,
          port,
          addresses,
          publicUrl: `http://${addresses[0] ?? "127.0.0.1"}:${port}`,
        });
      });
      app.use(express.static(staticDir, { index: "index.html", maxAge: options.devMode ? 0 : "1h" }));
    },
  });
  gameServer.define(ROOM_TYPE, MazeRoom);
  await gameServer.listen(port, hostname);
  const addresses = localIPv4Addresses();
  return {
    gameServer,
    port,
    addresses,
    localUrl: `http://127.0.0.1:${port}`,
    publicUrl: `http://${addresses[0] ?? "127.0.0.1"}:${port}`,
    close: () => gameServer.gracefullyShutdown(false),
  };
}

const launchedDirectly = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (launchedDirectly) {
  const devMode = process.argv.includes("--dev");
  const server = await startGameServer({ devMode });
  console.log(`Maze Chase server: ${server.localUrl}`);
  server.addresses.forEach((address) => console.log(`Student network: http://${address}:${server.port}`));
}
