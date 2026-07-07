# Portfolio Admin Dashboard

Admin panel for [abuzafor.me](https://abuzafor.me) — manage profile, about,
stats, projects, skills, experience, education, certifications, and the CV.
Pure static HTML/CSS/JS; talks to the API in
[AbuZafor99/portfolio-backend](https://github.com/AbuZafor99/portfolio-backend).

## Hosting (GitHub Pages)

Repo → **Settings → Pages** → Source: *Deploy from a branch* → Branch:
`main` / `/ (root)` → Save.

Live at: `https://abuzafor99.github.io/portfolio-admin/`

## Configuration

Set `apiBase` in `config.js` to the deployed backend URL
(e.g. `https://abuzafor-portfolio-api.azurewebsites.net`), or leave it empty
and enter the URL on the login screen once — it's stored in the browser.

Login uses the `ADMIN_EMAIL` / `ADMIN_PASSWORD` configured on the backend.
