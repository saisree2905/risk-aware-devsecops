/**
 * In-Memory Sliding Window Rate Limiter Middleware
 *
 * Provides IP-based rate limiting for public read-only endpoints without external dependencies.
 * Automatically cleans up stale IP tracking buckets to ensure bounded memory usage.
 * Bypassed/relaxed when NODE_ENV === 'test' to preserve test harness velocity.
 */

function createRateLimiter(options = {}) {
  const windowMs = options.windowMs || 60 * 1000; // 1 minute default
  const max = options.max || 120; // 120 requests per minute default
  const message = options.message || 'Too many requests. Please try again later.';
  const hits = new Map();

  // Periodic cleanup of expired client records every 2 minutes
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [ip, timestamps] of hits.entries()) {
      const validTimestamps = timestamps.filter(t => now - t < windowMs);
      if (validTimestamps.length === 0) {
        hits.delete(ip);
      } else {
        hits.set(ip, validTimestamps);
      }
    }
  }, Math.max(windowMs * 2, 60000));

  // Do not hold Node process open for the cleanup timer
  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }

  return function rateLimiter(req, res, next) {
    // Disable rate limiting during automated test suite runs
    if (process.env.NODE_ENV === 'test') {
      return next();
    }

    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const now = Date.now();

    const clientTimestamps = hits.get(ip) || [];
    const validTimestamps = clientTimestamps.filter(t => now - t < windowMs);

    if (validTimestamps.length >= max) {
      res.setHeader('Retry-After', Math.ceil(windowMs / 1000));
      return res.status(429).json({
        status: 'error',
        message,
        timestamp: new Date().toISOString(),
      });
    }

    validTimestamps.push(now);
    hits.set(ip, validTimestamps);

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - validTimestamps.length));

    next();
  };
}

module.exports = {
  createRateLimiter,
  publicRateLimiter: createRateLimiter({ windowMs: 60 * 1000, max: 120 }),
};
