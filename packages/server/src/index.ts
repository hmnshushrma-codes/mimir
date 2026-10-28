import { loadConfig } from "./config.js";
import { openDb } from "./db.js";
import { buildApp } from "./server.js";

const config = loadConfig();
const db = openDb(config.dbPath);
const app = buildApp({ config, db });

app
  .listen({ port: config.port, host: config.host })
  .then(() => {
    console.log(`agent-workshop collector listening on http://${config.host}:${config.port}`);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
