import Store from "electron-store";
import { CONFIG } from "./config";

export interface AgentStoreSchema {
  [CONFIG.STORE_KEYS.COMPANY_TOKEN]?: string;
  [CONFIG.STORE_KEYS.EMPLOYEE_ID]?: string;
  [CONFIG.STORE_KEYS.AGENT_ID]?: string;
  [CONFIG.STORE_KEYS.IS_REGISTERED]?: boolean;
  [CONFIG.STORE_KEYS.LAST_UPDATE_CHECK]?: string;
}

export const store = new Store<AgentStoreSchema>({
  name: "stafftrack-agent"
});

export function getCompanyToken(): string | undefined {
  return store.get(CONFIG.STORE_KEYS.COMPANY_TOKEN);
}

export function getEmployeeId(): string | undefined {
  return store.get(CONFIG.STORE_KEYS.EMPLOYEE_ID);
}

export function getAgentId(): string | undefined {
  return store.get(CONFIG.STORE_KEYS.AGENT_ID);
}

export function isRegistered(): boolean {
  return store.get(CONFIG.STORE_KEYS.IS_REGISTERED) === true;
}

