import express from "express";
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { APP_VERSION, ROOM_TYPE, type HealthResponse } from "../src/protocol";
import { SqlRunRoom } from "./SqlRunRoom";
import { localIPv4Addresses, makeRoomCode, makeSecret } from "./network";

export interface GameServerOptions {
  port?: number;
  hostname?: string;
  staticDir?: string;
}

export async function startGameServer(options: GameServerOptions = {}) {
  const requestedPort = options.port ?? Number(process.env.PORT ?? 2567);
  let listeningPort = requestedPort;
  const hostname = options.hostname ?? "0.0.0.0";
  const roomCode = makeRoomCode();
  const hostToken = makeSecret();
  const app = express();
  const httpServer = createServer(app);
  const transport = new WebSocketTransport({ server: httpServer, pingInterval: 5000, pingMaxRetries: 3, maxPayload: 4096 });
  const gameServer = new Server({ transport });
  gameServer.define(ROOM_TYPE, SqlRunRoom).filterBy(["roomCode"]);

  app.disable("x-powered-by");
  app.use(express.json({ limit: "8kb" }));
  app.get("/api/health", (_request, response) => {
    const addresses = localIPv4Addresses();
    const publicUrl = `http://${addresses[0] ?? "127.0.0.1"}:${listeningPort}`;
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.json({ ok: true, version: APP_VERSION, port: listeningPort, addresses, publicUrl, roomCode } satisfies HealthResponse);
  });
  app.get("/api/host-bootstrap", (request, response) => {
    const remote = request.socket.remoteAddress ?? "";
    if (!isLoopback(remote)) return response.status(403).json({ error: "Host bootstrap is available only on this computer." });
    return response.json({ roomCode, hostToken });
  });

  if (options.staticDir && existsSync(options.staticDir)) {
    const indexFile = resolve(options.staticDir, "index.html");
    app.use(express.static(options.staticDir, { extensions: ["html"] }));
    app.get(/.*/, (_request, response) => response.sendFile(indexFile));
  }

  await gameServer.listen(requestedPort, hostname);
  const address = httpServer.address();
  if (address && typeof address === "object") listeningPort = address.port;
  const addresses = localIPv4Addresses();
  return {
    port: listeningPort,
    roomCode,
    localUrl: `http://127.0.0.1:${listeningPort}`,
    publicUrl: `http://${addresses[0] ?? "127.0.0.1"}:${listeningPort}`,
    addresses,
    close: async () => { await gameServer.gracefullyShutdown(false); },
  };
}

function isLoopback(address: string): boolean {
  return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";
}
