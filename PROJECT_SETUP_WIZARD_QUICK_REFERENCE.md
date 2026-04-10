# Project Setup Wizard - Quick Reference Card

## Access Points

| Location | How to Access |
|----------|--------------|
| **Admin Header** | Click ⚙️ icon → Project Setup Wizard |
| **Admin Sidebar** | ☰ Menu → Project Setup Wizard |
| **Keyboard** | Not yet (can be added) |

## Required Credentials Quick Lookup

### **Supabase**
```
Location: https://app.supabase.com
Navigate to: Settings → General
Find:
  • Project ID (string: abc123def456)
  • Database Password (set when creating project)
```

### **Vercel**
```
Location: https://vercel.com/account/tokens
Action:
  1. Click "Create Token"
  2. Select "Full Access"
  3. Copy token (keep safe!)
  4. (Optional) Get Team ID from Settings
```

### **GitHub**
```
Location: https://github.com/settings/tokens
Action:
  1. Click "Generate new token"
  2. Select "classic" 
  3. Scopes: repo + admin:org_hook
  4. Generate and copy (keep safe!)
```

## Wizard Workflow

```
START
  │
  ├─→ [Welcome] Review purpose
  │
  ├─→ [Supabase] Input credentials → Verify
  │
  ├─→ [Vercel] Input token → Verify
  │
  ├─→ [GitHub] Input token → Verify
  │
  ├─→ [Review] Confirm all settings
  │
  ├─→ [Deploy] Automatic setup runs
  │    ├─ Create Supabase schema
  │    ├─ Migrate data
  │    ├─ Fork repository
  │    ├─ Create Vercel project
  │    ├─ Setup environment
  │    ├─ Deploy
  │    └─ Run tests
  │
  └─→ [Complete] New instance ready!
```

## Credential Checklist

Before launching wizard, gather:

- [ ] Supabase Project ID
- [ ] Supabase Database Password
- [ ] Vercel API Token
- [ ] Vercel Team ID (if using team)
- [ ] GitHub Personal Token
- [ ] GitHub Organization Name
- [ ] Project Name for new instance

## Common Passwords & Tokens

### **Supabase Password**
- Format: Your database password
- Used for: Direct database access
- Find: Created when project was set up
- ⚠️ Keep secret - it's your DB password

### **Vercel Token**
- Format: Bearer token string
- Used for: API access to Vercel
- Find: https://vercel.com/account/tokens
- ⚠️ Keep secret - full access to account

### **GitHub Token**
- Format: Personal access token
- Used for: API access to GitHub
- Find: https://github.com/settings/tokens
- ⚠️ Keep secret - controls repo access

## Wizard Settings Summary

### **Supabase**
| Label | Type | Example | Notes |
|-------|------|---------|-------|
| Project ID | Text | `oxzjqfgfxzqbmyyo` | Copy exactly from dashboard |
| Password | Password | `••••••••` | Same as database password |

### **Vercel**
| Label | Type | Example | Notes |
|-------|------|---------|-------|
| API Token | Password | `oFn48...` | Get from tokens page |
| Team ID | Text | (optional) | Leave empty if personal account |
| Project Name | Text | `spartan-copy` | Must be unique |

### **GitHub**
| Label | Type | Example | Notes |
|-------|------|---------|-------|
| Token | Password | `ghp_1234...` | Get from settings page |
| Organization | Text | `my-company` | Your org name |

## Status Indicators

| Icon | Status | Meaning |
|------|--------|---------|
| ⏳ | Pending | Waiting to start |
| 🔄 | In Progress | Currently running |
| ✅ | Completed | Finished successfully |
| ❌ | Error | Something failed |

## Deployment Steps

1. **Create Supabase Schema** - ~30-60s
   - Creates all tables
   - Sets up RLS policies

2. **Migrate Supabase Data** - ~30-120s
   - Imports users and auth
   - Copies application data

3. **Fork GitHub Repository** - ~5-10s
   - Creates code copy in org

4. **Create Vercel Project** - ~10-20s
   - Sets up deployment

5. **Configure Environment Variables** - ~5-10s
   - Sets database URLs and keys

6. **Deploy to Vercel** - ~2-5 min
   - Builds and deploys app

7. **Run Final Tests** - ~30-60s
   - Verifies everything works

**Total: ~5-10 minutes**

## Error Quick Fixes

| Error | Quick Fix | Full Help |
|-------|-----------|-----------|
| Invalid Supabase Project ID | Copy exact ID from dashboard | See troubleshooting |
| Invalid database password | Confirm password hasn't changed | Contact Supabase |
| Vercel token expired | Generate new token at tokens page | See troubleshooting |
| GitHub org not found | Check org name spelling | See troubleshooting |
| Project name exists | Use different name (add -copy, -prod) | See troubleshooting |

## What Gets Created

### **Supabase**
```
✓ Database schema (100+ MB data)
✓ All tables and relationships
✓ RLS policies configured
✓ Authentication ready
✓ All functions and procedures
```

### **GitHub**
```
✓ Repository fork
✓ Full source code
✓ All configurations
✓ Ready to customize
```

### **Vercel**
```
✓ Live URL
✓ Domains configured
✓ Automatic deployments
✓ Environment variables set
✓ Monitoring enabled
```

## After Wizard Completion

1. ✅ Visit deployment URL
2. ✅ Log in with your credentials
3. ✅ Run initial setup (if needed)
4. ✅ Test core features
5. ✅ Configure custom settings

## Useful Links

| Resource | URL |
|----------|-----|
| Supabase Dashboard | https://app.supabase.com |
| Vercel Tokens | https://vercel.com/account/tokens |
| GitHub Tokens | https://github.com/settings/tokens |
| Vercel Status | https://www.vercelstatus.com |
| Supabase Status | https://status.supabase.com |
| GitHub Status | https://www.githubstatus.com |

## Keyboard Shortcuts

(To be implemented)

| Key | Action |
|-----|--------|
| Ctrl+Enter | Start deployment |
| Esc | Close wizard |
| Tab | Navigate fields |

## Multiple Instance Creation

**To create another copy:**

1. Gather new credentials
2. Use different Project Name
3. Use different Supabase project
4. Run wizard again

**Same credentials can be used for:**
- ✓ Multiple instances (different project names)
- ✓ Multiple organizations (different orgs)
- ✓ Multiple teams (different Vercel teams)

## Success Indicators

Your deployment is successful when:

- ✅ All 7 steps show ✓ mark
- ✅ No errors in deployment log
- ✅ Vercel URL is accessible
- ✅ Can log in with credentials
- ✅ Dashboard loads without errors

## Getting Help

| Issue | Where to Get Help |
|-------|-------------------|
| Supabase credentials | Supabase dashboard |
| Vercel setup | Vercel documentation |
| GitHub tokens | GitHub documentation |
| Wizard errors | Review deployment log |
| General questions | See full guide |

## Safety Rules

🛑 **DO NOT**
- Share credentials with others
- Store tokens in code
- Use in unsecured documents
- Keep in browser history
- Screenshot with visible tokens

✅ **DO**
- Use environment variables
- Rotate tokens regularly
- Keep backups safe
- Use team accounts for production
- Use HTTPS only

## Version Info

**Project Setup Wizard**
- Version: 1.0
- Status: Production Ready
- Last Updated: March 2026

**Browser Support**
- Chrome/Edge: ✅
- Firefox: ✅
- Safari: ✅
- Mobile: ⚠️ (Limited)

---

**Need more details?** See `PROJECT_SETUP_WIZARD_GUIDE.md`  
**Technical implementation?** See `PROJECT_SETUP_WIZARD_TECHNICAL.md`
