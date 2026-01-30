# habbitApp_Backend

Serverless backend API for the HabitPulse/ChrisLO platform, designed for Vercel deployment.

**Repository**: https://github.com/wcollectiveV2/habbitApp_Backend

## 🚀 Quick Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/wcollectiveV2/habbitApp_Backend&env=DATABASE_URL,JWT_SECRET)

Or manually:

```bash
npm install -g vercel
vercel login
vercel
```

## 📋 Prerequisites

1. **Vercel Account** - [vercel.com](https://vercel.com)
2. **Neon Database** - [neon.tech](https://neon.tech) (free serverless Postgres)

## 🗄️ Database Setup (Neon)

### 1. Create Neon Database

1. Go to [neon.tech](https://neon.tech) → Sign up → Create new project
2. Copy your connection string:
   ```
   postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```

### 2. Run Database Schema

Run the `schema.sql` file in your Neon SQL Editor, or manually run:

### 2. Run Database Migrations

Connect to your Neon database and run:

```sql
-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  avatar_url TEXT,
  current_streak INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Habits table
CREATE TABLE IF NOT EXISTS habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  frequency VARCHAR(50) DEFAULT 'daily',
  target_count INT DEFAULT 1,
  category VARCHAR(100) DEFAULT 'general',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Habit logs table
CREATE TABLE IF NOT EXISTS habit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  completed_at TIMESTAMP DEFAULT NOW(),
  notes TEXT,
  UNIQUE(habit_id, user_id, (completed_at::date))
);

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  habit_id UUID REFERENCES habits(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  priority VARCHAR(50) DEFAULT 'medium',
  due_date TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_habits_user_id ON habits(user_id);
CREATE INDEX IF NOT EXISTS idx_habit_logs_habit_id ON habit_logs(habit_id);
CREATE INDEX IF NOT EXISTS idx_habit_logs_user_id ON habit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
```

### 3. Set Environment Variables in Vercel

In Vercel Dashboard → Project → Settings → Environment Variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | Neon connection string | `postgresql://user:pass@ep-xxx.neon.tech/db?sslmode=require` |
| `JWT_SECRET` | Secret for JWT tokens (min 32 chars) | `your-super-secure-random-string-here` |

## 📡 API Endpoints

### Health Check
```
GET /api/health
```

### Authentication
```
POST /api/auth/register    - Register new user
POST /api/auth/login       - Login with email/password
POST /api/auth/refresh     - Refresh access token
GET  /api/auth/me          - Get current user (requires auth)
```

### User Profile
```
GET   /api/user/profile    - Get user profile
PATCH /api/user/profile    - Update profile
GET   /api/user/stats      - Get user statistics
```

### Habits
```
GET    /api/habits              - List all habits
POST   /api/habits              - Create new habit
GET    /api/habits/:id          - Get single habit
PATCH  /api/habits/:id          - Update habit
DELETE /api/habits/:id          - Delete habit
POST   /api/habits/:id/complete - Mark habit as complete for today
```

### Tasks
```
GET   /api/tasks/today     - Get today's tasks
POST  /api/tasks           - Create new task
PATCH /api/tasks/:id       - Update task
GET   /api/tasks/history   - Get completed tasks history
```

## 🧪 Testing the API

### Test Health
```bash
curl https://your-project.vercel.app/api/health
```

### Register User
```bash
curl -X POST https://your-project.vercel.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","name":"Test User"}'
```

### Login
```bash
curl -X POST https://your-project.vercel.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

### Create Habit (with token)
```bash
curl -X POST https://your-project.vercel.app/api/habits \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"name":"Morning Run","description":"Run 5km every morning","category":"fitness"}'
```

## 🏗️ Project Structure

```
habbitApp_Backend/
├── api/
│   ├── health.ts              # Health check endpoint
│   ├── auth/
│   │   └── [...path].ts       # Auth endpoints (login, register, etc.)
│   ├── user/
│   │   └── [...path].ts       # User profile endpoints
│   ├── habits/
│   │   └── [...path].ts       # Habits CRUD endpoints
│   └── tasks/
│       └── [...path].ts       # Tasks endpoints
├── lib/
│   ├── db.ts                  # Neon database connection
│   ├── auth.ts                # JWT utilities
│   └── response.ts            # Response helpers
├── schema.sql                 # Database schema
├── vercel.json                # Vercel configuration
├── package.json
├── tsconfig.json
└── README.md
```

## 🔧 Local Development

```bash
# Install dependencies
npm install

# Create .env.local file
cp .env.example .env.local
# Edit .env.local with your Neon DATABASE_URL

# Run local dev server
npm run dev
```

The API will be available at `http://localhost:3000`.

## 📝 License

MIT

Last auto update: 2026-01-30 05:12:57 UTC by Nesslax on commit 09f0f8a1e780a88d9b1cce35daa50c4c55ed8c13
