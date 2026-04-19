// Security: Simple in-memory rate limiting (10 requests per minute per IP)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
export const RATE_LIMIT_WINDOW = 60000; // 1 minute in ms
export const RATE_LIMIT_MAX_REQUESTS = 10;

export function checkRateLimit(ip: string, maxRequests: number = RATE_LIMIT_MAX_REQUESTS): boolean {
  const now = Date.now();
  // Use a per-(ip, maxRequests) key so different limits don't share the same bucket
  const key = `${ip}:${maxRequests}`;
  const userLimit = rateLimitMap.get(key);

  if (!userLimit || now > userLimit.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (userLimit.count >= maxRequests) {
    return false;
  }

  userLimit.count++;
  return true;
}

// Cleanup old rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  rateLimitMap.forEach((limit, ip) => {
    if (now > limit.resetTime) {
      rateLimitMap.delete(ip);
    }
  });
}, 300000);
