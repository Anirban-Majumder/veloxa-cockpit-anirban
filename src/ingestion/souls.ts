import { z } from "zod";
import { execute, transaction, type Db } from "../db/client";
import { AGENT_ROSTER } from "./ingest";

const SoulFile = z.array(z.object({ employee_id: z.string(), soul: z.string().trim().min(1) }));

export async function ingestSouls(db: Db, log: (line: string) => void, path = "data/souls.json") {
  const file = Bun.file(path);
  if (!await file.exists()) {
    log(`Warning: ${path} is missing; skipping agent souls.`);
    return;
  }
  const souls = SoulFile.parse(await file.json());
  const seen = new Set<string>();
  for (const { employee_id } of souls) {
    if (!AGENT_ROSTER.includes(employee_id)) throw new Error(`Unknown employee ID in ${path}: ${employee_id}`);
    if (seen.has(employee_id)) throw new Error(`Duplicate employee ID in ${path}: ${employee_id}`);
    seen.add(employee_id);
  }
  await transaction(db, async () => {
    for (const { employee_id, soul } of souls) {
      await execute(db, "UPDATE agents SET soul = ? WHERE employee_id = ?", soul, employee_id);
    }
  });
}
