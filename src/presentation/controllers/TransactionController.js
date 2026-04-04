/**
 * TransactionController — Presentation Layer
 *
 * Thin controller — extracts HTTP request data, delegates to TransactionService.
 * All money returned as dollar strings per M2 design decision.
 */

export class TransactionController {
  /**
   * @param {import('../../application/services/TransactionService').TransactionService} transactionService
   */
  constructor(transactionService) {
    this.transactionService = transactionService;
  }

  /**
   * POST /api/v1/transactions
   */
  create = (req, res, next) => {
    try {
      const { amount, type, category, date, note } = req.body;
      const transaction = this.transactionService.create(req.user.id, {
        amount,
        type,
        category,
        date,
        note,
      });

      return res.status(201).json({
        status: 'success',
        data: { transaction },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/v1/transactions
   */
  list = (req, res, next) => {
    try {
      const filters = {
        type: req.query.type,
        category: req.query.category,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        minAmount: req.query.minAmount,
        maxAmount: req.query.maxAmount,
        search: req.query.search,
        cursor: req.query.cursor ? parseInt(req.query.cursor, 10) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit, 10) : 20,
      };

      const result = this.transactionService.list(req.user.id, filters);

      return res.status(200).json({
        status: 'success',
        data: {
          transactions: result.transactions,
          pagination: {
            nextCursor: result.nextCursor,
            hasMore: result.hasMore,
            limit: filters.limit,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/v1/transactions/:id
   */
  getById = (req, res, next) => {
    try {
      const id = parseInt(req.params.id, 10);
      const transaction = this.transactionService.getById(id, req.user.id);

      return res.status(200).json({
        status: 'success',
        data: { transaction },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * PUT /api/v1/transactions/:id
   */
  update = (req, res, next) => {
    try {
      const id = parseInt(req.params.id, 10);
      const transaction = this.transactionService.update(id, req.user.id, req.body);

      return res.status(200).json({
        status: 'success',
        data: { transaction },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * DELETE /api/v1/transactions/:id
   */
  softDelete = (req, res, next) => {
    try {
      const id = parseInt(req.params.id, 10);
      this.transactionService.softDelete(id, req.user.id);

      return res.status(200).json({
        status: 'success',
        data: { message: 'Transaction soft-deleted successfully.' },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/v1/analytics/summary
   */
  getSummary = (req, res, next) => {
    try {
      const filters = {
        type: req.query.type,
        category: req.query.category,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
      };

      const summary = this.transactionService.getSummary(req.user.id, filters);

      return res.status(200).json({
        status: 'success',
        data: { summary },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/v1/analytics/categories
   */
  getCategorySummary = (req, res, next) => {
    try {
      const filters = {
        type: req.query.type,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
      };

      const categories = this.transactionService.getCategorySummary(
        req.user.id,
        filters
      );

      return res.status(200).json({
        status: 'success',
        data: { categories },
      });
    } catch (error) {
      next(error);
    }
  };
}
