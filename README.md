# Orders Management — Bug Hunt

This is a small orders management app: create/view/update/delete clients, create/view/update/delete orders and assign them to clients, and browse both in filterable tables.

It's used as a **bug-hunting assessment**. The app runs and looks fine on the surface, but a number of bugs have been deliberately introduced across the stack: backend logic, security, frontend/UX, and configuration. Some are obvious the moment you click around; others only show up once you read the code, hit an edge case, or try a specific input.

## Your task

Find and fix as many bugs as you can. There's no fixed checklist to work through — treat it like a real codebase you've just inherited: something feels off, dig until you understand why, then fix it properly (not just paper over the symptom).

A few categories to keep in mind while you look:

- **Backend / logic** — does every endpoint do what it claims? Check filters, pagination, sorting, validation, calculations.
- **Security** — anything that looks like it trusts input it shouldn't, exposes more than it should, or was left in from local debugging.
- **Frontend / UX** — things that render wrong, behave inconsistently between similar screens, or are just bad practice even if "technically working."
- **Configuration** — the app should start up cleanly and reliably; if something about the setup is fragile or misconfigured, that counts too.

When you believe you've found and fixed a bug, make sure you can explain: what was wrong, why it was wrong, and how your fix addresses the root cause (not just the symptom you happened to notice).

## Stack

- **Backend**: Python, FastAPI, SQLAlchemy
- **Database**: PostgreSQL
- **Frontend**: React (Vite), plain CSS
- **Orchestration**: Docker Compose

## Running it locally

You only need [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running. No local Python/Node/Postgres setup required.

1. Clone this repository and open a terminal in the project folder.
2. Run:

   ```
   docker compose up --build
   ```

3. Once the containers are up, open:

   - Frontend: [http://localhost:5173](http://localhost:5173)
   - Backend API docs: [http://localhost:8000/docs](http://localhost:8000/docs)

4. The database is seeded automatically on first run with sample clients and orders, so the tables aren't empty.

   If the backend doesn't respond right after a cold start, give it a moment and try again (or check `docker compose ps` / `docker compose logs backend`) before assuming your machine is the problem — that alone might tell you something.

To stop the app, press `Ctrl+C`, then run `docker compose down` (add `-v` if you also want to wipe the database volume and reseed on the next run).

## Project structure

```
backend/     FastAPI app (app/main.py, models, schemas, routers)
frontend/    React app (src/pages, src/components)
docker-compose.yml
```

Both the backend and frontend containers mount your local source folders, so code changes on your machine are picked up automatically (hot reload) without rebuilding the images.

## Submitting

Push your fixes to a fork or branch and share it with whoever gave you this assessment, along with a short summary of what you found and fixed.
