import { FC, useState } from 'react';
import { motion } from 'motion/react';
import { Copy, Check, User } from 'lucide-react';
import { Message, DEFAULT_NIKILOW_AVATAR } from '../types';
import { renderMentions } from '../utils/mentions';
import { VerifiedBadge } from './VerifiedBadge';

interface MessageItemProps {
  message: Message;
  isStreaming?: boolean;
  userAvatar?: string;
  userName?: string;
  userUsername?: string;
  companionAvatar?: string;
  companionName?: string;
  onMentionClick?: (username: string) => void;
}

export const MessageItem: FC<MessageItemProps> = ({
  message,
  isStreaming,
  userAvatar,
  userName,
  userUsername,
  companionAvatar,
  companionName,
  onMentionClick,
}) => {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';
  const isKodewtUser = isUser && userUsername?.toLowerCase() === 'kodewt';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const formattedTime = new Date(message.createdAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const resolvedCompanionAvatar = companionAvatar || DEFAULT_NIKILOW_AVATAR;
  const resolvedCompanionName = companionName || 'nikilow';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`group flex gap-3 px-4 py-2.5 max-w-3xl mx-auto w-full ${
        isUser ? 'justify-end' : 'justify-start'
      }`}
    >
      {/* Companion Avatar */}
      {!isUser && (
        <div className="flex-shrink-0 pt-0.5">
          <div
            className="w-8 h-8 rounded-full overflow-hidden ring-1 ring-gray-200 dark:ring-gray-700 shadow-xs select-none block bg-gray-100 dark:bg-gray-800"
            title={resolvedCompanionName}
          >
            <img
              src={resolvedCompanionAvatar}
              alt={resolvedCompanionName}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
              onError={(e) => {
                e.currentTarget.src = DEFAULT_NIKILOW_AVATAR;
              }}
            />
          </div>
        </div>
      )}

      {/* Message content container */}
      <div
        className={`flex flex-col ${
          isUser ? 'items-end' : 'items-start'
        } max-w-[85%] sm:max-w-[78%]`}
      >
        <div
          className={`relative px-4 py-2.5 rounded-2xl text-sm leading-relaxed tracking-normal whitespace-pre-wrap select-text ${
            isUser
              ? 'bg-[#007AFF] text-white rounded-tr-xs shadow-xs'
              : 'bg-white dark:bg-[#181d26] text-gray-800 dark:text-gray-200 border border-gray-200/80 dark:border-gray-800 rounded-tl-xs shadow-xs'
          }`}
        >
          {renderMentions(message.content, onMentionClick)}
          {isStreaming && (
            <span className="inline-block w-1.5 h-4 ml-1 bg-gray-400 dark:bg-gray-500 animate-pulse align-middle" />
          )}
        </div>

        {/* Footer meta: timestamp and copy button */}
        <div
          className={`flex items-center gap-2 mt-1 px-1 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-gray-400 dark:text-gray-500 ${
            isUser ? 'flex-row-reverse' : 'flex-row'
          }`}
        >
          <span className="font-mono">{formattedTime}</span>
          <button
            onClick={handleCopy}
            className="p-0.5 rounded hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            title="Copy text"
          >
            {copied ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
          </button>
        </div>
      </div>

      {/* User avatar */}
      {isUser && (
        <div className="flex-shrink-0 pt-0.5 relative">
          {userAvatar ? (
            <div className="w-8 h-8 rounded-full overflow-hidden ring-1 ring-gray-200 dark:ring-gray-700 shadow-xs select-none">
              <img
                src={userAvatar}
                alt={userName || 'User'}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center text-gray-700 dark:text-gray-300 text-xs font-semibold shadow-xs select-none">
              {userName ? userName[0].toUpperCase() : <User size={14} />}
            </div>
          )}
          {isKodewtUser && (
            <div className="absolute -bottom-1 -right-1">
              <VerifiedBadge size="sm" />
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
};

