# A-Game

An open-source, NUSMods-style module planner for NUS students: drag-and-drop semester planning,
prerequisite/corequisite/preclusion checking, degree-requirement tracking, an
S/U (grade-free) budget tracker, and AI-assisted "community signal" summaries
for modules — built on the public [NUSMods API](https://api.nusmods.com).

Anyone can create their own account. There's no shared login or single PIN —
your plan, your exemptions, your degree programme are all yours alone.

## Status

Early scaffold. The schema, auth, and project shape are in place; the actual
planner UI, NUSMods integration, and community-signal pipeline are being
built next. See [Issues](../../issues) for what's in progress.

## Stack

- **Next.js** (App Router) + TypeScript
- **Prisma** + Postgres for storage
- **NextAuth** for accounts (email/password to start — OAuth providers can be
  added later)
- **NUSMods API** (`api.nusmods.com/v2`) for module data: prerequisites,
  module credits, workload, timetable
- Anthropic API (with web search) on a scheduled job, for the optional
  community-signal reports — never required to use the planner itself

## Running it locally

1. Clone the repo and install dependencies:
   ```
   npm install
   ```
2. Copy `.env.example` to `.env` and fill in your own values. **Never commit
   `.env`** — it's already gitignored. Each value's comment explains what it's
   for and how to get your own.
3. Set up the database:
   ```
   npm run db:migrate
   ```
4. Run the dev server:
   ```
   npm run dev
   ```

## A note on secrets

This project is meant to be run by anyone, with their own accounts and their
own API keys — not shared from one person's console. Nothing in this repo
should ever contain:
- a real database URL, API key, or bot token
- anyone's PIN, password, or password hash
- anyone's actual degree record, exemptions, or personal module plan

Sample/seed data in `prisma/seed.ts` (once added) uses fictional students
only. If you spot anything that looks like real personal data in a commit,
please open an issue.

## Contributing

Issues and PRs are welcome. This started as a personal tool for planning my
own NUS CS degree and is being opened up so classmates (and anyone else at
NUS) can use it for their own plan.

## License

MIT — see [LICENSE](./LICENSE).
