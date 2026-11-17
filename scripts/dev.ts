// Starts the API and the Vite UI together; Ctrl+C stops both.
const procs = [
  Bun.spawn(["bun", "--watch", "apps/api/src/index.ts"], { stdio: ["inherit", "inherit", "inherit"] }),
  Bun.spawn(["bun", "--bun", "vite", "--config", "apps/web/vite.config.ts", "--host"], { stdio: ["inherit", "inherit", "inherit"] }),
];
const stop = () => { for (const p of procs) p.kill(); process.exit(0); };
process.on("SIGINT", stop); process.on("SIGTERM", stop);
await Promise.race(procs.map((p) => p.exited)); stop();
export {};
