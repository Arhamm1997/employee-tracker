#!/bin/bash

# Template: Update Master Admin Credentials Script for VPS
# Customize the EMAIL and PASSWORD variables below before running
# Run this script on your VPS as root or with sudo

# === CONFIGURE THESE VALUES ===
NEW_EMAIL="your-new-email@example.com"
NEW_PASSWORD="YourNewSecurePassword123"
# ================================

echo "🔄 Updating master admin credentials on VPS..."
echo "📧 New Email: $NEW_EMAIL"
echo "🔒 New Password: $NEW_PASSWORD"

# Check if we're in the right directory
if [ ! -d "employee-tracker/backend" ]; then
    echo "❌ Error: employee-tracker/backend directory not found"
    echo "Please run this script from the parent directory of employee-tracker"
    echo "Or navigate to the correct directory and run: ./update-admin-template.sh"
    exit 1
fi

cd employee-tracker/backend

# Create a temporary update script with the configured values
cat > update_admin_temp.js << EOF
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function updateMasterAdmin() {
  try {
    console.log('🔄 Updating master admin credentials...');

    // Hash the new password
    const hashedPassword = await bcrypt.hash('$NEW_PASSWORD', 12);

    // Update the master admin (the one with companyId = null and role = 'super_admin')
    const updatedAdmin = await prisma.admin.updateMany({
      where: {
        companyId: null,
        role: 'super_admin'
      },
      data: {
        email: '$NEW_EMAIL',
        password: hashedPassword
      }
    });

    if (updatedAdmin.count === 0) {
      console.log('❌ No master admin found to update');
      return;
    }

    console.log('✅ Master admin credentials updated successfully!');
    console.log('📧 New email: $NEW_EMAIL');
    console.log('🔒 Password has been hashed and updated');

  } catch (error) {
    console.error('❌ Error updating master admin:', error);
  } finally {
    await prisma.\$disconnect();
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
echo "📧 Email: $NEW_EMAIL"
echo "🔒 Password: $NEW_PASSWORD"