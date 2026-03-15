import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱  Seeding database...");

  // ─── Clear all existing data ─────────────────────────────────────────────
  await prisma.printLog.deleteMany();
  await prisma.fileActivity.deleteMany();
  await prisma.keylogEntry.deleteMany();
  await prisma.connectionEvent.deleteMany();
  await prisma.clipboardLog.deleteMany();
  await prisma.usbEvent.deleteMany();
  await prisma.browserHistory.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.screenshot.deleteMany();
  await prisma.activity.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.admin.deleteMany();
  await prisma.settings.deleteMany();
  await prisma.agentUpdate.deleteMany();
  await prisma.plan.deleteMany();
  await prisma.paymentSettings.deleteMany();

  console.log("✅  Cleared existing data");

  // ─── Admins ───────────────────────────────────────────────────────────────
  const superAdminPwd = await bcrypt.hash("Admin@123", 12);
  const viewerPwd = await bcrypt.hash("Viewer@123", 12);

  await prisma.admin.createMany({
    data: [
      {
        name: "Super Admin",
        email: "superadmin@company.com",
        password: superAdminPwd,
        role: "super_admin",
        isActive: true,
      },
      {
        name: "Viewer User",
        email: "viewer@company.com",
        password: viewerPwd,
        role: "viewer",
        isActive: true,
      },
    ],
  });

  console.log("✅  Created admin accounts");

  // ─── Subscription Plans ─────────────────────────────────────────────────────
  const freePlan = await prisma.plan.create({
    data: {
      name: "Free",
      priceMonthly: 0,
      priceYearly: 0,
      maxSeats: 3,
      screenshotsEnabled: true,
      browserHistoryEnabled: false,
      usbMonitoringEnabled: false,
      alertsEnabled: false,
      keylogEnabled: false,
      fileActivityEnabled: false,
      printLogsEnabled: false,
      advancedReports: false,
      isActive: true,
    },
  });

  const proPlan = await prisma.plan.create({
    data: {
      name: "Professional",
      priceMonthly: 2999,
      priceYearly: 29990,
      maxSeats: 25,
      screenshotsEnabled: true,
      browserHistoryEnabled: true,
      usbMonitoringEnabled: true,
      alertsEnabled: true,
      keylogEnabled: true,
      fileActivityEnabled: true,
      printLogsEnabled: false,
      advancedReports: true,
      isActive: true,
    },
  });

  await prisma.plan.create({
    data: {
      name: "Enterprise",
      priceMonthly: 7999,
      priceYearly: 79990,
      maxSeats: -1,
      screenshotsEnabled: true,
      browserHistoryEnabled: true,
      usbMonitoringEnabled: true,
      alertsEnabled: true,
      keylogEnabled: true,
      fileActivityEnabled: true,
      printLogsEnabled: true,
      advancedReports: true,
      isActive: true,
    },
  });

  console.log("✅  Created subscription plans (Free, Professional, Enterprise)");

  // ─── Payment Settings ───────────────────────────────────────────────────────
  await prisma.paymentSettings.create({
    data: {
      bankName: "UBL",
      bankIban: "PK00UNIL0000000000000000",
      bankTitle: "StaffTrack Pvt Ltd",
      easypaisaNumber: "03001234567",
      easypaisaName: "StaffTrack",
      nayapayNumber: "03001234567",
      nayapayName: "StaffTrack",
      sadapayNumber: "03001234567",
      sadapayName: "StaffTrack",
      jsbankNumber: "",
      jsbankName: "",
      whatsappNumber: "923001234567",
      instructions: "After transferring, upload a screenshot of your payment receipt. Verification typically takes 1-2 hours during business days.",
    },
  });

  console.log("✅  Created payment settings");

  // ─── Default Settings ─────────────────────────────────────────────────────
  await prisma.settings.create({
    data: {
      workStartTime: "09:00",
      workEndTime: "18:00",
      workDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
      timezone: "Asia/Karachi",
      screenshotInterval: 10,
      screenshotQuality: 60,
      idleThreshold: 5,
      screenshotsEnabled: true,
      browserHistoryEnabled: true,
      usbMonitoringEnabled: true,
      clipboardEnabled: false,
      afterHoursEnabled: true,
      blockedSites: ["youtube.com", "facebook.com", "reddit.com", "twitter.com", "netflix.com"],
      productiveApps: [
        "Visual Studio Code", "IntelliJ IDEA", "Figma", "Adobe Photoshop",
        "Salesforce", "HubSpot", "Microsoft Excel", "Google Analytics",
        "Terminal", "Postman", "Docker Desktop", "GitHub Desktop",
      ],
      nonProductiveApps: ["YouTube", "Facebook", "Reddit", "Twitter", "Netflix", "Steam", "TikTok"],
      neutralApps: ["Google Chrome", "Microsoft Edge", "Slack", "Microsoft Teams", "Notepad"],
      alertEmails: ["superadmin@company.com"],
      alertOnBlockedSite: true,
      alertOnIdle: true,
      alertOnUsb: true,
      alertOnAfterHours: true,
      alertOnNewSoftware: true,
      idleAlertThreshold: 30,
      activityRetentionDays: 90,
      screenshotRetentionDays: 30,
      alertRetentionDays: 60,
    },
  });

  console.log("✅  Created default settings");

  // ─── Agent Update Record ──────────────────────────────────────────────────
  await prisma.agentUpdate.create({
    data: {
      version: "1.2.0",
      downloadUrl: "https://releases.company.com/agent/v1.2.0/EmployeeMonitor.exe",
      changelog: "- Improved screenshot compression\n- Fixed idle detection bug\n- Added USB monitoring support",
      isLatest: true,
    },
  });

  console.log("✅  Created agent update record");

  console.log("\n✅  Seeding complete!");
  console.log("\n📧  Platform Admin credentials (Master Admin Dashboard):");
  console.log("   Super Admin: superadmin@company.com / Admin@123");
  console.log("   Viewer:      viewer@company.com / Viewer@123");
  console.log("\n📋  Subscription Plans:");
  console.log("   Free (3 seats) — screenshots only");
  console.log("   Professional (25 seats, PKR 2999/mo) — all features except print logs");
  console.log("   Enterprise (unlimited, PKR 7999/mo) — all features");
  console.log("\n🚀  SaaS Flow:");
  console.log("   1. Company signs up at /signup");
  console.log("   2. Verify email → Select plan → Pay invoice");
  console.log("   3. Master admin approves payment → Company dashboard unlocked");
  console.log("   4. Add employees → Install agent on their machines\n");
}

main()
  .catch((e) => {
    console.error("❌  Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });