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
  soul: string | null;
}

export type AgentProfile = Omit<Agent, "work_email" | "soul">;

export function listAgents(db: Db): Promise<AgentProfile[]> {
  return selectAll(db,
    "SELECT employee_id, full_name, department, title, manager_id, join_date, location FROM agents ORDER BY employee_id");
}

export function findAgent(db: Db, employeeId: string): Promise<Agent | undefined> {
  return selectOne(db, "SELECT * FROM agents WHERE employee_id = ?", employeeId);
}
