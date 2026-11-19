import { modelSettings } from "../../../src/ai/model";
import { createApp } from "./app";

const app = createApp(process.env.VELOXA_PASSPHRASE, process.env.NODE_ENV === "production");

const port = Number(process.env.PORT ?? 8787);
const hostname = process.env.HOST ?? "127.0.0.1";

if (!modelSettings()) console.warn("GOOGLE_GENERATIVE_AI_API_KEY is not set: chat and concern generation will fail.");
console.log(`API listening on http://${hostname}:${port}`);

export default { port, hostname, fetch: app.fetch, idleTimeout: 120 };
