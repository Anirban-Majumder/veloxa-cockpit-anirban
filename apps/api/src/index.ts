import { modelSettings } from "../../../src/ai/model";
import { createApp } from "./app";
import { deploySettings } from "./config";

const settings = deploySettings();
const app = createApp(process.env.VELOXA_PASSPHRASE, settings);

const port = Number(process.env.PORT ?? 8787);
const hostname = process.env.HOST ?? "127.0.0.1";

if (!modelSettings()) console.warn("GOOGLE_GENERATIVE_AI_API_KEY is not set: chat and concern generation will fail.");
console.log(`API listening on http://${hostname}:${port} (APP_ENV=${settings.appEnv}${settings.basePath ? `, public path ${settings.basePath}/` : ""})`);

export default { port, hostname, fetch: app.fetch, idleTimeout: 120 };
