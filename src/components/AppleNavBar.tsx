import { FC } from 'react';
import { motion } from 'motion/react';
import { Rss, MessageCircle, User } from 'lucide-react';
import { ActiveTab, UserProfile } from '../types';
import { VerifiedBadge } from './VerifiedBadge';

interface AppleNavBarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  userProfile: UserProfile | null;
}

export const AppleNavBar: FC<AppleNavBarProps> = ({
  activeTab,
  onTabChange,
  userProfile,
}) => {
  const isKodewt = userProfile?.username.toLowerCase() === 'kodewt';

  const tabs: { id: ActiveTab; label: string; icon: typeof Rss }[] = [
    { id: 'feed', label: 'feed', icon: Rss },
    { id: 'chat', label: 'chat', icon: MessageCircle },
    { id: 'profile', label: 'profile', icon: User },
  ];

  return (
    <nav
      id="apple-tab-bar"
      aria-label="Main Navigation"
      className="fixed bottom-0 inset-x-0 z-40 h-16 bg-white/85 dark:bg-[#0e1117]/85 backdrop-blur-xl border-t sm:border-x sm:rounded-t-2xl border-gray-200/80 dark:border-gray-800/80 px-6 max-w-md mx-auto shadow-lg transition-colors select-none"
    >
      <div className="flex items-center justify-around h-full">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className="relative flex flex-col items-center justify-center flex-1 py-1 group transition-all active:scale-95"
              aria-label={tab.label}
              aria-current={isActive ? 'page' : undefined}
            >
              <div className="relative flex items-center justify-center">
                {/* Special avatar indicator for profile tab */}
                {tab.id === 'profile' && userProfile?.avatar_url ? (
                  <div
                    className={`w-6 h-6 rounded-full overflow-hidden transition-all ${
                      isActive
                        ? 'ring-2 ring-[#007AFF] shadow-xs'
                        : 'ring-1 ring-gray-300 dark:ring-gray-700 opacity-75 group-hover:opacity-100'
                    }`}
                  >
                    <img
                      src={userProfile.avatar_url}
                      alt={userProfile.name}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ) : (
                  <Icon
                    size={22}
                    strokeWidth={isActive ? 2.3 : 1.8}
                    className={`transition-colors duration-200 ${
                      isActive
                        ? 'text-[#007AFF]'
                        : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300'
                    }`}
                  />
                )}

                {/* Verified badge miniature for kodewt on profile tab */}
                {tab.id === 'profile' && isKodewt && (
                  <div className="absolute -top-1 -right-2 scale-75">
                    <VerifiedBadge size="sm" />
                  </div>
                )}
              </div>

              <span
                className={`text-[10px] mt-0.5 tracking-tight font-medium transition-colors duration-200 ${
                  isActive
                    ? 'text-[#007AFF] font-semibold'
                    : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300'
                }`}
              >
                {tab.label}
              </span>

              {/* iOS Active Indicator Pill */}
              {isActive && (
                <motion.div
                  layoutId="apple-nav-indicator"
                  className="absolute -bottom-1 w-5 h-0.5 bg-[#007AFF] rounded-full"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
