/**
 * Audit Middleware — Presentation Layer
 *
 * Factory that creates middleware to log write actions (POST, PUT, DELETE)
 * for compliance tracking. Logs AFTER the response completes to avoid
 * blocking the request pipeline.
 *
 * Only logs on successful responses (2xx status codes).
 */

/**
 * Creates an audit logging middleware.
 * @param {string} action - e.g., 'CREATE', 'UPDATE', 'DELETE', 'DEACTIVATE'
 * @param {string} resourceType - e.g., 'transaction', 'user', 'role'
 * @param {import('../../infrastructure/repositories/SqliteAuditLogRepository').SqliteAuditLogRepository} auditLogRepository
 * @returns {Function} Express middleware
 */
export function audit(action, resourceType, auditLogRepository) {
  return (req, res, next) => {
    // Capture data before response
    const startData = {
      actorId: req.user?.id,
      actorEmail: req.user?.email || 'unknown',
      ipAddress: req.ip,
    };

    // Store original json method to intercept response data
    const originalJson = res.json.bind(res);
    let responseData = null;

    res.json = function (body) {
      responseData = body;
      return originalJson(body);
    };

    // Log after response finishes
    res.on('finish', () => {
      // Only log successful operations (2xx)
      if (res.statusCode < 200 || res.statusCode >= 300) return;
      if (!startData.actorId) return;

      try {
        const resourceId = req.params?.id
          ? parseInt(req.params.id, 10)
          : responseData?.data?.transaction?.id
            || responseData?.data?.user?.id
            || null;

        // Look up actor email from the user context
        // req.user only has id/roles/permissions from JWT, not email
        // We'll use a best-effort approach
        const actorEmail = startData.actorEmail;

        auditLogRepository.create({
          actorId: startData.actorId,
          actorEmail,
          action,
          resourceType,
          resourceId,
          metadata: {
            method: req.method,
            path: req.originalUrl,
            statusCode: res.statusCode,
            body: req.body || {},
          },
          ipAddress: startData.ipAddress,
        });
      } catch (error) {
        // Audit logging should never break the request flow
        console.error('[AUDIT LOG ERROR]', error.message);
      }
    });

    next();
  };
}
