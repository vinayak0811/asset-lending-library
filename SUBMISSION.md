# Submission

Fill this in and commit it. This is the first file we open.

## Links

- **GitHub repository:** <public repo URL>
- **Live application:** <deployed URL>

## Notes for the reviewer

The application uses SQLite, so there's no external database dependency. If hosted on a free tier that sleeps on inactivity (e.g. Render), the first request may take 30–60 seconds to wake the instance. Subsequent requests will be fast.

The "Switch: Librarian / Librarian Demo / Member / Member Demo" buttons in the navbar header sign the current session out and take you to `/login` with the target account's email (and, for these demo accounts, its password) pre-filled — you still have to press "Sign In" yourself. Switching never skips authentication. A successful sign-in redirects to the dashboard, and clicking the SharedShelf logo in the navbar always takes you back to the dashboard too.

## Demo credentials

| Role | Email | Password |
|------|-------|----------|
| Librarian (full access) | librarian@example.com | password123 |
| Librarian (demo / view-only) | librarian2@example.com | password123 |
| Member (full access) | member@example.com | password123 |
| Member (demo / view-only) | member2@example.com | password123 |
| Member (3rd, full access) | member3@example.com | password123 |

There are exactly two demo accounts — one librarian, one member — and
both are **fully view-only**: they can see everything a normal account
of that role can, but no write action is available:
- The demo librarian cannot approve/issue/decline/return/mark-lost a
  loan, add a note, create/edit/archive a catalogue item, bulk import,
  add/remove a custodian, add a member, bulk-return, export CSV, or
  dismiss an alert. Member names/emails are also blurred throughout
  the UI.
- The demo member cannot submit a loan request.

All of this is enforced both in the UI (controls are hidden or replaced
with a notice) and on the server (the API returns 403 if called
directly) — so it can't be bypassed by calling the API directly either.
Every route also requires a signed-in session; there is no
unauthenticated path to view or do anything.
Every action in the app requires a signed-in session — there is no
unauthenticated path to create, approve, or modify anything.

## Stack

| Layer | What you used | Why |
|-------|---------------|-----|
| Frontend | React 18, Tailwind CSS, Recharts, Lucide Icons | React for component model and state management; Tailwind for rapid, consistent styling without CSS files; Recharts for dashboard charts; Lucide for clean icon set |
| Backend | Next.js 14 (App Router), TypeScript | Full-stack in one framework — API routes and pages co-located, type-safe end to end, no CORS headaches |
| Database | SQLite via Prisma ORM | Zero configuration, file-based, no external service needed. Prisma gives type-safe queries and easy migration to PostgreSQL if needed |
| Authentication | JWT (jose) + bcryptjs | Stateless auth via httpOnly cookies, no session store required |
| Hosting | <To be deployed — Render or Vercel> | Free tier with automatic deploys from GitHub |

## Goal checklist

Mark each honestly. Partial is fine — say what is partial.

| # | Goal | Status | Notes |
|---|------|--------|-------|
| 1 | Accounts and roles | Done | Email/password auth with JWT. LIBRARIAN and MEMBER roles enforced server-side in middleware and every API route. Members cannot issue, return, or mark lost. |
| 2 | Catalogue items | Done | Full CRUD: create with code/title/category, edit, archive/restore. Archived items hidden from default view but loan history preserved. |
| 3 | Loans | Done | Every loan belongs to one item. Carries borrower, requested date, due date. Members request; librarians can also create directly. Item detail shows full loan history. |
| 4 | Loan lifecycle with rules | Done | REQUESTED → ISSUED → RETURNED/LOST. Overdue computed dynamically. Server refuses to issue item with any open loan. Invalid transitions rejected with descriptive errors. |
| 5 | Custodians | Done | Many-to-many: librarians assigned as custodians per item. Dedicated "My Custodian Items" tab filters by current user. Custodian management in item detail modal. |
| 6 | Finding loans | Done | Server-side text search (item title, borrower name/email), status/item/borrower filters, sort by date/status/item/borrower, pagination with total count. |
| 7 | Bulk actions | Done | CSV import with per-row error report. Bulk return of selected issued loans with per-loan result. CSV export of all active loans. |
| 8 | Dashboard | Done | 4 headline numbers, loan status pie chart, custodian breakdown table, 8-week returns bar chart. |
| 9 | Immutable history | Done | Append-only LoanEvent table. Timeline shows who did what and when, with notes. No edit/delete endpoints exist. Librarians can append notes. |
| 10 | Overdue loan alerts | Done | Overdue loans appear in alerts view with count badge in navbar. Librarians can dismiss. New overdue loan on same item creates fresh undismissed alert. |

## How much time did you actually spend?

Approximately 12 hours across multiple sessions over a week, as suggested.

## What would you do next, with another 12 hours?

1. **End-to-end tests** — Playwright tests for the critical loan lifecycle flows (request → issue → overdue → return), bulk import with invalid rows, and role enforcement.
2. **Hold/reservation queue** (stretch goal) — Let members queue up for an item that's currently checked out, auto-notified when it's returned.
3. **Email reminders** — Send borrowers a reminder 2 days before their due date using a scheduled job.
4. **PostgreSQL migration** — Switch from SQLite to a hosted PostgreSQL (Neon/Supabase) for proper full-text search and concurrent writes.
5. **Optimistic UI updates** — Currently the UI re-fetches after mutations; optimistic updates would make actions feel instant.
6. **Mobile-responsive refinements** — The current layout works on mobile but could be more polished with a slide-out navigation drawer.

## What are you least happy with in this codebase, and why?

The **catalogue page** (`src/app/catalogue/page.tsx`). It's the largest file in the project — a single component handling item listing, search/filter, three tabs, create/edit/detail modals, custodian management, loan actions, and bulk import integration. It does too many things.

In production, I'd break it into smaller components: `<CatalogueGrid>`, `<ItemCard>`, `<ItemDetailDrawer>`, `<CreateItemForm>`, `<EditItemForm>`, `<CustodianManager>`, `<LoanActionPanel>`. Each would have its own file, its own state, and clear props contracts. The current monolith works and is readable, but it's the kind of file where a small change in one modal's behavior requires understanding the entire component's state.

I'm also not thrilled with the polling approach for alerts (every 10 seconds). It works, but it's wasteful — 99% of those requests return the same data. Server-sent events or WebSockets would be more elegant, but the complexity wasn't justified for this scale.
