// Core seven-table schema (D026). Columns follow ARCHITECTURE.md "Data model".
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS sources (
  id            INTEGER PRIMARY KEY,
  path          TEXT NOT NULL,              -- relative to the release-pack root
  sha256        TEXT NOT NULL,
  file_type     TEXT NOT NULL,              -- xlsx | csv | docx | pdf | eml | txt
  source_kind   TEXT NOT NULL,              -- data_room | transcript
  release_day   INTEGER NOT NULL,           -- 1..n, from the DayN_* folder
  released_at   TEXT NOT NULL,              -- ISO timestamp the cockpit could first know it
  ingested_at   TEXT NOT NULL,
  UNIQUE (path, sha256)
);
CREATE INDEX IF NOT EXISTS idx_sources_released ON sources(released_at);

CREATE TABLE IF NOT EXISTS evidence (
  id             INTEGER PRIMARY KEY,
  source_id      INTEGER NOT NULL REFERENCES sources(id),
  locator_json   TEXT NOT NULL,             -- exact location: sheet/row, page, paragraph, header
  text           TEXT NOT NULL,             -- deterministic extracted text
  data_json      TEXT,                      -- structured source fields (spreadsheet/csv rows, email headers)
  metadata_json  TEXT                       -- interpretive metadata (restrictions, aliases, conflicts)
);
CREATE INDEX IF NOT EXISTS idx_evidence_source ON evidence(source_id);

CREATE TABLE IF NOT EXISTS agents (
  employee_id  TEXT PRIMARY KEY,
  full_name    TEXT NOT NULL,
  work_email   TEXT,
  department   TEXT,
  title        TEXT,
  manager_id   TEXT,
  join_date    TEXT,
  location     TEXT,
  soul         TEXT                         -- reviewed persona; preserved across imports
);

CREATE TABLE IF NOT EXISTS conversations (
  id          INTEGER PRIMARY KEY,
  user_id     TEXT NOT NULL DEFAULT 'ceo',
  agent_id    TEXT REFERENCES agents(employee_id),  -- NULL for the analyst
  kind        TEXT NOT NULL CHECK (kind IN ('analyst', 'person')),
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id                INTEGER PRIMARY KEY,
  conversation_id   INTEGER NOT NULL REFERENCES conversations(id),
  role              TEXT NOT NULL,
  content           TEXT NOT NULL,          -- JSON: AI SDK message parts
  created_at        TEXT NOT NULL,
  knowledge_cutoff  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id);

CREATE TABLE IF NOT EXISTS concerns (
  id                    INTEGER PRIMARY KEY,
  knowledge_cutoff      TEXT NOT NULL,
  title                 TEXT NOT NULL,
  description           TEXT NOT NULL,
  impact                INTEGER NOT NULL CHECK (impact BETWEEN 1 AND 3),
  urgency               INTEGER NOT NULL CHECK (urgency BETWEEN 1 AND 3),
  evidence_strength     INTEGER NOT NULL CHECK (evidence_strength BETWEEN 1 AND 3),
  scoring_reasons_json  TEXT NOT NULL,      -- {impact, urgency, evidence_strength, uncertainty}
  score                 INTEGER NOT NULL,   -- 2*impact + urgency + evidence_strength
  rank                  INTEGER NOT NULL,
  model                 TEXT NOT NULL,
  generated_at          TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_concerns_cutoff ON concerns(knowledge_cutoff, rank);

CREATE TABLE IF NOT EXISTS concern_evidence (
  concern_id   INTEGER NOT NULL REFERENCES concerns(id) ON DELETE CASCADE,
  evidence_id  INTEGER NOT NULL REFERENCES evidence(id),
  rationale    TEXT,
  PRIMARY KEY (concern_id, evidence_id)
);
`;
