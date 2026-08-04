const { app, BrowserWindow, dialog } = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

let gameServer;

async function createHostWindow() {
  const serverModule = await import(pathToFileURL(path.join(__dirname, "../dist-server/server.js")).href);
  gameServer = await serverModule.startGameServer({
    port: 2567,
    hostname: "0.0.0.0",
    staticDir: path.join(__dirname, "../dist"),
  });
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1024,
    minHeight: 700,
    title: "Maze Chase Host",
    backgroundColor: "#090b16",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  const hostUrl = new URL(gameServer.localUrl);
  hostUrl.searchParams.set("host", "1");
  hostUrl.searchParams.set("public", gameServer.publicUrl);
  await window.loadURL(hostUrl.toString());
}

app.whenReady().then(() => createHostWindow().catch((error) => {
  dialog.showErrorBox("Maze Chase Host could not start", error instanceof Error ? error.stack ?? error.message : String(error));
  app.quit();
}));

app.on("window-all-closed", () => app.quit());
app.on("before-quit", () => {
  if (gameServer) void gameServer.close();
});
