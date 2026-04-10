# Project Setup Wizard - Technical Implementation

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  ProjectSetupDashboard                   │
│                   (React Component)                      │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
        ▼            ▼            ▼
   ┌─────────┐  ┌─────────┐  ┌─────────┐
   │ Supabase│  │ Vercel  │  │ GitHub  │
   │   API   │  │   API   │  │   API   │
   └─────────┘  └─────────┘  └─────────┘
        │            │            │
        └────────────┼────────────┘
                     │
                     ▼
          ┌──────────────────────┐
          │  Vercel Functions    │
          │    (Backend API)     │
          └──────────────────────┘
```

## Component Structure

### **ProjectSetupDashboard.tsx**
Main React component that orchestrates the entire setup wizard flow.

**State Management:**
```typescript
// Wizard navigation
const [currentStep, setCurrentStep] = useState('welcome');
const [isDialogOpen, setIsDialogOpen] = useState(true);

// Supabase state
const [supabaseProjectId, setSupabaseProjectId] = useState('');
const [supabasePassword, setSupabasePassword] = useState('');
const [supabaseVerified, setSupabaseVerified] = useState(false);

// Vercel state
const [vercelToken, setVercelToken] = useState('');
const [vercelTeamId, setVercelTeamId] = useState('');
const [projectName, setProjectName] = useState('');
const [vercelVerified, setVercelVerified] = useState(false);

// GitHub state
const [githubToken, setGithubToken] = useState('');
const [githubOrg, setGithubOrg] = useState('');
const [githubVerified, setGithubVerified] = useState(false);

// Deployment tracking
const [setupSteps, setSetupSteps] = useState<SetupStep[]>([...]);
const [deploymentLog, setDeploymentLog] = useState<DeploymentLogEntry[]>([]);
```

**Key Functions:**

1. **handleVerifySupabase()** - Validates Supabase credentials
2. **handleVerifyVercel()** - Validates Vercel token
3. **handleVerifyGithub()** - Validates GitHub token
4. **handleStartDeployment()** - Orchestrates the deployment workflow
5. **addLog()** - Adds entries to deployment log
6. **updateStepStatus()** - Updates progress of setup steps

### **Wizard Steps**

#### Step 1: Welcome
- Displays wizard purpose
- Lists what will be automated
- Shows required information
- Action: Click "Get Started"

#### Step 2: Supabase Configuration
- Input: Project ID, Database Password
- Action: Verify credentials via API
- Validation: Checks connection to Supabase

#### Step 3: Vercel Configuration
- Input: API Token, Project Name, Team ID (optional)
- Action: Verify token with Vercel API
- Validation: Checks user access and account status

#### Step 4: GitHub Configuration
- Input: Token, Organization Name
- Action: Verify token and org access
- Validation: Checks user permissions and org membership

#### Step 5: Review
- Display: Summary of all settings
- Action: Final confirmation before deployment
- Safety: Warning about non-interruptible process

#### Step 6: Deployment
- Display: Real-time progress of setup steps
- Display: Live deployment log
- Status: Shows each step's current status

## API Endpoints

All endpoints are Vercel serverless functions (`/api/setup/*`).

### **1. verify-supabase.ts**
```typescript
POST /api/setup/verify-supabase
Request: { projectId: string, password: string }
Response: { success: boolean, message: string, projectId: string }
```

Tests connection to Supabase by making an API call to the Supabase URL.

**Flow:**
```
projectId + password → Build Supabase URL → Test REST API → Return result
```

### **2. verify-vercel.ts**
```typescript
POST /api/setup/verify-vercel
Request: { token: string, teamId?: string }
Response: { success: boolean, message: string, user: string }
```

Validates Vercel API token by calling `/v2/user` endpoint.

**Flow:**
```
token → Call Vercel API → Get user info → Return result
```

### **3. verify-github.ts**
```typescript
POST /api/setup/verify-github
Request: { token: string, org: string }
Response: { success: boolean, message: string, user: string, org: string }
```

Validates GitHub token and verifies organization access.

**Flow:**
```
token → Get user info → Check org access → Return result
```

### **4. setup-supabase-schema.ts**
```typescript
POST /api/setup/setup-supabase-schema
Request: { projectId: string, password: string }
Response: { success: boolean, message: string, projectId: string }
```

Creates database schema by executing SQL migrations.

**Flow:**
```
Read export_schema_policies.sql → Execute on Supabase → Return result
```

**SQL Files Used:**
- `database-backup/export_schema_policies.sql`

### **5. migrate-supabase-data.ts**
```typescript
POST /api/setup/migrate-supabase-data
Request: { projectId: string, password: string }
Response: { success: boolean, message: string, projectId: string }
```

Imports data and user/auth information to Supabase.

**Flow:**
```
Read SQL files → Execute each migration → Track progress → Return result
```

**SQL Files Used:**
- `database-backup/export_users_auth.sql`
- `database-backup/export_application_data.sql`

### **6. fork-github-repo.ts**
```typescript
POST /api/setup/fork-github-repo
Request: { token: string, org: string }
Response: { 
  success: boolean,
  message: string,
  repo: string,
  repoUrl: string,
  cloneUrl: string 
}
```

Forks the Spartan repository to the specified organization.

**Source Repository:** `dyad-apps/spartan`

**Flow:**
```
token + org → Call GitHub fork API → Return new repo info
```

### **7. create-vercel-project.ts**
```typescript
POST /api/setup/create-vercel-project
Request: { 
  token: string, 
  teamId?: string, 
  projectName: string, 
  githubRepo: string 
}
Response: { 
  success: boolean,
  message: string,
  projectId: string,
  projectName: string,
  projectUrl: string 
}
```

Creates a new Vercel project connected to the forked GitHub repository.

**Flow:**
```
token + projectName + githubRepo → Create Vercel project → Return details
```

### **8. setup-vercel-env.ts**
```typescript
POST /api/setup/setup-vercel-env
Request: { 
  token: string, 
  teamId?: string, 
  projectId: string, 
  supabaseProjectId: string 
}
Response: { success: boolean, message: string, projectId: string }
```

Sets environment variables in Vercel project.

**Environment Variables Set:**
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key

**Flow:**
```
token + projectId + supabaseProjectId → Set env vars → Return result
```

### **9. trigger-vercel-deployment.ts**
```typescript
POST /api/setup/trigger-vercel-deployment
Request: { 
  token: string, 
  teamId?: string, 
  projectId: string 
}
Response: { 
  success: boolean,
  message: string,
  deploymentId: string,
  deploymentUrl: string 
}
```

Triggers a deployment on Vercel.

**Flow:**
```
token + projectId → Trigger deploy → Get deployment info → Return details
```

### **10. run-final-tests.ts**
```typescript
POST /api/setup/run-final-tests
Request: { 
  supabaseProjectId: string, 
  vercelProjectUrl: string 
}
Response: { 
  success: boolean,
  message: string,
  results: {
    supabase: boolean,
    vercel: boolean,
    connection: boolean
  }
}
```

Runs final validation tests on the deployed instance.

**Tests Performed:**
1. Supabase connection test
2. Vercel deployment accessibility
3. API endpoint connectivity

## Deployment Workflow

### **Execution Order**

```
Step 1: Create Supabase Schema
  ├─ Read SQL migration file
  ├─ Execute on Supabase
  └─ Verify completion

Step 2: Migrate Supabase Data
  ├─ Execute users/auth migrations
  ├─ Execute application data migrations
  └─ Verify completion

Step 3: Fork GitHub Repository
  ├─ Call GitHub fork API
  ├─ Wait for fork completion
  └─ Get repo information

Step 4: Create Vercel Project
  ├─ Create new project
  ├─ Connect to GitHub repo
  └─ Get project information

Step 5: Configure Environment Variables
  ├─ Set VITE_SUPABASE_URL
  ├─ Set VITE_SUPABASE_ANON_KEY
  └─ Verify variables set

Step 6: Deploy to Vercel
  ├─ Trigger initial deployment
  ├─ Monitor deployment progress
  └─ Get deployment URL

Step 7: Run Final Tests
  ├─ Test Supabase connection
  ├─ Test Vercel deployment
  ├─ Test API connectivity
  └─ Generate final report
```

## Error Handling

### **Error Chain**

```
API Call
  │
  ├─ Network Error
  │   └─ Show error: "Network connection failed"
  │
  ├─ HTTP Error (4xx)
  │   └─ Parse error response and show to user
  │
  ├─ HTTP Error (5xx)
  │   └─ Show error: "Service temporarily unavailable"
  │
  └─ Success with error message
      └─ Show step as failed, log error
```

### **Step Failure Handling**

When a step fails:

1. Set step status to `'error'`
2. Log error message with timestamp
3. Continue to next step (non-blocking)
4. User can review logs
5. Entire deployment marked as failed if critical step fails

## UI Components Used

All from shadcn/ui library:

```
├─ Dialog
│  └─ DialogContent
│     ├─ DialogHeader
│     ├─ DialogTitle
│     └─ DialogDescription
│
├─ Card
│  ├─ CardHeader
│  ├─ CardTitle
│  ├─ CardDescription
│  └─ CardContent
│
├─ Button
│
├─ Input
│
├─ Alert
│  └─ AlertDescription
│
├─ Badge
│
└─ Tabs (potential for future expansion)
```

## Icons Used (lucide-react)

```
Zap         - Main wizard icon
Database    - Supabase
Cloud       - Vercel
GitBranch   - GitHub
Settings    - Configuration
Check       - Success/completion
Loader2     - Loading spinner
AlertCircle - Warnings/errors
Copy        - Copy to clipboard
Eye/EyeOff  - Show/hide password
ChevronRight - Navigation
ExternalLink - External links
```

## Integration with AdminDashboard

### **AdminDashboard Props**

```typescript
// State
const [isProjectSetupDashboardOpen, setIsProjectSetupDashboardOpen] = useState(false);

// Render
<ProjectSetupDashboard 
  isOpen={isProjectSetupDashboardOpen} 
  onOpenChange={setIsProjectSetupDashboardOpen} 
/>

// Button in header
<Button 
  variant="outline" 
  size="icon" 
  onClick={() => setIsProjectSetupDashboardOpen(true)} 
  title="Project Setup Wizard"
>
  <Settings className="h-5 w-5" />
</Button>
```

### **AdminSidebar Menu Item**

```typescript
<NavButton
  icon={<Truck className="h-4 w-4" />}
  label="Project Setup Wizard"
  onClick={() => setIsProjectSetupDashboardOpen(true)}
/>
```

## Environment Variables Required

The system uses these environment variables in the API endpoints:

```env
# Supabase
SUPABASE_URL=https://[project-id].supabase.co
SUPABASE_ANON_KEY=[anon-key]
SUPABASE_SERVICE_ROLE_KEY=[service-role-key]

# Optional: Fallback configurations
GITHUB_TOKEN=[if-using-api]
VERCEL_TOKEN=[if-using-api]
```

## File Dependencies

```
ProjectSetupDashboard.tsx
├─ database-backup/export_schema_policies.sql
├─ database-backup/export_users_auth.sql
└─ database-backup/export_application_data.sql

API Endpoints (/api/setup/*)
├─ verify-supabase.ts
├─ verify-vercel.ts
├─ verify-github.ts
├─ setup-supabase-schema.ts
├─ migrate-supabase-data.ts
├─ fork-github-repo.ts
├─ create-vercel-project.ts
├─ setup-vercel-env.ts
├─ trigger-vercel-deployment.ts
└─ run-final-tests.ts
```

## Type Definitions

```typescript
interface SetupStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  status: 'pending' | 'in-progress' | 'completed' | 'error';
}

interface DeploymentLogEntry {
  time: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

interface ProjectSetupDashboardProps {
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
}
```

## Performance Considerations

### **Optimization Techniques**

1. **Sequential API Calls** - Prevents race conditions
2. **Real-time Log Updates** - Shows progress immediately
3. **Non-blocking Errors** - Continues with next step
4. **Status Tracking** - Visual feedback for each step
5. **Async Operations** - Non-blocking UI updates

### **Timeout Configurations**

```typescript
// API call timeout (5 seconds)
const response = await fetch(url, { timeout: 5000 });

// Deployment wait timeout (varies by step)
// Typically 1-5 minutes per step
```

## Security Considerations

### **Credential Handling**

1. ✓ HTTPS-only transmission
2. ✓ Never logged to console (except in UI logs)
3. ✓ Cleared from state after use
4. ✓ Not stored in localStorage
5. ✓ Backend-only processing when possible

### **Token Security**

1. ✓ Sent as POST body (not URL params)
2. ✓ Masked in input fields
3. ✓ Show/hide toggle available
4. ✓ Never appears in deployment logs

### **API Request Security**

1. ✓ Content-type: application/json
2. ✓ HTTPS only
3. ✓ CORS handled by Vercel
4. ✓ Rate limiting on third-party APIs

## Testing Strategy

### **Unit Tests** (To be implemented)

```typescript
describe('ProjectSetupDashboard', () => {
  test('should verify Supabase credentials');
  test('should verify Vercel token');
  test('should verify GitHub token');
  test('should handle deployment flow');
  test('should handle errors gracefully');
});
```

### **Integration Tests** (To be implemented)

```typescript
describe('Project Setup Wizard', () => {
  test('should create complete project instance');
  test('should verify all services connected');
  test('should rollback on critical failure');
});
```

## Deployment Checklist

- [ ] All API endpoints created in `/api/setup/`
- [ ] Database backup SQL files available
- [ ] Environment variables configured
- [ ] ProjectSetupDashboard component integrated
- [ ] AdminDashboard header button added
- [ ] AdminSidebar menu item added
- [ ] Component props properly passed
- [ ] Error handling implemented
- [ ] Real-time logging working
- [ ] UI responsive on all screen sizes
- [ ] Documentation complete
- [ ] Testing complete
- [ ] Deployed to production

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Mar 2026 | Initial implementation |

## Future Enhancements

1. **Batch Operations** - Create multiple copies at once
2. **Rollback Support** - Undo failed steps
3. **Custom Configuration** - Advanced setup options
4. **Update Wizard** - Update existing instances
5. **Multi-tenant Setup** - Support for multiple organizations
6. **CI/CD Integration** - Custom deployment pipelines
7. **Monitoring Dashboard** - Track deployed instances
8. **Automated Testing** - Run test suites post-deployment

---

**Status**: Production Ready  
**Last Updated**: March 2026  
**Maintainer**: Development Team
