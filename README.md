# Frontend 0.2

Acetate's statement-processing application and its separate product landing page.

## Local setup

Node 22+ is required.

```sh
npm ci
cp .env.example .env
npm run dev
```

The app runs at http://127.0.0.1:3000. `npm run dev:landing` previews the existing product landing page at http://127.0.0.1:3001. Its sign-in panel opens the local app's `/login` route; the published landing points to `https://app.acetate.me/login`.

## Configuration

`.env` contains default local settings, `.env.prod` contains production settings, and `.env.example` is the committed template. Both populated files are ignored by Git. Existing process variables take precedence. `npm run start:prod` or `NODE_ENV=production` selects `.env.prod`.

- `PORT`: local frontend port, default 3000.
- `BACKEND_URL`: backend base URL; local default is http://127.0.0.1:8080.
- `AUTH_SUPABASE_URL`, `AUTH_SUPABASE_PUBLISHABLE_KEY`: the backend's Supabase project URL and public publishable key. Only these public settings are exposed at `/api/auth/config`.

Production hosting uses Vercel environment variables. Backend secrets, database credentials, and AI provider credentials belong only to the backend.

## Domains and login

Deploy the repository root as the application at `app.acetate.me`, and `landing/` as the separate static product site at `acetate.me` (with `www` redirected to the root domain). The landing owns `/privacy-policy` and `/terms-of-service`; old app legal URLs redirect there.

The landing's compact account panel links to the app's `/login`. The app checks for an existing session, otherwise starts Google OAuth with Supabase using PKCE. Supabase returns to `/auth/callback` on the app's origin; its SDK exchanges the code and saves the session before opening `/`. The account panel restores the session and supports sign-out. App and landing browser storage are separate; tokens are not passed through the landing URL.

Enable Google in Supabase and allow `https://app.acetate.me/auth/callback` and `http://127.0.0.1:3000/auth/callback`. Keep the Google OAuth client's callback set to the Supabase project's `/auth/v1/callback`. Google branding uses the product homepage and public legal pages. See [Supabase Google setup](https://supabase.com/docs/guides/auth/social-login/auth-google).

## Statement processing

Signed-in users upload one PDF to `/api/jobs` with their Bearer token and a unique `Idempotency-Key`. The backend returns a durable job ID. The browser follows `/api/jobs/:id/events`, carrying its current access token and saved `Last-Event-ID`; status and result routes recover completed outcomes after a closed stream. Requests pass through an allowlisted frontend proxy. Internal backend routes are not exposed by that proxy.

The frontend ends each stream connection after 45 seconds to stay within hosting limits. The browser reconnects to the same job rather than uploading again. Processing remains on Cloud Run and survives frontend disconnection. Stop watching disconnects the viewer; it does not cancel backend processing. Reopening a saved running job resumes watching.

The hosted app accepts PDFs up to 4 MiB to stay below Vercel's function payload limit. The backend's own file limit may be larger. Supporting larger browser uploads requires a separate direct-upload or storage flow.

Browser history is separated by Supabase user ID. Sign-out clears the visible results and aborts the viewer without deleting backend jobs. Original PDF bytes are not persisted; attachments remain available only during their page session. Step outputs render JSON, sanitized Markdown, or text. Transaction sorting does not modify the original result.

## Deployment

`npm run build` copies locked browser dependencies to ignored `public/vendor/`. Vercel serves the public files and the stateless Node handler in `api/index.mjs`; `vercel.json` specifies routing and function limits. No frontend run state is retained by Vercel functions. `npm start` runs the local Node server without watching.

The landing's own `vercel.json` defines its static output and public legal routes. Its legal drafts identify Gabriel Welzel and gabriel@gabrr.app. Confirm provider, retention, and legal practices when changing the service.

## Verification

`npm test` covers authentication behavior, job submission/resumption, proxy route restrictions and headers, streaming, browser history, sorting, and timings. Browser checks cover the landing account panel and the real OAuth return flow.
