/*
  Warnings:

  - A unique constraint covering the columns `[agentKey]` on the table `Employee` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `agentKey` to the `Employee` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Admin" ADD COLUMN     "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "twoFactorSecret" TEXT;

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "agentKey" TEXT NOT NULL,
ADD COLUMN     "agentKeyUsed" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Plan" ADD COLUMN     "fileActivityEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "keylogEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "printLogsEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "billingCycle" TEXT NOT NULL DEFAULT 'monthly';

-- CreateTable
CREATE TABLE "AdminPasswordResetToken" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminPasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminRefreshToken" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "companyId" TEXT,
    "tokenHash" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "AdminRefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentRefreshToken" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "companyId" TEXT,
    "tokenHash" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "deviceInfo" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "AgentRefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentVersion" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "isLatest" BOOLEAN NOT NULL DEFAULT false,
    "releaseNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "billingCycle" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PKR',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "paymentMethod" TEXT,
    "paymentScreenshot" TEXT,
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentSettings" (
    "id" TEXT NOT NULL,
    "bankName" TEXT NOT NULL DEFAULT 'UBL',
    "bankIban" TEXT NOT NULL DEFAULT '',
    "bankTitle" TEXT NOT NULL DEFAULT '',
    "easypaisaNumber" TEXT NOT NULL DEFAULT '',
    "easypaisaName" TEXT NOT NULL DEFAULT '',
    "nayapayNumber" TEXT NOT NULL DEFAULT '',
    "nayapayName" TEXT NOT NULL DEFAULT '',
    "sadapayNumber" TEXT NOT NULL DEFAULT '',
    "sadapayName" TEXT NOT NULL DEFAULT '',
    "jsbankNumber" TEXT NOT NULL DEFAULT '',
    "jsbankName" TEXT NOT NULL DEFAULT '',
    "whatsappNumber" TEXT NOT NULL DEFAULT '',
    "instructions" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminPasswordResetToken_token_key" ON "AdminPasswordResetToken"("token");

-- CreateIndex
CREATE INDEX "AdminPasswordResetToken_adminId_idx" ON "AdminPasswordResetToken"("adminId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminRefreshToken_tokenHash_key" ON "AdminRefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "AdminRefreshToken_adminId_idx" ON "AdminRefreshToken"("adminId");

-- CreateIndex
CREATE INDEX "AdminRefreshToken_familyId_idx" ON "AdminRefreshToken"("familyId");

-- CreateIndex
CREATE INDEX "AdminRefreshToken_companyId_idx" ON "AdminRefreshToken"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentRefreshToken_tokenHash_key" ON "AgentRefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "AgentRefreshToken_employeeId_idx" ON "AgentRefreshToken"("employeeId");

-- CreateIndex
CREATE INDEX "AgentRefreshToken_familyId_idx" ON "AgentRefreshToken"("familyId");

-- CreateIndex
CREATE INDEX "AgentRefreshToken_companyId_idx" ON "AgentRefreshToken"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "Invoice_companyId_idx" ON "Invoice"("companyId");

-- CreateIndex
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_agentKey_key" ON "Employee"("agentKey");

-- AddForeignKey
ALTER TABLE "AdminPasswordResetToken" ADD CONSTRAINT "AdminPasswordResetToken_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminRefreshToken" ADD CONSTRAINT "AdminRefreshToken_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRefreshToken" ADD CONSTRAINT "AgentRefreshToken_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
