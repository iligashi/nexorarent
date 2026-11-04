# Drenas Rent a Car

Full-stack car rental platform built with Next.js and Express.js, using MySQL (XAMPP).

## Tech Stack

- **Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, Framer Motion, Zustand, Recharts
- **Backend:** Express.js, Node.js (ES Modules), MySQL2, JWT Auth, Zod validation
- **Database:** MySQL / MariaDB (via XAMPP)

## Prerequisites

- [Node.js](https://nodejs.org/) v20.9 or higher
- [Docker Compose](https://docs.docker.com/compose/) with MySQL 8.4, or [XAMPP](https://www.apachefriends.org/) with MySQL/MariaDB

## Local Setup

### 1. Clone the repository

```bash
git clone <repo-url>
cd nexora-rent
```

### 2. Start MySQL

For the repository's development-only Compose database, copy `.env.example` to `.env`, replace the example database passwords with generated local values, and start MySQL:

```bash
docker compose up -d
```

The database is bound to `127.0.0.1:3307`; the Compose file is for local development only. Alternatively, start MySQL in XAMPP and create the `drenas_rentacar` database before migrating.

### 3. Backend setup

```bash
cd server
npm install
```

Create a `.env` file inside `server/`:

```env
# Database (MySQL - local Compose)
DB_HOST=127.0.0.1
DB_PORT=3307
DB_NAME=drenas_rentacar
DB_USER=nexorarent
DB_PASSWORD=use_the_same_value_as_MYSQL_PASSWORD_in_root_.env

# JWT
JWT_SECRET=your_jwt_secret_key_here
JWT_REFRESH_SECRET=your_jwt_refresh_secret_key_here

# Server
PORT=4000
NODE_ENV=development
CLIENT_URL=http://localhost:3000
COOKIE_SAME_SITE=lax

```

Run database migrations and seed data:

```bash
npm run db:migrate
npm run db:seed
```

The Compose service creates the `drenas_rentacar` database. With XAMPP, create the database before running migrations. The migration runner applies the schema and sample data but does not create databases or require database-administration credentials.

Start the backend server:

```bash
npm run dev
```

The API will be running at `http://localhost:4000`.

### 4. Frontend setup

Open a new terminal:

```bash
cd client
npm install
```

Create a `.env.local` file inside `client/`:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Start the frontend dev server:

```bash
npm run dev
```

The site will be running at `http://localhost:3000`.

## Production operations

See [OPERATIONS.md](./OPERATIONS.md) for deployment configuration, database backup and restore, health monitoring, and release guidance. Production requires HTTPS origins, distinct strong JWT secrets, and managed database credentials; development defaults are not suitable for deployment.

## Demo access

Seeded credentials are intentionally omitted from this README. Configure a unique local admin password, and rotate any default credentials before using a deployed environment.

## Project Structure

```
nexora-rent/
├── client/                  # Next.js frontend
│   ├── app/
│   │   ├── (public)/        # Customer-facing pages
│   │   │   ├── page.tsx     #   Home
│   │   │   ├── cars/        #   Car listing & detail
│   │   │   ├── reserve/     #   Booking wizard
│   │   │   ├── about/       #   About page
│   │   │   ├── blog/        #   Blog listing & detail
│   │   │   ├── contact/     #   Contact form
│   │   │   ├── my-bookings/ #   User reservations
│   │   │   └── auth/        #   Login & register
│   │   └── admin/           # Admin dashboard
│   │       ├── page.tsx     #   Dashboard overview
│   │       ├── cars/        #   Car management (CRUD)
│   │       ├── reservations/#   Booking management + calendar
│   │       ├── customers/   #   Customer list
│   │       ├── revenue/     #   Revenue analytics
│   │       ├── blog/        #   Blog CMS
│   │       ├── messages/    #   Contact messages inbox
│   │       └── settings/    #   Company settings
│   ├── components/          # Reusable components
│   ├── stores/              # Zustand state stores
│   └── lib/                 # API client & utilities
│
├── server/                  # Express.js backend
│   └── src/
│       ├── index.js         # Entry point
│       ├── db/
│       │   ├── pool.js      # MySQL connection pool
│       │   ├── migrate.js   # Migration runner
│       │   ├── migrations/  # SQL schema files
│       │   └── seeds/       # Seed data
│       ├── routes/          # API route handlers
│       │   ├── auth.routes.js
│       │   ├── cars.routes.js
│       │   ├── reservations.routes.js
│       │   ├── admin.routes.js
│       │   ├── locations.routes.js
│       │   ├── extras.routes.js
│       │   ├── reviews.routes.js
│       │   ├── blog.routes.js
│       │   ├── contact.routes.js
│       │   └── upload.routes.js
│       └── middleware/       # Auth & role middleware
│
└── README.md
```

## Available Scripts

### Backend (`server/`)

| Command | Description |
|---------|-------------|
| `npm run dev` | Start server with auto-reload (port 4000) |
| `npm start` | Start server for production |
| `npm run db:migrate` | Run database migrations |
| `npm run db:seed` | Seed database with sample data |
| `npm run db:reset` | Run migrations + seed (full reset) |

### Frontend (`client/`)

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Next.js dev server (port 3000) |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |

## API Endpoints

Base URL: `http://localhost:4000/api/v1`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Register new user |
| POST | `/auth/login` | Login |
| GET | `/cars` | List cars (with filters) |
| GET | `/cars/featured` | Featured cars |
| GET | `/cars/:slug` | Car detail |
| GET | `/locations` | Pickup/dropoff locations |
| GET | `/extras` | Rental extras |
| POST | `/reservations` | Create reservation |
| GET | `/blog` | Blog posts |
| POST | `/contact` | Submit contact form |
| GET | `/admin/*` | Admin endpoints (auth required) |

## Notes

- The database uses MariaDB (included with XAMPP). No need to install MySQL separately.
- The server uses MySQL-compatible SQL through `mysql2`; PostgreSQL is not supported.
- For XAMPP, update `DB_HOST`, `DB_PORT`, `DB_USER`, and `DB_PASSWORD` in `server/.env` to match your local MySQL setup.
- Never use the development Compose file or its local credentials as a production deployment template.
