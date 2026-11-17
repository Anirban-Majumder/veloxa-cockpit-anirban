import ExcelJS from "exceljs";
import { unzipSync, strFromU8 } from "fflate";
import { extractText, getDocumentProxy } from "unpdf";

/** One extracted passage or row, before it is written to the evidence table. */
export interface ParsedEvidence {
  locator: Record<string, unknown>;
  text: string;
  data?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export type FileType = "xlsx" | "csv" | "docx" | "pdf" | "eml" | "txt";

export function fileTypeOf(path: string): FileType | undefined {
  const ext = path.toLowerCase().split(".").pop();
  return (["xlsx", "csv", "docx", "pdf", "eml", "txt"] as const).find((t) => t === ext);
}

export async function parseFile(type: FileType, bytes: Uint8Array): Promise<ParsedEvidence[]> {
  switch (type) {
    case "xlsx": return parseXlsx(bytes);
    case "csv": return parseCsv(new TextDecoder().decode(bytes));
    case "docx": return parseDocx(bytes);
    case "pdf": return parsePdf(bytes);
    case "eml": return parseEml(new TextDecoder().decode(bytes));
    case "txt": return parseTxt(new TextDecoder().decode(bytes));
  }
}

// ---------- tables (xlsx / csv) ----------

const SALARY_HEADER = /\b(gross|net|salary|ctc|deductions?|basic pay)\b/i;
const PERSON_HEADER = /\b(emp(loyee)? ?id|name|employee)\b/i;

/** Individual pay rows are restricted from the CEO (A002); totals are allowed. */
function tableRestriction(headers: string[]): Record<string, unknown> | undefined {
  const pay = headers.some((h) => SALARY_HEADER.test(h));
  const person = headers.some((h) => PERSON_HEADER.test(h));
  return pay && person ? { restricted: "individual_salary" } : undefined;
}

function rowsToEvidence(
  rows: unknown[][],
  locate: (rowIndex: number) => Record<string, unknown>,
): ParsedEvidence[] {
  const out: ParsedEvidence[] = [];
  const filled = (r: unknown[]) => r.filter((c) => c !== null && c !== undefined && c !== "").length;
  // Header = first row with >= 2 filled cells; anything above it is a title/note.
  const headerIdx = rows.findIndex((r) => filled(r) >= 2);
  if (headerIdx < 0) return out;
  for (let i = 0; i < headerIdx; i++) {
    const note = rows[i]!.filter((c) => c != null && c !== "").join(" ").trim();
    if (note) out.push({ locator: { ...locate(i), role: "note" }, text: note });
  }
  const headers = rows[headerIdx]!.map((h, j) => (h == null || h === "" ? `col${j + 1}` : String(h)));
  const restriction = tableRestriction(headers);
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i]!;
    if (filled(r) === 0) continue;
    const data: Record<string, unknown> = {};
    headers.forEach((h, j) => {
      const v = r[j];
      if (v !== null && v !== undefined && v !== "") data[h] = v;
    });
    // Rows with only the first key filled (e.g. empty template rows) carry no evidence.
    if (Object.keys(data).length < 2) continue;
    out.push({
      locator: locate(i),
      text: Object.entries(data).map(([k, v]) => `${k}: ${v}`).join("; "),
      data,
      metadata: restriction,
    });
  }
  return out;
}

function cellValue(v: ExcelJS.CellValue): unknown {
  if (v == null) return null;
  if (v instanceof Date) {
    const iso = v.toISOString();
    return iso.endsWith("T00:00:00.000Z") ? iso.slice(0, 10) : iso;
  }
  if (typeof v === "object") {
    if ("richText" in v) return v.richText.map((t) => t.text).join("");
    if ("result" in v) return cellValue(v.result as ExcelJS.CellValue);
    if ("text" in v) return String(v.text);
    if ("error" in v) return null;
  }
  return v;
}

async function parseXlsx(bytes: Uint8Array): Promise<ParsedEvidence[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
  const out: ParsedEvidence[] = [];
  for (const ws of wb.worksheets) {
    const rows: unknown[][] = [];
    for (let r = 1; r <= ws.rowCount; r++) {
      const vals = ws.getRow(r).values as ExcelJS.CellValue[];
      // ExcelJS row arrays are 1-based; drop index 0.
      rows.push(Array.from({ length: Math.max(0, vals.length - 1) }, (_, j) => cellValue(vals[j + 1])));
    }
    out.push(...rowsToEvidence(rows, (i) => ({ sheet: ws.name, row: i + 1 })));
  }
  return out;
}

export function splitCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

function parseCsv(text: string): ParsedEvidence[] {
  return rowsToEvidence(splitCsv(text), (i) => ({ row: i + 1 }));
}

// ---------- documents ----------

const decodeXml = (s: string) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&");

function parseDocx(bytes: Uint8Array): ParsedEvidence[] {
  const xml = strFromU8(unzipSync(bytes, { filter: (f) => f.name === "word/document.xml" })["word/document.xml"]!);
  const paras = xml.split(/<\/w:p>/).map((p) =>
    decodeXml(p.replace(/<w:tab\/>/g, "\t").replace(/<w:br\/>/g, "\n").replace(/<[^>]+>/g, "")).trim());
  const out: ParsedEvidence[] = [];
  paras.forEach((text, i) => { if (text) out.push({ locator: { paragraph: i + 1 }, text }); });
  return out;
}

async function parsePdf(bytes: Uint8Array): Promise<ParsedEvidence[]> {
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const { text } = await extractText(pdf, { mergePages: false });
  return text.map((t, i) => ({ locator: { page: i + 1 }, text: t.trim() })).filter((e) => e.text);
}

function decodeQuotedPrintable(s: string): string {
  const bin = s.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

function parseEml(raw: string): ParsedEvidence[] {
  const norm = raw.replace(/\r\n/g, "\n");
  const split = norm.indexOf("\n\n");
  const head = (split < 0 ? norm : norm.slice(0, split)).replace(/\n[ \t]+/g, " ");
  let body = split < 0 ? "" : norm.slice(split + 2);
  const headers: Record<string, string> = {};
  for (const line of head.split("\n")) {
    const m = line.match(/^([\w-]+):\s*(.*)$/);
    if (m) headers[m[1]!.toLowerCase()] = m[2]!;
  }
  if (/quoted-printable/i.test(headers["content-transfer-encoding"] ?? "")) body = decodeQuotedPrintable(body);
  if (/base64/i.test(headers["content-transfer-encoding"] ?? "")) body = Buffer.from(body, "base64").toString("utf8");
  const keep = ["from", "to", "cc", "subject", "date", "message-id", "in-reply-to"];
  const data = Object.fromEntries(keep.filter((k) => headers[k]).map((k) => [k, headers[k]]));
  const text = [...keep.filter((k) => k !== "message-id" && headers[k]).map((k) => `${k[0]!.toUpperCase()}${k.slice(1)}: ${headers[k]}`), "", body.trim()].join("\n");
  return [{ locator: { message: headers["message-id"] ?? null }, text, data }];
}

function parseTxt(text: string): ParsedEvidence[] {
  return text.split(/\n\s*\n/).map((t, i) => ({ locator: { block: i + 1 }, text: t.trim() })).filter((e) => e.text);
}
