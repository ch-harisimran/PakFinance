@frontend/AGENTS.md

# Repository layout

- `frontend/` — the Next.js app. All UI, routes, design system and fixtures.
  Run every npm command from here, or use the proxy scripts in the root
  `package.json` (`npm run dev`, `npm run build`, `npm run lint`).
- `backend/` — not yet created. See `PLAN.md`.
- `PLAN.md` — product and architecture plan for the whole project.
- `frontend/design/` — design system, landing spec, tokens (`tokens.css` is
  imported by `frontend/app/globals.css`).
