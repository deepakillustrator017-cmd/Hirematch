# HireIn AI

Static HTML, CSS, and vanilla JavaScript hiring platform. Vercel serves the project root; `index.html` is the homepage. Clean URLs are configured in `vercel.json`.

## Supabase setup

1. In the Supabase SQL Editor, review and run [`supabase/schema.sql`](supabase/schema.sql). It creates/extends application tables, row-level security policies, and the private `resumes` plus public `logos` and `avatars` buckets. Back up production data before applying schema changes.
2. In Authentication → URL Configuration, set the production site URL to `https://hireinai.in` and add `https://hireinai.in/**`, `https://www.hireinai.in/**`, `http://localhost:8000/**`, and `http://127.0.0.1:8000/**` to the redirect allow list. Enable email/password and configure email verification templates.
3. To enable Google sign-in, configure the Google OAuth client in Supabase Authentication → Providers and add `https://xyazcbtxuahzrkxdzywy.supabase.co/auth/v1/callback` to Google Cloud Console's authorized redirect URIs.
4. Assign recruiter/admin roles only to verified accounts from the SQL Editor. Example: `update public.profiles p set role = 'recruiter' from auth.users u where p.user_id = u.id and u.email = 'verified@example.com';`

## AI function

With the Supabase CLI linked to this project, deploy the function using `supabase functions deploy ai-assistant`; set the provider key with `supabase secrets set OPENAI_API_KEY=...`. Optionally configure `OPENAI_MODEL` and comma-separated `AI_ALLOWED_ORIGINS`. The model key stays server-side and is never included in the static frontend. Without the secret, resume writing actions show a setup message and ATS still provides its local keyword analysis.

## Vercel

Connect the repository with the project root as the Root Directory and no build command or output directory. Vercel serves the HTML and static assets directly; `vercel.json` maps `/jobs`, `/job/:id`, `/apply`, `/ats`, `/dashboard`, `/recruiter`, and auth routes to their HTML files. The detail route uses root-relative scripts and styles so assets resolve under `/job/<id>`.

## Storage and privacy

Resume PDFs are stored in the private `resumes` bucket at `<user-id>/<purpose>/<random-name>`. The SQL policies limit candidate access to their own files and allow a recruiter to access the resume attached to their own job's application. Download links are short-lived signed URLs. Never put Supabase service-role or AI provider keys in HTML or JavaScript.

## Local preview

Serve the repository root with any static HTTP server (for example, `python -m http.server 8000`) and open `http://localhost:8000`. Auth redirects and AI function CORS must include the local origin used.
