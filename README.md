# विविध स्पर्धा परीक्षा पूर्व प्रशिक्षण कार्यक्रम – AMRUT Study Portal

AMRUT (Government of Maharashtra) competitive-examination training & study portal: public website, logged-in candidate portal and admin panel.

**Stack (confirmed only):** Node.js · Express + EJS (server-rendered) · PostgreSQL (manage with pgAdmin) · deploy on AWS. No React/Next/MongoDB/Firebase.

Design & specification (sitemaps, wireframes, design system, journeys, access control, HOLD list, priorities): [docs/DESIGN-SPEC.md](docs/DESIGN-SPEC.md).

## Run locally

```bash
npm install
cp .env.example .env        # set DATABASE_URL, SESSION_SECRET
npm run db:setup            # creates the database if missing, applies schema, loads SAMPLE data
npm start                   # http://localhost:3000   (npm run dev = auto-restart)
```

`npm run db:reset` drops and re-creates all tables with fresh sample data.

## Prototype logins (sample data – change before any real use)

| Area | Login | Password | Profile |
|---|---|---|---|
| Candidate portal `/login` | `DEMO-001` | `Demo@123` | लक्षित गट · verified (study material allowed) |
| | `DEMO-002` | `Demo@123` | Non-लक्षित गट · verified |
| | `DEMO-003` | `Demo@123` | verification pending |
| Admin `/admin/login` | `admin@amrut.local` | `Admin@123` | administrator (roles HOLD) |

Candidate login is a **prototype stand-in**. The real mechanism depends on the Mahaamrut integration, which is HOLD.

Useful pages: `/journey` (clickable end-to-end prototype journey) · `/design-system` (component library).

## Structure

```
server.js                 Express app, sessions (stored in PostgreSQL), security headers
src/db/schema.sql         All tables (bilingual *_en / *_mr fields)
src/db/setup.js           DB create + schema + sample seed
src/middleware.js         language, CSRF, view locals, layout rendering, guards, uploads
src/helpers.js            t() i18n, L() bilingual fields, formatting, icons
src/i18n/                 en.js, mr.js (+ extra/portal-*.js, admin-*.js)
src/services/             access control, settings cache, catalog queries
src/routes/               public.js, portal.js, admin.js, files.js (access-checked downloads)
src/admin/                resources.js (admin entity config), crud.js (generic CRUD)
src/views/                layouts/, partials/, public/, portal/, admin/
public/css/amrut.css      AMRUT design system
uploads/                  public/ (served) · private/ (study material, proofs – via access check)
```

## Deployment notes (AWS)

Configuration is entirely through environment variables (`.env.example`):
- `DATABASE_URL` and `DB_SSL` for PostgreSQL.
- `SESSION_SECRET`.
- `NODE_ENV=production`, which enables secure cookies and hides the demo hints.

The app trusts one proxy hop, so it works behind a load balancer. Uploads are currently written to the local `UPLOAD_DIR`. The final AWS architecture (compute, file storage, backups, monitoring) is **to be documented separately once finalised**.
