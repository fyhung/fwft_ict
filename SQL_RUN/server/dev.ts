import { startGameServer } from "./index";

startGameServer()
  .then((server) => console.log(`SQL Run development server: ${server.publicUrl}`))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
