import { Hono } from "hono";
import { listAgents } from "../../../../src/agents/store";
import { openDb } from "../../../../src/db/client";
import { resolveCutoff } from "../cutoff";

export const agents = new Hono().get("/", async (c) =>
  c.json(await listAgents(await openDb(), await resolveCutoff(c.req.query("cutoff")))));
