import { selectAll, selectOne, type Db } from "../db/client";

export interface Agent {
  employee_id: string;
  full_name: string;
  work_email: string | null;
  department: string | null;
  title: string | null;
  manager_id: string | null;
  join_date: string | null;
  location: string | null;
  status: string | null;
  exit_date: string | null;
  soul: string | null;
}

export type AgentProfile = Omit<Agent, "work_email" | "soul">;

/** Each person's latest profile on or before the cutoff; people past their last working day are left out. */
const AGENTS_AT_CUTOFF = `
  SELECT a.employee_id, json_extract(profile.data_json, '$."Full Name"') AS full_name,
         json_extract(profile.data_json, '$."Work Email"') AS work_email,
         json_extract(profile.data_json, '$."Join Date"') AS join_date, a.soul,
         p.department, p.title, p.manager_id, p.location, p.status, p.exit_date
  FROM agents a
  JOIN agent_profiles p ON p.employee_id = a.employee_id
  JOIN evidence profile ON profile.id = (
    SELECT e.id FROM evidence e JOIN sources s ON s.id = e.source_id
    WHERE s.released_at = p.effective_from
      AND json_extract(e.data_json, '$."Emp ID"') = a.employee_id
      AND json_extract(e.data_json, '$."Full Name"') IS NOT NULL
    ORDER BY e.id DESC LIMIT 1
  )
  WHERE p.effective_from = (
          SELECT MAX(effective_from) FROM agent_profiles
          WHERE employee_id = a.employee_id AND effective_from <= ?)
    AND (p.exit_date IS NULL OR p.exit_date >= substr(?, 1, 10))`;

export async function listAgents(db: Db, cutoff: string): Promise<AgentProfile[]> {
  const agents = await selectAll<Agent>(db, `${AGENTS_AT_CUTOFF} ORDER BY a.employee_id`, cutoff, cutoff);
  return agents.map(({ work_email: _email, soul: _soul, ...profile }) => profile);
}

export function findAgent(db: Db, employeeId: string, cutoff: string): Promise<Agent | undefined> {
  return selectOne(db, `${AGENTS_AT_CUTOFF} AND a.employee_id = ?`, cutoff, cutoff, employeeId);
}
