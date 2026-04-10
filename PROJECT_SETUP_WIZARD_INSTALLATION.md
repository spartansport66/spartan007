# Project Setup Wizard - Installation & Deployment Guide

## Installation Steps

### **Step 1: Install Required Dependencies**

The Project Setup Wizard requires the following packages. Ensure they're in your `package.json`:

```bash
npm install @vercel/node @supabase/supabase-js
# or
pnpm add @vercel/node @supabase/supabase-js
```

### **Step 2: Files to Copy/Create**

The following files should be in your project:

**Frontend Component:**
```
src/components/ProjectSetupDashboard.tsx
```

**Backend API Endpoints:**
```
api/setup/verify-supabase.ts
api/setup/verify-vercel.ts
api/setup/verify-github.ts
api/setup/setup-supabase-schema.ts
api/setup/migrate-supabase-data.ts
api/setup/fork-github-repo.ts
api/setup/create-vercel-project.ts
api/setup/setup-vercel-env.ts
api/setup/trigger-vercel-deployment.ts
api/setup/run-final-tests.ts
```

**Database Backup Files (Required):**
```
database-backup/export_schema_policies.sql
database-backup/export_users_auth.sql
database-backup/export_application_data.sql
```

### **Step 3: Verify File Locations**

Ensure proper directory structure:

```
project-root/
├── api/
│   └── setup/
│       ├── verify-supabase.ts
│       ├── verify-vercel.ts
│       ├── verify-github.ts
│       ├── setup-supabase-schema.ts
│       ├── migrate-supabase-data.ts
│       ├── fork-github-repo.ts
│       ├── create-vercel-project.ts
│       ├── setup-vercel-env.ts
│       ├── trigger-vercel-deployment.ts
│       └── run-final-tests.ts
├── src/
│   ├── components/
│   │   └── ProjectSetupDashboard.tsx
│   └── pages/
│       └── AdminDashboard.tsx
└── database-backup/
    ├── export_schema_policies.sql
    ├── export_users_auth.sql
    └── export_application_data.sql
```

### **Step 4: Environment Variables**

Set these environment variables in your Vercel/deployment platform:

```env
# Supabase Configuration
SUPABASE_URL=https://[your-project-id].supabase.co
SUPABASE_ANON_KEY=[your-anon-key]
SUPABASE_SERVICE_ROLE_KEY=[your-service-role-key]

# Needed for API endpoints
VITE_SUPABASE_URL=https://[your-project-id].supabase.co
VITE_SUPABASE_ANON_KEY=[your-anon-key]
```

### **Step 5: Build & Deploy**

```bash
# Build the project
npm run build
# or
pnpm build

# Deploy to Vercel (if using Vercel)
npm run deploy
# or push to GitHub and Vercel will auto-deploy
```

## TypeScript Configuration

The API files use Vercel's request/response types. Ensure your `tsconfig.json` includes:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020", "DOM"],
    "skipLibCheck": true,
    "esModuleInterop": true,
    "strict": true
  }
}
```

## Component Integration

### **AdminDashboard Integration**

The ProjectSetupDashboard is already integrated into the AdminDashboard:

1. **Import** - Added at top of file
2. **State** - `isProjectSetupDashboardOpen` state created
3. **Button** - Settings icon button in header
4. **Sidebar** - Menu item in admin sidebar
5. **Render** - Component rendered in dashboard

**If you need to re-integrate:**

```typescript
// 1. Import
import ProjectSetupDashboard from '@/components/ProjectSetupDashboard';

// 2. Add state
const [isProjectSetupDashboardOpen, setIsProjectSetupDashboardOpen] = useState(false);

// 3. Add button in header
<Button 
  variant="outline" 
  size="icon" 
  onClick={() => setIsProjectSetupDashboardOpen(true)}
  title="Project Setup Wizard"
>
  <Settings className="h-5 w-5" />
</Button>

// 4. Add sidebar prop
<AdminSidebar
  // ... other props
  setIsProjectSetupDashboardOpen={setIsProjectSetupDashboardOpen}
/>

// 5. Render component
<ProjectSetupDashboard 
  isOpen={isProjectSetupDashboardOpen} 
  onOpenChange={setIsProjectSetupDashboardOpen} 
/>
```

## Database Migration Files

The wizard requires these SQL files in `database-backup/`:

### **export_schema_policies.sql**
- **Purpose**: Creates database schema, tables, relationships, RLS policies
- **Size**: ~50-100 KB
- **Time**: ~30-60 seconds to execute
- **Content**: DDL statements for schema creation

### **export_users_auth.sql**
- **Purpose**: Imports Supabase auth users and metadata
- **Size**: ~10-50 KB
- **Time**: ~10-30 seconds to execute
- **Content**: User account data and authentication setup

### **export_application_data.sql**
- **Purpose**: Imports core application data (dealers, orders, products, etc.)
- **Size**: ~50-200 KB
- **Time**: ~30-120 seconds to execute
- **Content**: Application business data

## Production Deployment Checklist

### **Before Going Live**

- [ ] All API endpoints created and tested
- [ ] Environment variables set on Vercel/deployment platform
- [ ] Database backup SQL files accessible
- [ ] ProjectSetupDashboard component integrated
- [ ] AdminDashboard props updated
- [ ] AdminSidebar menu item added
- [ ] Component builds without errors
- [ ] All dependencies installed
- [ ] TypeScript compilation successful
- [ ] No console warnings or errors

### **Development Testing**

```bash
# Run local development server
npm run dev
# or
pnpm dev

# Test in browser:
# 1. Navigate to Admin Dashboard
# 2. Click Settings icon or menu item
# 3. Walk through wizard with test credentials
# 4. Review deployment logs
```

### **Staging Testing**

- [ ] Deploy to staging environment
- [ ] Test full wizard flow with staging credentials
- [ ] Verify all API endpoints accessible
- [ ] Check error handling
- [ ] Verify database migrations work
- [ ] Confirm environment variables set correctly

### **Production Deployment**

- [ ] All staging tests passed
- [ ] Code reviewed and approved
- [ ] API endpoints active
- [ ] Environment variables configured
- [ ] Database backup files ready
- [ ] Monitoring enabled
- [ ] Error tracking enabled
- [ ] Documentation updated

## Troubleshooting Installation

### **Module Not Found Errors**

```
Cannot find module '@vercel/node'
```

**Solution:**
```bash
npm install --save-dev @vercel/node
# or
pnpm add -D @vercel/node
```

### **API Endpoints Not Found**

Ensure API endpoints are in correct location:
- ✓ All files in `/api/setup/` directory
- ✓ Files have `.ts` extension
- ✓ File names match exactly

### **Build Errors**

**TypeScript errors about `@vercel/node`:**

Add to `package.json`:
```json
{
  "devDependencies": {
    "@vercel/node": "^3.0.0",
    "@types/node": "^20.0.0"
  }
}
```

**Fetch timeout errors:**

Remove `timeout` parameter from fetch calls in `run-final-tests.ts`:
```typescript
// ❌ Wrong
const res = await fetch(url, { timeout: 5000 });

// ✅ Correct
const res = await fetch(url);
```

### **Database Backup Files Missing**

Ensure files exist in `database-backup/`:
```bash
ls database-backup/
# Should show:
# export_schema_policies.sql
# export_users_auth.sql
# export_application_data.sql
```

If missing, copy from original backup directory or regenerate using database backup tools.

## API Endpoint Verification

Test each endpoint individually:

```bash
# Verify Supabase
curl -X POST http://localhost:3000/api/setup/verify-supabase \
  -H "Content-Type: application/json" \
  -d '{"projectId":"xyz","password":"abc"}'

# Verify Vercel
curl -X POST http://localhost:3000/api/setup/verify-vercel \
  -H "Content-Type: application/json" \
  -d '{"token":"vercel_token"}'

# Verify GitHub
curl -X POST http://localhost:3000/api/setup/verify-github \
  -H "Content-Type: application/json" \
  -d '{"token":"github_token","org":"org-name"}'
```

## Performance Optimization

### **For Better Performance:**

1. **Use Vercel Edge Functions** (future enhancement)
   - Reduce latency for credential verification
   - Faster response times

2. **Implement Caching** (future enhancement)
   - Cache verified credentials for 1 hour
   - Reduce API calls to third-party services

3. **Batch Operations** (future enhancement)
   - Run parallel verifications
   - Reduce total setup time

## Monitoring & Logging

### **Enable Application Logging**

```typescript
// In your API endpoints
console.log(`[${new Date().toISOString()}] Starting Supabase verification...`);
console.log(`[${new Date().toISOString()}] Project ID: ${projectId}`);
```

### **Monitor in Production**

- Set up error tracking (Sentry, LogRocket)
- Monitor API response times
- Track deployment success rates
- Alert on failures

## Security Hardening

### **Before Production:**

1. **Rate Limiting** (future enhancement)
   - Limit API calls per minute
   - Prevent brute force attempts

2. **Token Encryption** (future enhancement)
   - Encrypt tokens in transit
   - Hash tokens in logs

3. **Access Control** (current)
   - Only admins can access wizard
   - Verify admin status before showing

4. **Audit Logging** (future enhancement)
   - Log wizard usage
   - Track who created instances
   - Record all deployments

## Rollback Procedure

If deployment fails:

1. **Check Error Logs** - Review deployment log for specific error
2. **Note Partial Setup** - Some steps may have partially completed
3. **Manual Cleanup**:
   - Delete incomplete Supabase project
   - Delete incomplete GitHub fork
   - Delete incomplete Vercel project
4. **Retry** - Run wizard again with corrected credentials

## Support & Resources

**Official Documentation:**
- https://supabase.com/docs
- https://vercel.com/docs
- https://docs.github.com/en/rest

**Community Resources:**
- Supabase GitHub Discussions
- Vercel Community Forum
- GitHub Community

## Version Compatibility

| Component | Version | Notes |
|-----------|---------|-------|
| @vercel/node | ^3.0.0 | API endpoint types |
| @supabase/supabase-js | ^2.0.0 | Database client |
| React | ^18.0.0 | Component framework |
| TypeScript | ^5.0.0 | Type safety |

## Future Updates

Planned improvements:

- [ ] Rollback support
- [ ] Parallel API calls
- [ ] Custom migration scripts
- [ ] Multi-region deployment
- [ ] Advanced monitoring
- [ ] CI/CD pipeline integration

---

**Version**: 1.0  
**Last Updated**: March 2026  
**Status**: Ready for Production
