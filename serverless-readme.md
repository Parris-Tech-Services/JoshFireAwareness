EMV Proxy Options

This repo includes a small proxy example you can run locally or deploy as a serverless function to safely fetch the EMV incident JSON (which blocks browser CORS).

Local Node dev

1. Install Node.js (14+).
2. From the `server` folder run:

```powershell
node emv-proxy-standalone.js
```

3. Open the app from `http://localhost:5500` (Live Server) and the client will try `/api/emv` first.

Deploy to Vercel (serverless function)

Create `api/emv.js` with the same proxy logic (see example), then deploy to Vercel. The client can call `/api/emv` on the same origin.

Deploy to Netlify Functions

Create `netlify/functions/emv.js` and deploy; the function will be available at `/.netlify/functions/emv`.

Notes

- The proxy simply forwards EMV JSON and adds `Access-Control-Allow-Origin: *` for browser compatibility. Use only for personal/temporary use — check EMV terms before broader sharing.
- For production, prefer deploying the function under a trusted hostname (Vercel/Netlify) rather than leaving a long-running local proxy.

Vercel example

Place `api/emv.js` in your repo root (file `api/emv.js` is included in this workspace). Vercel will serve it at `https://<your-deploy>/api/emv`.

Netlify Functions example

Place the `netlify/functions/emv.js` file in your repo (included here). It will be available at `https://<your-deploy>/.netlify/functions/emv`.

Usage in client

Update `FEEDS.incidentsVicEmergencyProxy` in `index.html` to point to the deployed path if different, otherwise the client will try `/api/emv` by default.

## Continuous Deployment examples

### Vercel (GitHub Actions)

A sample GitHub Action is included at `.github/workflows/deploy-vercel.yml`. Create a GitHub secret `VERCEL_TOKEN` (from your Vercel account) and push to `main` to trigger automatic deploys.

### Netlify

A `netlify.toml` is included and the function in `netlify/functions/emv.js` will be auto-deployed by Netlify. Connect the repo in Netlify and deploy the site.

