# AI Prompts

## Overview

I used AI (Claude) extensively throughout this project to accelerate development. Below are the prompts I used, grouped by task, including instances where the output was wrong and what I fixed.

---

## Phase 1: Schema & Type Design

### Prompt 1.1 — Initial Prisma Schema
> "Design a Prisma schema for an asset lending library system with these entities: User (email, password, name, role), CatalogueItem (code, title, category, description, archived), Custodian (many-to-many between User and CatalogueItem), Loan (with full lifecycle: REQUESTED → ISSUED → RETURNED/LOST), and LoanEvent (immutable audit log). Use SQLite as the database."

**What I got**: A working schema, but it used Prisma `enum` types for Role and LoanStatus.

**What went wrong**: SQLite doesn't support Prisma enums — they're only available with PostgreSQL and MySQL. The schema wouldn't compile.

**What I fixed**: Changed all `enum` fields to `String` types with comments indicating valid values. This is a known Prisma/SQLite limitation that the AI didn't account for.

### Prompt 1.2 — TypeScript DTOs
> "Based on this Prisma schema, generate TypeScript type definitions for API request/response DTOs, including a DisplayStatus type that adds 'OVERDUE' as a computed status."

**Result**: Clean types generated correctly. Used as-is after minor formatting.

---

## Phase 2: Business Logic

### Prompt 2.1 — Loan State Machine
> "Implement a loan lifecycle module with these rules: REQUESTED → ISSUED (requires due date), ISSUED → RETURNED, ISSUED → LOST. Overdue is computed dynamically (ISSUED and past due date), never stored. Before issuing, check that no other loan for the same item is REQUESTED or ISSUED. Every transition creates an immutable LoanEvent. Wrap mutations in Prisma transactions."

**Result**: Good implementation. The transition validation function was comprehensive with clear error messages.

### Prompt 2.2 — CSV Import with Error Reporting *(produced wrong output)*
> "Write a CSV import function using PapaParse that validates each row (code, title, category required), checks for duplicate codes both within the CSV and against the database, and returns a per-row report of successes and failures."

**What went wrong**: The AI's first version used `Promise.all` to process all rows concurrently. This caused a race condition: if two rows in the same CSV had the same code, both could pass the duplicate check before either was inserted, resulting in a database unique constraint violation instead of a clean error message.

**What I fixed**: Changed to sequential processing with a `for` loop and a `seenCodesInBatch` Set to track codes already encountered within the current upload. This ensures intra-CSV duplicates are caught with a descriptive error message rather than a cryptic database error.

---

## Phase 3: API Routes

### Prompt 3.1 — Loans API with Server-Side Query
> "Create a Next.js API route for GET /api/loans that supports: text search over item title and borrower name/email, status filtering (including OVERDUE as a special case), item and borrower filters, sorting by due date/requested date/status/item/borrower, and pagination with total count. Members should only see their own loans. Librarians see all."

**Result**: Working implementation. The OVERDUE filter correctly translates to `status = 'ISSUED' AND dueDate < now`.

### Prompt 3.2 — Bulk Return API
> "Write a bulk return endpoint that accepts an array of loan IDs, processes each one individually, and returns a per-loan report of what succeeded and what was rejected (with specific reasons like 'already returned', 'marked as lost', 'never issued')."

**Result**: Clean implementation used as-is.

---

## Phase 4: Frontend

### Prompt 4.1 — Dashboard with Recharts *(produced wrong output)*
> "Build a dashboard page using Recharts that shows 4 metric cards, a pie chart of loan status breakdown, a custodian table, and a bar chart of returns per week over 8 weeks."

**What went wrong**: The AI generated Recharts imports that used named exports (`import { PieChart, Pie, Cell }`) but also tried to use the default export pattern, causing "PieChart is not a function" errors. It also didn't wrap the charts in `<ResponsiveContainer>`, so they rendered at 0 width.

**What I fixed**: Corrected the import statements to use only named exports, wrapped all charts in `<ResponsiveContainer width="100%" height={...}>`, and added the `"use client"` directive that was missing (Recharts requires client-side rendering).

### Prompt 4.2 — Catalogue Page with Modals
> "Build a catalogue page with: item card grid, search/filter, active/archived/custodian tabs, create/edit/detail modals with full loan management (request, issue, return, mark lost), custodian assignment, and bulk import integration."

**Result**: This was the largest single prompt. The output was ~800 lines and mostly correct. I had to fix the custodian management section, which originally sent the wrong API payload format (sent `{custodianUserIds: [...]}` instead of `{custodianIds: [...]}`).

### Prompt 4.3 — Loan Timeline Component
> "Create an immutable audit timeline component that displays LoanEvents with icons per action type, actor info, timestamps, and notes. Include a form for librarians to append permanent notes. The timeline should visually communicate that events cannot be edited or deleted."

**Result**: Good output with a lock icon and "Immutable Audit Timeline" heading. Used mostly as-is.

---

## Phase 5: Seed Data

### Prompt 5.1 — Realistic Seed Script
> "Write a Prisma seed script that creates 5 users, 16 catalogue items across 5 categories, custodian assignments, and 10 loans with varied statuses (including overdue, returned, lost, and requested). Each loan needs proper LoanEvents. Use bcryptjs to hash passwords. Make it idempotent by deleting all data first."

**Result**: Working seed script. The relative date calculations using `date-fns` were correct.

---

## Phase 6: Auth & Middleware

### Prompt 6.1 — Next.js Middleware
> "Write Next.js middleware that verifies the auth_token JWT cookie using jose on all routes except /login, /api/auth/*, /_next/*, and static files. Redirect browser requests to /login on auth failure, return 401 JSON for API requests."

**Result**: Working middleware. I adjusted the path matching patterns slightly to include `/favicon.ico`.

---

## Summary of AI Usage

- **Total prompts**: ~15 substantive prompts plus numerous follow-ups for debugging
- **Prompts that produced wrong output**: 3 (schema enums, CSV race condition, Recharts imports)
- **Approach**: I used AI as a fast first-draft generator, then reviewed and tested every line. The business logic in `loan-rules.ts` received the most manual attention because correctness there directly determines whether the system meets the requirements.
