# Project Reference Card

Save this for quick reference when working with external testing setup.

---

## 📊 Your Two Supabase Projects

### Production Project

```
Name: social-media-saas (original)
Project Ref: kvqdkohdpvmdylqgujpn
URL: https://kvqdkohdpvmdylqgujpn.supabase.co
Anon Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2cWRrb2hkcHZtZHlscWd1anBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5ODg3NjAsImV4cCI6MjA3NjU2NDc2MH0.mB5s5sBCKIov-hIG5xJpo90SDLiQ2c8JAvvOkGCGyII

Used by: Your main application (localhost + production deployment)
Contains: Real customer data, real businesses, live content
Access: Public (anyone can sign up)
Testers: NO - keep testers out of production!
```

### Staging Project (NEW - To Be Created)

```
Name: social-media-saas-staging
Project Ref: [FILL IN AFTER CREATING]
URL: https://[YOUR_NEW_REF].supabase.co
Anon Key: [FILL IN AFTER CREATING]

Used by: Vercel preview deployments, external testing
Contains: Test data only (safe to wipe/reset)
Access: Restricted to approved_testers whitelist
Testers: YES - safe for external testers
```

---

## 🔐 Which Project Should I Use When?

| Task | Use Project | Why |
|------|-------------|-----|
| Local development (`npm run dev`) | **Production** | Working with real data structure |
| Deploying edge functions (normal) | **Production** | Updates for main app |
| Creating PR for external testing | **Staging** | Vercel preview uses staging |
| Adding external tester | **Staging** | Tester whitelist only in staging |
| Vercel preview environment vars | **Staging** | External testers use staging |
| Testing new features yourself | **Production** | Your normal workflow |
| Resetting/wiping database | **Staging** | Never wipe production! |

---

## 🚨 Safety Rules

### NEVER:
- ❌ Create `approved_testers` table in production
- ❌ Give staging credentials to real customers
- ❌ Use production credentials in Vercel preview environment
- ❌ Deploy untested code to production without staging test
- ❌ Mix up the project refs when linking Supabase CLI

### ALWAYS:
- ✅ Double-check which project you're in before running SQL
- ✅ Verify Vercel preview uses staging credentials
- ✅ Keep staging project ref/keys in this document
- ✅ Test in staging before merging to production
- ✅ Use `npx supabase status` to verify which project you're linked to

---

## 📝 Quick Commands

### Check which Supabase project you're linked to:
```bash
npx supabase status
# Shows project ref - verify it's the one you expect!
```

### Switch to production:
```bash
npx supabase link --project-ref kvqdkohdpvmdylqgujpn
```

### Switch to staging:
```bash
npx supabase link --project-ref [YOUR_STAGING_REF]
```

### Check Vercel environment:
```bash
vercel env ls
# Verify preview env uses staging URL
```

### Add external tester (in staging SQL editor):
```sql
INSERT INTO approved_testers (email, name) 
VALUES ('tester@example.com', 'Tester Name');
```

---

## 🔍 Quick Verification Checklist

Before letting external testers access:

- [ ] Staging project ref is different from `kvqdkohdpvmdylqgujpn`
- [ ] Staging anon key is different from production anon key
- [ ] `approved_testers` table exists in staging SQL editor
- [ ] `approved_testers` table does NOT exist in production SQL editor
- [ ] Vercel preview environment uses staging URL (not production)
- [ ] Edge functions deployed to staging project
- [ ] Staging project has no real customer data

---

**Keep this file updated as you create the staging project!**
