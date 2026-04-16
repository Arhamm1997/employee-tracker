## Plan: Fix Production API and Signup Flow

TL;DR - The admin UI 404s and the signup plan link issue are caused by incorrect production environment and deployment config. The backend is built to run on port 5001 while `api.monitorhub.live` is currently proxied to the wrong port, and the company portal Next.js app needs a correct `NEXT_PUBLIC_API_URL` for production.

**Steps**
1. Update production backend environment variables.
   - Ensure `backend/.env` on the deployed server contains the real production domain values.
   - Required values include: `COMPANY_PORTAL_URL=https://app.monitorhub.live`, `FRONTEND_URL=https://monitorhub.live`, `VPS_URL=https://api.monitorhub.live`, `SLACK_REDIRECT_URI=https://api.monitorhub.live/api/slack/callback`, plus the necessary JWT and SMTP secrets.
   - Confirm `PORT=5001` for the backend service, matching `backend/src/index.ts` and `fix-vps.sh`.

2. Fix deployment Nginx proxy configuration.
   - In `deploy-vps.sh`, change the `api.$DOMAIN` proxy pass target from `http://localhost:3001` to `http://127.0.0.1:5001`.
   - Verify that `api.monitorhub.live` is routed to the backend port 5001, while `app.monitorhub.live` is routed to the Next.js company portal on 3001.
   - If using `fix-vps.sh`, make sure it is the actual deployment script and keep its backend proxy on 5001.

3. Set company portal production API URL.
   - Add `NEXT_PUBLIC_API_URL=https://api.monitorhub.live/api` to the production environment used by `company-portal` during build/start.
   - Also consider adding `NEXT_PUBLIC_DASHBOARD_URL=https://app.monitorhub.live` if the portal redirects to the dashboard.
   - Confirm `company-portal/package.json` uses `next build` and that build-time env vars are present.

4. Confirm backend route registration and host.
   - `backend/src/routes/index.ts` mounts master admin routes under `/api/admin`, so the route names shown in the browser are correct.
   - `company-portal/lib/api.ts` already uses `API_URL` + path, so the only thing that must be correct is `API_URL`.
   - This means the 404 is due to the wrong target host/proxy rather than bad frontend routes.

5. Rebuild and restart services.
   - Rebuild `backend`, `company-portal`, and `Master Admin Dashboard` after env fixes.
   - Restart the backend service and Next.js portal service.
   - Reload Nginx after updating proxy config.

6. Verify the fix.
   - `https://api.monitorhub.live/health` should return a backend JSON health response.
   - `https://api.monitorhub.live/api/admin/changelog` should resolve to the admin API route (authenticated as needed).
   - The welcome email select-plan link should use `https://app.monitorhub.live/select-plan`.
   - The admin UI should stop returning 404 for `/api/admin/slack/integrations`, `/api/admin/slack/plans`, `/api/admin/changelog`, and subscription endpoints.

**Relevant files**
- `backend/.env` — production environment values for backend and portal links.
- `backend/src/index.ts` — backend port config and allowed origins.
- `backend/src/routes/index.ts` — master admin route mounting under `/api/admin`.
- `company-portal/lib/api.ts` — frontend API base URL logic.
- `deploy-vps.sh` — initial deployment nginx/proxy setup and env generation.
- `fix-vps.sh` — corrected deployment/nginx example for production.

**Decisions**
- Use port 5001 for the backend API in production, matching backend code and the fixed script.
- Use `api.monitorhub.live` as the dedicated API origin, not the company portal host.
- Treat the 404s as deployment routing errors rather than missing route handlers.

**Further Considerations**
1. After the fix, if `api.monitorhub.live/api/admin/...` still fails, confirm DNS for `api.monitorhub.live` and that the correct server is receiving traffic.
2. If the company portal is built without `NEXT_PUBLIC_API_URL`, the frontend may still point to localhost; ensure env vars are provided at build time.
3. Consider adding a production `.env.example` or deployment doc listing all required host-specific env vars.
