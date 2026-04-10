# Project Setup Wizard - Complete Implementation Guide

## Overview

The **Project Setup Wizard** is a comprehensive automated system that enables users to create a complete working copy of the Spartan project with minimal effort. It automates the entire process of:

1. **Supabase Configuration** - Creating schema and migrating data
2. **GitHub Setup** - Forking the repository to your organization
3. **Vercel Deployment** - Creating and deploying the project
4. **Environment Configuration** - Automatic setup of all credentials

## Quick Access

### From Admin Dashboard Header
- Click the **⚙️ Settings icon** in the top-right corner of the admin dashboard
- Click **Project Setup Wizard**

### From Admin Sidebar Menu
- Open the admin menu (☰ button)
- Scroll to **Project Setup Wizard**
- Click to launch

## What You'll Need

### 1. **Supabase Credentials**
- **Project ID**: Found in Supabase Dashboard → Settings → General
  - Example: `ojhghfdhgfdhgf`
- **Database Password**: Set when creating your Supabase project
  - ⚠️ Keep this secure - it's your main database password

### 2. **Vercel API Token**
- Go to: https://vercel.com/account/tokens
- Click "Create Token"
- Select scope: "Full Access"
- Copy and save the token
- (Optional) **Team ID**: If using a team account, get from Settings

### 3. **GitHub Token**
- Go to: https://github.com/settings/tokens
- Click "Generate new token (classic)"
- Scopes needed:
  - ✓ `repo` - Full control of private repositories
  - ✓ `admin:org_hook` - Full control of org hooks
- Copy and save the token

### 4. **Project Information**
- **New Project Name**: What to call your copy (e.g., `spartan-copy-prod`)
- **GitHub Organization**: Where to fork the repository

## Step-by-Step Wizard Guide

### **Step 1: Welcome Screen**
- Review what the wizard will do
- Understand the automation benefits
- Click "Get Started" to begin

### **Step 2: Supabase Configuration**
1. Enter your new Supabase Project ID
2. Enter your database password
3. Click "Verify Credentials"
   - ✅ Green check = Credentials valid
   - ❌ Red error = Check credentials and try again
4. Once verified, click "Next"

### **Step 3: Vercel Configuration**
1. Enter your Vercel API Token
2. (Optional) Enter Team ID if using a team account
3. Enter your desired Project Name
4. Click "Verify Token"
   - ✅ Green check = Token valid
   - ❌ Red error = Token might be invalid or expired
5. Once verified, click "Next"

### **Step 4: GitHub Configuration**
1. Enter your GitHub Token
2. Enter your Organization Name (where repo will be forked)
3. Click "Verify Token"
   - ✅ Green check = Token and org access valid
   - ❌ Red error = Check token or org permissions
4. Once verified, click "Next"

### **Step 5: Review Configuration**
- Review all your settings
- Ensure Project ID, Project Name, and Organization are correct
- ⚠️ Once you click "Start Deployment", the process cannot be interrupted
- Click "Start Deployment" to begin automated setup

### **Step 6: Deployment Progress**
Watch as the wizard automatically:

1. **Create Supabase Schema**
   - Creates all tables and relationships
   - Imports RLS policies
   - Sets up triggers and functions

2. **Migrate Supabase Data**
   - Imports application data
   - Sets up users and authentication

3. **Fork GitHub Repository**
   - Creates a copy of the repository in your organization
   - Maintains all code and configurations

4. **Create Vercel Project**
   - Creates a new Vercel project
   - Connects to your forked GitHub repository

5. **Configure Environment Variables**
   - Sets up Supabase URLs and keys
   - Configures all necessary environment variables

6. **Deploy to Vercel**
   - Builds your project
   - Deploys to Vercel's servers
   - Makes it live on the internet

7. **Run Final Tests**
   - Verifies Supabase connection
   - Checks Vercel deployment
   - Validates API connectivity

### **Step 7: Completion**
- 🎉 Your new project instance is ready!
- View deployment logs
- Access your new application at the provided Vercel URL

## Real-time Monitoring

### **Status Indicators**
- ⏳ **Pending** - Waiting to start
- 🔄 **In Progress** - Currently running
- ✅ **Completed** - Successfully finished
- ❌ **Error** - Something went wrong

### **Deployment Log**
Real-time updates display:
- Timestamp of each action
- Success/error messages
- Status updates
- Final results

## What Gets Created

### **In Supabase**
- ✓ Complete database schema
- ✓ All tables and relationships
- ✓ Row-Level Security (RLS) policies
- ✓ Authentication setup
- ✓ Stored procedures and functions
- ✓ Initial application data

### **On GitHub**
- ✓ Forked repository in your organization
- ✓ Complete source code
- ✓ Configuration files
- ✓ Environment templates

### **On Vercel**
- ✓ New deployment project
- ✓ Connected to your GitHub repository
- ✓ Configured environment variables
- ✓ Live deployment URL
- ✓ Automatic deployments on code changes

### **Environment Configured**
- ✓ Supabase URL and keys
- ✓ API endpoints
- ✓ Authentication URLs
- ✓ All integration keys

## Troubleshooting

### **"Failed to verify Supabase credentials"**
- ✗ Check Project ID - must be exact
- ✗ Check Database Password - must be correct
- ✗ Ensure Supabase project is active

### **"Invalid Vercel token"**
- ✗ Token might be expired - generate a new one
- ✗ Token might not have proper scopes
- ✗ Check spelling and spaces

### **"No access to organization"**
- ✗ GitHub token doesn't have org access
- ✗ Org name is spelled wrong
- ✗ You might not be an org admin

### **"Failed to fork repository"**
- ✗ Repository might already exist
- ✗ No permission to fork
- ✗ Try with a different project name

### **"Failed to create Vercel project"**
- ✗ Project name already exists
- ✗ Team ID might be wrong
- ✗ Account limit might be reached

### **Deployment Stuck or Failed**
- ✗ Check deployment logs for specific error
- ✗ Ensure all credentials are correct
- ✗ Try again after a few minutes
- ✗ Contact support with error message

## Advanced Options

### **Multiple Copies**
- You can create multiple copies by:
  1. Using different project names
  2. Using different Supabase projects
  3. Re-running the wizard with new credentials

### **Team Deployments**
- Use the Vercel Team ID to deploy to a team account
- Requires team admin access on GitHub and Vercel

### **Custom Domain Setup**
- After wizard completion, you can:
  1. Add custom domain in Vercel settings
  2. Update DNS records
  3. Enable HTTPS

## What Happens After Setup

### **Your New Instance Has**
- ✅ Working database with all data
- ✅ Complete codebase
- ✅ Deployed and live URL
- ✅ All environment variables configured
- ✅ RLS policies and authentication working

### **Next Steps**
1. Visit your deployment URL from the wizard
2. Log in with your credentials
3. Run initial setup (if any)
4. Test all features
5. Configure for your specific use case

### **Automatic Updates**
- Vercel auto-deploys when you push to GitHub
- No manual deployment needed
- Continuous deployment enabled by default

## API Endpoints (Technical Details)

The wizard uses the following API endpoints:

```
POST /api/setup/verify-supabase
POST /api/setup/verify-vercel
POST /api/setup/verify-github
POST /api/setup/setup-supabase-schema
POST /api/setup/migrate-supabase-data
POST /api/setup/fork-github-repo
POST /api/setup/create-vercel-project
POST /api/setup/setup-vercel-env
POST /api/setup/trigger-vercel-deployment
POST /api/setup/run-final-tests
```

## Security Notes

### **Credentials Security**
- ✓ Tokens are sent via HTTPS only
- ✓ Passwords are handled securely
- ✓ Never logged or stored
- ✓ Cleared after use

### **Best Practices**
- 🔒 Never share your Supabase password
- 🔒 Keep GitHub tokens secret
- 🔒 Use team accounts for production
- 🔒 Rotate tokens periodically
- 🔒 Use Environment Variables for secrets

## Support & Help

### **Common Issues**
- Check the troubleshooting section above
- Review deployment logs for errors
- Verify all credentials are correct
- Check rate limits on each service

### **Getting Help**
- Review the deployment logs for specific errors
- Check service status pages:
  - https://status.supabase.com
  - https://www.vercelstatus.com
  - https://www.githubstatus.com

## Cancellation & Rollback

### **During Wizard**
- Click "Cancel" to exit at any time
- No changes made until you click "Start Deployment"

### **During Deployment**
- Deployment cannot be interrupted (by design)
- Allow process to complete
- Review logs if errors occur

### **After Completion**
- Delete from Supabase, GitHub, or Vercel directly
- Each service has its own deletion process
- Data can be restored from backups

## Performance Estimates

Typical wizard execution times:

| Task | Duration |
|------|----------|
| Supabase credential verification | 2-5 seconds |
| Vercel credential verification | 2-5 seconds |
| GitHub credential verification | 2-5 seconds |
| Supabase schema creation | 30-60 seconds |
| Data migration | 30-120 seconds |
| GitHub repository fork | 5-10 seconds |
| Vercel project creation | 10-20 seconds |
| Environment variable setup | 5-10 seconds |
| Vercel deployment | 2-5 minutes |
| Final tests | 30-60 seconds |
| **Total Time** | **~5-10 minutes** |

## Next Steps

1. **Launch the Wizard** from Admin Dashboard
2. **Gather Your Credentials** (Supabase, Vercel, GitHub)
3. **Follow the Wizard Steps** carefully
4. **Monitor the Deployment** progress
5. **Test Your New Instance** when complete
6. **Configure Custom Settings** as needed

---

**Version**: 1.0  
**Last Updated**: March 2026  
**Status**: Production Ready
