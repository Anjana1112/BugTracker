# Bug Tracker

A full-stack issue tracker for small teams. Organize work into projects, file and assign tickets, discuss them in comments, attach files, and see a full history of every change.

**Live demo:** https://bug-tracker-rbqb.vercel.app

> The API runs on Render's free tier, so the first request after a period of inactivity can take up to a minute while the server wakes up.

## Demo accounts

Try the app without signing up. Every account uses the password `demo1234`.

| Role      | Email                        |
| --------- | ---------------------------- |
| Admin     | demo-admin@bugtracker.app    |
| Manager   | demo-manager@bugtracker.app  |
| Developer | demo-dev@bugtracker.app      |

Demo data is reset periodically, so feel free to create, edit, and delete things.

## Features

- **Projects and tickets**: create projects, file tickets with priority and status, and assign them to teammates
- **Role-based access**: users only see projects and tickets they're a member of, with permissions based on role
- **Comments**: threaded discussion on every ticket
- **Activity history**: every field change on a ticket or project is recorded with who changed what and when
- **File attachments**: upload screenshots and files to tickets, stored in Cloudflare R2
- **Search**: find tickets, projects, and users from anywhere in the app
- **Accounts**: email/password sign-up and login, plus light and dark themes

## Tech stack

| Layer    | Tools                                              |
| -------- | -------------------------------------------------- |
| Frontend | Next.js, React, TypeScript, NextAuth               |
| Backend  | Node.js, Express, TypeScript, JWT authentication   |
| Database | PostgreSQL (Neon), Prisma ORM                      |
| Storage  | Cloudflare R2                                      |
| Testing  | Vitest (166 integration tests)                     |
| Hosting  | Vercel (client), Render (server)                   |

## Project structure

```
client/           Next.js frontend
server/
  src/
    controllers/  Request handlers (auth, projects, tickets, comments, users, search)
    routes/       Express routes
    middleware/   Auth and error handling
    lib/          Storage and shared utilities
  prisma/         Schema, migrations, and seed scripts
  test/           Integration tests
```

## Running locally

**Requirements:** Node.js 20+, a PostgreSQL database (a free Neon project works), and a Cloudflare R2 bucket if you want attachments.

**1. Clone the repo**

```bash
git clone https://github.com/Anjana1112/BugTracker.git
cd BugTracker
```

**2. Start the server**

```bash
cd server
npm install
cp .env.example .env        # then fill in the values
npx prisma generate
npx prisma migrate deploy
npm run seed:demo           # optional: loads sample data and demo accounts
npm run dev
```

The API runs on http://localhost:8000.

**3. Start the client** (in a second terminal)

```bash
cd client
npm install
cp .env.example .env.local  # then fill in the values
npm run dev
```

The app runs on http://localhost:3000.

## Environment variables

**Server** (`server/.env`)

| Variable               | Description                                              |
| ---------------------- | -------------------------------------------------------- |
| `DATABASE_URL`         | Postgres connection string (pooled)                      |
| `DIRECT_URL`           | Direct (non-pooled) connection string, used for migrations |
| `JWT_SECRET`           | Long random string for signing tokens                    |
| `CLIENT_ORIGIN`        | Frontend URL allowed by CORS                             |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL_BASE` | Cloudflare R2 storage for attachments |
| `BCRYPT_COST`          | Optional password hashing cost                           |

**Client** (`client/.env.local`)

| Variable                   | Description                                  |
| -------------------------- | -------------------------------------------- |
| `NEXT_PUBLIC_API_BASE_URL` | URL of the API server                        |
| `EXPRESS_API_URL`          | URL of the API server, used by NextAuth      |
| `NEXTAUTH_URL`             | URL of the frontend                          |
| `NEXTAUTH_SECRET`          | Long random string for session encryption    |

## Tests

The server has an integration test suite covering auth, permissions, projects, tickets, comments, and search. Tests run against a separate database, so point `server/.env.test` at a dedicated test database (never production), then:

```bash
cd server
npm test
```

## Deployment

- **Server (Render):** root directory `server`, build command `npm run render-build`, start command `npm start`
- **Client (Vercel):** root directory `client`, with the client environment variables set in the project settings
- **Database:** Neon Postgres, migrated during the Render build

Never run `prisma/seed.ts` against a production database. It deletes all existing data.
