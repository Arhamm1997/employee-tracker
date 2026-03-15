#!/bin/bash

# Update Master Admin Credentials Script for VPS
# Run this script on your VPS as root or with sudo
# This updates the admin credentials without full redeployment

echo "🔄 Updating master admin credentials on VPS..."

# Check if we're in the right directory
if [ ! -d "employee-tracker/backend" ]; then
    echo "❌ Error: employee-tracker/backend directory not found"
    echo "Please run this script from the parent directory of employee-tracker"
    exit 1
fi

cd employee-tracker/backend

# Create a temporary update script
cat > update_admin_temp.js << 'EOF'
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function updateMasterAdmin() {
  try {
    console.log('🔄 Updating master admin credentials...');

    // Hash the new password
    const hashedPassword = await bcrypt.hash('AWANarham96', 12);

    // Update the master admin (the one with companyId = null and role = 'super_admin')
    const updatedAdmin = await prisma.admin.updateMany({
      where: {
        companyId: null,
        role: 'super_admin'
      },
      data: {
        email: 'seobyarham@gmail.com',
        password: hashedPassword
      }
    });

    if (updatedAdmin.count === 0) {
      console.log('❌ No master admin found to update');
      return;
    }

    console.log('✅ Master admin credentials updated successfully!');
    console.log('📧 New email: seobyarham@gmail.com');
    console.log('🔒 Password has been hashed and updated');

  } catch (error) {
    console.error('❌ Error updating master admin:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateMasterAdmin();
EOF

# Run the update script
echo "Running database update..."
node update_admin_temp.js

# Clean up
rm update_admin_temp.js

echo "✅ Admin credentials update complete!"
echo "You can now log in with:"
echo "📧 Email: seobyarham@gmail.com"
echo "🔒 Password: AWANarham96"