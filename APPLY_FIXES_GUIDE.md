# 🔒 Security Fixes - Application Guide

This guide will help you apply all security fixes to your Supabase backend automatically.

---

## 📋 Prerequisites

Before starting, ensure you have:

- ✅ Node.js installed (v16 or higher)
- ✅ Access to your Supabase Dashboard
- ✅ Service Role Key from Supabase

---

## 🚀 Quick Start (5 minutes)

### Step 1: Install Required Dependencies

```bash
npm install @supabase/supabase-js dotenv
```

### Step 2: Create .env File

Create a file named `.env` in the project root with the following content:

```env
SUPABASE_URL=https://jslfzhladmazveeedsfe.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

**⚠️ IMPORTANT:** Replace `your_service_role_key_here` with your actual Service Role Key from Supabase Dashboard.

**Where to find your Service Role Key:**
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project: MedAIApp
3. Go to Settings → API
4. Copy the `service_role` key (NOT the `anon` key)

### Step 3: Run the Automation Script

```bash
node apply-security-fixes.js
```

You should see output like:

```
🔧 MedAIApp Security Fixes Automation

📡 Connecting to Supabase...
   ✅ Connected successfully

📄 Applying: Initial secure database schema
   File: 20260522075833_secure_database.sql
   Executing 15 SQL statements...
   ✅ Migration completed

📄 Applying: Row Level Security policies
   File: security_policies.sql
   Executing 12 SQL statements...
   ✅ Migration completed

📄 Applying: Advanced security features
   File: advanced_security.sql
   Executing 18 SQL statements...
   ✅ Migration completed

🔒 Enabling Row Level Security (RLS)...
   ✅ RLS configuration completed

🔍 Verifying security configuration...
   Results:
   ✅ profiles table
   ✅ appointments table
   ✅ messages table

============================================================
📊 Security Fixes Summary
============================================================
✅ Migrations applied: 3/3
✅ Database verification: PASSED
============================================================

✨ Next steps:
1. Go to Supabase Dashboard → Authentication → Policies
2. Verify RLS is enabled on all tables
3. Go to Storage → Create buckets: "avatars" and "diplomas"
4. Test your application thoroughly
5. Reset your Service Role Key in Supabase Dashboard
6. Update .env with the new key

🎉 Security fixes automation completed!
```

---

## 🔄 Alternative: Manual Application

If the automation script doesn't work, you can apply migrations manually:

### Method 1: Supabase Dashboard SQL Editor

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project: MedAIApp
3. Navigate to: **SQL Editor** (left sidebar)
4. Click **New Query**
5. Copy and paste the content of each migration file in order:
   - `supabase/migrations/20260522075833_secure_database.sql`
   - `supabase/migrations/security_policies.sql`
   - `supabase/migrations/advanced_security.sql`
6. Click **Run** for each file

### Method 2: Supabase CLI

If you have Supabase CLI installed:

```bash
supabase db push
```

This will automatically apply all migrations in the `supabase/migrations/` folder.

---

## ✅ Verification Checklist

After applying the fixes, verify everything is configured correctly:

### 1. Row Level Security (RLS)

Go to: **Dashboard → Database → Tables**

Check that RLS is **enabled** on these tables:
- ✅ `profiles`
- ✅ `appointments`
- ✅ `messages`
- ✅ `doctors`
- ✅ `notifications`

### 2. Storage Buckets

Go to: **Dashboard → Storage**

Create these buckets if they don't exist:

**Avatars Bucket:**
- Name: `avatars`
- Public: ✅ Yes
- File size limit: 5MB
- Allowed MIME types: `image/jpeg, image/png, image/webp`

**Diplomas Bucket:**
- Name: `diplomas`
- Public: ❌ No (Private)
- File size limit: 10MB
- Allowed MIME types: `image/jpeg, image/png, application/pdf`

### 3. Storage Policies

For each bucket, ensure these policies exist:

**Avatars:**
- ✅ Users can upload their own avatar
- ✅ Anyone can view avatars (public)

**Diplomas:**
- ✅ Doctors can upload their diplomas
- ✅ Only admins can view diplomas

### 4. Test Security

Try these tests in your app:

**Test 1: IDOR Protection**
- ❌ Doctor A should NOT be able to modify Doctor B's appointments
- ✅ Doctor A can only modify their own appointments

**Test 2: File Upload Validation**
- ❌ Uploading a .exe file should be rejected
- ❌ Uploading a file > 5MB should be rejected
- ✅ Uploading valid image files should work

**Test 3: Profile Protection**
- ❌ User A should NOT be able to edit User B's profile
- ✅ Users can only edit their own profile

**Test 4: Admin Panel**
- ❌ Regular users should NOT see admin panel
- ✅ Only admin@medai.am can access admin features

---

## 🔐 Post-Application Security Steps

### CRITICAL: Reset Your Service Role Key

**⚠️ YOUR SERVICE ROLE KEY WAS EXPOSED IN THIS CHAT**

You MUST reset it immediately:

1. Go to: **Dashboard → Settings → API**
2. Click **Reset** next to Service Role Key
3. Copy the new key
4. Update your `.env` file with the new key
5. Update `EXPO_PUBLIC_SUPABASE_ANON_KEY` in your app
6. Redeploy your application

### Update Environment Variables

Update your `.env` file:

```env
# Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL=https://jslfzhladmazveeedsfe.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<new_anon_key_here>

# Admin Configuration
EXPO_PUBLIC_ADMIN_EMAIL=admin@medai.am

# API Keys (keep these secret!)
SUPABASE_SERVICE_ROLE_KEY=<new_service_role_key_here>
```

### Deploy Updated Code

```bash
# Commit and push the security fixes
git add .
git commit -m "🔒 Apply Supabase security fixes and reset keys"
git push origin main

# Rebuild and redeploy your app
eas build --platform all
```

---

## 🆘 Troubleshooting

### Error: "SUPABASE_SERVICE_ROLE_KEY not found"

**Solution:** Make sure you created the `.env` file in the project root with your Service Role Key.

### Error: "Connection failed"

**Solutions:**
1. Check your internet connection
2. Verify the Supabase URL is correct
3. Verify the Service Role Key is correct (not the anon key)
4. Check if Supabase is experiencing downtime

### Error: "Table already exists"

**Solution:** This is normal if you're running the script multiple times. The script will skip existing tables.

### Script completes but verification fails

**Solution:** Apply migrations manually using the Supabase Dashboard SQL Editor method described above.

---

## 📞 Need Help?

If you encounter issues:

1. Check the [Supabase Documentation](https://supabase.com/docs)
2. Review the detailed security audit in `SECURITY.md`
3. Check individual migration files for specific SQL statements
4. Contact Supabase support if database issues persist

---

## 📚 Additional Resources

- **Full Security Audit:** `SECURITY.md`
- **Quick Checklist:** `SECURITY_CHECKLIST.md`
- **Deployment Guide:** `README_SECURITY_FIXES.md`
- **Migration Files:** `supabase/migrations/`

---

## ✨ Success!

Once you've completed all steps and verification:

1. ✅ All security vulnerabilities are fixed
2. ✅ Row Level Security is enabled
3. ✅ Storage policies are configured
4. ✅ Service Role Key is reset
5. ✅ Application is secure and ready for production

**You're done! Your MedAI application is now secure. 🎉**

---

**Last Updated:** June 2, 2026  
**Script Version:** 1.0.0
