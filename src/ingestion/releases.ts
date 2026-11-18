import { readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

export const RELEASE_ROOT = resolve(process.env.VELOXA_RELEASE_DIR ?? "data/Release_Packs");
const YEAR = Number(process.env.VELOXA_RELEASE_YEAR ?? 2026);
const MONTHS = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];

export interface Release {
  day: number;
  folder: string;
  /** Day folders are "treated as released at 10:00 AM IST" (hackathon email). */
  releasedAt: string;
}

/** Discovers DayN_Ddd_DDMon folders, sorted by day number. */
export function discoverReleases(root = RELEASE_ROOT): Release[] {
  const out: Release[] = [];
  for (const name of readdirSync(root)) {
    const m = name.match(/^Day(\d+)_[A-Za-z]{3}_(\d{1,2})([A-Za-z]{3})$/);
    if (!m || !statSync(join(root, name)).isDirectory()) continue;
    const month = MONTHS.indexOf(m[3]!.toLowerCase());
    if (month < 0) continue;
    const date = `${YEAR}-${String(month + 1).padStart(2, "0")}-${m[2]!.padStart(2, "0")}`;
    out.push({ day: Number(m[1]), folder: name, releasedAt: `${date}T10:00:00+05:30` });
  }
  return out.sort((a, b) => a.day - b.day);
}

/** A day's pack exists upfront but counts only from its release time. */
export const isReleased = (releasedAt: string, now = Date.now()) => Date.parse(releasedAt) <= now;

/** Only these subfolders are product inputs; brief/ and data_room/templates/ are not company evidence. */
export const INPUT_DIRS = ["data_room", "transcripts"] as const;
export const SKIP_DIRS = new Set(["templates"]);
