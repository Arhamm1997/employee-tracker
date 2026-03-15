-- CreateTable
CREATE TABLE "Admin" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'viewer',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "employeeCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "avatar" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "agentToken" TEXT NOT NULL,
    "agentVersion" TEXT,
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pendingCommand" TEXT,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "appName" TEXT NOT NULL,
    "windowTitle" TEXT NOT NULL,
    "isIdle" BOOLEAN NOT NULL DEFAULT false,
    "isProductive" BOOLEAN NOT NULL DEFAULT true,
    "isAfterHours" BOOLEAN NOT NULL DEFAULT false,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Screenshot" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "appName" TEXT NOT NULL,
    "windowTitle" TEXT NOT NULL,
    "monitorCount" INTEGER NOT NULL DEFAULT 1,
    "cloudinaryId" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Screenshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "metadata" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "emailSent" BOOLEAN NOT NULL DEFAULT false,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrowserHistory" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "browser" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "visitedAt" TIMESTAMP(3) NOT NULL,
    "duration" INTEGER,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "BrowserHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsbEvent" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "deviceName" TEXT NOT NULL,
    "deviceType" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsbEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClipboardLog" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "appName" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClipboardLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL,
    "workStartTime" TEXT NOT NULL DEFAULT '09:00',
    "workEndTime" TEXT NOT NULL DEFAULT '18:00',
    "workDays" TEXT[] DEFAULT ARRAY['Mon', 'Tue', 'Wed', 'Thu', 'Fri']::TEXT[],
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Karachi',
    "screenshotInterval" INTEGER NOT NULL DEFAULT 10,
    "screenshotQuality" INTEGER NOT NULL DEFAULT 60,
    "idleThreshold" INTEGER NOT NULL DEFAULT 5,
    "screenshotsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "browserHistoryEnabled" BOOLEAN NOT NULL DEFAULT true,
    "usbMonitoringEnabled" BOOLEAN NOT NULL DEFAULT true,
    "clipboardEnabled" BOOLEAN NOT NULL DEFAULT false,
    "afterHoursEnabled" BOOLEAN NOT NULL DEFAULT true,
    "blockedSites" TEXT[],
    "productiveApps" TEXT[],
    "nonProductiveApps" TEXT[],
    "neutralApps" TEXT[],
    "alertEmails" TEXT[],
    "alertOnBlockedSite" BOOLEAN NOT NULL DEFAULT true,
    "alertOnIdle" BOOLEAN NOT NULL DEFAULT true,
    "alertOnUsb" BOOLEAN NOT NULL DEFAULT true,
    "alertOnAfterHours" BOOLEAN NOT NULL DEFAULT true,
    "alertOnNewSoftware" BOOLEAN NOT NULL DEFAULT true,
    "idleAlertThreshold" INTEGER NOT NULL DEFAULT 30,
    "activityRetentionDays" INTEGER NOT NULL DEFAULT 90,
    "screenshotRetentionDays" INTEGER NOT NULL DEFAULT 30,
    "alertRetentionDays" INTEGER NOT NULL DEFAULT 60,
    "maxEmployees" INTEGER NOT NULL DEFAULT 10,
    "keylogEnabled" BOOLEAN NOT NULL DEFAULT false,
    "fileMonitorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "printMonitorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentUpdate" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "downloadUrl" TEXT NOT NULL,
    "changelog" TEXT NOT NULL,
    "isLatest" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConnectionEvent" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConnectionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KeylogEntry" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "appName" TEXT NOT NULL,
    "keys" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KeylogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileActivity" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "appName" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrintLog" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "printer" TEXT NOT NULL,
    "document" TEXT NOT NULL,
    "pages" INTEGER NOT NULL DEFAULT 1,
    "appName" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrintLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Admin_email_key" ON "Admin"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_employeeCode_key" ON "Employee"("employeeCode");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_email_key" ON "Employee"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_agentToken_key" ON "Employee"("agentToken");

-- CreateIndex
CREATE INDEX "Activity_employeeId_timestamp_idx" ON "Activity"("employeeId", "timestamp");

-- CreateIndex
CREATE INDEX "Screenshot_employeeId_timestamp_idx" ON "Screenshot"("employeeId", "timestamp");

-- CreateIndex
CREATE INDEX "Alert_employeeId_timestamp_idx" ON "Alert"("employeeId", "timestamp");

-- CreateIndex
CREATE INDEX "Alert_isRead_idx" ON "Alert"("isRead");

-- CreateIndex
CREATE INDEX "BrowserHistory_employeeId_visitedAt_idx" ON "BrowserHistory"("employeeId", "visitedAt");

-- CreateIndex
CREATE INDEX "UsbEvent_employeeId_timestamp_idx" ON "UsbEvent"("employeeId", "timestamp");

-- CreateIndex
CREATE INDEX "ClipboardLog_employeeId_timestamp_idx" ON "ClipboardLog"("employeeId", "timestamp");

-- CreateIndex
CREATE INDEX "ConnectionEvent_employeeId_timestamp_idx" ON "ConnectionEvent"("employeeId", "timestamp");

-- CreateIndex
CREATE INDEX "KeylogEntry_employeeId_timestamp_idx" ON "KeylogEntry"("employeeId", "timestamp");

-- CreateIndex
CREATE INDEX "FileActivity_employeeId_timestamp_idx" ON "FileActivity"("employeeId", "timestamp");

-- CreateIndex
CREATE INDEX "PrintLog_employeeId_timestamp_idx" ON "PrintLog"("employeeId", "timestamp");

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Screenshot" ADD CONSTRAINT "Screenshot_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrowserHistory" ADD CONSTRAINT "BrowserHistory_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsbEvent" ADD CONSTRAINT "UsbEvent_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClipboardLog" ADD CONSTRAINT "ClipboardLog_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectionEvent" ADD CONSTRAINT "ConnectionEvent_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeylogEntry" ADD CONSTRAINT "KeylogEntry_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileActivity" ADD CONSTRAINT "FileActivity_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrintLog" ADD CONSTRAINT "PrintLog_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
