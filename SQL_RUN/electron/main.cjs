const { app, BrowserWindow, dialog } = require("electron");
const path = require("node:path");

let gameServer;

async function createHostWindow() {
  const serverModule = require(path.join(__dirname, "../dist-server/server.cjs"));
  gameServer = await serverModule.startGameServer({
    port: 2567,
    hostname: "0.0.0.0",
    staticDir: path.join(__dirname, "../dist"),
  });
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    autoHideMenuBar: true,
    backgroundColor: "#0c1020",
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  const url = new URL(gameServer.localUrl);
  url.searchParams.set("host", "1");
  await window.loadURL(url.toString());
}

app.whenReady().then(() => createHostWindow().catch((error) => {
  dialog.showErrorBox("SQL Run could not start", error instanceof Error ? (error.stack || error.message) : String(error));
  app.quit();
}));
app.on("window-all-closed", () => app.quit());
app.on("before-quit", () => { if (gameServer) void gameServer.close(); });
