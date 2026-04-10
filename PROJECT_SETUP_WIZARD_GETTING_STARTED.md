# Project Setup Wizard - Getting Started Guide

## 🚀 10-Minute Quick Start

### **What You'll Accomplish**
By following this guide, you'll create a **complete working copy** of the Spartan project that:
- ✅ Has its own database with all data
- ✅ Is deployed and live on the internet
- ✅ Has all users and authentication set up
- ✅ Is ready for immediate use

---

## **Step 0: Prepare Your Information** (5 minutes)

Before starting the wizard, collect these items:

### **From Supabase** (2 minutes)
1. Go to: https://app.supabase.com
2. Select your project
3. Go to: Settings → General
4. Find: **Project ID** (looks like: `oxzjqfgfxzqbmyyo`)
   - Copy this → Paste in **Project ID** field
5. You set **Database Password** when creating project
   - Have it ready → Paste in wizard

**✅ Supabase Info Ready**

### **From Vercel** (2 minutes)
1. Go to: https://vercel.com/account/tokens
2. Click: "Create Token"
3. Select: "Full Access"
4. Click: "Create"
5. Copy the token → Keep it safe!
   - Paste in **API Token** field
6. Leave **Team ID** empty (unless using team account)
7. Choose a **Project Name** (e.g., `spartan-copy`)
   - Must be unique, only lowercase and dashes

**✅ Vercel Info Ready**

### **From GitHub** (1 minute)
1. Go to: https://github.com/settings/tokens
2. Click: "Generate new token" → Select "classic"
3. Scopes needed:
   - ✓ `repo` - Check the box
   - ✓ `admin:org_hook` - Check the box
4. Scroll down and click: "Generate token"
5. Copy the token → Keep it safe!
   - Paste in **GitHub Token** field
6. Know your **Organization Name** (e.g., `my-company`)
   - Where the forked repo will be created

**✅ GitHub Info Ready**

### **Checklist**
- [ ] Supabase Project ID
- [ ] Supabase Database Password
- [ ] Vercel API Token
- [ ] Project Name
- [ ] GitHub Personal Token
- [ ] GitHub Organization Name

---

## **Step 1: Open the Wizard** (30 seconds)

### **Method A: Header Button**
```
1. Log in to Admin Dashboard
2. Look at top-right corner
3. Find the ⚙️ Settings icon
4. Click it
```

### **Method B: Menu**
```
1. Log in to Admin Dashboard
2. Click ☰ (menu icon in top-right)
3. Scroll down
4. Click "Project Setup Wizard"
```

**Result:** Wizard dialog opens with Welcome screen

---

## **Step 2: Welcome Screen** (10 seconds)

You'll see:
- "Project Setup Wizard" title
- Overview of what will happen
- List of what gets created
- Two buttons: "Cancel" and "Get Started"

**✅ Click "Get Started"**

---

## **Step 3: Supabase Configuration** (1 minute)

You'll see:
- Input field: "Project ID"
- Input field: "Database Password"
- Button: "Verify Credentials"

**What to do:**
```
1. Copy your Supabase Project ID
2. Paste in "Project ID" field
3. Copy your Database Password
4. Paste in "Database Password" field
   (Don't worry, it's masked)
5. Click "Verify Credentials"
6. Wait for green ✅ check mark
```

**Got an error?**
- Double-check Project ID (must be exact)
- Double-check Password (check for typos)
- Ensure Supabase project is active

**✅ Credentials verified, click "Next"**

---

## **Step 4: Vercel Configuration** (1 minute)

You'll see:
- Input field: "API Token"
- Input field: "Team ID" (optional)
- Input field: "Project Name"
- Button: "Verify Token"

**What to do:**
```
1. Copy your Vercel API Token
2. Paste in "API Token" field
3. Leave "Team ID" empty (unless using team)
4. Type your desired "Project Name"
   (e.g., spartan-copy)
5. Click "Verify Token"
6. Wait for green ✅ check mark
```

**Got an error?**
- Token might be expired → Generate new one
- Project name might be taken → Try different name
- Team ID might be wrong → Leave it empty

**✅ Token verified, click "Next"**

---

## **Step 5: GitHub Configuration** (1 minute)

You'll see:
- Input field: "GitHub Token"
- Input field: "Organization Name"
- Button: "Verify Token"

**What to do:**
```
1. Copy your GitHub Personal Token
2. Paste in "GitHub Token" field
3. Type your "Organization Name"
   (e.g., my-company)
4. Click "Verify Token"
5. Wait for green ✅ check mark
```

**Got an error?**
- Token might be expired → Generate new one
- Org name might be wrong → Check spelling
- You might not have org access → Try different org

**✅ Token verified, click "Next"**

---

## **Step 6: Review Configuration** (30 seconds)

You'll see:
- Summary card for Supabase
- Summary card for Vercel
- Summary card for GitHub
- Warning message
- Two buttons: "Back" and "Start Deployment"

**Review carefully:**
```
✓ Project ID correct?
✓ Project Name correct?
✓ Organization correct?
```

⚠️ **Important:** Once you click "Start Deployment", the process cannot be interrupted!

**✅ Everything correct? Click "Start Deployment"**

---

## **Step 7: Automated Deployment Begins** (5-10 minutes)

The wizard now automatically:

```
🔄 Creating Supabase Schema...          [~30-60 seconds]
   └─ Setting up database structure

🔄 Migrating Supabase Data...           [~30-120 seconds]
   └─ Importing all your data

🔄 Forking GitHub Repository...         [~5-10 seconds]
   └─ Creating code copy in your org

🔄 Creating Vercel Project...           [~10-20 seconds]
   └─ Setting up deployment platform

🔄 Configuring Environment Variables... [~5-10 seconds]
   └─ Connecting services

🔄 Deploying to Vercel...               [~2-5 minutes]
   └─ Building and uploading application

🔄 Running Final Tests...               [~30-60 seconds]
   └─ Verifying everything works
```

### **What You See**
- List of 7 setup steps
- Current status of each step
- Real-time deployment log below
- Colored messages (info, success, error, warning)
- Progress indicator

**✅ Wait for all steps to show green ✅**

---

## **Step 8: Success!** (30 seconds)

When complete, you'll see:
```
✅ Create Supabase Schema
✅ Migrate Supabase Data
✅ Fork GitHub Repository
✅ Create Vercel Project
✅ Configure Environment Variables
✅ Deploy to Vercel
✅ Run Final Tests

🎉 Full project setup completed successfully!
```

### **What You Can Do Now**
- ✅ Close the wizard
- ✅ Open your new project's URL
- ✅ Log in with your credentials
- ✅ Start using the application

**Where's my new URL?**
Look in the deployment log - it should say something like:
```
✓ Vercel project created: https://spartan-copy.vercel.app
```

---

## **Step 9: First Time Setup** (5 minutes)

Your new instance might need some initial configuration:

```
1. Open deployment URL in browser
2. Log in with your admin credentials
3. Check if settings are configured
4. Test core features:
   ✓ Create a test order
   ✓ Add a test dealer
   ✓ Create a test payment
5. Run any initialization procedures
```

---

## **Troubleshooting Quick Fixes**

| Problem | Quick Fix |
|---------|-----------|
| "Invalid Project ID" | Copy exact ID from Supabase dashboard |
| "Verification failed" | Check internet connection |
| "Token expired" | Generate new token at service website |
| "Org not found" | Verify spelling of organization name |
| "Project name taken" | Add -copy, -prod, or other suffix |
| "Deployment stuck" | Wait a few more minutes (usually finishes) |
| "Test failed" | Check deployment logs for error details |

**Need more help?** See `PROJECT_SETUP_WIZARD_GUIDE.md`

---

## **Common Questions**

### **Q: How long does it take?**
**A:** About 5-10 minutes total, depending on data size and network speed.

### **Q: Will my original instance be affected?**
**A:** No! Your original stays exactly the same. Only a new copy is created.

### **Q: Can I create multiple copies?**
**A:** Yes! Run the wizard again with different credentials each time.

### **Q: What if something fails?**
**A:** Check the deployment log for the specific error. Most issues can be fixed by running the wizard again.

### **Q: Is my data secure?**
**A:** Yes! All credentials are sent via HTTPS, never logged, and immediately discarded after use.

### **Q: Can I delete the new instance?**
**A:** Yes! Each service (Supabase, GitHub, Vercel) has their own delete/removal process.

### **Q: What's next after setup?**
**A:** Test the instance, customize settings, and start using it!

---

## **Next Steps After Success**

1. **Visit Your New URL**
   ```
   Example: https://spartan-copy.vercel.app
   ```

2. **Log In**
   ```
   Use your admin credentials
   ```

3. **Run Quick Tests**
   ```
   ✓ Check dashboard loads
   ✓ Try creating a test record
   ✓ Verify all menus work
   ```

4. **Configure Settings** (if needed)
   ```
   ✓ Update company name
   ✓ Add users
   ✓ Configure integrations
   ✓ Set up notifications
   ```

5. **Start Using**
   ```
   ✓ Add your data
   ✓ Configure workflows
   ✓ Train your team
   ```

---

## **Need Help?**

### **Before You Start**
- See **Step 0 checklist** above

### **During Wizard**
- Check error messages in red text
- Review deployment log for details
- Try fixing credential and re-verifying

### **After Wizard**
- Check `PROJECT_SETUP_WIZARD_GUIDE.md` for detailed help
- Review troubleshooting section
- Contact support with error details

### **Resources**
- Full User Guide: `PROJECT_SETUP_WIZARD_GUIDE.md`
- Quick Reference: `PROJECT_SETUP_WIZARD_QUICK_REFERENCE.md`
- Technical Help: `PROJECT_SETUP_WIZARD_TECHNICAL.md`

---

## **Quick Checklist**

Before clicking "Get Started":
- [ ] Supabase Project ID (copied)
- [ ] Database Password (ready)
- [ ] Vercel Token (copied)
- [ ] Project Name (decided)
- [ ] GitHub Token (copied)
- [ ] Organization Name (known)
- [ ] ~10 minutes of time
- [ ] Stable internet connection
- [ ] Admin access to services

---

## **Timeline**

```
Preparation:        5 minutes ⏱️
Open Wizard:        30 seconds 🎯
Supabase Setup:     1 minute ⚙️
Vercel Setup:       1 minute ⚙️
GitHub Setup:       1 minute ⚙️
Review:             30 seconds 📋
Automated Deploy:   5-10 minutes 🚀
─────────────────────────────────
TOTAL:             ~15 minutes ✅
```

---

## **Success Indicators**

You'll know it worked when:

✅ All 7 steps show green checkmarks  
✅ Deployment log shows "🎉 Full project setup completed successfully!"  
✅ You can open the deployment URL  
✅ You can log in to the new instance  
✅ Dashboard displays correctly  
✅ Menu items and features work  

---

## **Pro Tips**

💡 **Tip 1:** Save your tokens in a safe place (they'll be needed again)

💡 **Tip 2:** Note your deployment URL (you'll need it to access your new instance)

💡 **Tip 3:** Test the new instance before sharing with others

💡 **Tip 4:** Keep the wizard documentation open while following steps

💡 **Tip 5:** If something fails, try again - most issues resolve on second attempt

---

**Ready to get started?**

👉 **Go to your Admin Dashboard**  
👉 **Find the ⚙️ Settings button**  
👉 **Click "Project Setup Wizard"**  
👉 **Follow the steps above**  
👉 **Enjoy your new instance!**

---

**Version**: 1.0  
**Status**: Ready to Use  
**Last Updated**: March 2026  
**Estimated Read Time**: 5 minutes  
**Estimated Setup Time**: 10-15 minutes
