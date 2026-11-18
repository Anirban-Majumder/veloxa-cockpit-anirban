# Veloxa conventions

- Bun + TypeScript. `bun run dev` to run, `bun run typecheck`, `bun run lint`, `bun test tests` before handing work back.
- `src/` holds server logic and never imports from `apps/`. `apps/web` never imports from `src/`; it talks to the API over HTTP.
- API: one Hono file per resource in `apps/api/src/routes/`. Handlers stay thin: validate the body with zod via `readBody`, call a `src/` function, return JSON. Throw `HttpError(status, message)` for 4xx; `handleError` maps everything else to 500.
- Database: use `selectOne`, `selectAll`, `execute` and `transaction` from `src/db/client.ts`. Only the API process opens the database file.
- AI: each AI feature keeps its schemas and prompts in its own `config.ts`. One-shot structured output goes through `generateStructured` (`src/ai/generate.ts`); chat streams through the `ToolLoopAgent` in `src/chat/agent.ts`. Check AI SDK APIs against `node_modules/ai/docs`, not memory.
- Knowledge cutoff, person scope and salary restrictions are enforced in code (`src/retrieval`), never left to the model.
- Write readable code with descriptive names; add a comment only when the code cannot say it.
- No co-author or AI attribution trailers in commits.
