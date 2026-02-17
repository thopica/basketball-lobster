# 🦞 Basketball Lobster

**The best basketball content, all in one feed.**

AI-curated NBA content aggregator with a clean, Hacker News-style interface.

## Tech Stack

- **Frontend:** Next.js 14 + React + Tailwind CSS + DaisyUI
- **Backend:** Next.js API Routes (serverless)
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth (Email + Google OAuth)
- **AI:** Claude API (Haiku 4.5) for summaries & curation
- **Hosting:** Vercel
- **Crawling:** Vercel Cron Jobs (every 2 hours)

## Setup Guide

### Step 1: Create Accounts

1. **Supabase** → https://supabase.com (free tier)
2. **Vercel** → https://vercel.com (free tier)
3. **Anthropic Console** → https://console.anthropic.com (pay-per-use API)
4. **GitHub** → Create a new repository for this project

### Step 2: Set Up Supabase

1. Create a new Supabase project
2. Go to **SQL Editor** → **New Query**
3. Copy the entire contents of `supabase-schema.sql` and run it
4. Go to **Settings** → **API** and note:
   - Project URL (`NEXT_PUBLIC_SUPABASE_URL`)
   - Anon public key (`NEXT_PUBLIC_SUPABASE_ANON_KEY`)
   - Service role key (`SUPABASE_SERVICE_ROLE_KEY`)

### Step 3: Set Up Google OAuth (Optional but recommended)

1. Go to Supabase → **Authentication** → **Providers** → **Google**
2. Follow the instructions to set up Google OAuth
3. Add your Vercel domain to allowed redirect URLs

### Step 4: Get API Keys

1. **Anthropic:** Go to console.anthropic.com → API Keys → Create new key
2. **YouTube (optional):** Google Cloud Console → APIs → YouTube Data API v3
3. **Cron Secret:** Generate a random string (e.g., `openssl rand -hex 32`)

### Step 5: Deploy to Vercel

1. Push this code to your GitHub repository
2. Go to Vercel → New Project → Import from GitHub
3. Add environment variables:

```
NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
SUPABASE_SERVICE_ROLE_KEY=your_key
ANTHROPIC_API_KEY=your_key
YOUTUBE_API_KEY=your_key (optional)
CRON_SECRET=your_random_secret
```

4. Deploy!

### Step 6: Test the Crawler

Trigger a manual crawl:
```
https://your-domain.vercel.app/api/cron/crawl?secret=your_cron_secret
```

The cron job will run automatically every 2 hours once deployed.

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── feed/route.ts          # Feed endpoint (sort, filter, paginate)
│   │   ├── content/[id]/route.ts  # Single content + comments
│   │   ├── vote/route.ts          # Upvote toggle
│   │   ├── comments/route.ts      # Post comments
│   │   ├── comment-vote/route.ts  # Comment upvotes
│   │   ├── submit/route.ts        # User content submission
│   │   └── cron/crawl/route.ts    # Crawl engine (cron job)
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx                   # Main feed page
├── components/
│   ├── Header.tsx
│   ├── ContentCard.tsx
│   ├── DetailView.tsx
│   ├── AuthModal.tsx
│   └── SubmitModal.tsx
├── lib/
│   ├── ai-curator.ts             # Claude API integration
│   ├── crawler.ts                # RSS/YouTube/Podcast crawler
│   ├── supabase-browser.ts       # Browser Supabase client
│   ├── supabase-server.ts        # Server Supabase client
│   ├── types.ts                  # TypeScript types
│   └── utils.ts                  # Utility functions
```

## Content Curation Model

- **Score 8-10:** Auto-published (high confidence)
- **Score 5-7:** Auto-published, flagged for review
- **Score 1-4:** Held in pending queue

Review flagged/pending content in Supabase Dashboard → Table Editor → `content`

## Monthly Cost Estimate

| Service | Cost |
|---------|------|
| Vercel | $0 (free tier) |
| Supabase | $0 (free tier) |
| Claude API (Haiku) | $3-5 |
| Domain | ~$1 |
| **Total** | **$4-6/month** |
