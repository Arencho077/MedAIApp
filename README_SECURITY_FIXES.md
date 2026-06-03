# 🏥 MedAI Armenia App - Security Fixes Applied

## ✅ Security Audit Complete

All critical vulnerabilities have been identified and patched. See [SECURITY.md](./SECURITY.md) for the full security audit report.

---

## 🚨 CRITICAL: Action Required Before Deploying

### 1. Create Environment File

```bash
cp .env.example .env
```

Then edit `.env` and add your actual credentials:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
EXPO_PUBLIC_ADMIN_EMAIL=admin@yourdomain.com
```

⚠️ **Never commit `.env` to git!** It's already in `.gitignore`.

---

### 2. Apply Database Security Policies

Run the SQL migration in your Supabase dashboard:

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Open `supabase/migrations/security_policies.sql`
3. Copy and paste the entire content
4. Click **Run**

This will enable Row Level Security (RLS) and prevent unauthorized data access.

---

### 3. Configure Supabase Settings

In your Supabase dashboard:

**Database → Settings → Custom Postgres Configuration**

Add:
```
app.admin_email = 'your_admin_email@example.com'
```

This is used by server-side admin functions to validate admin access.

---

### 4. Create Storage Buckets

In **Supabase Dashboard → Storage**, create two buckets:

1. **`avatars`**
   - Make it **public** (for user profile pictures)
   - Apply the storage policies from the SQL migration

2. **`diplomas`**
   - Make it **private** (admin-only access)
   - Apply the storage policies from the SQL migration

---

### 5. Review Exposed Credentials (if applicable)

If you previously committed `.env` or hardcoded secrets to Git:

1. **Rotate all Supabase keys** in the Supabase dashboard
2. **Change admin password** if it was exposed
3. **Review Git history** for leaked secrets using tools like `git-secrets` or `truffleHog`

---

## 🛠️ What Was Fixed

### Critical Vulnerabilities
- ✅ **IDOR Attack** - Appointments can only be modified by their owners
- ✅ **Hardcoded Secrets** - Moved to environment variables
- ✅ **Missing Authorization** - Added ownership checks on all sensitive operations
- ✅ **File Upload Exploits** - Added type, size, and content validation
- ✅ **SQL Injection Risks** - RLS policies enforce server-side validation
- ✅ **Push Notification Abuse** - Added sender validation and rate limiting considerations

### Security Improvements
- ✅ Input validation (email format, password strength)
- ✅ Email normalization (case-insensitive)
- ✅ File upload security (type/size limits)
- ✅ URL validation (prevent open redirects)
- ✅ Message length limits (prevent abuse)
- ✅ Comprehensive RLS policies
- ✅ Audit logging in critical functions

---

## 📦 Installation

```bash
# Install dependencies
npm install

# Create .env file (see step 1 above)
cp .env.example .env

# Start development server
npm start
```

---

## 🚀 Deployment Checklist

Before deploying to production:

- [ ] Environment variables configured (`.env` for dev, deployment secrets for prod)
- [ ] SQL migration applied (RLS policies enabled)
- [ ] Storage buckets created and policies applied
- [ ] Admin email configured in Supabase
- [ ] All Supabase keys rotated (if they were exposed)
- [ ] HTTPS enforced in production
- [ ] Rate limiting configured (use Supabase Edge Functions or a WAF)
- [ ] Error logging/monitoring set up (e.g., Sentry)
- [ ] Backup strategy in place for database

---

## 📖 Documentation

- **[SECURITY.md](./SECURITY.md)** - Full security audit report
- **[supabase/migrations/security_policies.sql](./supabase/migrations/security_policies.sql)** - Database security policies

---

## 🔐 Security Contact

For security issues, please contact: **[your-security-email@domain.com]**

**Do NOT open public GitHub issues for security vulnerabilities.**

---

## 📄 License

[Your License Here]

---

**Last Updated:** June 2, 2026  
**Security Audit by:** Internal security review
