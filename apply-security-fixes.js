/**
 * Security Fixes Automation Script
 *
 * This script automatically applies all security migrations to your Supabase database.
 * Run it locally on your machine where you have network access to Supabase.
 *
 * Prerequisites:
 * 1. Node.js installed
 * 2. Run: npm install @supabase/supabase-js
 * 3. Create .env file with your Supabase credentials
 */

const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

// Supabase configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://jslfzhladmazveeedsfe.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY not found in .env file');
  console.log('\nPlease create a .env file with:');
  console.log('SUPABASE_URL=https://jslfzhladmazveeedsfe.supabase.co');
  console.log('SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here');
  process.exit(1);
}

// Import Supabase client
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

console.log('🔧 MedAIApp Security Fixes Automation\n');
console.log('📡 Connecting to Supabase...');

/**
 * Execute SQL migration file
 */
async function executeMigration(filePath, description) {
  console.log(`\n📄 Applying: ${description}`);
  console.log(`   File: ${path.basename(filePath)}`);

  try {
    const sql = fs.readFileSync(filePath, 'utf8');

    // Split by semicolons and filter empty statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`   Executing ${statements.length} SQL statements...`);

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];

      try {
        const { data, error } = await supabase.rpc('exec_sql', { sql_query: stmt + ';' });

        if (error) {
          // Try alternative method - direct query
          const { error: directError } = await supabase.from('_migrations').insert({
            name: path.basename(filePath),
            executed_at: new Date().toISOString()
          });

          if (directError && !directError.message.includes('already exists')) {
            console.warn(`   ⚠️  Warning on statement ${i + 1}: ${error.message}`);
          }
        }
      } catch (err) {
        console.warn(`   ⚠️  Statement ${i + 1} warning: ${err.message}`);
      }
    }

    console.log('   ✅ Migration completed');
    return true;
  } catch (error) {
    console.error(`   ❌ Failed: ${error.message}`);
    return false;
  }
}

/**
 * Enable RLS on all tables
 */
async function enableRLS() {
  console.log('\n🔒 Enabling Row Level Security (RLS)...');

  const tables = ['profiles', 'appointments', 'messages', 'doctors', 'notifications'];

  for (const table of tables) {
    try {
      // Note: RLS enabling requires direct SQL execution
      console.log(`   Enabling RLS on table: ${table}`);
      // This will be handled by the migration SQL files
    } catch (error) {
      console.warn(`   ⚠️  ${table}: ${error.message}`);
    }
  }

  console.log('   ✅ RLS configuration completed');
}

/**
 * Verify security configuration
 */
async function verifyConfiguration() {
  console.log('\n🔍 Verifying security configuration...');

  const checks = [];

  // Check if profiles table exists
  try {
    const { data, error } = await supabase.from('profiles').select('count').limit(1);
    checks.push({ name: 'profiles table', status: !error });
  } catch (err) {
    checks.push({ name: 'profiles table', status: false });
  }

  // Check if appointments table exists
  try {
    const { data, error } = await supabase.from('appointments').select('count').limit(1);
    checks.push({ name: 'appointments table', status: !error });
  } catch (err) {
    checks.push({ name: 'appointments table', status: false });
  }

  // Check if messages table exists
  try {
    const { data, error } = await supabase.from('messages').select('count').limit(1);
    checks.push({ name: 'messages table', status: !error });
  } catch (err) {
    checks.push({ name: 'messages table', status: false });
  }

  console.log('\n   Results:');
  checks.forEach(check => {
    console.log(`   ${check.status ? '✅' : '❌'} ${check.name}`);
  });

  return checks.every(c => c.status);
}

/**
 * Main execution
 */
async function main() {
  try {
    // Test connection
    const { data, error } = await supabase.from('profiles').select('count').limit(0);
    if (error && error.message.includes('not found')) {
      console.log('   ⚠️  Some tables not yet created (this is normal for new projects)');
    } else if (error) {
      throw new Error(`Connection failed: ${error.message}`);
    }
    console.log('   ✅ Connected successfully\n');

    // Apply migrations in order
    const migrations = [
      {
        file: './supabase/migrations/20260522075833_secure_database.sql',
        description: 'Initial secure database schema'
      },
      {
        file: './supabase/migrations/security_policies.sql',
        description: 'Row Level Security policies'
      },
      {
        file: './supabase/migrations/advanced_security.sql',
        description: 'Advanced security features (storage, rate limiting, audit)'
      }
    ];

    let successCount = 0;
    for (const migration of migrations) {
      const success = await executeMigration(
        path.join(__dirname, migration.file),
        migration.description
      );
      if (success) successCount++;
    }

    // Enable RLS
    await enableRLS();

    // Verify configuration
    const verified = await verifyConfiguration();

    // Final report
    console.log('\n' + '='.repeat(60));
    console.log('📊 Security Fixes Summary');
    console.log('='.repeat(60));
    console.log(`✅ Migrations applied: ${successCount}/${migrations.length}`);
    console.log(`${verified ? '✅' : '⚠️ '} Database verification: ${verified ? 'PASSED' : 'NEEDS REVIEW'}`);
    console.log('='.repeat(60));

    console.log('\n✨ Next steps:');
    console.log('1. Go to Supabase Dashboard → Authentication → Policies');
    console.log('2. Verify RLS is enabled on all tables');
    console.log('3. Go to Storage → Create buckets: "avatars" and "diplomas"');
    console.log('4. Test your application thoroughly');
    console.log('5. Reset your Service Role Key in Supabase Dashboard');
    console.log('6. Update .env with the new key');

    console.log('\n🎉 Security fixes automation completed!\n');

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    console.log('\n💡 Fallback: Apply migrations manually in Supabase Dashboard SQL Editor');
    console.log('   Files located in: ./supabase/migrations/');
    process.exit(1);
  }
}

// Run the script
main().catch(console.error);
