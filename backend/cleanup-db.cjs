const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function cleanupDatabase() {
  console.log('🧹 Starting database cleanup...');

  try {
    // Count records before cleanup
    const counts = {
      companies: await prisma.company.count(),
      admins: await prisma.admin.count(),
      masterAdmins: await prisma.admin.count({ where: { companyId: null } }),
      employees: await prisma.employee.count(),
      activities: await prisma.activity.count(),
      screenshots: await prisma.screenshot.count(),
      alerts: await prisma.alert.count(),
      subscriptions: await prisma.subscription.count(),
      invoices: await prisma.invoice.count(),
      plans: await prisma.plan.count(),
      paymentSettings: await prisma.paymentSettings.count(),
      agentUpdates: await prisma.agentUpdate.count(),
      agentVersions: await prisma.agentVersion.count(),
    };

    console.log('📊 Records before cleanup:', counts);

    // ⚠️  IMPORTANT: Preserve global data that should not be deleted
    console.log('🔒 Preserving global data:');
    console.log(`   - ${counts.plans} plans`);
    console.log(`   - ${counts.paymentSettings} payment settings`);
    console.log(`   - ${counts.agentUpdates} agent updates`);
    console.log(`   - ${counts.agentVersions} agent versions`);
    console.log(`   - ${counts.masterAdmins} master admin(s)`);

    // Delete all company-related data except master admins
    console.log('🗑️  Deleting all company-related data...');

    // Delete in order to respect foreign key constraints
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

    // Delete agent refresh tokens
    await prisma.agentRefreshToken.deleteMany();

    // Delete employees (this will cascade to related data)
    await prisma.employee.deleteMany();

    // Delete admin-related data for company admins (not master admins)
    await prisma.adminRefreshToken.deleteMany({
      where: { companyId: { not: null } }
    });
    await prisma.adminPasswordResetToken.deleteMany({
      where: {
        admin: { companyId: { not: null } }
      }
    });

    // Delete company admins (keep master admins)
    await prisma.admin.deleteMany({
      where: { companyId: { not: null } }
    });

    // Delete invoices
    await prisma.invoice.deleteMany();

    // Delete subscriptions
    await prisma.subscription.deleteMany();

    // Delete email and password reset tokens
    await prisma.emailVerificationToken.deleteMany();
    await prisma.passwordResetToken.deleteMany();

    // Delete settings
    await prisma.settings.deleteMany();

    // Finally delete all companies
    await prisma.company.deleteMany();

    // Count records after cleanup
    const finalCounts = {
      companies: await prisma.company.count(),
      admins: await prisma.admin.count(),
      masterAdmins: await prisma.admin.count({ where: { companyId: null } }),
      employees: await prisma.employee.count(),
      activities: await prisma.activity.count(),
      screenshots: await prisma.screenshot.count(),
      alerts: await prisma.alert.count(),
      subscriptions: await prisma.subscription.count(),
      invoices: await prisma.invoice.count(),
      plans: await prisma.plan.count(),
      paymentSettings: await prisma.paymentSettings.count(),
      agentUpdates: await prisma.agentUpdate.count(),
      agentVersions: await prisma.agentVersion.count(),
    };

    console.log('✅ Records after cleanup:', finalCounts);
    console.log('🎉 Database cleanup completed successfully!');
    console.log(`📋 Preserved:`);
    console.log(`   - ${finalCounts.masterAdmins} master admin(s)`);
    console.log(`   - ${finalCounts.plans} global plan(s)`);
    console.log(`   - ${finalCounts.paymentSettings} payment setting(s)`);
    console.log(`   - ${finalCounts.agentUpdates} agent update(s)`);
    console.log(`   - ${finalCounts.agentVersions} agent version(s)`);

  } catch (error) {
    console.error('❌ Database cleanup failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the cleanup
cleanupDatabase()
  .then(() => {
    console.log('🏁 Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });