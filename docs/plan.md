# Development Plan

## How the Work Was Split

### Session 1 — Foundation & Data Layer (Estimated: 2h, Actual: ~2h)
**Goal**: Get the database schema right, the ORM configured, and basic auth working.

**Order of build**:
1. Project scaffolding (Next.js, TypeScript, Tailwind, Prisma)
2. Prisma schema design — all 5 tables with relations and constraints
3. Type definitions (`src/types/index.ts`) — shared DTOs between server and client
4. Auth library (`src/lib/auth.ts`) — JWT creation, verification, cookie management
5. Prisma client singleton (`src/lib/prisma.ts`)

**Why this order**: The schema drives everything. Getting the data model right before writing any business logic prevents costly rework. Types come next because they're the contract between API and UI.

### Session 2 — Business Logic & Core API Routes (Estimated: 3h, Actual: ~3h)
**Goal**: Implement all loan lifecycle rules and the API surface.

**Order of build**:
1. `loan-rules.ts` — state machine, transition validation, overdue computation, open-loan check
2. `csv-helper.ts` — CSV import/export with PapaParse
3. Auth API routes (`/api/auth/login`, `/logout`, `/me`)
4. Catalogue API routes (`/api/catalogue`, `/catalogue/[id]`, `/catalogue/import`)
5. Loans API routes (`/api/loans`, `/loans/[id]`, `/loans/[id]/transition`)
6. Bulk operations (`/api/loans/bulk-return`, `/api/loans/export`)
7. Alerts API (`/api/alerts`, `/alerts/[loanId]/dismiss`)
8. Dashboard API (`/api/dashboard`)
9. Users API (`/api/users`)
10. Next.js middleware for route protection

**Why this order**: Business rules first because they're the hardest to get right and the most likely to surface design issues. Auth routes before domain routes because everything depends on authentication. Catalogue before loans because loans reference items.

### Session 3 — Seed Data (Estimated: 1h, Actual: ~1h)
**Goal**: Create realistic demo data that exercises every feature.

1. Seed script with 5 users, 16 items, custodian assignments, 10 loans with varied statuses
2. Each loan has proper audit events
3. Overdue loans seeded with past due dates and `alertDismissed: false`

**Why**: The seed data is essentially an integration test — if the seed runs without violating constraints, the schema is internally consistent.

### Session 4 — Frontend Components & Pages (Estimated: 4h, Actual: ~4h)
**Goal**: Build the complete UI.

**Order of build**:
1. Auth context (`AuthContext.tsx`) — global auth state with login/logout/switch
2. Shared components — `Navbar`, `StatusBadge`, `LoanTimeline`, `BulkImportModal`
3. Root layout and login page
4. Dashboard page — metric cards, pie chart, bar chart, custodian table
5. Catalogue page — item grid, create/edit/detail modals, request/issue, custodian management
6. Loans page — search/filter/sort/paginate, bulk return, CSV export, detail modal
7. Alerts page — overdue list, dismiss/return/mark-lost actions

**Why this order**: Context and shared components first because every page depends on them. Dashboard is the simplest page (read-only), so it's a good first validation that the API layer works. Catalogue is the most complex page (CRUD + modals + loan actions), so it goes next while there's still energy for it. Loans page builds on patterns established in catalogue.

### Session 5 — Documentation, Polish, Deployment (Estimated: 2h, Actual: ~2h)
1. All 5 required docs under `docs/`
2. `SUBMISSION.md` with demo credentials and checklist
3. `README.md` with setup instructions
4. Final testing and bug fixes
5. Deployment to free host

## What I Cut When Running Short

Nothing was cut — all 10 goals are implemented. The stretch ideas (holds, fees, barcode scanning, etc.) were deliberately not attempted so that the core 10 could be done thoroughly.

## Estimate vs Actual

| Session | Estimated | Actual | Notes |
|---------|-----------|--------|-------|
| Foundation & Data | 2h | ~2h | On target. Schema required one revision (switching from Prisma enums to strings for SQLite compatibility). |
| Business Logic & API | 3h | ~3h | On target. Loan state machine was the trickiest part — spent extra time validating edge cases. |
| Seed Data | 1h | ~1h | On target. |
| Frontend | 4h | ~4h | On target. Catalogue page was the most complex (large file with many modals). |
| Docs & Polish | 2h | ~2h | On target. |
| **Total** | **12h** | **~12h** | |
