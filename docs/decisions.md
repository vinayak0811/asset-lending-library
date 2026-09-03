# Decisions

## Decision 1: Next.js Monolith vs Separate Frontend/Backend

**Chose**: Single Next.js 14 App Router project containing both API routes and React pages.

**Rejected**: Separate Express.js backend + standalone React SPA.

**Why**: For a team of one building in 12 hours, a monolith eliminates an entire category of problems — CORS configuration, separate deployment pipelines, coordinating two `package.json` files, keeping type definitions in sync across repos. Next.js App Router gives me file-based API routing that co-locates server logic with the pages that consume it. The entire application deploys as one unit to one host.

**Trade-off**: If this system needed to scale the API and UI independently (e.g., the API serves mobile clients too), a separate backend would be better. At this scale, it's overhead.

## Decision 2: SQLite vs PostgreSQL

**Chose**: SQLite with Prisma ORM.

**Rejected**: PostgreSQL (Supabase/Neon), MySQL.

**Why**: Zero configuration. No connection strings, no managed database service, no cold-start latency, no free-tier credential management. The database is a single file (`prisma/dev.db`) that travels with the project. Prisma abstracts the SQL dialect, so switching to PostgreSQL later is literally a one-line change in `schema.prisma` (`provider = "postgresql"`) plus a connection string.

**Trade-off**: SQLite lacks full-text search (`CONTAINS` does sequential scans), has file-level write locking (no concurrent writes), and doesn't support Prisma enums (hence storing roles and statuses as plain strings). For a lending library with dozens of users and hundreds of items, none of these limitations matter. At 100x scale, PostgreSQL would be necessary.

## Decision 3: Overdue as Computed State vs Stored Status

**Chose**: Overdue is computed dynamically whenever a loan is viewed: `status === 'ISSUED' && dueDate < now`.

**Rejected**: Storing `OVERDUE` as an explicit status value in the database, updated by a cron job.

**Why**: The assignment specification explicitly requires this ("computed whenever it's viewed rather than stored as a state of its own"). Beyond compliance, it's the correct design — a loan's overdue-ness is a function of the current time, not a state transition. A cron job introduces a window where a loan is overdue but not yet marked as such. Computing it dynamically means it's always correct, with no synchronization lag.

**Trade-off**: Every query that needs to distinguish "overdue" from "issued on time" must include a date comparison. The dashboard and alerts endpoints do this with Prisma's `{ dueDate: { lt: now } }` filter, which is efficient with an index on `dueDate`.

## Decision 4: JWT Cookies vs Server-Side Sessions (Later Reversed)

**Initially chose**: Server-side sessions stored in a `Session` table, looked up by a session ID cookie.

**Reversed to**: Stateless JWT tokens stored in `httpOnly` cookies, verified with `jose`.

**Why I reversed**: After implementing the Session table, I realized it created unnecessary complexity — every API request would require a database query to validate the session, the session table needed periodic cleanup, and it added a table that had nothing to do with the business domain. JWTs are self-contained: the middleware verifies the token cryptographically without touching the database. The 7-day expiration is baked into the token itself.

**Trade-off**: JWTs can't be revoked server-side (if a user changes their password, old tokens remain valid until expiry). For a demo lending library, this is acceptable. In production, I'd add a token blacklist or shorten the TTL and use refresh tokens.

## Decision 5: Append-Only LoanEvent Table vs Audit Library

**Chose**: A dedicated `LoanEvent` table with no UPDATE or DELETE API endpoints, enforcing immutability at the application layer.

**Rejected**: Using a generic audit logging library (e.g., Prisma middleware that logs all model changes), or storing events as a JSON array inside the Loan record.

**Why**: The requirement says "nothing in this timeline can be edited or deleted after the fact, including by librarians." A separate table with explicit INSERT-only access is the clearest expression of this rule. It's queryable (e.g., "show me all events by this actor"), relational (foreign keys to Loan and User), and its immutability is enforced by simply not writing code that mutates it. A generic audit log would capture every field change on every model, which is noisy and doesn't match the requirement's notion of a curated loan timeline. A JSON array inside Loan would be hard to query and loses the relational guarantees.

**Trade-off**: The LoanEvent table grows monotonically. At very high volume, it would need archiving or partitioning. For the expected scale, it's fine.

## Decision 6: Per-Loan Alert Dismissal vs Separate Alert Table

**Chose**: A boolean `alertDismissed` column directly on the `Loan` table.

**Rejected**: A separate `DismissedAlert` table with a foreign key to Loan.

**Why**: The requirement says "if the item is later issued again and becomes overdue on the new loan, the alert returns." Since each new loan creates a new `Loan` row with `alertDismissed: false`, this behavior is automatic. The alert query is a simple filter: `status = 'ISSUED' AND dueDate < now AND alertDismissed = false`. A separate table would require an outer join and add a level of indirection for what is fundamentally a single boolean per loan.

**Trade-off**: Adds a column to the Loan table that's only relevant while the loan is active and overdue. This is minimal overhead compared to the join cost of a separate table.

## Decision 7: Bulk Operations as Sequential Processing

**Chose**: Process bulk CSV imports and bulk returns sequentially, one row/loan at a time, collecting per-item results.

**Rejected**: Wrapping the entire bulk operation in a single database transaction (all-or-nothing).

**Why**: The requirement explicitly states "the result is a per-row report naming exactly which rows failed and why, while every valid row is still imported." An all-or-nothing transaction would roll back valid rows if any row fails. Sequential processing lets each row succeed or fail independently, producing the required granular report.

**Trade-off**: Sequential processing is slower than a single batch INSERT. For the expected CSV sizes (tens to low hundreds of rows), this is imperceptible. At thousands of rows, I'd batch the valid rows after a validation pass.
