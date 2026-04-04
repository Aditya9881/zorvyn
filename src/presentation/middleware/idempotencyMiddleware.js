/**
 * Idempotency Middleware — Presentation Layer
 *
 * Prevents duplicate POST /transactions creation.
 * Reads the `Idempotency-Key` header. If a cached response exists
 * for that key+user, returns it immediately. Otherwise, intercepts
 * the response and caches it.
 *
 * Key is scoped per authenticated user — different users can reuse keys.
 * If no Idempotency-Key header is provided, the request proceeds normally
 * (no caching, no enforcement).
 */

/**
 * Creates idempotency middleware.
 * @param {import('../../infrastructure/repositories/SqliteIdempotencyRepository').SqliteIdempotencyRepository} idempotencyRepository
 * @returns {Function} Express middleware
 */
export function idempotency(idempotencyRepository) {
  return (req, res, next) => {
    const key = req.headers['idempotency-key'];

    // No key provided — proceed without caching
    if (!key) {
      return next();
    }

    const userId = req.user?.id;
    if (!userId) {
      return next();
    }

    // Check for cached response
    const cached = idempotencyRepository.findByKey(key, userId);
    if (cached) {
      const body = JSON.parse(cached.responseBody);
      return res.status(cached.statusCode).json(body);
    }

    // Intercept res.json to capture and cache the response
    const originalJson = res.json.bind(res);
    res.json = function (body) {
      // Only cache successful responses (2xx)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          idempotencyRepository.store(
            key,
            userId,
            res.statusCode,
            JSON.stringify(body)
          );
        } catch (error) {
          // Don't break the response if caching fails
          console.error('[IDEMPOTENCY CACHE ERROR]', error.message);
        }
      }
      return originalJson(body);
    };

    next();
  };
}
