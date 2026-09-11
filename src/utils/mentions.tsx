import React, { ReactNode } from 'react';
import { VerifiedBadge } from '../components/VerifiedBadge';

/**
 * Parses text and converts @username mentions into clickable interactive elements.
 */
export function renderMentions(
  text: string,
  onMentionClick?: (username: string) => void
): ReactNode[] {
  if (!text) return [];

  // Match @username
  const regex = /(@[a-zA-Z0-9_]+)/g;
  const parts = text.split(regex);

  return parts.map((part, index) => {
    if (part.startsWith('@')) {
      const rawUsername = part.slice(1);
      const isKodewt = rawUsername.toLowerCase() === 'kodewt';

      return (
        <button
          key={index}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (onMentionClick) {
              onMentionClick(rawUsername);
            }
          }}
          className={`inline-flex items-center gap-1 font-medium transition-colors cursor-pointer hover:underline ${
            isKodewt
              ? 'text-[#007AFF] dark:text-[#3897f0] font-semibold'
              : 'text-[#007AFF] dark:text-[#3897f0]'
          }`}
          title={`View @${rawUsername}'s profile`}
        >
          <span>{part}</span>
          {isKodewt && <VerifiedBadge size="sm" />}
        </button>
      );
    }
    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}
