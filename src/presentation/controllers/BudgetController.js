/**
 * BudgetController — Presentation Layer
 *
 * Thin controller for budget management.
 * Users can set, view, and delete their own budgets.
 */

export class BudgetController {
  /**
   * @param {import('../../application/services/BudgetService').BudgetService} budgetService
   */
  constructor(budgetService) {
    this.budgetService = budgetService;
  }

  /**
   * POST /api/v1/budgets — Set or update a budget
   */
  setBudget = (req, res, next) => {
    try {
      const { category, limit, yearMonth } = req.body;
      const budget = this.budgetService.setBudget(req.user.id, {
        category,
        limit,
        yearMonth,
      });

      return res.status(200).json({
        status: 'success',
        data: { budget },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/v1/budgets?yearMonth=2026-04 — List budgets with remaining
   */
  getBudgets = (req, res, next) => {
    try {
      const yearMonth = req.query.yearMonth;
      const budgets = this.budgetService.getBudgets(req.user.id, yearMonth);

      return res.status(200).json({
        status: 'success',
        data: { budgets },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * DELETE /api/v1/budgets/:id — Remove a budget
   */
  deleteBudget = (req, res, next) => {
    try {
      const id = parseInt(req.params.id, 10);
      this.budgetService.deleteBudget(id, req.user.id);

      return res.status(200).json({
        status: 'success',
        data: { message: 'Budget deleted successfully.' },
      });
    } catch (error) {
      next(error);
    }
  };
}
