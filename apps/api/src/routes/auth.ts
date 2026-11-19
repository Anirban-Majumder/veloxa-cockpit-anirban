import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { Hono, type Context } from "hono";
import { getConnInfo } from "hono/bun";
import { deleteCookie, getSignedCookie, setSignedCookie } from "hono/cookie";
import { z } from "zod";
import type { DeploySettings } from "../config";
import { HttpError, readBody, rejectForeignOrigins } from "../http";

const SESSION = "veloxa_session";
const SESSION_SECONDS = 7 * 24 * 60 * 60;
const FAILURE_WINDOW_MS = 60_000;
const MAX_FAILURES = 5;
const loginBody = z.object({ passphrase: z.string() });
const hash = (value: string) => createHash("sha256").update(value).digest();
const LOOPBACK = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

/** Behind the local reverse proxy every request comes from loopback, so trust its X-Real-IP there and only there. */
function clientIp(c: Context) {
  const remote = c.env ? getConnInfo(c).remote.address : undefined;
  const forwarded = c.req.header("x-real-ip")?.trim();
  if (remote && LOOPBACK.has(remote) && forwarded) return forwarded;
  return remote ?? "unknown";
}

export function auth(passphrase: string | undefined, settings: Pick<DeploySettings, "appEnv" | "basePath" | "publicOrigins">, loginPage: string) {
  const production = settings.appEnv === "prod";
  if (!passphrase && production) throw new Error("VELOXA_PASSPHRASE must be set when APP_ENV=prod.");
  if (!production) console.warn("APP_ENV=dev: authentication, HTTPS cookies, PUBLIC_BASE_PATH and PUBLIC_ORIGINS are off.");

  const base = settings.basePath;
  const expectedHash = production && passphrase ? hash(passphrase) : undefined;
  const signingKey = passphrase ? createHmac("sha256", passphrase).update("veloxa-session-v1").digest("hex") : "";
  const cookieOptions = { path: base ? `${base}/` : "/", httpOnly: true, sameSite: "Strict", secure: production } as const;
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
      return c.redirect(`${base}/login`);
    })
    .use("/api/*", rejectForeignOrigins(settings.publicOrigins))
    .get("/login", (c) => {
      if (!expectedHash) return c.redirect(`${base}/`);
      return c.body(Bun.file(loginPage).stream(), 200, { "Content-Type": "text/html; charset=utf-8" });
    })
    .get("/api/session", (c) => c.json({ enabled: !!expectedHash }))
    .post("/api/login", async (c) => {
      if (!expectedHash) return c.json({ ok: true });

      const ip = clientIp(c);
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
