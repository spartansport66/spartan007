# Project Setup Wizard - Development Setup

## Quick Start for Local Development

The Project Setup Wizard requires the API endpoints to be running. For local development, follow these steps:

### Step 1: Install Dependencies

```bash
npm install
```

This will install:
- `express` - Web framework for the dev API server
- `cors` - CORS handling for API calls
- `tsx` - TypeScript execution runtime

### Step 2: Run Development Servers

You need to run **two terminals**:

**Terminal 1 - Development API Server:**
```bash
npm run dev:api
```

Expected output:
```
✓ Development API Server running on http://localhost:3001
✓ API endpoints available at http://localhost:3001/api/setup/*
```

**Terminal 2 - Vite Dev Server:**
```bash
npm run dev
```

Expected output:
```
  VITE v6.x.x  ready in xxx ms

  ➜  Local:   http://localhost:8080/
```

### Alternative: Run Both Servers Together

If you have `npm-run-all` installed, or you can use:

```bash
npm run dev:all
```

### Step 3: Access the Application

Open your browser and navigate to:
```
http://localhost:8080
```

Navigate to Admin Dashboard → Admin Utils → Project Setup Wizard

### How It Works

During local development:

1. **Vite Dev Server** (port 8080)
   - Runs the React frontend
   - Proxies `/api/*` requests to the Dev API Server

2. **Dev API Server** (port 3001)
   - Handles all Project Setup Wizard verification endpoints
   - Makes direct calls to Supabase, Vercel, and GitHub APIs
   - Provides proper error responses

3. **API Proxy** (configured in vite.config.ts)
   - Routes all `/api/setup/*` calls from frontend to port 3001
   - Transparent to the frontend code

## Troubleshooting

### "Failed to verify Supabase" Error

**Ensure both servers are running:**
- Check Terminal 1: Dev API Server should show "Development API Server running on http://localhost:3001"
- Check Terminal 2: Vite should show "ready in XXX ms"

### Port Already in Use

If port 3001 or 8080 is already in use:

**For Vite (port 8080):**
- Edit `vite.config.ts` and change the port
- Or kill the process using that port

**For Dev API Server (port 3001):**
- Edit `dev-api-server.ts` and change `const PORT = 3001;`
- Or kill the process using that port

### Dependencies Not Installing

```bash
# Try clearing npm cache
npm cache clean --force

# Then install again
rm -rf node_modules package-lock.json
npm install
```

## Production Deployment

When deploying to production:

1. The API endpoints are deployed as Vercel serverless functions in the `/api` directory
2. The frontend calls `/api/setup/*` which will be served from the same Vercel deployment
3. **No Dev API Server is needed** in production

## Files Involved

- `dev-api-server.ts` - Development API server (local only)
- `vite.config.ts` - Vite config with /api proxy
- `package.json` - Scripts and dependencies
- `api/setup/*.ts` - Actual serverless functions (used in production)

## Verifying Setup

### Test Supabase Verification

```bash
curl -X POST http://localhost:3001/api/setup/verify-supabase \
  -H "Content-Type: application/json" \
  -d '{"projectId":"qzmwtbbtagktpsckhmcz"}'
```

### Test Vercel Verification

```bash
curl -X POST http://localhost:3001/api/setup/verify-vercel \
  -H "Content-Type: application/json" \
  -d '{"token":"your-vercel-token"}'
```

### Test GitHub Verification

```bash
curl -X POST http://localhost:3001/api/setup/verify-github \
  -H "Content-Type: application/json" \
  -d '{"token":"your-github-token","org":"your-org"}'
```

If you see valid JSON responses, the dev server is working correctly.
