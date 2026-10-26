# Drenas Rent a Car

Full-stack car rental platform built with Next.js and Express.js, using MySQL (XAMPP).

## Tech Stack

- **Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, Framer Motion, Zustand, Recharts
- **Backend:** Express.js, Node.js (ES Modules), MySQL2, JWT Auth, Zod validation
- **Database:** MySQL / MariaDB (via XAMPP)

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- [XAMPP](https://www.apachefriends.org/) (Apache + MySQL/MariaDB)

## Local Setup

### 1. Clone the repository

```bash
git clone <repo-url>
cd nexora-rent
```

### 2. Start XAMPP

Open XAMPP Control Panel and start **Apache** and **MySQL** modules.

### 3. Backend setup

```bash
cd server
npm install
```

Create a `.env` file inside `server/`:

```env
# Database (MySQL - XAMPP)
DB_HOST=localhost
DB_PORT=3306
DB_NAME=drenas_rentacar
DB_USER=root
DB_PASSWORD=

# JWT
JWT_SECRET=your_jwt_secret_key_here
JWT_REFRESH_SECRET=your_jwt_refresh_secret_key_here

# Server
PORT=4000
NODE_ENV=development
CLIENT_URL=http://localhost:3000

# Email (SMTP) - optional
SMTP_HOST=smtp.example.com
SMTP_PORT=465
SMTP_USER=your_smtp_user
SMTP_PASS=your_smtp_password
EMAIL_FROM=noreply@example.com
```

Run database migrations and seed data:

```bash
npm run db:migrate
npm run db:seed
```

This creates the `drenas_rentacar` database, all tables, and populates it with 12 cars, 5 locations, 4 extras, and 1 admin account.

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
- Car images are managed via URL from the admin panel (no file upload needed).
- The XAMPP default config (root user, no password, port 3306) is used by default.
- If your XAMPP MySQL runs on a different port, update `DB_PORT` in `server/.env`.
