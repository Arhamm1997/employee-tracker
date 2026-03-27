# Fix Prompt — Employee Tracker (Production SaaS Issues)

You are working on a multi-tenant employee monitoring SaaS app deployed on a Contabo VPS.
Stack: Node.js + Express + TypeScript (backend, port 5001), React 18 + TypeScript + Vite (Frontend, port 5173).
All paths are relative to `C:\Projects\Employee Tracker\`.

Fix ALL the issues below, in order. Do not skip any. Do not add extra features beyond what is asked.

---

## ISSUE 1 — Company name not stored or displayed anywhere

### Problem
Backend already returns company name on login (`data.company.name`) and subscription info has it too.
Frontend ignores the company field entirely — it is typed as `unknown` in `api.ts` and never stored or shown.

### Fix 1A — `backend/src/controllers/auth.controller.ts`

Find the `getMe` function. It currently does NOT include company info. Fix it to also return company name:

```typescript
// Current — only returns admin fields:
res.json({
  id: admin.id,
  name: admin.name,
  email: admin.email,
  role: admin.role,
  twoFactorEnabled: admin.twoFactorEnabled,
});

// Fix — also fetch and return company name:
export async function getMe(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const admin = await prisma.admin.findUnique({
      where: { id: req.admin!.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        twoFactorEnabled: true,
        companyId: true,
      },
    });

    if (!admin) {
      res.status(404).json({ message: "Admin not found" });
      return;
    }

    const company = admin.companyId
      ? await prisma.company.findUnique({
          where: { id: admin.companyId },
          select: { id: true, name: true },
        })
      : null;

    res.json({
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      twoFactorEnabled: admin.twoFactorEnabled,
      companyId: admin.companyId,
      companyName: company?.name ?? null,
    });
  } catch (err) {
    next(err);
  }
}
```

### Fix 1B — `Frontend/src/app/lib/auth-types.ts`

Add `companyName` to the `User` interface:

```typescript
export interface User {
  id: string;
  name: string;
  email: string;
  role: "super_admin" | "viewer";
  twoFactorEnabled?: boolean;
  companyId?: string;
  companyName?: string | null;   // ADD THIS
}
```

### Fix 1C — `Frontend/src/app/lib/api.ts`

Update `LoginResponse` and `RawLoginResponse` to include company info, and update `apiGetMe` return type:

```typescript
export interface LoginResponse {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: "super_admin" | "viewer";
    twoFactorEnabled?: boolean;
    companyId?: string;
    companyName?: string | null;   // ADD THIS
  };
}

// In RawLoginResponse, change company? from unknown to typed:
type RawLoginResponse = {
  success: boolean;
  data: {
    accessToken?: string;
    user?: LoginResponse["user"];
    company?: {
      id: string;
      name: string;
      subscriptionStatus: string | null;
      subscriptionExpiresAt: string | null;
    };
    requires2FA?: boolean;
    tempToken?: string;
  };
};

// apiLogin — pass companyName from company object into user when available:
export const apiLogin = async (email: string, password: string): Promise<LoginResult> => {
  const raw = await post<RawLoginResponse>("/auth/login", { email, password });
  const d = raw.data;
  if (d.requires2FA) {
    return { requires2FA: true, tempToken: d.tempToken! };
  }
  const user = d.user!;
  // Merge companyName from separate company object into user
  if (d.company?.name && !user.companyName) {
    user.companyName = d.company.name;
  }
  return { token: d.accessToken!, user };
};

// apiGetMe return type — already correct from the interface update above
export const apiGetMe = () =>
  get<LoginResponse["user"] & { twoFactorEnabled: boolean }>("/auth/me");
```

### Fix 1D — `Frontend/src/app/components/layout/DashboardLayout.tsx`

Display company name in the sidebar under the "MonitorHub" logo area.
Find the `SidebarContent` component. In the logo section (around line 92-99), add company name below "MonitorHub":

```tsx
{expanded && (
  <div className="flex flex-col">
    <span className="text-white font-semibold whitespace-nowrap" style={{ fontSize: "15px" }}>MonitorHub</span>
    {user?.companyName && (
      <span className="text-[#a78bfa] whitespace-nowrap truncate" style={{ fontSize: "11px" }}>{user.companyName}</span>
    )}
  </div>
)}
```

Also in the user dropdown menu (DropdownMenuLabel section around line 320-331), add company name:

```tsx
<DropdownMenuLabel className="font-normal">
  <div className="flex flex-col space-y-1">
    <p className="text-sm font-medium">{user?.name}</p>
    <p className="text-xs text-muted-foreground">{user?.email}</p>
    {user?.companyName && (
      <p className="text-xs text-muted-foreground">{user.companyName}</p>
    )}
    <Badge
      variant={isSuperAdmin ? "default" : "secondary"}
      className={`w-fit mt-1 ${isSuperAdmin ? "bg-[#6366f1] hover:bg-[#6366f1]" : ""}`}
      style={{ fontSize: "10px" }}
    >
      {isSuperAdmin ? "Super Admin" : "Viewer"}
    </Badge>
  </div>
</DropdownMenuLabel>
```

---

## ISSUE 2 — Settings created without plan defaults (settings don't respect plan)

### Problem
When a company's settings row doesn't exist yet and gets auto-created in `getSettings`, all feature flags default to whatever the Prisma schema default is — NOT the company's actual plan. So a company on a "Screenshots Only" plan might have `keylogEnabled: true` in the DB.

### Fix — `backend/src/controllers/settings.controller.ts` → `getSettings` function

Replace the lazy-create block (lines 114-125) with a plan-aware version:

```typescript
if (!settings) {
  // Fetch plan to set correct feature defaults
  let plan = null;
  if (companyId) {
    const subscription = await prisma.subscription.findUnique({
      where: { companyId },
      include: { plan: true },
    });
    plan = subscription?.plan ?? null;
  }

  settings = await prisma.settings.create({
    data: {
      companyId,
      blockedSites: [],
      productiveApps: [],
      nonProductiveApps: [],
      neutralApps: [],
      alertEmails: [],
      // Set feature defaults from plan — if no plan, use safe defaults
      screenshotsEnabled:     plan?.screenshotsEnabled    ?? true,
      browserHistoryEnabled:  plan?.browserHistoryEnabled ?? false,
      usbMonitoringEnabled:   plan?.usbMonitoringEnabled  ?? false,
      keylogEnabled:          plan?.keylogEnabled         ?? false,
      fileMonitorEnabled:     plan?.fileActivityEnabled   ?? false,
      printMonitorEnabled:    plan?.printLogsEnabled      ?? false,
    },
  });
}
```

---

## ISSUE 3 — Backend accepts any feature toggle without plan validation

### Problem
`PUT /api/settings` accepts `enableKeylog: true` even if the company's plan doesn't include keylogger. A user can bypass the frontend and call the API directly.

### Fix — `backend/src/controllers/settings.controller.ts` → `updateSettings` function

After `const companyId = req.admin?.companyId ?? null;` and before building `updateData`, add plan-fetching and a guard helper:

```typescript
export async function updateSettings(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = req.body as { /* existing type */ };
    const companyId = req.admin?.companyId ?? null;

    // Fetch plan for feature gating validation
    let plan: {
      screenshotsEnabled: boolean;
      browserHistoryEnabled: boolean;
      usbMonitoringEnabled: boolean;
      keylogEnabled: boolean;
      fileActivityEnabled: boolean;
      printLogsEnabled: boolean;
    } | null = null;

    if (companyId) {
      const subscription = await prisma.subscription.findUnique({
        where: { companyId },
        include: { plan: true },
      });
      plan = subscription?.plan ?? null;
    }

    // Helper: if plan exists, reject enabling a feature not in plan
    function assertPlanFeature(wantEnable: boolean | undefined, planFlag: boolean | undefined, featureName: string): void {
      if (wantEnable === true && plan && !planFlag) {
        throw Object.assign(new Error(`Feature "${featureName}" is not included in your current plan`), { status: 403 });
      }
    }

    const updateData: Record<string, unknown> = {};

    if (body.monitoring) {
      const m = body.monitoring;
      if (m.screenshotInterval !== undefined) updateData.screenshotInterval = m.screenshotInterval;
      if (m.screenshotQuality !== undefined)
        updateData.screenshotQuality = qualityToInt(m.screenshotQuality);
      if (m.idleThreshold !== undefined) updateData.idleThreshold = m.idleThreshold;

      if (m.enableScreenshots !== undefined) {
        assertPlanFeature(m.enableScreenshots, plan?.screenshotsEnabled, "screenshots");
        updateData.screenshotsEnabled = m.enableScreenshots;
      }
      if (m.enableBrowserHistory !== undefined) {
        assertPlanFeature(m.enableBrowserHistory, plan?.browserHistoryEnabled, "browser history");
        updateData.browserHistoryEnabled = m.enableBrowserHistory;
      }
      if (m.enableUsb !== undefined) {
        assertPlanFeature(m.enableUsb, plan?.usbMonitoringEnabled, "USB monitoring");
        updateData.usbMonitoringEnabled = m.enableUsb;
      }
      if (m.enableClipboard !== undefined) updateData.clipboardEnabled = m.enableClipboard;
      if (m.enableAfterHours !== undefined) updateData.afterHoursEnabled = m.enableAfterHours;

      const mAny = m as any;
      if (mAny.enableKeylog !== undefined) {
        assertPlanFeature(mAny.enableKeylog, plan?.keylogEnabled, "keylogger");
        updateData.keylogEnabled = mAny.enableKeylog;
      }
      if (mAny.enableFileMonitor !== undefined) {
        assertPlanFeature(mAny.enableFileMonitor, plan?.fileActivityEnabled, "file monitor");
        updateData.fileMonitorEnabled = mAny.enableFileMonitor;
      }
      if (mAny.enablePrintMonitor !== undefined) {
        assertPlanFeature(mAny.enablePrintMonitor, plan?.printLogsEnabled, "print monitor");
        updateData.printMonitorEnabled = mAny.enablePrintMonitor;
      }
    }

    // ... rest of the function unchanged (workSchedule, blockedSites, appCategories, notifications, dataRetention)
  } catch (err: any) {
    if (err?.status === 403) {
      res.status(403).json({ message: err.message });
      return;
    }
    next(err);
  }
}
```

---

## ISSUE 4 — `apiGetMe` doesn't return companyName (frontend shows null after page refresh)

### Problem
On page refresh, `auth-context.tsx` calls `apiGetMe()` (not `apiLogin`) to restore the user session. If `getMe` doesn't return `companyName`, it will be undefined after refresh even though `login()` set it.

This is already fixed by Fix 1A (getMe now includes companyName). No extra work needed here.

---

## ISSUE 5 — Audit Logging not wired up (AuditLog model exists but unused)

### Problem
`AuditLog` table exists in the DB schema but is NEVER written to. Sensitive admin actions are untracked.

### Fix — `backend/src/lib/audit.ts` (create new file)

```typescript
import prisma from "./prisma";

export async function auditLog(params: {
  companyId: string | null;
  userId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  changes?: object;
  ip?: string;
}): Promise<void> {
  try {
    if (!params.companyId) return; // skip master admin actions for now
    await prisma.auditLog.create({
      data: {
        company_id: params.companyId,
        user_id: params.userId ?? null,
        action: params.action,
        entity_type: params.entityType ?? null,
        entity_id: params.entityId ?? null,
        changes: params.changes ?? undefined,
        ip_address: params.ip ?? null,
      },
    });
  } catch {
    // audit log failure must never crash the request
  }
}
```

### Then wire it in key controllers:

**`backend/src/controllers/employee.controller.ts`** — import `auditLog` and add after employee create/delete:
```typescript
import { auditLog } from "../lib/audit";

// After employee created:
await auditLog({ companyId, userId: req.admin!.id, action: "EMPLOYEE_CREATED", entityType: "Employee", entityId: employee.id, changes: { name, email, department }, ip: req.ip });

// After employee deleted:
await auditLog({ companyId, userId: req.admin!.id, action: "EMPLOYEE_DELETED", entityType: "Employee", entityId: id, ip: req.ip });
```

**`backend/src/controllers/auth.controller.ts`** — after successful login (inside `login` function, after `lastLoginAt` update):
```typescript
import { auditLog } from "../lib/audit";

await auditLog({ companyId: admin.companyId, userId: admin.id, action: "ADMIN_LOGIN", ip: req.ip });
```

**`backend/src/controllers/settings.controller.ts`** — after settings updated:
```typescript
import { auditLog } from "../lib/audit";

await auditLog({ companyId, userId: req.admin!.id, action: "SETTINGS_UPDATED", changes: updateData, ip: req.ip });
```

**`backend/src/controllers/employee.controller.ts`** — after `sendRemoteCommand` (lock/shutdown):
```typescript
await auditLog({ companyId, userId: req.admin!.id, action: `REMOTE_COMMAND_${command.toUpperCase()}`, entityType: "Employee", entityId: id, ip: req.ip });
```

---

## ISSUE 6 — No per-user rate limiting (only global rate limit exists)

### Problem
`backend/src/index.ts` has a global rate limiter, but no per-user or per-endpoint limits. Brute-force attacks on specific endpoints are still possible.

### Fix — `backend/src/index.ts`

Add these after the existing `globalLimit` definition:

```typescript
// Stricter limit for auth endpoints (brute-force protection)
const authLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { message: "Too many login attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Agent data upload limit (per agent, not per IP — agents share IPs on corp networks)
const agentUploadLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  message: { message: "Too many requests from this agent" },
  standardHeaders: true,
  legacyHeaders: false,
});
```

Then apply them to specific route groups (in `app.use` section, before `routes`):

```typescript
app.use("/api/auth/login", authLimit);
app.use("/api/auth/2fa", authLimit);
app.use("/api/auth/forgot-password", authLimit);
app.use("/api/company/auth", authLimit);
app.use("/api/agent/screenshot", agentUploadLimit);
app.use("/api/agent/browser-history", agentUploadLimit);
app.use("/api/agent/keylog", agentUploadLimit);
app.use("/api/agent/file-activity", agentUploadLimit);
```

---

## ISSUE 7 — `getMe` endpoint doesn't return companyId (frontend auth-context loses it on refresh)

### Problem
`auth-context.tsx` calls `apiGetMe()` on startup to restore session. The returned user object currently has no `companyId`. After page refresh, `user.companyId` is undefined even though the JWT has it.

This is already fixed by Fix 1A. Verify `getMe` now selects and returns `companyId`. Done.

---

## ISSUE 8 — Request body size is not limited (large payload attack)

### Fix — `backend/src/index.ts`

Find `app.use(express.json())` and add explicit size limit:

```typescript
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));
```

---

## ISSUE 9 — No input validation on employee update endpoint

### Problem
`PUT /api/employees/:id` has no validation — any string can be sent as `name`, `email`, `department`.

### Fix — `backend/src/routes/employee.routes.ts`

Add Zod validation on the update route. Find the `updateEmployee` call and add a validation middleware using `body()` from `express-validator` or use Zod inline similar to how `companyAuth.controller.ts` does it.

Add to the controller `updateEmployee` in `employee.controller.ts`:

```typescript
import { z } from "zod";

const updateEmployeeSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  department: z.string().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
});

// At start of updateEmployee function:
const parsed = updateEmployeeSchema.safeParse(req.body);
if (!parsed.success) {
  res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten().fieldErrors });
  return;
}
const body = parsed.data;
// use body.name, body.email, etc. instead of req.body directly
```

---

## ISSUE 10 — Company name on the Dashboard page (not just sidebar)

### Fix — `Frontend/src/app/pages/DashboardPage.tsx`

Find the dashboard welcome/greeting area and update to show company name.
Import `useAuth`:

```tsx
import { useAuth } from "../lib/auth-types";

const { user } = useAuth();
```

In the greeting text (wherever it says "Welcome" or shows a title), add:

```tsx
<h1 className="text-2xl font-bold">
  Welcome back, {user?.name}
</h1>
{user?.companyName && (
  <p className="text-muted-foreground text-sm">{user.companyName}</p>
)}
```

---

## DEPLOYMENT NOTES (Contabo VPS)

After making ALL changes above:

1. **Backend deploy:**
```bash
cd /path/to/backend
git pull
npm install
npm run build   # or: npx tsc
pm2 restart all   # or: pm2 restart backend
```

2. **Frontend deploy:**
```bash
cd /path/to/Frontend
git pull
npm install
npm run build
# Copy dist/ to nginx serving directory
cp -r dist/* /var/www/html/
```

3. **Verify no DB migration needed:**
- No new Prisma models added
- No schema changes
- Only code logic changes
- `npm run db:push` NOT needed

4. **Test checklist after deploy:**
- [ ] Login → sidebar shows company name below MonitorHub
- [ ] User dropdown → shows company name
- [ ] Dashboard page → shows company name
- [ ] Page refresh → company name still visible (from getMe fix)
- [ ] Settings page → features correctly enabled/disabled per plan
- [ ] Try to enable keylogger via API directly on a plan that doesn't include it → should get 403
- [ ] Create employee → check AuditLog table in DB has a row
- [ ] Login → check AuditLog table has ADMIN_LOGIN row

---

## SUMMARY OF FILES TO MODIFY

| File | Change |
|------|--------|
| `backend/src/controllers/auth.controller.ts` | `getMe` returns companyId + companyName; `login` adds audit log |
| `backend/src/controllers/settings.controller.ts` | `getSettings` uses plan defaults; `updateSettings` validates plan features + audit log |
| `backend/src/controllers/employee.controller.ts` | Add Zod validation + audit logs on create/delete/command |
| `backend/src/index.ts` | Add body size limit + per-route rate limits |
| `backend/src/lib/audit.ts` | **NEW FILE** — audit log helper |
| `Frontend/src/app/lib/auth-types.ts` | Add `companyName` to `User` |
| `Frontend/src/app/lib/api.ts` | Update `LoginResponse`, `RawLoginResponse`, `apiLogin` to handle companyName |
| `Frontend/src/app/components/layout/DashboardLayout.tsx` | Show companyName in sidebar + dropdown |
| `Frontend/src/app/pages/DashboardPage.tsx` | Show companyName in greeting |

**Total files: 9 (1 new, 8 modified)**
No database schema changes needed.
