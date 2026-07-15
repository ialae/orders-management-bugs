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

> **Important note.** In our next meeting, we'll likely go through a handful of the bugs you fixed and ask you to walk us through them: what was wrong, how you found it, why your fix works. This is meant to be a normal conversation about your own work, not a trick — but it also means it's easy to tell when someone can't actually explain a fix they submitted. Using AI tools to help you think, research, or write code is fine; what won't hold up is submitting fixes you can't personally explain, because that gap shows immediately in conversation and will disqualify your submission. Do the work in a way you can stand behind.

## Stack

- **Backend**: Python, FastAPI, SQLAlchemy
- **Database**: PostgreSQL
- **Frontend**: React (Vite), plain CSS
- **Orchestration**: Docker Compose

## Running it locally

You only need **Docker Desktop** installed and running. No local Python, Node, or Postgres setup required — everything runs inside containers.

### Step 0: Install and start Docker Desktop (skip if already installed)

1. Download and install it for your OS: [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/).
2. Open the Docker Desktop application and wait until it says it's running (the whale icon in your menu bar / system tray stops animating).
3. Confirm it's working by running this in a terminal:

   ```
   docker --version
   ```

   If that prints a version number, you're good. If it errors, Docker Desktop isn't running yet — open the app and wait for it to fully start, then try again.

### Step 1: Get the code onto your machine

Pick whichever of these you're comfortable with:

- **With Git installed** — open a terminal anywhere you keep projects and run:

  ```
  git clone https://github.com/ialae/orders-management-bugs.git
  cd orders-management-bugs
  ```

- **Without Git** — go to [github.com/ialae/orders-management-bugs](https://github.com/ialae/orders-management-bugs), click the green **Code** button, choose **Download ZIP**, then unzip it and open a terminal inside the unzipped folder (the one containing `docker-compose.yml`).

### Step 2: Start the app

From inside that folder, run:

```
docker compose up --build
```

The first run downloads images and builds the containers, so it can take a couple of minutes — that's normal. Leave this terminal window open; it's showing you live logs from all three services (database, backend, frontend).

### Step 3: Open the app

Once the logs settle down, open:

- Frontend: [http://localhost:5173](http://localhost:5173)
- Backend API docs: [http://localhost:8000/docs](http://localhost:8000/docs)

The database is seeded automatically on first run with sample clients and orders, so the tables won't be empty.

**If the frontend loads but looks broken, or the backend doesn't respond right away:** give it a few more seconds and refresh — the three containers don't always finish starting in the same order. If it's still not responding after that, check what's going on with:

```
docker compose ps
docker compose logs backend
```

Don't assume it's something wrong with your machine before checking those — what you find there might tell you something.

### Stopping the app

Press `Ctrl+C` in that terminal, then run:

```
docker compose down
```

Add `-v` to that last command (`docker compose down -v`) if you also want to wipe the database volume, so the next `docker compose up` starts from a fresh reseed.

### Making changes

Both the backend and frontend containers mount your local source folders, so once the app is running, any code change you save on your machine is picked up automatically — no need to stop and re-run `docker compose up --build` for every edit. You only need to rebuild if you change dependencies (`requirements.txt` or `package.json`).

## Project structure

```
backend/     FastAPI app (app/main.py, models, schemas, routers)
frontend/    React app (src/pages, src/components)
docker-compose.yml
```

## Submitting

Push your fixes to a fork or branch and share it with whoever gave you this assessment, along with a short summary of what you found and fixed.
