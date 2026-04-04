# Architectural Decision Records (ADRs)

This document captures the key technical decisions made during the development of the Zorvyn financial dashboard backend, including the context, decision rationale, and consequences of each choice.

---

## ADR-001: BigInt Currency Storage (Cents)

### Status: Accepted

### Context
Financial calculations are uniquely sensitive to rounding errors that occur with standard floating-point numbers (IEEE 754). The expression `0.1 + 0.2` evaluates to `0.30000000000000004` in JavaScript, not `0.3`. When aggregating millions of transactions, these imprecisions accumulate into material balance discrepancies that undermine user trust and regulatory compliance.

Our `DEVELOPMENT_SPEC.md` (Section III) explicitly identifies this as the "Floating-Point Trap" and recommends integer storage in minor units.

### Decision
**Store all monetary values as INTEGER (cents) in the database.** `$100.00` is stored as `10000`. SQLite's INTEGER type is a signed 64-bit value, supporting amounts up to `$92,233,720,368,547,758.07` — sufficient for any real-world financial dashboard.

Conversion between dollars (API strings) and cents (DB integers) happens exclusively at the Application layer boundary:

```
Frontend → "150.75" (dollar string)
    ↓  Transaction.dollarsToCents("150.75")
Application → 15075 (integer cents)
    ↓
Database → INTEGER 15075
```

### Consequences
- **Positive:** Zero precision loss on all arithmetic. `SUM()`, `GROUP BY`, and `CASE WHEN` aggregations produce exact results.
- **Positive:** Database indexes on INTEGER columns are faster than on DECIMAL/TEXT.
- **Positive:** API returns dollar strings (`"150.75"`) — no float contamination reaches the frontend.
- **Trade-off:** Every read/write path must include conversion logic. This is centralized in `Transaction.dollarsToCents()` and `Transaction.centsToDollars()` to prevent duplication.
- **Trade-off:** DB values are not human-readable without conversion. Mitigated by clear column naming (`amount` always refers to cents in the DB context).

---

## ADR-002: Clean Architecture (4-Layer Separation)

### Status: Accepted

### Context
Financial backends require strict separation of business rules from infrastructure concerns. A tightly coupled codebase where SQL queries are embedded in controllers makes it impossible to:
- Test business logic without a database
- Swap SQLite for PostgreSQL without rewriting services
- Enforce consistent authorization across endpoints

The `DEVELOPMENT_SPEC.md` (Section I) prescribes Clean Architecture with the Repository Pattern.

### Decision
**Organize the codebase into four concentric layers with inward-pointing dependencies:**

| Layer | Directory | Responsibility | Dependencies |
|---|---|---|---|
| **Domain** | `src/domain/` | Entities, value objects, domain errors | None |
| **Application** | `src/application/` | Use-case orchestration (services) | Domain |
| **Infrastructure** | `src/infrastructure/` | SQLite repos, JWT, bcrypt | Domain |
| **Presentation** | `src/presentation/` | Express controllers, routes, middleware | Application |

**Dependency Injection** is performed in `src/index.js`, which instantiates all repositories and services, wiring them together without any layer needing to know about another's implementation.

### Consequences
- **Positive:** Domain entities are pure functions — 41 unit tests run without any database or HTTP server.
- **Positive:** Repositories are trivially swappable (SQLite → PostgreSQL) by creating a new implementation with the same interface.
- **Positive:** Services contain zero SQL and zero HTTP concepts — they're purely business logic.
- **Trade-off:** More files and indirection than a monolithic controller approach. Justified by the complexity of financial logic and the need for comprehensive testing.

---

## ADR-003: Idempotent POST Requests

### Status: Accepted

### Context
Network retries, browser double-clicks, and mobile connectivity issues can cause duplicate `POST /transactions` requests. In a financial system, creating two `$500` salary entries instead of one is a critical data integrity failure.

### Decision
**Implement client-controlled idempotency via an `Idempotency-Key` header.** The middleware intercepts `POST /transactions` and:

1. Checks if the key+userId combination exists in `idempotent_requests` table
2. If found (and non-expired): returns the **cached response** — no new record created
3. If not found: executes the handler, captures the response, and caches it

```sql
UNIQUE(idempotency_key, user_id)  -- Different users can reuse keys
expires_at TEXT NOT NULL           -- Keys expire after 24 hours
```

### Consequences
- **Positive:** Duplicate POST requests are safe — the client receives the same response without side effects.
- **Positive:** Key scoping per user prevents cross-user interference.
- **Positive:** Optional — requests without the header work normally (no enforcement).
- **Trade-off:** Adds a DB lookup on every POST. Mitigated by the `UNIQUE` index making lookups O(log n).
- **Trade-off:** 24-hour expiry means keys cannot be reused within that window. Acceptable for financial transaction deduplication.

---

## ADR-004: Immediate Token Revocation on User Deactivation

### Status: Accepted

### Context
When an Admin deactivates a user account, any active JWT tokens for that user must be immediately invalidated. Standard JWT design is stateless — tokens are valid until they expire. In a financial system, allowing a deactivated user to continue making transactions for up to 15 minutes (access token TTL) is an unacceptable security risk.

### Decision
**Maintain an in-memory `Map<userId, Set<jti>>` that tracks active token JTIs per user.** When `revokeAllUserTokens(userId)` is called during deactivation:

1. All JTIs for that user are moved to the revoked set
2. The `authenticate` middleware checks every incoming token's JTI against the revoked set
3. Revoked tokens return `401 Unauthorized` immediately

### Consequences
- **Positive:** Token revocation is instant — no 15-minute window of vulnerability.
- **Positive:** Granular — only the deactivated user's tokens are affected, not the entire system.
- **Trade-off:** In-memory store means revocation state is lost on server restart. Production deployment should use Redis. Documented in the README as a known limitation.
- **Trade-off:** Memory grows linearly with active sessions. Mitigated by periodic cleanup of expired JTIs.

---

## ADR-005: Immutable Audit Logs

### Status: Accepted

### Context
Financial compliance regulations (SOX, PCI-DSS) require an immutable record of all administrative actions. If audit logs can be modified or deleted, they lose their evidentiary value.

### Decision
**The `audit_logs` table has no `deleted_at` column and no UPDATE operations.** The `SqliteAuditLogRepository` exposes only two write operations:
- `create()` — INSERT a new log entry
- (No update or delete methods exist)

The middleware captures actions non-blockingly — it writes the log entry **after** `res.finish` to avoid adding latency to the response.

```sql
CREATE TABLE audit_logs (
  ...
  -- No deleted_at column. No UPDATE statements. INSERT-only.
);
```

### Consequences
- **Positive:** Compliance-grade audit trail — entries cannot be tampered with via the API.
- **Positive:** Non-blocking write — audit logging adds zero latency to user-facing responses.
- **Trade-off:** Table grows indefinitely. Production systems should implement log rotation or archival to external storage (S3, etc.).
- **Trade-off:** No "undo" for accidental entries. This is intentional — in financial compliance, every action must be recorded permanently.
