/**
 * ITransactionRepository — Repository Interface (Application Layer)
 *
 * Contract for transaction data access.
 * All monetary values are in cents (BIGINT-safe integers).
 * All read queries MUST filter by deleted_at IS NULL (soft-delete aware).
 *
 * Supports multi-criteria filtering per DEVELOPMENT_SPEC.md Section IV:
 * - Date range: startDate, endDate (YYYY-MM-DD)
 * - Category: exact match
 * - Type: 'income' or 'expense'
 * - Amount threshold: minAmount, maxAmount (in cents)
 */

/**
 * @typedef {object} TransactionFilters
 * @property {string}  [startDate]  - YYYY-MM-DD
 * @property {string}  [endDate]    - YYYY-MM-DD
 * @property {string}  [category]   - Exact category match
 * @property {string}  [type]       - 'income' or 'expense'
 * @property {number}  [minAmount]  - Minimum amount in cents
 * @property {number}  [maxAmount]  - Maximum amount in cents
 * @property {string}  [search]     - Keyword search in note field
 * @property {string}  [sortBy]     - Column to sort by (date, amount)
 * @property {string}  [sortOrder]  - 'asc' or 'desc'
 * @property {number}  [limit]      - Page size
 * @property {number}  [offset]     - Offset for pagination
 */

/**
 * @typedef {object} TransactionSummary
 * @property {number} totalIncome   - Sum of income amounts in cents
 * @property {number} totalExpense  - Sum of expense amounts in cents
 * @property {number} netBalance    - totalIncome - totalExpense (in cents)
 * @property {number} transactionCount - Total number of matching transactions
 */

export const ITransactionRepository = {
  findById: 'findById(id) → Transaction | null (soft-delete aware)',
  findByUserId: 'findByUserId(userId, filters?) → { transactions: Transaction[], total: number }',
  create: 'create({ userId, type, category, amountInCents, note, date }) → Transaction',
  update: 'update(transaction) → Transaction',
  softDelete: 'softDelete(id) → boolean',
  getSummary: 'getSummary(userId, filters?) → TransactionSummary (all values in cents)',
};
