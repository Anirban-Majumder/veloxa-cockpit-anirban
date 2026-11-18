import { openDb } from "../src/db/client";
import { initializeData } from "../src/ingestion/initialize";

try {
  await initializeData(await openDb());
  process.exit(0);
} catch (error) {
  console.error("Container initialization failed:", (error as Error).message);
  process.exit(1);
}
