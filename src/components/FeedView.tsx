import { FC, useState, useMemo, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Send,
  RefreshCw,
  LogIn,
  AlertCircle,
  Search,
  X,
  User,
  Clock,
} from 'lucide-react';
import { Post, UserProfile } from '../types';
import { PostItem } from './PostItem';
import { VerifiedBadge } from './VerifiedBadge';
import { usePostRateLimit } from '../utils/rateLimit';

interface FeedViewProps {
  posts: Post[];
  userProfile: UserProfile | null;
  onAddPost: (content: string) => Promise<void>;
  onLikePost: (postId: string) => void;
  onDeletePost?: (postId: string) => Promise<void> | void;
  onViewProfile: (username: string) => void;
  onOpenAuth: () => void;
  onRefreshFeed: () => void;
  isRefreshing?: boolean;
  onOpenMenu?: () => void;
}

export const FeedView: FC<FeedViewProps> = ({
  posts,
  userProfile,
  onAddPost,
  onLikePost,
  onDeletePost,
  onViewProfile,
  onOpenAuth,
  onRefreshFeed,
  isRefreshing = false,
  onOpenMenu,
}) => {
  const [content, setContent] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentUserPosts = useMemo(() => {
    if (!userProfile) return [];
    return posts.filter(
      (p) =>
        p.userId === userProfile.id ||
        p.authorUsername.toLowerCase() === userProfile.username.toLowerCase()
    );
  }, [posts, userProfile]);

  const { isRateLimited, formattedRemaining, recordPost } = usePostRateLimit(
    userProfile?.id,
    currentUserPosts
  );

  const MAX_CHARS = 300;
  const remainingChars = MAX_CHARS - content.length;
  const isOverLimit = remainingChars < 0;

  // Filtered posts based on search query
  const trimmedQuery = searchQuery.trim().toLowerCase().replace(/^@/, '');

  // Extract unique users that match the search query
  const matchingUsers = useMemo(() => {
    if (!trimmedQuery) return [];

    const userMap = new Map<string, { username: string; name: string; avatar?: string; isVerified?: boolean }>();

    // Add known users
    userMap.set('kodewt', {
      username: 'kodewt',
      name: 'kodewt',
      isVerified: true,
    });

    if (userProfile) {
      userMap.set(userProfile.username.toLowerCase(), {
        username: userProfile.username.toLowerCase(),
        name: userProfile.name,
        avatar: userProfile.avatar_url,
        isVerified: userProfile.username.toLowerCase() === 'kodewt',
      });
    }

    // Add post authors
    for (const p of posts) {
      const u = p.authorUsername.toLowerCase();
      if (!userMap.has(u)) {
        userMap.set(u, {
          username: u,
          name: p.authorName,
          avatar: p.authorAvatar,
          isVerified: p.isVerified || u === 'kodewt',
        });
      }
    }

    // Also parse @mentions from post contents to discover more users
    for (const p of posts) {
      const mentions = p.content.match(/@([a-zA-Z0-9_]+)/g);
      if (mentions) {
        for (const m of mentions) {
          const u = m.slice(1).toLowerCase();
          if (!userMap.has(u)) {
            userMap.set(u, {
              username: u,
              name: u,
              isVerified: u === 'kodewt',
            });
          }
        }
      }
    }

    return Array.from(userMap.values()).filter(
      (u) =>
        u.username.includes(trimmedQuery) ||
        u.name.toLowerCase().includes(trimmedQuery)
    );
  }, [trimmedQuery, posts, userProfile]);

  const filteredPosts = useMemo(() => {
    if (!trimmedQuery) return posts;
    return posts.filter((p) => {
      const inContent = p.content.toLowerCase().includes(trimmedQuery);
      const inUsername = p.authorUsername.toLowerCase().includes(trimmedQuery);
      const inName = p.authorName.toLowerCase().includes(trimmedQuery);
      return inContent || inUsername || inName;
    });
  }, [posts, trimmedQuery]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const toSend = content.trim();
    if (!toSend || isOverLimit || isSubmitting) return;

    if (isRateLimited) {
      setError(`rate limit active: you can only post updates once every 5 minutes (try again in ${formattedRemaining}).`);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    onAddPost(toSend)
      .then(() => {
        setContent('');
        recordPost();
      })
      .catch((err: unknown) => {
        setError((err as Error)?.message?.toLowerCase() || 'failed to post');
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto pb-24 bg-[#fbfbfa] dark:bg-[#0b0d11]">
      {/* Apple-style sticky header */}
      <header className="sticky top-0 z-20 px-4 sm:px-6 py-2.5 bg-white/85 dark:bg-[#0e1117]/85 backdrop-blur-xl border-b border-gray-200/70 dark:border-gray-800/80 select-none">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {onOpenMenu && (
              <button
                onClick={onOpenMenu}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs font-medium transition-colors cursor-pointer mr-1"
                title="menu"
                aria-label="menu"
              >
                <span className="text-xs">menu</span>
              </button>
            )}
            <h1 className="text-base font-semibold tracking-tight text-gray-900 dark:text-gray-100">
              feed
            </h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-mono">
              {filteredPosts.length}
            </span>
          </div>

          <button
            onClick={onRefreshFeed}
            disabled={isRefreshing}
            className="p-1.5 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
            title="refresh feed"
            aria-label="refresh feed"
          >
            <RefreshCw
              size={15}
              className={`${isRefreshing ? 'animate-spin text-[#007AFF]' : ''}`}
            />
          </button>
        </div>

        {/* Search Bar for Posts and Users */}
        <div className="max-w-2xl mx-auto mt-2.5">
          <div className="relative flex items-center">
            <Search
              size={14}
              className="absolute left-3 text-gray-400 dark:text-gray-500 pointer-events-none"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="search posts or @users..."
              className="w-full pl-9 pr-8 py-1.5 text-xs bg-gray-100/80 dark:bg-[#151922] border border-transparent dark:border-gray-800/80 rounded-xl text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-hidden focus:border-gray-300 dark:focus:border-gray-700 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                aria-label="clear search"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Feed Container */}
      <div className="max-w-2xl w-full mx-auto px-4 sm:px-6 py-4 space-y-4">
        {/* If user is searching, show matching users banner if any */}
        {trimmedQuery && matchingUsers.length > 0 && (
          <div className="p-3 bg-white dark:bg-[#151922] border border-gray-200/80 dark:border-gray-800/80 rounded-2xl shadow-2xs space-y-2">
            <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500">
              users found: {matchingUsers.length}
            </span>
            <div className="flex flex-wrap gap-2 pt-1">
              {matchingUsers.map((u) => (
                <button
                  key={u.username}
                  type="button"
                  onClick={() => onViewProfile(u.username)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-gray-50 hover:bg-gray-100 dark:bg-[#181d26] dark:hover:bg-[#1f2633] border border-gray-200/70 dark:border-gray-800/80 text-xs transition-colors cursor-pointer group"
                >
                  <div className="w-5 h-5 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 shrink-0 flex items-center justify-center text-[10px]">
                    {u.avatar ? (
                      <img src={u.avatar} alt={u.name} className="w-full h-full object-cover" />
                    ) : (
                      <User size={11} className="text-gray-500" />
                    )}
                  </div>
                  <span className="text-gray-800 dark:text-gray-200 group-hover:text-[#007AFF] transition-colors">
                    @{u.username}
                  </span>
                  {u.isVerified && <VerifiedBadge size="sm" />}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Post Composer */}
        <div className="bg-white dark:bg-[#151922] border border-gray-200/80 dark:border-gray-800/80 rounded-2xl p-4 shadow-2xs">
          {userProfile ? (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full overflow-hidden ring-1 ring-gray-200 dark:ring-gray-700 bg-gray-100 dark:bg-gray-800 shrink-0">
                  {userProfile.avatar_url ? (
                    <img
                      src={userProfile.avatar_url}
                      alt={userProfile.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs font-semibold text-gray-700 dark:text-gray-300">
                      {userProfile.name ? userProfile.name[0].toLowerCase() : 'u'}
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <textarea
                    rows={3}
                    value={content}
                    onChange={(e) => {
                      setContent(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="what are you thinking? share an update..."
                    maxLength={350}
                    className="w-full resize-none bg-transparent border-none p-1 text-xs text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-hidden leading-relaxed"
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-1.5 text-xs text-rose-500 px-1">
                  <AlertCircle size={13} />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800/70">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-mono transition-colors ${
                      isOverLimit
                        ? 'text-rose-500 font-bold'
                        : remainingChars < 30
                        ? 'text-amber-500'
                        : 'text-gray-400 dark:text-gray-500'
                    }`}
                  >
                    {remainingChars}
                  </span>

                  {isRateLimited && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-lg border border-amber-200/60 dark:border-amber-900/50">
                      <Clock size={11} className="shrink-0" />
                      <span>cooldown: {formattedRemaining}</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={!content.trim() || isSubmitting || isOverLimit || isRateLimited}
                    title={isRateLimited ? `You can post updates once every 5 minutes. Try again in ${formattedRemaining}.` : 'Post update'}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#007AFF] hover:bg-[#0066d6] text-white text-xs font-medium transition-all shadow-xs disabled:opacity-35 disabled:pointer-events-none active:scale-95 cursor-pointer"
                  >
                    <span>{isSubmitting ? 'posting...' : isRateLimited ? `cooldown (${formattedRemaining})` : 'post'}</span>
                    <Send size={12} />
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <div className="flex items-center justify-between gap-4 py-1">
              <div>
                <h4 className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                  join the conversation
                </h4>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  sign in to share thoughts and updates
                </p>
              </div>

              <button
                type="button"
                onClick={onOpenAuth}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#007AFF] hover:bg-[#0066d6] text-white text-xs font-medium transition-all shadow-xs shrink-0 cursor-pointer"
              >
                <LogIn size={13} />
                <span>sign in</span>
              </button>
            </div>
          )}
        </div>

        {/* Chronological Posts List */}
        <div className="space-y-3">
          <AnimatePresence>
            {filteredPosts.map((post) => (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
              >
                <PostItem
                  post={post}
                  onLike={onLikePost}
                  onViewProfile={onViewProfile}
                  onDelete={onDeletePost}
                  canDelete={Boolean(
                    userProfile &&
                      (userProfile.id === post.userId ||
                        userProfile.username.toLowerCase() ===
                          post.authorUsername.toLowerCase())
                  )}
                />
              </motion.div>
            ))}
          </AnimatePresence>

          {filteredPosts.length === 0 && (
            <div className="py-16 text-center text-gray-400 dark:text-gray-500">
              <p className="text-xs">
                {trimmedQuery ? `no posts found for "${searchQuery}"` : 'no posts yet'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
