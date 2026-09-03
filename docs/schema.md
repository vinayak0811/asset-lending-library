# Database Schema

## Entity-Relationship Diagram

```
User 1──────────┤ Custodian ├──────────1 CatalogueItem
 │                                           │
 │ (borrower)                                │
 │                                           │
 └──────────────┤   Loan   ├─────────────────┘
                     │
                     │ (1:many)
                     │
                ┤ LoanEvent ├
                     │
                     │ (actor)
                     │
                   User
```

## Tables

### User

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT (UUID) | PRIMARY KEY, DEFAULT uuid() | Unique identifier |
| email | TEXT | UNIQUE, NOT NULL | Login email address |
| passwordHash | TEXT | NOT NULL | bcrypt-hashed password |
| name | TEXT | NOT NULL | Display name |
| role | TEXT | NOT NULL, DEFAULT 'MEMBER' | 'LIBRARIAN' or 'MEMBER' |
| createdAt | DATETIME | NOT NULL, DEFAULT now() | Account creation timestamp |
| updatedAt | DATETIME | NOT NULL, auto-updated | Last modification timestamp |

### CatalogueItem

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT (UUID) | PRIMARY KEY, DEFAULT uuid() | Unique identifier |
| code | TEXT | UNIQUE, NOT NULL | Human-readable asset code (e.g., CAM-001) |
| title | TEXT | NOT NULL | Item name |
| category | TEXT | NOT NULL | Category grouping |
| description | TEXT | NULLABLE | Optional description |
| isArchived | BOOLEAN | NOT NULL, DEFAULT false | Soft-delete flag |
| createdAt | DATETIME | NOT NULL, DEFAULT now() | Creation timestamp |
| updatedAt | DATETIME | NOT NULL, auto-updated | Last modification timestamp |

### Custodian (Join Table)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT (UUID) | PRIMARY KEY, DEFAULT uuid() | Unique identifier |
| userId | TEXT | FOREIGN KEY → User.id, ON DELETE CASCADE | Librarian user |
| itemId | TEXT | FOREIGN KEY → CatalogueItem.id, ON DELETE CASCADE | Catalogue item |
| createdAt | DATETIME | NOT NULL, DEFAULT now() | Assignment timestamp |

**Unique constraint**: `@@unique([userId, itemId])` — a librarian can only be assigned once per item.

### Loan

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT (UUID) | PRIMARY KEY, DEFAULT uuid() | Unique identifier |
| itemId | TEXT | FOREIGN KEY → CatalogueItem.id, ON DELETE RESTRICT | Borrowed item |
| borrowerId | TEXT | FOREIGN KEY → User.id, ON DELETE RESTRICT | Borrowing member |
| status | TEXT | NOT NULL, DEFAULT 'REQUESTED' | REQUESTED, ISSUED, RETURNED, or LOST |
| requestedDate | DATETIME | NOT NULL, DEFAULT now() | When the loan was requested |
| issuedDate | DATETIME | NULLABLE | When the loan was issued |
| dueDate | DATETIME | NULLABLE | When the item is due back |
| returnedDate | DATETIME | NULLABLE | When the item was actually returned |
| notes | TEXT | NULLABLE | Optional notes |
| alertDismissed | BOOLEAN | NOT NULL, DEFAULT false | Whether the overdue alert has been dismissed |
| createdAt | DATETIME | NOT NULL, DEFAULT now() | Record creation timestamp |
| updatedAt | DATETIME | NOT NULL, auto-updated | Last modification timestamp |

### LoanEvent (Immutable Audit Log)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT (UUID) | PRIMARY KEY, DEFAULT uuid() | Unique identifier |
| loanId | TEXT | FOREIGN KEY → Loan.id, ON DELETE RESTRICT | Parent loan |
| actorId | TEXT | FOREIGN KEY → User.id, ON DELETE RESTRICT | Who performed the action |
| action | TEXT | NOT NULL | REQUESTED, ISSUED, RETURNED, LOST, ALERT_DISMISSED, NOTE_ADDED |
| notes | TEXT | NULLABLE | Description or note text |
| timestamp | DATETIME | NOT NULL, DEFAULT now() | When the event occurred |

**No UPDATE or DELETE API exists for LoanEvent.** The table is append-only by design — this is the "history you cannot rewrite" requirement. The `ON DELETE RESTRICT` foreign keys prevent cascading deletions from destroying audit trails.

## Relationships

| Relationship | Type | Description |
|--------------|------|-------------|
| User → Loan | One-to-Many | A user (borrower) has many loans |
| CatalogueItem → Loan | One-to-Many | An item has many loans over its lifetime |
| User ↔ CatalogueItem (via Custodian) | Many-to-Many | Librarians assigned as custodians |
| Loan → LoanEvent | One-to-Many | Each loan has an append-only event timeline |
| User → LoanEvent | One-to-Many | A user (actor) creates many audit events |

## Constraints: Database vs Application

### Enforced by Database
- Primary key uniqueness (all tables)
- `User.email` uniqueness
- `CatalogueItem.code` uniqueness
- `Custodian` unique compound key `(userId, itemId)`
- Foreign key referential integrity with `ON DELETE RESTRICT` (prevents orphaned loans/events)
- `ON DELETE CASCADE` for custodian assignments (removing a user or item cleans up assignments)
- Non-null constraints on required fields

### Enforced by Application (loan-rules.ts)
- Loan state machine transitions (REQUESTED → ISSUED → RETURNED/LOST)
- Single open loan per item invariant (checked before issuing)
- Dynamic overdue computation (ISSUED + past due date)
- Role-based access control (LIBRARIAN vs MEMBER)
- Alert dismissal logic (only overdue loans can be dismissed)
- Immutability of LoanEvent records (no update/delete endpoints exist)

## Deliberate Denormalization

- **`Loan.alertDismissed`**: Stores whether a librarian has dismissed the overdue alert for this specific loan. This could be a separate table (`DismissedAlert`), but since dismissal is a per-loan, binary state that's only relevant while the loan is active, a boolean column avoids an unnecessary join for what is essentially metadata about the loan itself.

- **`Loan.status` includes terminal states**: RETURNED and LOST are stored as the loan status rather than being inferred from events. This allows efficient querying (find all issued loans, count returned loans this week) without scanning the event log. The event log remains the source of truth for the timeline, but the loan record provides the queryable current state.

## What Would Break First at 100x the Data

1. **Dashboard aggregation queries**: The dashboard computes metrics by scanning all loans and all custodians. At 100x (tens of thousands of loans, hundreds of items), the `COUNT` queries and the 8-week weekly return aggregation would slow down. **Fix**: Materialized views or a pre-computed stats table updated by triggers/cron.

2. **Loan search with text matching**: SQLite's `CONTAINS` does sequential scans. At 100x data volume, the search across item titles and borrower names would degrade. **Fix**: Switch to PostgreSQL with `pg_trgm` index, or add a full-text search index.

3. **SQLite concurrency**: SQLite uses file-level locking. Under concurrent write load from many librarians, write contention would appear. **Fix**: Migrate to PostgreSQL (Prisma makes this a one-line datasource change).

4. **Seed script performance**: The sequential seed creates records one-by-one in transactions. At 100x, this would be slow. **Fix**: Use `createMany` and batch inserts.

5. **Alert polling**: Every navigation triggers an alert count query. At scale, this per-request overhead compounds. **Fix**: Cache the alert count in Redis with a short TTL, or use a pre-computed counter column.
