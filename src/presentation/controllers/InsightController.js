/**
 * InsightController — Presentation Layer
 *
 * Thin controller for the AI-powered financial insights endpoint.
 */

export class InsightController {
  /**
   * @param {import('../../application/services/InsightService').InsightService} insightService
   */
  constructor(insightService) {
    this.insightService = insightService;
  }

  /**
   * GET /api/v1/analytics/ai-insights
   */
  getInsights = (req, res, next) => {
    try {
      const result = this.insightService.generateInsights(req.user.id);

      return res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}
