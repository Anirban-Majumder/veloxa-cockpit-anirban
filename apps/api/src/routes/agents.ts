import { describeRoute } from "hono-openapi";
import { Hono } from "hono";
import { listAgents } from "../../../../src/agents/store";
import { officeAtCutoff } from "../../../../src/agents/office";
import { openDb } from "../../../../src/db/client";
import { resolveCutoff } from "../cutoff";

export const agents = new Hono()
  .get("/office", describeRoute({
  summary: "Get the office roster",
  description: "Returns office presences at the selected release.",
  tags: ["People"],
  parameters: [
    { name: "cutoff", in: "query", description: "Exact release cutoff, defaults to the latest available release.", schema: { type: "string" } },
  ],
  responses: {
    200: { description: "Office roster" },
    400: { description: "Unknown cutoff" },
    409: { description: "No releases ingested" },
  },
}), async (c) => c.json(await officeAtCutoff(await openDb(), await resolveCutoff(c.req.query("cutoff")))))
  .get("/", describeRoute({
  summary: "List people",
  description: "Returns people at the selected release.",
  tags: ["People"],
  parameters: [
    { name: "cutoff", in: "query", description: "Exact release cutoff, defaults to the latest available release.", schema: { type: "string" } },
  ],
  responses: {
    200: { description: "People at the release" },
    400: { description: "Unknown cutoff" },
    409: { description: "No releases ingested" },
  },
}), async (c) =>
    c.json(await listAgents(await openDb(), await resolveCutoff(c.req.query("cutoff")))));
