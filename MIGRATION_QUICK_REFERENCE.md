# 📋 API Migration Quick Reference Card

## 🚀 5 Ways to Migrate

```bash
# 1. INTERACTIVE WIZARD (Easiest - Recommended)
npm run migrate:setup

# 2. POWERSHELL (Windows)
.\migrate-api.ps1

# 3. BASH (macOS/Linux)
bash migrate-api.sh

# 4. CLI (Command Line)
SOURCE_API_KEY=key1 TARGET_API_KEY=key2 \
npm run migrate:auto -- --source old-proj --target new-proj

# 5. API ENDPOINTS (Programmatic)
curl -X POST http://localhost:3001/api/migration/auto-migrate \
  -d '{"sourceProjectId":"old","sourceApiKey":"key1","targetProjectId":"new","targetApiKey":"key2"}'
```

## 🔑 Get Your API Keys

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. Select project
3. **Settings** → **API**
4. Copy **Service Role Key**
5. Repeat for target project

## 📊 What Gets Migrated

| Component | Included | Details |
|-----------|----------|---------|
| Tables | ✅ | All table structures, columns, types |
| Data | ✅ | All rows from all tables |
| Indexes | ✅ | Automatically recreated |
| RLS Policies | ✅ | All security policies |
| Users | ✅ | Auth users (Supabase Auth) |
| Roles | ✅ | Custom user roles |
| Storage | ✅ | Buckets and configuration |
| Functions | ✅ | Database functions/procedures |
| Triggers | ✅ | All database triggers |

## ⏱️ How Long?

- Small (< 100MB): **2-5 min**
- Medium (100MB-1GB): **5-10 min**
- Large (> 1GB): **10-30 min**

## ✅ Pre-Migration Checklist

- [ ] Backup current database
- [ ] Have Service Role Keys for both projects
- [ ] Target project ready
- [ ] Good internet connection
- [ ] No other migrations running

## 🔧 CLI Options

```bash
# Skip users and storage
--no-users --no-storage

# Skip functions
--no-functions

# Combine options
npm run migrate:auto -- --source proj1 --target proj2 --no-users --no-storage
```

## 📊 Post-Migration

1. **Check the report** - Verify all steps completed
2. **Count the rows** - Source and target should match
3. **Test your app** - Update connection strings
4. **Update env vars** - Point to new project
5. **Go live** - Once verified

## 🐛 Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| Connection failed | Check project ID and API key are correct |
| Users not migrated | Use Service Role Key, not Anon key |
| Permission denied | Verify API key has database access |
| Rows don't match | Check RLS policies, try specific tables |
| Too slow | Monitor internet, don't close terminal |

## 🔐 Security Tips

```bash
# ✅ GOOD - Use environment variables
export SOURCE_API_KEY=your_key
export TARGET_API_KEY=your_key
npm run migrate:auto -- --source old --target new

# ✅ GOOD - Use .env file (add to .gitignore)
echo "SOURCE_API_KEY=..." >> .env.migration
echo "TARGET_API_KEY=..." >> .env.migration
export $(cat .env.migration | xargs)

# ❌ BAD - Don't put keys in command
npm run migrate:auto --api-key sbp_abc123...

# ❌ BAD - Don't commit to git
git add .env  # WRONG - API keys will be exposed!
```

## 📞 Common Commands

```bash
# Check if migration is done
curl http://localhost:3001/api/migration/status

# Export data for backup
curl -X POST http://localhost:3001/api/migration/export \
  -d '{"projectId":"proj-id","apiKey":"...","dataType":"all"}'

# Export only RLS policies
curl -X POST http://localhost:3001/api/migration/export \
  -d '{"projectId":"proj-id","apiKey":"...","dataType":"policies"}'

# Start API server for endpoints
npm run dev:api
```

## 📁 File Locations

| File | Purpose |
|------|---------|
| `/api/migration/README.md` | Complete documentation |
| `/api/migration/cli.ts` | CLI implementation |
| `/api/migration/setup-wizard.ts` | Interactive wizard |
| `/migrate-api.ps1` | Windows PowerShell script |
| `/migrate-api.sh` | macOS/Linux bash script |
| `/API_MIGRATION_GUIDE.md` | Step-by-step guide |

## 🆘 Getting Help

1. Check `/api/migration/README.md` for detailed docs
2. Read the troubleshooting section above
3. Review migration logs (shown during run)
4. Verify your API keys and project IDs
5. Test with a small project first

## ⚡ Pro Tips

**Tip 1: Test First**
Create a test project and migrate a copy first before going live

**Tip 2: Automate**
Use the API endpoints to integrate with CI/CD pipelines

**Tip 3: Monitor**
Watch the terminal output to see exactly what's happening

**Tip 4: Backup**
Always backup before migration (even with API-based approach)

**Tip 5: Verify**
Check row counts match after migration before going live

## 📚 Related Commands

```bash
npm run dev          # Start app
npm run dev:api      # Start API server
npm run build        # Build for production
npm run lint         # Check code quality
```

## 🎯 Next After Migration

1. Update `.env` files with new project ID
2. Update Vercel environment variables
3. Run your test suite
4. Test key features in staging
5. Deploy to production
6. Monitor for issues

---

**Status:** ✅ Production Ready  
**Version:** 1.0  
**Last Updated:** April 7, 2026

**Quick Start:** `npm run migrate:setup` → Done! 🚀
