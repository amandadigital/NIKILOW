import {
  FC,
  useState,
  useRef,
  useEffect,
  KeyboardEvent,
  ChangeEvent,
} from 'react';
import {
  Send,
  Square,
  ArrowDown,
  Sparkles,
  RefreshCw,
  LogIn,
  User,
  Menu,
} from 'lucide-react';
import {
  Message,
  UserProfile,
  CompanionPersonality,
  DEFAULT_NIKILOW_AVATAR,
} from '../types';
import { MessageItem } from './MessageItem';
import { VerifiedBadge } from './VerifiedBadge';

interface ChatAreaProps {
  messages: Message[];
  isStreaming: boolean;
  onSendMessage: (text: string) => void;
  onStopStreaming: () => void;
  onOpenMenu: () => void;
  onNewChat: () => void;
  userProfile: UserProfile | null;
  onOpenProfile: () => void;
  onOpenAuth: () => void;
  personality: CompanionPersonality;
  onMentionClick?: (username: string) => void;
}

export const ChatArea: FC<ChatAreaProps> = ({
  messages,
  isStreaming,
  onSendMessage,
  onStopStreaming,
  onOpenMenu,
  onNewChat,
  userProfile,
  onOpenProfile,
  onOpenAuth,
  personality,
  onMentionClick,
}) => {
  const [inputText, setInputText] = useState('');
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isKodewt =
    userProfile &&
    (userProfile.username.toLowerCase() === 'kodewt' ||
      userProfile.name.toLowerCase().includes('kodewt'));

  const companionName = personality.name || 'nikilow';
  const companionAvatar = personality.avatarUrl || DEFAULT_NIKILOW_AVATAR;

  const starters = isKodewt
    ? [
        `hey ${companionName.toLowerCase()}, how are you today?`,
        'what are you thinking about right now?',
        'tell me what you did today.',
        'did you get enough sleep last night?',
        'tell me a thoughtful thought.',
      ]
    : [
        "what's on your mind today?",
        'do you ever overthink the smallest things?',
        'recommend a song for quiet nights.',
        'tell me an honest truth about the world.',
        'what made you smile recently?',
      ];

  // Auto-scroll when messages change or stream updates
  useEffect(() => {
    if (!showScrollBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isStreaming, showScrollBottom]);

  // Handle scroll position detection
  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } =
      scrollContainerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 120;
    setShowScrollBottom(!isNearBottom);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowScrollBottom(false);
  };

  const handleInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    // Auto-resize
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        180
      )}px`;
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    const text = inputText.trim();
    if (!text || isStreaming) return;
    onSendMessage(text);
    setInputText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#fbfbfa] dark:bg-[#0b0d11] relative pb-16">
      {/* Top navigation header */}
      <header className="h-14 flex items-center justify-between px-3 sm:px-4 border-b border-gray-200/70 dark:border-gray-800/80 bg-white/70 dark:bg-[#0e1117]/70 backdrop-blur-md z-10 select-none">
        <div className="flex items-center gap-2.5">
          {/* Menu button in Nikilow's header (opens modal menu) */}
          <button
            id="chat-menu-btn"
            onClick={onOpenMenu}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs font-medium transition-colors cursor-pointer"
            title="chats & menu"
            aria-label="chats & menu"
          >
            <Menu size={15} />
            <span className="text-xs font-medium">menu</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenMenu}
              className="relative w-8 h-8 rounded-full overflow-hidden ring-1 ring-gray-200 dark:ring-gray-700 shadow-2xs hover:ring-2 hover:ring-[#007AFF] transition-all cursor-pointer bg-gray-100 dark:bg-gray-800"
              title={`${companionName} settings & menu`}
            >
              <img
                src={companionAvatar}
                alt={companionName}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  e.currentTarget.src = DEFAULT_NIKILOW_AVATAR;
                }}
              />
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-1.5 ring-white dark:ring-[#0e1117]" />
            </button>

            <div className="flex items-center gap-1.5">
              <h1 className="text-sm font-semibold text-gray-900 dark:text-gray-100 tracking-tight truncate max-w-[140px] sm:max-w-none">
                {companionName}
              </h1>
              {isKodewt && companionName.toLowerCase() === 'nikilow' && (
                <VerifiedBadge size="sm" />
              )}
              <span className="text-[11px] text-gray-400 dark:text-gray-500 ml-1">
                online
              </span>
            </div>
          </div>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-2">
          {userProfile ? (
            <button
              onClick={onOpenProfile}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200/80 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-medium transition-colors cursor-pointer"
              title="open profile"
            >
              {userProfile.avatar_url ? (
                <img
                  src={userProfile.avatar_url}
                  alt={userProfile.name}
                  className="w-4 h-4 rounded-full object-cover"
                />
              ) : (
                <User size={13} />
              )}
              <span className="hidden sm:inline">@{userProfile.username}</span>
              {isKodewt && <VerifiedBadge size="sm" />}
            </button>
          ) : (
            <button
              onClick={onOpenAuth}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-900 hover:bg-gray-800 dark:bg-gray-100 dark:hover:bg-white text-white dark:text-gray-900 text-xs font-medium transition-colors shadow-2xs cursor-pointer"
            >
              <LogIn size={13} />
              <span>sign in</span>
            </button>
          )}

          <button
            onClick={onNewChat}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
            title="start new conversation"
          >
            <RefreshCw size={13} />
            <span className="hidden sm:inline">new chat</span>
          </button>
        </div>
      </header>

      {/* Main chat messages view */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-2 py-4 space-y-2 scroll-smooth"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center max-w-xl mx-auto px-4 text-center select-none">
            {/* Companion Photo Avatar */}
            <div className="relative w-20 h-20 rounded-3xl overflow-hidden ring-2 ring-gray-200 dark:ring-gray-700 shadow-lg mb-4 bg-gray-100 dark:bg-gray-800">
              <img
                src={companionAvatar}
                alt={companionName}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  e.currentTarget.src = DEFAULT_NIKILOW_AVATAR;
                }}
              />
              <span className="absolute bottom-1 right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#151922]" />
            </div>

            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 tracking-tight mb-1.5 flex items-center justify-center gap-1.5">
              <span>
                {isKodewt && companionName.toLowerCase() === 'nikilow'
                  ? 'hey kodewt'
                  : `hey, i'm ${companionName.toLowerCase()}.`}
              </span>
              {isKodewt && companionName.toLowerCase() === 'nikilow' && (
                <VerifiedBadge size="md" />
              )}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mb-7 leading-relaxed">
              thoughtful, observant, and always here to talk. what&apos;s on your mind?
            </p>

            <div className="w-full space-y-2 max-w-md">
              <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500 tracking-wider block mb-2">
                start a conversation
              </span>
              {starters.map((starter, idx) => (
                <button
                  key={idx}
                  onClick={() => onSendMessage(starter)}
                  className="w-full text-left px-3.5 py-2.5 rounded-xl text-xs text-gray-700 dark:text-gray-300 bg-white dark:bg-[#141822] border border-gray-200/80 dark:border-gray-800/80 hover:border-gray-400 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-[#181d29] transition-all shadow-2xs active:scale-[0.99] flex items-center justify-between group cursor-pointer"
                >
                  <span>{starter}</span>
                  <Sparkles
                    size={13}
                    className="text-gray-400 dark:text-gray-500"
                  />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="py-2">
            {messages.map((message, index) => {
              const isLast = index === messages.length - 1;
              return (
                <MessageItem
                  key={message.id || index}
                  message={message}
                  isStreaming={isLast && isStreaming && message.role === 'assistant'}
                  userAvatar={userProfile?.avatar_url}
                  userName={userProfile?.name}
                  userUsername={userProfile?.username}
                  companionAvatar={companionAvatar}
                  companionName={companionName}
                  onMentionClick={onMentionClick}
                />
              );
            })}
            <div ref={messagesEndRef} className="h-4" />
          </div>
        )}
      </div>

      {/* Scroll to bottom button */}
      {showScrollBottom && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-20 right-6 p-2 rounded-full bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 shadow-md border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all z-20 cursor-pointer"
          aria-label="scroll to bottom"
        >
          <ArrowDown size={16} />
        </button>
      )}

      {/* Chat Input Field (docked directly above the navigation bar) */}
      <div className="p-2 sm:p-2.5 bg-white/90 dark:bg-[#0e1117]/90 backdrop-blur-md border-t border-gray-200/70 dark:border-gray-800/70">
        <div className="max-w-3xl mx-auto relative flex items-end gap-2 bg-gray-100 dark:bg-[#181d26] rounded-2xl p-1.5 pl-3 border border-transparent focus-within:border-gray-300 dark:focus-within:border-gray-700 transition-all">
          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={`message ${companionName.toLowerCase()}...`}
            rows={1}
            className="flex-1 max-h-36 resize-none bg-transparent border-none text-xs sm:text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-hidden py-1 leading-relaxed"
          />

          {isStreaming ? (
            <button
              onClick={onStopStreaming}
              className="p-2 rounded-xl bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors shrink-0 cursor-pointer"
              title="stop response"
            >
              <Square size={16} className="fill-current" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!inputText.trim()}
              className="p-2 rounded-xl bg-[#007AFF] hover:bg-[#0066d6] text-white disabled:opacity-30 disabled:pointer-events-none transition-all shrink-0 cursor-pointer shadow-xs active:scale-95"
              title="send message"
            >
              <Send size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

