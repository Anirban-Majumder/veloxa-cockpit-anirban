import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { Hono } from "hono";
import { getConnInfo } from "hono/bun";
import { deleteCookie, getSignedCookie, setSignedCookie } from "hono/cookie";
import { z } from "zod";
import { HttpError, readBody, rejectForeignOrigins } from "../http";

const SESSION = "veloxa_session";
const SESSION_SECONDS = 7 * 24 * 60 * 60;
const FAILURE_WINDOW_MS = 60_000;
const MAX_FAILURES = 5;
const loginBody = z.object({ passphrase: z.string() });
const hash = (value: string) => createHash("sha256").update(value).digest();

export function auth(passphrase: string | undefined, production: boolean, loginPage: string) {
  if (!passphrase && production) throw new Error("VELOXA_PASSPHRASE must be set in production.");
  if (!passphrase) console.warn("VELOXA_PASSPHRASE is unset. Authentication is disabled in development.");

  const expectedHash = passphrase ? hash(passphrase) : undefined;
  const signingKey = passphrase ? createHmac("sha256", passphrase).update("veloxa-session-v1").digest("hex") : "";
  const cookieOptions = { path: "/", httpOnly: true, sameSite: "Strict", secure: production } as const;
  const failuresByIp = new Map<string, number[]>();
  let nextSweep = 0;

  const matches = (value: string) => !!expectedHash && timingSafeEqual(expectedHash, hash(value));

  function recentFailures(ip: string, now: number) {
    if (now >= nextSweep) {
      for (const [address, failures] of failuresByIp) {
        if (failures.at(-1)! <= now - FAILURE_WINDOW_MS) failuresByIp.delete(address);
      }
      nextSweep = now + FAILURE_WINDOW_MS;
    }
    return (failuresByIp.get(ip) ?? []).filter((time) => time > now - FAILURE_WINDOW_MS);
  }

  return new Hono()
    .use("*", async (c, next) => {
      c.header("Cache-Control", "no-store");
      const { path, method } = c.req;
      if (!expectedHash || (path === "/login" && (method === "GET" || method === "HEAD")) ||
          (path === "/api/login" && method === "POST")) return next();

      const header = c.req.header("x-veloxa-passphrase");
      if (header !== undefined && matches(header)) return next();

      const expiresAt = await getSignedCookie(c, signingKey, SESSION);
      if (typeof expiresAt === "string" && Number(expiresAt) > Date.now()) return next();

      if (path === "/api" || path.startsWith("/api/")) throw new HttpError(401, "Authentication required.");
      return c.redirect("/login");
    })
    .use("/api/*", rejectForeignOrigins)
    .get("/login", (c) => {
      if (!expectedHash) return c.redirect("/");
      return c.body(Bun.file(loginPage).stream(), 200, { "Content-Type": "text/html; charset=utf-8" });
    })
    .get("/api/session", (c) => c.json({ enabled: !!expectedHash }))
    .post("/api/login", async (c) => {
      if (!expectedHash) return c.json({ ok: true });

      const ip = (c.env ? getConnInfo(c).remote.address : undefined) ?? "unknown";
      function checkLimit(now: number) {
        const failures = recentFailures(ip, now);
        if (failures.length >= MAX_FAILURES) {
          c.header("Retry-After", String(Math.ceil((failures[0]! + FAILURE_WINDOW_MS - now) / 1000)));
          throw new HttpError(429, "Too many failed attempts. Try again in a minute.");
        }
        return failures;
      }

      checkLimit(Date.now());
      const { passphrase: submitted } = await readBody(c, loginBody);
      const now = Date.now();
      const failures = checkLimit(now);
      if (!matches(submitted)) {
        failuresByIp.set(ip, [...failures, now]);
        throw new HttpError(401, "Incorrect passphrase.");
      }
      const expires = new Date(now + SESSION_SECONDS * 1000);
      await setSignedCookie(c, SESSION, String(expires.getTime()), signingKey, {
        ...cookieOptions,
        expires,
        maxAge: SESSION_SECONDS,
      });
      return c.json({ ok: true });
    })
    .post("/api/logout", (c) => {
      deleteCookie(c, SESSION, cookieOptions);
      return c.json({ ok: true });
    });
}
