import { useState, useEffect, useCallback, useMemo, useRef } from 'react';

/**
 * 5 minutes rate limit for posting updates (300,000 ms)
 */
export const POST_RATE_LIMIT_MS = 5 * 60 * 1000;

const STORAGE_KEY = 'nikilow_feed_last_post_timestamp';

/**
 * Format remaining milliseconds into a human-readable mm:ss format
 */
export function formatRemainingTime(ms: number): string {
  if (ms <= 0) return '0s';
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes > 0) {
    return `${minutes}m ${seconds < 10 ? '0' : ''}${seconds}s`;
  }
  return `${seconds}s`;
}

/**
 * Get the timestamp of the last post made by user
 */
export function getLastPostTimestamp(userId?: string): number {
  try {
    if (userId) {
      const userVal = localStorage.getItem(`${STORAGE_KEY}_${userId}`);
      if (userVal) {
        const parsed = parseInt(userVal, 10);
        if (!isNaN(parsed) && parsed > 0) return parsed;
      }
    }
    const generalVal = localStorage.getItem(STORAGE_KEY);
    if (generalVal) {
      const parsed = parseInt(generalVal, 10);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
  } catch (err) {
    console.warn('Failed to read post rate limit timestamp:', err);
  }
  return 0;
}

/**
 * Record a new post timestamp
 */
export function recordPostTimestamp(userId?: string, timestamp: number = Date.now()): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(timestamp));
    if (userId) {
      localStorage.setItem(`${STORAGE_KEY}_${userId}`, String(timestamp));
    }
  } catch (err) {
    console.warn('Failed to save post rate limit timestamp:', err);
  }
}

/**
 * Check if the user is currently rate-limited from posting updates
 */
export function getPostRateLimitStatus(
  userId?: string,
  userPosts?: { createdAt: number }[]
): {
  isRateLimited: boolean;
  remainingMs: number;
  formattedRemaining: string;
  nextAllowedTime: number;
} {
  const storedTime = getLastPostTimestamp(userId);

  // Also check if any recent post in userPosts was created within cooldown window
  let mostRecentPostTime = 0;
  if (userPosts && userPosts.length > 0) {
    for (const p of userPosts) {
      if (p.createdAt && p.createdAt > mostRecentPostTime) {
        mostRecentPostTime = p.createdAt;
      }
    }
  }

  const effectiveLastPostTime = Math.max(storedTime, mostRecentPostTime);
  if (!effectiveLastPostTime) {
    return {
      isRateLimited: false,
      remainingMs: 0,
      formattedRemaining: '0s',
      nextAllowedTime: 0,
    };
  }

  const now = Date.now();
  const elapsed = now - effectiveLastPostTime;
  const remainingMs = Math.max(0, POST_RATE_LIMIT_MS - elapsed);

  return {
    isRateLimited: remainingMs > 0,
    remainingMs,
    formattedRemaining: formatRemainingTime(remainingMs),
    nextAllowedTime: effectiveLastPostTime + POST_RATE_LIMIT_MS,
  };
}

/**
 * React hook for real-time rate limiting countdown
 */
export function usePostRateLimit(
  userId?: string,
  userPosts?: { createdAt: number }[]
) {
  // Extract the most recent post time as a primitive number
  let latestPostTime = 0;
  if (userPosts && userPosts.length > 0) {
    for (const p of userPosts) {
      const t = typeof p.createdAt === 'number' ? p.createdAt : 0;
      if (t > latestPostTime) {
        latestPostTime = t;
      }
    }
  }

  // Calculate status directly using primitive values
  const [status, setStatus] = useState(() =>
    getPostRateLimitStatus(userId, latestPostTime ? [{ createdAt: latestPostTime }] : undefined)
  );

  const userIdRef = useRef(userId);
  userIdRef.current = userId;
  const latestPostTimeRef = useRef(latestPostTime);
  latestPostTimeRef.current = latestPostTime;

  // Sync only when primitive userId or latestPostTime values change
  useEffect(() => {
    const next = getPostRateLimitStatus(
      userId,
      latestPostTime ? [{ createdAt: latestPostTime }] : undefined
    );
    setStatus((prev) => {
      if (
        prev.isRateLimited === next.isRateLimited &&
        prev.formattedRemaining === next.formattedRemaining &&
        prev.nextAllowedTime === next.nextAllowedTime
      ) {
        return prev;
      }
      return next;
    });
  }, [userId, latestPostTime]);

  // Live timer interval to update countdown second-by-second while rate limited
  useEffect(() => {
    if (!status.isRateLimited) return;

    const interval = setInterval(() => {
      const next = getPostRateLimitStatus(
        userIdRef.current,
        latestPostTimeRef.current ? [{ createdAt: latestPostTimeRef.current }] : undefined
      );
      setStatus((prev) => {
        if (
          prev.isRateLimited === next.isRateLimited &&
          prev.formattedRemaining === next.formattedRemaining &&
          prev.nextAllowedTime === next.nextAllowedTime
        ) {
          return prev;
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [status.isRateLimited]);

  const recordPost = useCallback(
    (timestamp: number = Date.now()) => {
      recordPostTimestamp(userId, timestamp);
      const next = getPostRateLimitStatus(userId, [{ createdAt: timestamp }]);
      setStatus(next);
    },
    [userId]
  );

  return useMemo(
    () => ({
      isRateLimited: status.isRateLimited,
      remainingMs: status.remainingMs,
      formattedRemaining: status.formattedRemaining,
      recordPost,
    }),
    [status, recordPost]
  );
}
