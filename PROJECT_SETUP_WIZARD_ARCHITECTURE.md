# Project Setup Wizard - System Architecture & Diagrams

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER INTERFACE                            │
│                   ProjectSetupDashboard.tsx                      │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Welcome → Supabase → Vercel → GitHub → Review → Deploy  │ │
│  │                                                              │ │
│  │  Real-time Log Display        Status Indicators             │ │
│  │  ✅ Created                   ⏳ Pending                     │ │
│  │  ✓ Supabase Schema           🔄 In Progress               │ │
│  │  ✓ Data Migration             ❌ Error                     │ │
│  └────────────────────────────────────────────────────────────┘ │
└────────────────────────┬────────────────────────────────────────┘
                         │
           ┌─────────────┴────────────┬─────────────┬─────────────┐
           │                          │             │             │
           ▼                          ▼             ▼             ▼
    ┌────────────────┐      ┌────────────────┐  ┌──────────┐  ┌──────────┐
    │  Verification  │      │   Deployment   │  │ Logging  │  │ Progress │
    │   Endpoints    │      │   Endpoints    │  │Subsystem │  │ Tracker  │
    │                │      │                │  │          │  │          │
    │ • verify-sb    │      │ • setup-schema │  │ Console  │  │ 7 Steps  │
    │ • verify-vercl│      │ • migrate-data │  │ Logs     │  │ Tracking │
    │ • verify-gh   │      │ • fork-repo    │  │ Colors   │  │ Status   │
    └────────────────┘      │ • create-proj  │  │ Types    │  │          │
                            │ • setup-env    │  │          │  │ Pending  │
                            │ • trigger-dep  │  │ Info     │  │ Running  │
                            │ • run-tests    │  │ Success  │  │ Done     │
                            └────────────────┘  │Error     │  │ Failed   │
                                                │Warning   │  │          │
                                                └──────────┘  └──────────┘
```

## Data Flow Architecture

```
USER INPUT
    │
    ├─ Supabase Credentials
    │  ├─ Project ID
    │  └─ Database Password
    │
    ├─ Vercel Credentials
    │  ├─ API Token
    │  ├─ Team ID (optional)
    │  └─ Project Name
    │
    └─ GitHub Credentials
       ├─ Personal Token
       └─ Organization Name

         ▼ CREDENTIAL VALIDATION

    ┌──────────────────────────────────────┐
    │   Verification Phase                 │
    │  /api/setup/verify-supabase         │ → Supabase API
    │  /api/setup/verify-vercel           │ → Vercel API
    │  /api/setup/verify-github           │ → GitHub API
    └──────────────────────────────────────┘

         ▼ DEPLOYMENT PHASE

    ┌──────────────────────────────────────┐
    │   Step 1: Create Schema              │
    │  /api/setup/setup-supabase-schema   │ ─→ PostgreSQL
    │  Executes: export_schema_policies.sql│
    └──────────────────────────────────────┘
                    │
                    ▼
    ┌──────────────────────────────────────┐
    │   Step 2: Migrate Data               │
    │  /api/setup/migrate-supabase-data   │ ─→ PostgreSQL
    │  Executes: export_users_auth.sql    │
    │  Executes: export_application_data   │
    └──────────────────────────────────────┘
                    │
                    ▼
    ┌──────────────────────────────────────┐
    │   Step 3: Fork Repository            │
    │  /api/setup/fork-github-repo        │ ─→ GitHub API
    │  Forks: dyad-apps/spartan           │
    └──────────────────────────────────────┘
                    │
                    ▼
    ┌──────────────────────────────────────┐
    │   Step 4: Create Project             │
    │  /api/setup/create-vercel-project   │ ─→ Vercel API
    │  Connects: GitHub Fork              │
    └──────────────────────────────────────┘
                    │
                    ▼
    ┌──────────────────────────────────────┐
    │   Step 5: Setup Environment          │
    │  /api/setup/setup-vercel-env        │ ─→ Vercel API
    │  Sets: VITE_SUPABASE_*              │
    └──────────────────────────────────────┘
                    │
                    ▼
    ┌──────────────────────────────────────┐
    │   Step 6: Deploy                     │
    │  /api/setup/trigger-vercel-deploy   │ ─→ Vercel API
    │  Builds & deploys application       │
    └──────────────────────────────────────┘
                    │
                    ▼
    ┌──────────────────────────────────────┐
    │   Step 7: Run Tests                  │
    │  /api/setup/run-final-tests         │ ─→ Verify services
    │  Tests: DB, deployment, API         │
    └──────────────────────────────────────┘
                    │
                    ▼
          ✅ DEPLOYMENT COMPLETE
          New Instance Ready to Use
```

## Component Hierarchy

```
AdminDashboard
├── State
│   ├── isProjectSetupDashboardOpen: boolean
│   ├── setIsProjectSetupDashboardOpen: function
│   └── ... (other states)
│
├── Header
│   ├── Dashboard Title
│   ├── Buttons
│   │   ├── Place Order
│   │   ├── Notification Settings
│   │   ├── Online Orders Admin
│   │   ├── Combo Offers
│   │   ├── Database Backup
│   │   └── ⚙️ Project Setup Wizard ← Click triggers
│   │
│   └── Sheet (Mobile Menu)
│
├── Sidebar
│   └── AdminSidebar
│       ├── Props
│       │   └── setIsProjectSetupDashboardOpen: function
│       │
│       └── Menu Items
│           └── "Project Setup Wizard" ← Click triggers
│
├── Main Content
│   ├── Sales Overview Cards
│   ├── Dashboard Cards
│   └── ... (other content)
│
└── Dialogs
    ├── DatabaseBackupDialog
    │   └── isOpen, onOpenChange props
    │
    └── ProjectSetupDashboard ← Rendered here
        ├── Welcome Step
        ├── Supabase Step
        ├── Vercel Step
        ├── GitHub Step
        ├── Review Step
        └── Deployment Step
```

## State Management Flow

```
User Click → Button Handler
            ↓
    setIsProjectSetupDashboardOpen(true)
            ↓
    isProjectSetupDashboardOpen = true
            ↓
    ProjectSetupDashboard Re-renders
            ↓
    Dialog Opens with Welcome Screen
            ↓
    User Enters Credentials
            ↓
    handleVerify[Service]() called
            ↓
    Fetch /api/setup/verify-[service]
            ↓
    Credential Validation Result
            ↓
    setSupabaseVerified(true/false)
            ↓
    Next Button Enable/Disable
            ↓
    User proceeds or fixes credentials
            ↓
    handleStartDeployment() called
            ↓
    Sequential API calls
            ↓
    Update setupSteps array
            ↓
    Add log entries
            ↓
    UI Re-renders with progress
            ↓
    Deployment Complete
            ↓
    User clicks Close or Minimize
            ↓
    setIsProjectSetupDashboardOpen(false)
            ↓
    Dialog Closes
```

## API Request/Response Pattern

```
VERIFICATION ENDPOINTS
┌─────────────────────────────────────┐
│ POST /api/setup/verify-[service]    │
├─────────────────────────────────────┤
│ Request Body:                       │
│ {                                   │
│   "projectId": "string",           │
│   "password": "string",            │
│   "token": "string",               │
│   "org": "string"                  │
│ }                                   │
├─────────────────────────────────────┤
│ Response (Success - 200):            │
│ {                                   │
│   "success": true,                 │
│   "message": "Verified",           │
│   "projectId": "string",           │
│   "user": "string"                 │
│ }                                   │
├─────────────────────────────────────┤
│ Response (Error - 400):              │
│ {                                   │
│   "error": "Error message"         │
│ }                                   │
└─────────────────────────────────────┘

DEPLOYMENT ENDPOINTS
┌─────────────────────────────────────┐
│ POST /api/setup/setup-[action]      │
├─────────────────────────────────────┤
│ Request Body:                       │
│ {                                   │
│   "projectId": "string",           │
│   "password": "string",            │
│   "token": "string",               │
│   ... additional params             │
│ }                                   │
├─────────────────────────────────────┤
│ Response (Success - 200):            │
│ {                                   │
│   "success": true,                 │
│   "message": "Completed",          │
│   "projectId": "string",           │
│   "projectUrl": "string",          │
│   ... additional data               │
│ }                                   │
├─────────────────────────────────────┤
│ Response (Error - 400):              │
│ {                                   │
│   "error": "Detailed error message"│
│ }                                   │
└─────────────────────────────────────┘
```

## Database Migration Process

```
SOURCE INSTANCE
├── Supabase Project (Original)
│   ├── Database Schema
│   ├── RLS Policies
│   ├── Users & Auth
│   ├── Application Data
│   └── Functions/Triggers

      Export Process
      ↓
   SQL Files Generated
      ├── export_schema_policies.sql (~50-100KB)
      ├── export_users_auth.sql (~10-50KB)
      └── export_application_data.sql (~100-200KB)

            ↓ Transfer via Wizard API

TARGET INSTANCE
├── New Supabase Project
│   ├── Step 1: Create Schema
│   │   └─ Execute schema DDL
│   ├── Step 2: Migrate Data
│   │   ├─ Import users/auth
│   │   └─ Import application data
│   ├── Step 3-7: Configure & Deploy
│   │   ├─ Fork to GitHub
│   │   ├─ Create on Vercel
│   │   ├─ Setup environment
│   │   ├─ Deploy
│   │   └─ Test
│   │
│   └── Result: Full working copy!
```

## Error Handling Flow

```
USER ACTION
    ↓
USER INPUT VALIDATION
    ├─ Empty fields? → Show error → Continue
    ├─ Invalid format? → Show error → Continue
    └─ Valid? → Proceed
        ↓
API CALL MADE
    ├─ Network error?
    │   ├─ Catch fetch exception
    │   ├─ Show user-friendly message
    │   └─ Update log with error
    │
    ├─ HTTP error (4xx)?
    │   ├─ Parse error response
    │   ├─ Show specific error message
    │   └─ Log error details
    │
    ├─ HTTP error (5xx)?
    │   ├─ Show: "Service unavailable"
    │   ├─ Suggest retry
    │   └─ Log server error
    │
    └─ Success but error in response?
        ├─ Check response.success flag
        ├─ Show error message
        ├─ Mark step as failed
        └─ Continue to next step
            ↓
STEP COMPLETION
    ├─ Step failed?
    │   ├─ Mark as failed (❌)
    │   ├─ Log error details
    │   ├─ User can review logs
    │   └─ Continue to next step
    │
    └─ Step succeeded?
        ├─ Mark as completed (✅)
        ├─ Log success
        └─ Proceed to next step
            ↓
DEPLOYMENT COMPLETE
    ├─ Show summary
    ├─ Display any warnings
    ├─ Allow retry for failed steps
    └─ Allow user to close or minimize
```

## Timeline & Sequencing

```
TIME        EVENT                           STATUS
────────────────────────────────────────────────────────
00:00       User clicks wizard             Start
00:01       Welcome screen displayed       ⏳ Pending
00:02       User enters Supabase info      Input
00:05       Supabase verified              ✅ Done
00:06       User enters Vercel info        Input
00:10       Vercel token verified          ✅ Done
00:11       User enters GitHub info        Input
00:15       GitHub token verified          ✅ Done
00:16       Review screen displayed        Ready
00:17       User clicks "Start"            Start Deploy
00:18       Create schema started          🔄 In Progress
01:00       Schema creation done           ✅ Done
01:01       Data migration started         🔄 In Progress
02:30       Data migration done            ✅ Done
02:35       Fork repository started        🔄 In Progress
02:45       Fork completed                 ✅ Done
02:46       Create Vercel project started  🔄 In Progress
03:05       Vercel project created         ✅ Done
03:06       Setup environment started      🔄 In Progress
03:15       Environment configured         ✅ Done
03:16       Deployment started             🔄 In Progress
05:30       Deployment completed           ✅ Done
05:31       Run final tests started        🔄 In Progress
06:30       Tests completed                ✅ Done
06:31       Wizard complete!               🎉 Success
────────────────────────────────────────────────────────
TOTAL TIME: 6-10 minutes depending on service load
```

## Integration Points

```
AdminDashboard.tsx
├── Import ProjectSetupDashboard
├── Create state: isProjectSetupDashboardOpen
├── Add header button
│   └─ onClick → setIsProjectSetupDashboardOpen(true)
├── Pass prop to AdminSidebar
│   └─ setIsProjectSetupDashboardOpen={setIsProjectSetupDashboardOpen}
└── Render component
    └─ <ProjectSetupDashboard isOpen={...} onOpenChange={...} />
        │
        └─ Dialog Opens/Closes based on props

AdminSidebar.tsx
├── Add prop: setIsProjectSetupDashboardOpen
├── Accept in function signature
├── Add menu button
│   └─ onClick → setIsProjectSetupDashboardOpen(true)
└─ When clicked, opens dialog immediately
```

## Performance Optimization

```
BEFORE: Sequential manual setup
    Supabase setup (30 min)
    +
    GitHub fork (10 min) 
    +
    Vercel project (20 min)
    +
    Environment setup (10 min)
    +
    Manual verification (20 min)
    ─────────────────────────
    TOTAL: ~90 minutes
    
    ✗ Error-prone
    ✗ Long wait times
    ✗ Multiple system switches
    ✗ Coordination required

AFTER: Automated wizard
    Verification (10 sec)
    +
    Automated setup (5-10 min)
    ─────────────────────────
    TOTAL: ~5-10 minutes
    
    ✓ Automated
    ✓ Fast
    ✓ Single interface
    ✓ No coordination needed
    
    IMPROVEMENT: 85% faster! ⚡
```

## Security Architecture

```
USER INPUT
    │
    ├─ In Component (Frontend)
    │   ├─ Password Field (masked)
    │   ├─ Token Field (masked)
    │   └─ Show/Hide Toggle
    │
    └─ Sent via HTTPS POST
        ↓
    API ENDPOINT (Backend)
    ├─ Receive Credentials
    ├─ Validate Format
    ├─ Never log full credentials
    ├─ Use immediately
    ├─ Pass to Service API
    └─ Discard from memory
        ↓
    SERVICE API (3rd Party)
    ├─ Supabase
    ├─ Vercel
    └─ GitHub
        ↓
    RESPONSE
    ├─ No credentials sent back
    ├─ Only success/failure
    ├─ No storage
    └─ End of lifecycle

✅ SECURE ✅
No credentials stored, logged, or cached
```

---

This architecture ensures:
- ✅ Clear data flow
- ✅ Scalable design
- ✅ Secure credential handling
- ✅ Efficient automation
- ✅ Comprehensive error handling
- ✅ Real-time feedback
- ✅ Easy debugging
