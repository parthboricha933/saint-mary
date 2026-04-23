# Saint Mary School - School Management Website

> A complete school management website for **Saint Mary School, Rajula, Amreli, Gujarat** (UDISE: 24131005639). Deployable on Vercel with PostgreSQL, or run locally with Node.js + SQLite/PostgreSQL. Pure static HTML/CSS/JS frontend with serverless API backend.

---

## Features

### Public Website (`/`)
- Responsive single-page design with smooth scroll navigation
- Sections: Home, About, Academics, Syllabus, Fees Structure, Events, Gallery, Contact Us, Admissions
- Photo gallery with category filtering
- Admission inquiry form (Std 1 to 12)
- Contact form with message submission
- Scroll animations and parallax hero section
- Mobile-responsive hamburger navigation

### Admin Panel (`/admin`)
- Secure admin login with token-based authentication
- Dashboard overview with key stats
- **User Management** — view, approve, reject, delete teachers and principals
- **Gallery Management** — upload, view, delete gallery images (drag & drop)
- **Notice Board** — create, edit, delete notifications (academic, events, general)
- **Syllabus Management** — CRUD for class-wise syllabus entries (Std 1–8)
- **Fees Structure Management** — CRUD for class-wise fee details (tuition, exam, lab, sports, transport)
- **Admission Inquiries** — view and manage admission requests
- **Contact Messages** — view messages submitted via contact form

### Staff Dashboard (`/dashboard`)
- Teacher and Principal login with cookie-based auth
- **Events** — view published school events
- **Notifications** — view and filter notices by category
- **Syllabus** — view syllabus organized by class (accordion layout)
- **Manage Teachers** (Principal only) — approve/reject pending teacher registrations
- **Content Management** (Principal only) — Gallery, Notices, Syllabus, Fees management

### Teacher Registration (`/login`)
- Teachers and principals can self-register
- New registrations require principal/admin approval before login
- Password stored as SHA-256 hash

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Server | Node.js (built-in `http` module) / Vercel Serverless |
| Database | PostgreSQL (Vercel) or SQLite (local) via Prisma ORM |
| Frontend | Static HTML + CSS + Vanilla JavaScript |
| Auth | Cookie-based (SHA-256 hashed tokens) |
| Deployment | Vercel / Caddy reverse proxy |

---

## Project Structure

```
saint-mary/
├── light-server.mjs            # Local dev server (all API routes + static files)
├── vercel.json                  # Vercel deployment config
├── api/
│   └── [...path].js             # Catch-all serverless API handler (Vercel)
├── package.json                # Dependencies & scripts
├── Caddyfile                   # Caddy reverse proxy config (optional)
├── auth-config.json            # Admin credentials (local dev)
├── .env.example                # Environment variable template
├── .gitignore
├── start-server.sh             # Server auto-restart wrapper (local)
│
├── prisma/
│   ├── schema.prisma           # PostgreSQL schema (Vercel)
│   └── schema.sqlite.prisma    # SQLite schema (local dev)
│
├── db/
│   └── custom.db               # SQLite database (local dev only)
│
└── public/                     # Static web assets
    ├── index.html              # Main public website
    ├── login.html              # Staff login page
    ├── dashboard.html          # Teacher/Principal dashboard
    ├── admin.html              # Admin management panel
    └── uploads/
        ├── school-logo.png     # School logo
        ├── hero-photo.jpg      # Hero section background
        └── gallery/            # Gallery images
            ├── image1.png
            ├── image2.png
            ├── image3.png
            └── image4.png
```

---

## Database Schema

9 models defined in Prisma:

| Model | Purpose |
|-------|---------|
| `User` | Admin, Principal, Teacher accounts |
| `Event` | School events (published/pending) |
| `Notification` | Notices and announcements |
| `Syllabus` | Class-wise syllabus entries |
| `FeeStructure` | Class-wise fee breakdown |
| `GalleryImage` | Photo gallery entries |
| `AdmissionInquiry` | Student admission requests |
| `ContactMessage` | Contact form submissions |
| `SiteSettings` | Key-value site configuration |

---

## Deployment on Vercel (Recommended)

### Prerequisites
- A [Vercel](https://vercel.com) account
- [Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres) (free tier available)
- GitHub account

### Steps

1. **Fork or push this repo to GitHub**

2. **Import to Vercel**
   - Go to [vercel.com/new](https://vercel.com/new)
   - Import the `saint-mary` repository
   - Framework Preset: **Other**
   - Click **Deploy**

3. **Add Vercel Postgres**
   - In your Vercel project, go to **Storage** tab
   - Click **Create Database** and select **Postgres**
   - Choose the free (Hobby) plan
   - Once created, Vercel automatically sets `DATABASE_URL` and `DIRECT_DATABASE_URL` environment variables

4. **Set environment variables**
   - Go to **Settings > Environment Variables**
   - Add:
     - `ADMIN_EMAIL` = your admin email (e.g. `admin@saintmaryschool.com`)
     - `ADMIN_TOKEN_HASH` = SHA-256 hash of your admin token
   - `DATABASE_URL` and `DIRECT_DATABASE_URL` are already set by Vercel Postgres

5. **Push database schema**
   - Locally, set the Vercel Postgres connection string:
     ```bash
     # Copy the DATABASE_URL from Vercel dashboard
     npx prisma db push
     ```
   - This creates all 9 tables in the remote Postgres database

6. **Redeploy** — Vercel will auto-rebuild with the new environment variables

### Generate Admin Token Hash

```bash
node -e "console.log(require('crypto').createHash('sha256').update('your-admin-email:your-token').digest('hex'))"
```

Replace `your-admin-email` and `your-token` with your chosen admin credentials.

---

## Local Development

### Prerequisites
- Node.js v18+
- npm
- SQLite (comes with Node.js, no extra install needed)

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/parthboricha933/saint-mary.git
cd saint-mary

# 2. Install dependencies
npm install

# 3. Switch to SQLite schema (for local dev)
cp prisma/schema.sqlite.prisma prisma/schema.prisma

# 4. Set up environment
cp .env.example .env
# Edit .env:
#   DATABASE_URL="file:./db/custom.db"

# 5. Initialize the database
mkdir -p db
npx prisma db push
npx prisma generate

# 6. Seed data (optional)
npx prisma db seed

# 7. Start the server
npm start
# Server runs on http://localhost:3000
```

### NPM Scripts

```bash
npm start              # Start the local server (768MB memory limit)
npm run db:push        # Push schema changes to database
npm run db:generate    # Regenerate Prisma client
npm run db:studio      # Open Prisma Studio (database GUI)
```

---

## User Roles & Permissions

| Role | Description | Access |
|------|------------|--------|
| **Admin** | Superuser (configured in `auth-config.json`) | Full access to all features |
| **Principal** | School principal (approved account) | Dashboard + Content management + Teacher approval |
| **Teacher** | School teacher (approved account) | Dashboard (view-only: events, notifications, syllabus) |

---

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/admin-login` | Admin login (email + token) |
| POST | `/api/auth/user-login` | Teacher/Principal login (email + password) |
| GET | `/api/auth/me` | Get current authenticated user |
| POST | `/api/auth/logout` | Clear auth cookies |
| POST | `/api/auth/register` | Register new teacher/principal |

### Events
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/events` | Public | List published events |
| POST | `/api/events` | Admin/Principal | Create event |
| PUT | `/api/events/:id` | Admin/Principal | Update event |
| DELETE | `/api/events/:id` | Admin/Principal | Delete event |

### Notifications
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/notifications` | Public | List published notifications |
| POST | `/api/notifications` | Admin/Principal | Create notification |
| PUT | `/api/notifications/:id` | Admin/Principal | Update notification |
| DELETE | `/api/notifications/:id` | Admin/Principal | Delete notification |

### Syllabus
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/syllabus` | Public | List published syllabus |
| POST | `/api/syllabus` | Admin/Principal | Create syllabus entry |
| PUT | `/api/syllabus/:id` | Admin/Principal | Update syllabus |
| DELETE | `/api/syllabus/:id` | Admin/Principal | Delete syllabus |

### Fees
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/fee-structure` | Public | List fee structures |
| POST | `/api/fee-structure` | Admin/Principal | Create fee entry |
| PUT | `/api/fee-structure/:id` | Admin/Principal | Update fee |
| DELETE | `/api/fee-structure/:id` | Admin/Principal | Delete fee |

### Gallery
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/gallery` | Public | List gallery images |
| POST | `/api/gallery` | Admin/Principal | Add gallery image |
| DELETE | `/api/gallery/:id` | Admin/Principal | Delete image |
| POST | `/api/upload` | Admin/Principal | Upload image file (base64) |

### Users
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/users` | Admin/Principal | List all users |
| PUT | `/api/users/:id` | Admin | Update user |
| DELETE | `/api/users/:id` | Admin | Delete user |

### Other
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/admission-inquiries` | Public | Submit admission inquiry |
| GET | `/api/admission-inquiries` | Admin | List inquiries |
| POST | `/api/contact` | Public | Submit contact message |
| GET | `/api/contact-messages` | Admin | List messages |
| GET | `/api/settings` | Public | Get site settings |
| POST | `/api/settings` | Admin | Update site settings |

---

## Deployment

### Vercel (Recommended)

See the [Deployment on Vercel](#deployment-on-vercel-recommended) section above for step-by-step instructions.

### VPS / Dedicated Server (with Caddy)

```caddyfile
:81 {
    reverse_proxy localhost:3000
}
```

To deploy on a VPS:
1. Copy the project to your server
2. Install Node.js dependencies (`npm install`)
3. Set up PostgreSQL and configure `DATABASE_URL` in `.env`
4. Initialize the database (`npx prisma db push`)
5. Configure Caddy to proxy to the Node.js server
6. Start the server with `npm start` or `./start-server.sh`

---

## License

This project is developed for **Saint Mary School, Rajula, Amreli, Gujarat**.
