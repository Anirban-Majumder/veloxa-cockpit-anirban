const run = (cmd: string[]) => Bun.spawn(cmd, { stdio: ["inherit", "inherit", "inherit"] });

const processes = [
  run(["bun", "--watch", "apps/api/src/index.ts"]),
  run(["bun", "--bun", "vite", "--config", "apps/web/vite.config.ts"]),
];

function stopAll() {
  for (const p of processes) p.kill();
  process.exit(0);
}

process.on("SIGINT", stopAll);
process.on("SIGTERM", stopAll);
await Promise.race(processes.map((p) => p.exited));
stopAll();
export {};
