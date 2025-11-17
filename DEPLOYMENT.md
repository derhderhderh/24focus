# Deployment Guide

## Overview

This ATC24 dashboard has two components:
1. **Data Server** (server.js) - Connects to 24data WebSocket and writes JSON files
2. **Next.js Frontend** - Reads JSON files and displays the data

## Architecture

\`\`\`
24data WebSocket → Data Server → JSON Files → Next.js API Routes → Frontend
\`\`\`

The data server collects live data and writes it to:
- `public/api/v1/telemetry.json`
- `public/api/v1/flight-plans.json`
- `public/api/v1/aircraft-list.json`

## Netlify Deployment

### Step 1: Deploy the Data Server Separately

The data server needs to run continuously to collect data from 24data. Deploy it on a service that supports long-running processes:

**Option A: Railway**
1. Create a new project on [Railway](https://railway.app)
2. Connect your GitHub repository
3. Set the start command to: `node server.js`
4. Deploy

**Option B: Render**
1. Create a new Web Service on [Render](https://render.com)
2. Connect your repository
3. Set the start command to: `node server.js`
4. Deploy

**Option C: VPS (DigitalOcean, AWS, etc.)**
1. SSH into your server
2. Clone the repository
3. Run `npm install`
4. Use PM2 to keep the server running: `pm2 start server.js`

### Step 2: Deploy Frontend to Netlify

1. Push your code to GitHub
2. Go to [Netlify](https://netlify.com) and create a new site
3. Connect your GitHub repository
4. Build settings:
   - Build command: `npm run build`
   - Publish directory: `.next`
5. Deploy

### Step 3: Sync Data Files

Since the data server writes to `public/api/v1/`, you need to sync these files to Netlify:

**Option 1: Use a shared storage service (Recommended)**
- Modify server.js to write to AWS S3, Vercel Blob, or another cloud storage
- Modify API routes to read from the same storage

**Option 2: Periodic Git commits (Not recommended for production)**
- Have the data server commit and push JSON files periodically
- Configure Netlify to auto-deploy on commits

**Option 3: API Gateway**
- Keep the data server's Express endpoints
- Have the Next.js API routes proxy to your data server's URL
- Update the fetch URLs in the API routes

## Environment Variables

No environment variables are required for the default setup.

## Running Locally

1. Start the data server: `npm run server`
2. Start the Next.js dev server: `npm run dev`
3. Open http://localhost:3000

## Notes

- Speed violation rule is set to 200 knots under 2,000 feet
- Data files are updated every 2 seconds by the data server
- The frontend polls the API routes every 2-5 seconds for updates
\`\`\`

```json file="" isHidden
