import { resolve } from "node:path";
import { APP_VERSION } from "../src/protocol";
import { startGameServer } from "./index";

startGameServer({ staticDir: resolve(process.cwd(), "dist") })
  .then((server) => console.log(`SQL Run v${APP_VERSION} listening at ${server.publicUrl}`))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
