import { describe, expect, test } from "bun:test";
import { createApp } from "../apps/api/src/app";

const passphrase = "shared test passphrase";
const makeApp = (secret = passphrase) => createApp(secret, true);
type App = ReturnType<typeof makeApp>;

function login(app: App, submitted: string, address = "192.0.2.1") {
  return app.request("/api/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ passphrase: submitted }),
  }, { requestIP: () => ({ address, family: "IPv4", port: 12345 }) });
}

describe("passphrase authentication", () => {
  test("rejects API requests and redirects unauthenticated page and asset requests", async () => {
    const app = makeApp();
    for (const path of ["/api/status", "/api/chat", "/api/ingest", "/api/logout", "/api/unknown"]) {
      const response = await app.request(path, { method: "POST" });
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: "Authentication required." });
    }
    for (const path of ["/", "/assets/dashboard.js"]) {
      const response = await app.request(path);
      expect(response.status).toBe(302);
      expect(response.headers.get("location")).toBe("/login");
    }
    const loginPage = await createApp(passphrase, false).request("/login");
    expect(loginPage.status).toBe(200);
    expect(await loginPage.text()).toContain("Veloxa Digital HQ");
  });

  test("rejects the wrong passphrase and issues an expiring signed cookie on success", async () => {
    const app = makeApp();
    const failure = await login(app, "incorrect");
    expect(failure.status).toBe(401);
    expect(failure.headers.get("set-cookie")).toBeNull();

    const response = await login(app, passphrase);
    expect(response.status).toBe(200);
    const setCookie = response.headers.get("set-cookie")!;
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Strict");
    expect(setCookie).toContain("Secure");
    expect(setCookie).toContain("Max-Age=604800");
    expect(setCookie).toContain("Expires=");
    const cookie = setCookie.split(";")[0]!;
    expect((await app.request("/api/session", { headers: { cookie } })).status).toBe(200);
    expect((await app.request("/api/session", { headers: { cookie: cookie + "x" } })).status).toBe(401);
    expect((await makeApp("new passphrase").request("/api/session", { headers: { cookie } })).status).toBe(401);
  });

  test("limits logins after five failures from one IP within a minute", async () => {
    const app = makeApp();
    for (let i = 0; i < 5; i++) expect((await login(app, "incorrect")).status).toBe(401);
    const limited = await login(app, passphrase);
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
    expect((await login(app, passphrase, "192.0.2.2")).status).toBe(200);
  });

  test("accepts the passphrase header and rejects an incorrect one", async () => {
    const app = makeApp();
    for (const [value, status] of [[passphrase, 200], ["incorrect", 401]] as const) {
      const response = await app.request("/api/session", { headers: { "x-veloxa-passphrase": value } });
      expect(response.status).toBe(status);
      expect(response.headers.get("set-cookie")).toBeNull();
    }
  });

  test("logout expires the browser's session cookie", async () => {
    const app = makeApp();
    const session = (await login(app, passphrase)).headers.get("set-cookie")!.split(";")[0]!;
    const response = await app.request("/api/logout", { method: "POST", headers: { cookie: session } });
    expect(response.status).toBe(200);
    const expired = response.headers.get("set-cookie")!;
    expect(expired).toContain("veloxa_session=;");
    expect(expired).toContain("Path=/");
    expect(expired).toContain("Max-Age=0");
    expect((await app.request("/api/session", { headers: { cookie: expired.split(";")[0]! } })).status).toBe(401);
  });

  test("requires a production passphrase and allows passphrase-free development", async () => {
    expect(() => createApp(undefined, true)).toThrow("VELOXA_PASSPHRASE must be set");
    const response = await createApp(undefined, false).request("/api/session");
    expect(await response.json()).toEqual({ enabled: false });
  });
});
