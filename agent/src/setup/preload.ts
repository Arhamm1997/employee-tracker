import { contextBridge, ipcRenderer } from "electron";

declare global {
  interface Window {
    stafftrackSetup: {
      register: (companyToken: string, employeeId: string) => Promise<void>;
    };
  }
}

contextBridge.exposeInMainWorld("stafftrackSetup", {
  register: (companyToken: string, employeeId: string) =>
    ipcRenderer.invoke("stafftrack:register", { companyToken, employeeId })
});

