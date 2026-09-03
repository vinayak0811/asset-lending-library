# Architecture

## System Overview

SharedShelf is a monolithic full-stack application built as a single Next.js 14 (App Router) project. The server-side API routes and the React client-side pages live in the same codebase and deploy as one unit.

```
┌─────────────────────────────────────────────────────────┐
│                      Browser (Client)                    │
│  React 18 + Tailwind CSS + Recharts + Lucide Icons       │
│  Pages: /login, /dashboard, /catalogue, /loans, /alerts  │
└──────────────────────────┬──────────────────────────────┘
                           │  HTTP (JSON / CSV)
                           ▼
┌─────────────────────────────────────────────────────────┐
│               Next.js 14 App Router (Server)             │
│  API Routes:  /api/auth/*                                │
│               /api/catalogue/*                           │
│               /api/loans/*                               │
│               /api/alerts/*                              │
│               /api/dashboard                             │
│               /api/users                                 │
│  Middleware:  JWT verification on every request           │
│  Libraries:  loan-rules.ts, csv-helper.ts, auth.ts       │
└──────────────────────────┬──────────────────────────────┘
                           │  Prisma Client (ORM)
                           ▼
┌─────────────────────────────────────────────────────────┐
│                    SQLite Database                        │
│  Tables: User, CatalogueItem, Custodian, Loan, LoanEvent │
│  File: prisma/dev.db                                     │
└─────────────────────────────────────────────────────────┘
```

## Moving Pieces

| Component | Technology | Runs Where |
|-----------|-----------|------------|
| Client-side UI | React 18, Tailwind CSS, Recharts | User's browser |
| Server-side API | Next.js API routes (Node.js) | Node.js server process |
| Authentication | JWT (jose), bcryptjs | Server + browser cookie |
| ORM | Prisma Client | Server |
| Database | SQLite (file-based) | Same machine as server |
| CSV Processing | PapaParse | Server (import) + Client (export download) |

## Request Path: Member Requests a Loan

A representative end-to-end flow:

1. **User clicks "Request Loan"** on a catalogue item card in the browser.
2. **React sends** `POST /api/loans` with `{ itemId, borrowerId }` in the request body. The `auth_token` JWT cookie is included automatically.
3. **Next.js middleware** intercepts the request, extracts the JWT from the cookie, verifies it with `jose`, and attaches the decoded user to the request context. If invalid, returns `401 JSON`.
4. **API route handler** (`src/app/api/loans/route.ts POST`) runs:
   - Calls `requireAuth()` to decode the user from the cookie.
   - Validates the request body.
   - Calls `requestLoan(itemId, borrowerId, notes)` from `loan-rules.ts`.
5. **`requestLoan` function** executes business logic:
   - Verifies the catalogue item exists and is not archived.
   - Calls `checkItemHasOpenLoan(itemId)` — queries the `Loan` table for any row with `status IN ('REQUESTED', 'ISSUED')` for this item. If found, throws an error with a descriptive message.
   - Opens a Prisma transaction:
     - Creates a new `Loan` record with `status = 'REQUESTED'`.
     - Creates a `LoanEvent` record (immutable audit entry) with `action = 'REQUESTED'`, actor, and timestamp.
   - Returns the new loan with its relations.
6. **API route** serializes the loan (with `computedStatus`) to JSON and returns `201 Created`.
7. **React component** receives the response, updates local state, and shows a success toast. The catalogue item now shows "Requested" status badge.

## What I Decided Not to Build

- **WebSocket/SSE real-time updates**: Polling every 10 seconds for alerts is simpler and sufficient for this scale. Real-time would add complexity (socket server, reconnection logic, state sync) without meaningful user benefit for a small lending library.
- **Email notifications**: Would require an email service (SendGrid, SES), template management, and delivery tracking. Noted as a stretch goal.
- **File upload for item images**: Would need blob storage (S3, Cloudinary). Items are identified by code and title, which is sufficient for the sign-out-sheet replacement scenario.
- **Separate microservices**: A single Next.js app is dramatically simpler to develop, test, deploy, and debug. At this scale (hundreds of items, dozens of users), there is no performance reason to split.
- **Redis/session store**: JWTs are stateless and fit the 7-day session window. No need for server-side session storage.
- **Rate limiting / CSRF**: Important for production but out of scope for this assessment. The JWT cookie with `httpOnly` and `sameSite` provides basic CSRF protection.
