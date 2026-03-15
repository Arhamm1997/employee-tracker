import os from "os";
import { machineId } from "node-machine-id";
import { CONFIG } from "../config";
import { api } from "../lib/api";
import { store } from "../store";
import { logger } from "../lib/logger";

interface RegisterResponse {
  success: boolean;
  data?: {
    agent_id: string;
  };
  error?: string;
  code?: string;
}

export async function register(companyToken: string, employeeId: string): Promise<void> {
  try {
    const trimmedToken = companyToken.trim();
    const trimmedEmployeeId = employeeId.trim();

    if (!trimmedToken || !trimmedEmployeeId) {
      throw new Error("Company token and employee ID are required.");
    }

    const machineIdValue = await machineId();
    const machineName = os.hostname();
    const osVersion = os.version();

    const response = await api.post<RegisterResponse>(`${CONFIG.SERVER_URL}/api/agents/register`, {
      company_token: trimmedToken,
      employee_id: trimmedEmployeeId,
      machine_id: machineIdValue,
      machine_name: machineName,
      os_version: osVersion,
      agent_version: CONFIG.CURRENT_VERSION
    });

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error ?? "Registration failed");
    }

    store.set(CONFIG.STORE_KEYS.AGENT_ID, response.data.data.agent_id);
    store.set(CONFIG.STORE_KEYS.COMPANY_TOKEN, trimmedToken);
    store.set(CONFIG.STORE_KEYS.EMPLOYEE_ID, trimmedEmployeeId);
    store.set(CONFIG.STORE_KEYS.IS_REGISTERED, true);

    logger.info("Agent registered successfully.");
  } catch (error) {
    logger.error("Registration failed", { error });
    if (error instanceof Error) {
      throw new Error(error.message);
    }
    throw new Error("Registration failed.");
  }
}

