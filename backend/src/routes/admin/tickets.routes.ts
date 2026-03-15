import { Router, Response } from "express";
import { requireAdmin, AdminRequest } from "../../middleware/adminAuth";

const router = Router();
router.use(requireAdmin);

const emptyPaginated = (page: number, pageSize: number) => ({
  data: [],
  total: 0,
  page,
  pageSize,
  totalPages: 0,
});

// ── GET /admin/tickets ────────────────────────────────────────────────────────
router.get("/", (req: AdminRequest, res: Response) => {
  const pageSize = Math.min(Number(req.query.pageSize ?? 20), 100);
  const page = Math.max(Number(req.query.page ?? 1), 1);
  return res.json({ success: true, data: emptyPaginated(page, pageSize) });
});

// ── GET /admin/tickets/:id ────────────────────────────────────────────────────
router.get("/:id", (_req: AdminRequest, res: Response) => {
  return res.status(404).json({ success: false, error: "Ticket not found" });
});

// ── POST /admin/tickets/:id/reply ─────────────────────────────────────────────
router.post("/:id/reply", (_req: AdminRequest, res: Response) => {
  return res.status(404).json({ success: false, error: "Ticket not found" });
});

export default router;
