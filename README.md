# SharedShelf — Asset Lending Library

A full-stack equipment lending management system built with Next.js, TypeScript, Prisma, and SQLite.

## Features

- **Role-based access**: Librarian and Member roles with server-side enforcement
- **Catalogue management**: Create, edit, archive/restore items with identifying codes
- **Loan lifecycle**: Request → Issue → Return/Lost, with server-enforced state machine
- **Dynamic overdue detection**: Computed at query time, never stale
- **Custodian assignments**: Many-to-many librarian-to-item responsibility tracking
- **Server-side search & filtering**: Text search, status/item/borrower filters, sorting, pagination
- **Bulk operations**: CSV import with per-row error reporting, multi-loan return, CSV export
- **Dashboard analytics**: Headline metrics, status breakdown chart, custodian table, 8-week trend chart
- **Immutable audit trail**: Append-only loan event timeline with actor, action, timestamp, and notes
- **Overdue alerts**: Persistent alert badges with dismissal and automatic re-appearance on new loans

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn

### Setup

```bash
# Clone the repository
git clone <repo-url>
cd asset-lending-library

# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Create and seed the database
npx prisma db push
npm run prisma:seed

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Demo Accounts

Only the two **restricted demo accounts** are exposed anywhere in the
UI (the login page's quick-sign-in buttons and the navbar's "Switch"
control):

| Role | Email | Password |
|------|-------|----------|
| Librarian (demo / restricted) | librarian2@example.com | password123 |
| Member (demo / restricted) | member2@example.com | password123 |

Both are **view-only** — they can see everything a normal account of
that role can (dashboard, catalogue, loans, and — for the librarian —
members) but cannot perform *any* write action:
- **Demo librarian**: member names/emails are blurred everywhere, and
  every mutating action — Approve & Issue, Decline, Direct Issue,
  Return, Mark Lost, Add Note, Add/Edit/Archive item, Bulk Import,
  Add/Remove Custodian, Add Member, Bulk Return, Export CSV, Dismiss
  Alert — is hidden in the UI and rejected server-side with a 403.
- **Demo member**: can browse the catalogue and view loan history, but
  cannot submit a loan request — hidden in the UI and rejected
  server-side with a 403.

The navbar's **Switch** control only ever toggles between these two
demo accounts, and does so **instantly** — no sign-in step, since
neither side has more access than the other. It is not shown for, and
cannot reach, the full-access accounts below.

#### Full-access accounts (not shown in the UI)

The full-access Librarian and Member accounts still exist in the
database (seeded by `npm run prisma:seed`) but are deliberately kept
out of the login page and the Switch control. To use one, go to
`/login` and type the credentials in manually:

| Role | Email | Password |
|------|-------|----------|
| Librarian (full access) | librarian@example.com | password123 |
| Member (full access) | member@example.com | password123 |

You must be logged in as one of the accounts above (or your own) to
perform any action; nothing is available to a signed-out visitor —
every route requires a valid session. A successful sign-in always
redirects to the dashboard, and the SharedShelf logo in the navbar
always links back to the dashboard.

## Project Structure

```
asset-lending-library/
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── seed.ts                # Demo data seeder
├── src/
│   ├── app/
│   │   ├── api/               # Server-side API routes
│   │   │   ├── auth/          # Login, logout, current user
│   │   │   ├── catalogue/     # CRUD, import
│   │   │   ├── loans/         # CRUD, transitions, bulk, export
│   │   │   ├── alerts/        # Overdue alerts, dismiss
│   │   │   ├── dashboard/     # Dashboard analytics
│   │   │   └── users/         # User listing
│   │   ├── dashboard/         # Dashboard page
│   │   ├── catalogue/         # Catalogue page
│   │   ├── loans/             # Loans management page
│   │   ├── alerts/            # Overdue alerts page
│   │   ├── login/             # Login page
│   │   ├── layout.tsx         # Root layout
│   │   ├── page.tsx           # Redirect to dashboard
│   │   └── globals.css        # Global styles
│   ├── components/            # Shared UI components
│   ├── context/               # React context (auth)
│   ├── lib/                   # Server utilities
│   │   ├── auth.ts            # JWT auth helpers
│   │   ├── loan-rules.ts      # Loan state machine
│   │   ├── csv-helper.ts      # CSV import/export
│   │   └── prisma.ts          # Prisma client singleton
│   └── types/                 # TypeScript type definitions
├── docs/                      # Required documentation
│   ├── architecture.md
│   ├── schema.md
│   ├── plan.md
│   ├── decisions.md
│   └── ai-prompts.md
├── SUBMISSION.md
└── README.md
```

## Environment Variables

Copy `.env.example` to `.env`:

```
DATABASE_URL="file:./dev.db"
JWT_SECRET="your-secret-key"
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm start` | Start production server |
| `npm run prisma:seed` | Seed database with demo data |
| `npm run prisma:generate` | Regenerate Prisma client |

## License

MIT
