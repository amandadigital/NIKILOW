import { FC } from 'react';

interface VerifiedBadgeProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const VerifiedBadge: FC<VerifiedBadgeProps> = ({ size = 'sm', className = '' }) => {
  const dimensions =
    size === 'lg' ? 'w-5 h-5' : size === 'md' ? 'w-4 h-4' : 'w-3.5 h-3.5';
  const iconSize = size === 'lg' ? 12 : size === 'md' ? 10 : 9;

  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 ${dimensions} rounded-full bg-[#007AFF] text-white shadow-xs select-none ${className}`}
      title="Verified Account"
      aria-label="Verified badge"
    >
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </span>
  );
};
