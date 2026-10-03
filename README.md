# Remedia — Homeopathy Clinical Assistant

Next.js 15 clinical workspace for Classical Homeopathy and Electro-Homeopathy consultations, backed by Supabase Auth/Postgres and the Vercel AI SDK.

## Stack

- Next.js 15 (App Router)
- Supabase (`@supabase/ssr`, Auth, PostgreSQL + RLS)
- Tailwind CSS
- Vercel AI SDK (`ai`, `@ai-sdk/google`)

## Setup

1. Copy env vars:

```bash
cp .env.example .env.local
```

Fill in:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `GOOGLE_GENERATIVE_AI_API_KEY` (from [Google AI Studio](https://aistudio.google.com/apikey))

2. Run the SQL migration in the Supabase SQL editor:

`supabase/migrations/001_patients_consultations.sql`

3. Install and run:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Features

- Email/password login with middleware protecting `/`
- Patient sidebar search + new patient modal
- Consultation form with up to 10 structured symptoms (Location, Sensation, Modality, Concomitant)
- Streaming AI analysis via `/api/analyze`
- Editable remedy/potency finalization saved to `consultations`
