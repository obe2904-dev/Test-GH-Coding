# Social Media SaaS - MVP

A social media management tool for small businesses, built with React, TypeScript, Tailwind CSS, and Supabase.

## Features (Current)

- ✅ User authentication (sign up, login, logout)
- ✅ Protected dashboard route
- ✅ Basic profile management
- 🚧 Post scheduler (coming next)
- 🚧 Platform connections (coming next)
- 🚧 AI content generation (coming next)

## Tech Stack

- **Frontend:** React 18 + TypeScript + Vite
- **Styling:** Tailwind CSS
- **Backend:** Supabase (Auth + PostgreSQL)
- **State:** Zustand
- **Routing:** React Router v6

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Supabase

Follow the detailed guide in `supabase/SETUP.md`:
- Create a Supabase project
- Copy API credentials to `.env`
- Run initial database migration

### 3. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 4. Create Your First Account

1. Navigate to `/signup`
2. Enter email and password
3. Check email for verification link
4. Sign in at `/login`
5. You'll be redirected to the dashboard

## Project Structure

```
src/
├── components/       # Reusable UI components
│   └── ProtectedRoute.tsx
├── pages/           # Route pages
│   ├── LoginPage.tsx
│   ├── SignUpPage.tsx
│   └── DashboardPage.tsx
├── stores/          # Zustand state management
│   └── authStore.ts
├── lib/             # Utilities and configs
│   └── supabase.ts
├── types/           # TypeScript definitions
│   └── database.ts
├── App.tsx          # Route configuration
└── main.tsx         # App entry point

supabase/
├── migrations/      # SQL migration files
│   └── 001_initial_schema.sql
└── SETUP.md        # Supabase setup guide
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Next Development Steps

See `product-requirements.md` for the full roadmap. Immediate priorities:

1. **Platform OAuth** - Connect Facebook, Instagram, LinkedIn
2. **Post Composer** - Create and schedule posts
3. **AI Content** - Generate captions and hashtags
4. **Analytics Dashboard** - Show reach, engagement, clicks

## Environment Variables

Copy `.env.example` to `.env` and configure:

```env
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Contributing

This is an MVP in active development. The structure will evolve as features are added and tested with real users.
