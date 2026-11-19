export type AppEnv = "dev" | "prod";

export type DeploySettings = {
  appEnv: AppEnv;
  /** Path prefix a reverse proxy strips before forwarding, e.g. "/VeloxaDigitalHQ". Empty in dev. */
  basePath: string;
  /** Extra browser origins allowed to call the API. Ignored in dev, where only localhost is allowed. */
  publicOrigins: string[];
  /** Serve the built frontend from apps/web/dist rather than leaving it to the Vite dev server. */
  serveBuild: boolean;
};

export function normalizeBasePath(value: string | undefined) {
  const trimmed = (value ?? "").trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  if (!/^\/[A-Za-z0-9._~-]+(?:\/[A-Za-z0-9._~-]+)*$/.test(trimmed)) {
    throw new Error(`PUBLIC_BASE_PATH must look like /VeloxaDigitalHQ, got "${value}".`);
  }
  return trimmed;
}

export function deploySettings(env: Record<string, string | undefined> = process.env): DeploySettings {
  const raw = (env.APP_ENV ?? "dev").trim().toLowerCase();
  if (raw !== "dev" && raw !== "prod") throw new Error(`APP_ENV must be "dev" or "prod", got "${env.APP_ENV}".`);
  const prod = raw === "prod";
  return {
    appEnv: raw,
    basePath: prod ? normalizeBasePath(env.PUBLIC_BASE_PATH) : "",
    publicOrigins: prod ? (env.PUBLIC_ORIGINS ?? "").split(",").map((origin) => origin.trim()).filter(Boolean) : [],
    serveBuild: env.NODE_ENV === "production",
  };
}
