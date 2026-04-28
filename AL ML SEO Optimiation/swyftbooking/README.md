# SwyftBooking — AI + ML + SEO Platform

This repo is a working scaffold based on your `AI ML SEO Optimization.docx` requirements:

- Microservices (Node.js + MongoDB + Redis)
- AI content generation (`POST /api/ai/generate-content`)
- SEO page service (`GET /api/seo/:slug`)
- Pricing service (`GET /api/pricing/:route`)
- Prediction service (`GET /api/predict/:route`)
- Analytics tracking (`POST /api/track`)
- Next.js frontend with SEO pages (`/flights/[slug]`) + JSON-LD schema injection

## Run locally (Docker)

1. Copy env:

```bash
cp .env.example .env
```

2. Start stack:

```bash
docker compose up --build
```

3. Seed routes (once):

```bash
node scripts/seedRoutes.mjs
```

Open:

- Frontend: `http://localhost:3000`
- Gateway health: `http://localhost:5000/health`

## Run locally (no Docker)

Start MongoDB + Redis locally, then:

```bash
npm install
npm run seed:routes
npm run dev
```

