import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import {
  getEmployees,
  getEmployee,
  getEmployeeDetail,
  getEmployeeActivities,
  getEmployeeScreenshots,
  getEmployeeBrowserHistory,
  getEmployeeAlerts,
  getEmployeeUsbEvents,
  getEmployeeTimeline,
  disableEmployee,
  enableEmployee,
  createEmployee,
  deleteEmployee,
  uploadAvatar,
  avatarUpload,
  getConnectionHistory,
  sendRemoteCommand,
  getKeylogHistory,
  getFileActivity,
  getPrintLogs,
  resetAllData,
} from "../controllers/employee.controller";
import { requireSuperAdmin } from "../middleware/role.middleware";
import { checkEmployeeSeatLimit } from "../middleware/seatLimit.middleware";
import { checkFeature } from "../middleware/featureCheck";

const router = Router();

router.use(authenticate);

router.post("/", requireSuperAdmin, checkEmployeeSeatLimit, createEmployee);
router.get("/", getEmployees);
router.get("/:id", getEmployee);
router.get("/:id/detail", getEmployeeDetail);
router.get("/:id/activities", getEmployeeActivities);
router.get("/:id/screenshots", checkFeature("screenshots"), getEmployeeScreenshots);
router.get("/:id/browser-history", checkFeature("browserHistory"), getEmployeeBrowserHistory);
router.get("/:id/alerts", getEmployeeAlerts);
router.get("/:id/usb-events", checkFeature("usbMonitoring"), getEmployeeUsbEvents);
router.get("/:id/timeline", getEmployeeTimeline);
router.get("/:id/connection-history", getConnectionHistory);
router.get("/:id/keylog", checkFeature("keylog"), getKeylogHistory);
router.get("/:id/file-activity", checkFeature("fileActivity"), getFileActivity);
router.get("/:id/print-logs", checkFeature("printLogs"), getPrintLogs);
router.delete("/reset-all-data", requireSuperAdmin, resetAllData);
router.put("/:id/disable", requireSuperAdmin, disableEmployee);
router.put("/:id/enable", requireSuperAdmin, enableEmployee);
router.put("/:id/avatar", requireSuperAdmin, avatarUpload.single("avatar"), uploadAvatar);
router.post("/:id/command", requireSuperAdmin, sendRemoteCommand);
router.delete("/:id", requireSuperAdmin, deleteEmployee);

export default router;
