# Saint Mary School - School Management Website

> A complete school management website for **Saint Mary School, Rajula, Amreli, Gujarat** (UDISE: 24131005639). Built with a lightweight Node.js server, Prisma ORM with SQLite, and pure static HTML/CSS/JS.

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
| Server | Node.js (built-in `http` module, no framework) |
| Database | SQLite via Prisma ORM |
| Frontend | Static HTML + CSS + Vanilla JavaScript |
| Auth | Cookie-based (SHA-256 hashed tokens) |
| Reverse Proxy | Caddy |

---

## Project Structure

```
saint-mary/
├── light-server.mjs            # Main HTTP server (all API routes + static files)
├── package.json                # Dependencies & scripts
├── Caddyfile                   # Caddy reverse proxy config (port 81 → 3000)
├── auth-config.json            # Admin credentials configuration
├── .env                        # Environment variables (DATABASE_URL)
├── .gitignore
├── start-server.sh             # Server auto-restart wrapper
│
├── prisma/
│   └── schema.prisma           # Database schema (9 models)
│
├── db/
│   └── custom.db               # SQLite database (auto-generated)
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

## Setup & Installation

### Prerequisites
- Node.js v18+
- npm

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/parthboricha933/saint-mary.git
cd saint-mary

# 2. Install dependencies
npm install

# 3. Set up environment
cp .env.example .env
# Edit .env and set DATABASE_URL=file:../db/custom.db

# 4. Initialize the database
npx prisma db push
npx prisma generate

# 5. Configure admin credentials
# Edit auth-config.json with your admin email and token hash

# 6. Start the server
npm start
# Server runs on http://localhost:3000
```

### NPM Scripts

```bash
npm start              # Start the server (768MB memory limit)
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

The project is configured to run behind **Caddy** as a reverse proxy:

```caddyfile
:81 {
    reverse_proxy localhost:3000
}
```

To deploy:
1. Copy the project to your server
2. Install Node.js dependencies (`npm install`)
3. Set up the database (`npx prisma db push`)
4. Configure Caddy to proxy to the Node.js server
5. Start the server with `npm start` or `./start-server.sh`

---

## License

This project is developed for **Saint Mary School, Rajula, Amreli, Gujarat**.
