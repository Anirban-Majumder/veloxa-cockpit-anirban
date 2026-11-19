import { Hono } from "hono";
import { listAgents } from "../../../../src/agents/store";
import { officeAtCutoff } from "../../../../src/agents/office";
import { openDb } from "../../../../src/db/client";
import { resolveCutoff } from "../cutoff";

export const agents = new Hono()
  .get("/office", async (c) => c.json(await officeAtCutoff(await openDb(), await resolveCutoff(c.req.query("cutoff")))))
  .get("/", async (c) =>
    c.json(await listAgents(await openDb(), await resolveCutoff(c.req.query("cutoff")))));
