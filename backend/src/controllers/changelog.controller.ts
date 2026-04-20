import { Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma";
import { AuthRequest } from "../middleware/auth.middleware";
import { AdminRequest } from "../middleware/adminAuth";

// ─── Admin: Create a changelog entry ─────────────────────────────────────────

export async function adminCreateChangelog(req: AdminRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { title, description, type, planTarget, publish } = req.body as {
      title: string;
      description: string;
      type?: string;
      planTarget?: string;
      publish?: boolean;
    };

    if (!title?.trim() || !description?.trim()) {
      res.status(400).json({ message: "Title and description are required" });
      return;
    }

    const entry = await prisma.changelog.create({
      data: {
        title: title.trim(),
        description: description.trim(),
        type: type || "feature",
        planTarget: planTarget || "all",
        isPublished: !!publish,
        publishedAt: publish ? new Date() : null,
      },
    });

    res.status(201).json({ entry });
  } catch (err) {
    next(err);
  }
}

// ─── Admin: List all changelog entries ───────────────────────────────────────

export async function adminListChangelog(_req: AdminRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const entries = await prisma.changelog.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { reads: true } },
      },
    });

    res.json({ entries });
  } catch (err) {
    next(err);
  }
}

// ─── Admin: Update a changelog entry ─────────────────────────────────────────

export async function adminUpdateChangelog(req: AdminRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { title, description, type, planTarget } = req.body as {
      title?: string;
      description?: string;
      type?: string;
      planTarget?: string;
    };

    const entry = await prisma.changelog.findUnique({ where: { id } });
    if (!entry) {
      res.status(404).json({ message: "Entry not found" });
      return;
    }

    const updated = await prisma.changelog.update({
      where: { id },
      data: {
        ...(title !== undefined && { title: title.trim() }),
        ...(description !== undefined && { description: description.trim() }),
        ...(type !== undefined && { type }),
        ...(planTarget !== undefined && { planTarget }),
      },
    });

    res.json({ entry: updated });
  } catch (err) {
    next(err);
  }
}

// ─── Admin: Publish / Unpublish a changelog entry ────────────────────────────

export async function adminPublishChangelog(req: AdminRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { publish } = req.body as { publish: boolean };

    const entry = await prisma.changelog.findUnique({ where: { id } });
    if (!entry) {
      res.status(404).json({ message: "Entry not found" });
      return;
    }

    const updated = await prisma.changelog.update({
      where: { id },
      data: {
        isPublished: publish,
        publishedAt: publish && !entry.publishedAt ? new Date() : entry.publishedAt,
      },
    });

    res.json({ entry: updated });
  } catch (err) {
    next(err);
  }
}

// ─── Admin: Delete a changelog entry ─────────────────────────────────────────

export async function adminDeleteChangelog(req: AdminRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const entry = await prisma.changelog.findUnique({ where: { id } });
    if (!entry) {
      res.status(404).json({ message: "Entry not found" });
      return;
    }

    await prisma.changelog.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

// ─── Company: Get published changelog entries (with unread count) ─────────────

export async function getChangelog(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const companyId = req.admin?.companyId;
    if (!companyId) {
      res.json({ entries: [], unreadCount: 0 });
      return;
    }

    // Get company's plan target to filter entries
    const subscription = await prisma.subscription.findUnique({
      where: { companyId },
      include: { plan: { select: { name: true } } },
    });

    const planName = subscription?.plan?.name?.toLowerCase() ?? "standard";

    const entries = await prisma.changelog.findMany({
      where: {
        isPublished: true,
        OR: [
          { planTarget: "all" },
          { planTarget: planName },
        ],
      },
      orderBy: { publishedAt: "desc" },
      take: 50,
    });

    // Get read status for this company
    const reads = await prisma.changelogRead.findMany({
      where: { companyId, changelogId: { in: entries.map((e) => e.id) } },
      select: { changelogId: true },
    });
    const readSet = new Set(reads.map((r) => r.changelogId));

    const result = entries.map((e) => ({
      ...e,
      isRead: readSet.has(e.id),
    }));

    const unreadCount = result.filter((e) => !e.isRead).length;

    res.json({ entries: result, unreadCount });
  } catch (err) {
    next(err);
  }
}

// ─── Company: Mark a changelog entry as read ─────────────────────────────────

export async function markChangelogRead(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const companyId = req.admin!.companyId!;
    const { id } = req.params;

    await prisma.changelogRead.upsert({
      where: { changelogId_companyId: { changelogId: id, companyId } },
      create: { changelogId: id, companyId },
      update: { readAt: new Date() },
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

// ─── Company: Mark ALL changelog entries as read ──────────────────────────────

export async function markAllChangelogRead(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const companyId = req.admin!.companyId!;

    const entries = await prisma.changelog.findMany({
      where: { isPublished: true },
      select: { id: true },
    });

    await Promise.all(
      entries.map((e) =>
        prisma.changelogRead.upsert({
          where: { changelogId_companyId: { changelogId: e.id, companyId } },
          create: { changelogId: e.id, companyId },
          update: {},
        })
      )
    );

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}
