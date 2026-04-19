# StoryBank

Career story management platform for senior professionals. Upload interview transcripts, extract Q&A pairs with AI, build a tagged example bank, match examples to job specs, and track patterns in your interview performance.

---

## Features

- **Transcript upload** — paste text or upload a file
- **Two-pass AI extraction** — extracts Q&A pairs with source citation, verified on a second pass to reduce hallucination
- **Auto-tagging** — 14 competency categories applied automatically (leadership, commercial, technical, practice session, and more)
- **Example bank** — filter by tag, quality rating, or keyword; STAR format breakdown per example
- **Job spec matching** — paste a job description and get ranked matches with gap analysis; each gap links directly to a targeted practice session
- **Mirror effect** — surface recurring stories, phrase patterns, and a strength map across your example bank; weak categories link directly to practice
- **Practice sessions** — mock interview with AI personas; practice can be focused on a specific topic or gap from your analysis; save answers directly to your example bank afterwards
- **Consistency tracker** — detect contradictions between examples you've told in different contexts
- **AES-256-GCM encryption** — sensitive transcript and example fields encrypted at rest
- **Semantic search** — OpenAI text-embedding-3-small embeddings stored in Upstash Vector for similarity-based matching

---

## Tech Stack

- **Framework**: Next.js 14 (App Router), TypeScript
- **Database**: Turso (libSQL/SQLite), Drizzle ORM
- **Auth**: Auth.js v5 (Google OAuth)
- **AI**: Anthropic API (Claude) for extraction and analysis
- **Search**: Upstash Vector + OpenAI text-embedding-3-small embeddings
- **Styling**: Tailwind CSS, Deep Tay palette
- **Deployment**: Vercel

---

## Getting Started

```bash
git clone https://github.com/cla1redonald/ai-interview-coach.git
cd ai-interview-coach
npm install
cp .env.example .env.local
# Fill in environment variables (see below)
npm run db:migrate
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment Variables

Copy `.env.example` to `.env.local` and fill in the values:

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Anthropic API key — used for AI extraction and analysis |
| `TURSO_DATABASE_URL` | Turso database URL (`libsql://[db-name]-[org].turso.io`) |
| `TURSO_AUTH_TOKEN` | Turso auth token |
| `NEXTAUTH_SECRET` | Random secret for Auth.js JWT signing (`openssl rand -base64 32`) |
| `NEXTAUTH_URL` | App URL (`http://localhost:3000` for dev, production URL on Vercel) |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `UPSTASH_VECTOR_REST_URL` | Upstash Vector REST endpoint — required for job spec matching |
| `UPSTASH_VECTOR_REST_TOKEN` | Upstash Vector REST token |
| `OPENAI_API_KEY` | OpenAI API key for text-embedding-3-small embeddings |
| `ENCRYPTION_KEY` | AES-256-GCM encryption key (`openssl rand -base64 32`). Must be a randomly generated value, not a passphrase. If unset, encryption is disabled and data is stored as plaintext. |

---

## Architecture

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full architecture spec, including the two-pass extraction pipeline, database schema, encryption design, vector search approach, and the Unified Experience components (focus flow, save to bank).

---

## License

MIT
