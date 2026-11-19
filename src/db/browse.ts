import { execute, type Db } from "./client";

const metadataPragmas = new Set([
  "FOREIGN_KEY_CHECK", "FOREIGN_KEY_LIST", "INDEX_INFO", "INDEX_LIST", "INDEX_XINFO",
  "INTEGRITY_CHECK", "QUICK_CHECK", "TABLE_INFO", "TABLE_LIST", "TABLE_XINFO",
]);
const readPragmas = new Set([
  ...metadataPragmas, "APPLICATION_ID", "COLLATION_LIST", "COMPILE_OPTIONS", "DATABASE_LIST",
  "ENCODING", "FOREIGN_KEYS", "FUNCTION_LIST", "JOURNAL_MODE", "MODULE_LIST", "PAGE_COUNT",
  "PAGE_SIZE", "PRAGMA_LIST", "QUERY_ONLY", "SCHEMA_VERSION", "USER_VERSION",
]);
const transactionCommands = new Set(["BEGIN", "COMMIT", "END", "ROLLBACK", "SAVEPOINT", "RELEASE"]);
const externalFunctions = new Set(["LOAD_EXTENSION", "WRITEFILE", "EDIT", "EVAL"]);
const quoteStarts = "'\"`[";

// Keep quoted values and comments intact so their punctuation cannot change statement boundaries.
function sqlTokens(sql: string) {
  const tokens: string[] = [];
  for (const [token] of sql.matchAll(/--[^\n]*|\/\*[\s\S]*?\*\/|'(?:''|[^'])*'|"(?:""|[^"])*"|`(?:``|[^`])*`|\[[^\]]*\]|[a-z_\u0080-\uFFFF][a-z0-9_$\u0080-\uFFFF]*|[ \t\r\n\f]+|[^]/gi)) {
    if (/^(?:--|\/\*|[ \t\r\n\f])/.test(token)) continue;
    if (token.length === 1 && quoteStarts.includes(token)) return [];
    tokens.push(token.toUpperCase());
  }
  if (tokens.at(-1) === ";") tokens.pop();
  return tokens;
}

function mainCommand(tokens: string[]) {
  if (tokens[0] !== "WITH") return tokens[0];
  let depth = 0;
  for (const [index, token] of tokens.entries()) {
    if (token === "(") depth++;
    if (token === ")" && --depth === 0 && tokens[index + 1] !== "," && tokens[index + 1] !== "AS") {
      return tokens[index + 1];
    }
  }
}

function isReadPragma(tokens: string[]) {
  const name = tokens[2] === "." ? 3 : 1;
  const pragma = tokens[name] ?? "";
  if (tokens.length === name + 1) return readPragmas.has(pragma);
  // Only these inspection pragmas accept arguments without changing connection state.
  return metadataPragmas.has(pragma) && tokens[name + 1] === "(" && tokens.at(-1) === ")" &&
    !tokens.includes("=");
}

export function isBrowserStatementAllowed(sql: string, writable = false) {
  const tokens = sqlTokens(sql);
  const first = tokens[0];
  if (!first || sql.includes("\0") || tokens.includes(";") || transactionCommands.has(first)) return false;
  if (writable) return true;
  if (tokens.some((token, index) => {
    const name = quoteStarts.includes(token[0]!) ? token.slice(1, -1) : token;
    return tokens[index + 1] === "(" && externalFunctions.has(name);
  })) return false;
  if (first === "PRAGMA") return isReadPragma(tokens);
  if (first === "EXPLAIN") {
    const command = mainCommand(tokens.slice(tokens[1] === "QUERY" && tokens[2] === "PLAN" ? 3 : 1));
    return command === "SELECT";
  }
  return mainCommand(tokens) === "SELECT";
}

function jsonCell(value: unknown) {
  if (value instanceof Uint8Array) return Array.from(value);
  if (value instanceof ArrayBuffer) return Array.from(new Uint8Array(value));
  if (typeof value === "bigint") return value.toString();
  return value;
}

function columnType(declared: string | null, value: unknown) {
  if (declared) {
    if (/INT/i.test(declared)) return 2;
    if (/REAL|DOUBLE|FLOAT/i.test(declared)) return 3;
    if (/BLOB/i.test(declared)) return 4;
    return 1;
  }
  if (typeof value === "number") return Number.isInteger(value) ? 2 : 3;
  if (typeof value === "bigint") return 2;
  if (value instanceof Uint8Array || value instanceof ArrayBuffer) return 4;
  return 1;
}

function studioResult(result: Awaited<ReturnType<Db["batch"]>>[number]) {
  const rows: unknown[][] = result.rows.filter(Array.isArray);
  const names = new Set<string>();
  const headers = result.columns.map((displayName, index) => {
    let name = displayName;
    for (let suffix = 1; names.has(name); suffix++) name = `__${displayName}_${suffix}`;
    names.add(name);
    const originalType = result.columnTypes[index] || null;
    const sample = originalType ? undefined : rows.find((row) => row[index] != null)?.[index];
    return { name, displayName, originalType, type: columnType(originalType, sample) };
  });
  return {
    headers,
    rows: rows.map((row) => Object.fromEntries(headers.map(({ name }, index) => [name, jsonCell(row[index])]))),
    stat: {
      rowsAffected: result.rowsAffected,
      rowsRead: result.rowsRead ?? null,
      rowsWritten: result.rowsWritten ?? null,
      queryDurationMs: result.queryDurationMs ?? null,
    },
    lastInsertRowid: result.lastInsertRowid,
  };
}

export async function browseDatabase(db: Db, statements: string[], atomic: boolean, writable: boolean) {
  return (await execute(db, { statements, atomic, readOnly: !writable })).map(studioResult);
}
