/**
 * AuditLogController — Presentation Layer
 *
 * Admin-only audit log visibility.
 * Wraps the existing SqliteAuditLogRepository.
 */

export class AuditLogController {
  /**
   * @param {import('../../infrastructure/repositories/SqliteAuditLogRepository').SqliteAuditLogRepository} auditLogRepository
   */
  constructor(auditLogRepository) {
    this.auditLogRepository = auditLogRepository;
  }

  /**
   * GET /api/v1/audit-logs — List audit logs with optional filters
   */
  list = (req, res, next) => {
    try {
      const filters = {
        actorId: req.query.actorId ? parseInt(req.query.actorId, 10) : undefined,
        resourceType: req.query.resourceType,
        resourceId: req.query.resourceId ? parseInt(req.query.resourceId, 10) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit, 10) : 50,
        offset: req.query.offset ? parseInt(req.query.offset, 10) : 0,
      };

      const logs = this.auditLogRepository.findAll(filters);

      return res.status(200).json({
        status: 'success',
        data: { logs, count: logs.length },
      });
    } catch (error) {
      next(error);
    }
  };
}
