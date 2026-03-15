export const CONFIG = {
  SERVER_URL: "http://YOUR_VPS_IP:3000",
  CURRENT_VERSION: "1.0.0",
  HEARTBEAT_INTERVAL_MS: 60000,
  SCREENSHOT_INTERVAL_MS: 300000,
  KEYLOG_FLUSH_INTERVAL_MS: 30000,
  ACTIVITY_CHECK_INTERVAL_MS: 10000,
  UPDATE_CHECK_INTERVAL_MS: 3600000,
  STORE_KEYS: {
    COMPANY_TOKEN: "company_token",
    EMPLOYEE_ID: "employee_id",
    AGENT_ID: "agent_id",
    IS_REGISTERED: "is_registered",
    LAST_UPDATE_CHECK: "last_update_check"
  }
} as const;

export type Config = typeof CONFIG;

