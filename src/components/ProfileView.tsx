import { FC, useState, useMemo, FormEvent } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  Edit3,
  LogOut,
  LogIn,
  Send,
  Sparkles,
  Heart,
  MessageSquare,
  ShieldCheck,
  Clock,
} from 'lucide-react';
import { Post, UserProfile } from '../types';
import { VerifiedBadge } from './VerifiedBadge';
import { PostItem } from './PostItem';
import { usePostRateLimit } from '../utils/rateLimit';

interface ProfileViewProps {
  currentUser: UserProfile | null;
  viewedUser: UserProfile | null;
  posts: Post[];
  onBack?: () => void;
  onEditProfile: () => void;
  onSignOut: () => void;
  onOpenAuth: () => void;
  onAddPost: (content: string) => Promise<void>;
  onLikePost: (postId: string) => void;
  onDeletePost?: (postId: string) => Promise<void> | void;
  onViewProfile: (username: string) => void;
  onStartChatWithNikilow?: () => void;
  onOpenMenu?: () => void;
}

export const ProfileView: FC<ProfileViewProps> = ({
  currentUser,
  viewedUser,
  posts,
  onBack,
  onEditProfile,
  onSignOut,
  onOpenAuth,
  onAddPost,
  onLikePost,
  onDeletePost,
  onViewProfile,
  onStartChatWithNikilow,
  onOpenMenu,
}) => {
  const [newPostContent, setNewPostContent] = useState('');
  const [isSubmittingPost, setIsSubmittingPost] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  // If viewedUser is explicitly provided, show that; otherwise show currentUser
  const profile = viewedUser || currentUser;
  const isOwnProfile =
    currentUser && profile && currentUser.username.toLowerCase() === profile.username.toLowerCase();

  const isKodewt =
    profile?.username.toLowerCase() === 'kodewt' || profile?.is_verified;

  // Posts authored by this profile
  const userPosts = useMemo(() => {
    if (!profile) return [];
    return posts.filter(
      (p) => p.authorUsername.toLowerCase() === profile.username.toLowerCase()
    );
  }, [posts, profile]);

  // Posts authored by current logged-in user (for rate limit check)
  const currentUserPosts = useMemo(() => {
    if (!currentUser) return [];
    return posts.filter(
      (p) =>
        p.userId === currentUser.id ||
        p.authorUsername.toLowerCase() === currentUser.username.toLowerCase()
    );
  }, [posts, currentUser]);

  const { isRateLimited, formattedRemaining, recordPost } = usePostRateLimit(
    currentUser?.id,
    currentUserPosts
  );

  const totalLikes = userPosts.reduce((acc, p) => acc + p.likesCount, 0);

  const handlePostSubmit = (e: FormEvent) => {
    e.preventDefault();
    const toSend = newPostContent.trim();
    if (!toSend || isSubmittingPost) return;

    if (isRateLimited) {
      setPostError(`Rate limit active: you can post updates once every 5 minutes (wait ${formattedRemaining}).`);
      return;
    }

    setIsSubmittingPost(true);
    setPostError(null);

    onAddPost(toSend)
      .then(() => {
        setNewPostContent('');
        recordPost();
      })
      .catch((err: unknown) => {
        setPostError((err as Error)?.message || 'Failed to post');
      })
      .finally(() => {
        setIsSubmittingPost(false);
      });
  };

  // Not signed in and no profile specified to view
  if (!profile) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-[#fbfbfa] dark:bg-[#0b0d11] pb-24 select-none">
        <div className="max-w-sm w-full p-6 bg-white dark:bg-[#151922] border border-gray-200/80 dark:border-gray-800/80 rounded-3xl shadow-xs">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-50 dark:bg-blue-950/40 text-[#007AFF] flex items-center justify-center">
            <Sparkles size={28} />
          </div>

          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
            your profile
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">
            sign in or create an account to view your profile, publish posts up to 300 characters, and chat directly with nikilow.
          </p>

          <button
            onClick={onOpenAuth}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-2xl bg-[#007AFF] hover:bg-[#0066d6] text-white text-xs font-semibold shadow-xs transition-all active:scale-98 cursor-pointer"
          >
            <LogIn size={15} />
            <span>sign in</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto pb-24 bg-[#fbfbfa] dark:bg-[#0b0d11]">
      {/* Apple-style Navigation Header */}
      <header className="sticky top-0 z-20 h-14 flex items-center justify-between px-4 sm:px-6 bg-white/80 dark:bg-[#0e1117]/80 backdrop-blur-xl border-b border-gray-200/70 dark:border-gray-800/80 select-none">
        <div className="flex items-center gap-2">
          {onBack ? (
            <button
              onClick={onBack}
              className="flex items-center gap-1 -ml-2 px-2.5 py-1.5 rounded-xl text-xs font-medium text-[#007AFF] hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors cursor-pointer"
              aria-label="go back"
            >
              <ArrowLeft size={16} />
              <span>back</span>
            </button>
          ) : (
            <>
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
                profile
              </h1>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isOwnProfile && (
            <>
              <button
                onClick={onEditProfile}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-medium transition-colors cursor-pointer"
                title="edit profile"
              >
                <Edit3 size={13} />
                <span>edit</span>
              </button>
              <button
                onClick={onSignOut}
                className="p-1.5 rounded-xl text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                title="sign out"
              >
                <LogOut size={15} />
              </button>
            </>
          )}

          {!isOwnProfile && onStartChatWithNikilow && (
            <button
              onClick={onStartChatWithNikilow}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#007AFF] hover:bg-[#0066d6] text-white text-xs font-medium transition-colors shadow-2xs cursor-pointer"
            >
              <MessageSquare size={13} />
              <span>chat</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Profile Content */}
      <div className="max-w-2xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Profile Card */}
        <div className="p-6 sm:p-8 bg-white dark:bg-[#151922] border border-gray-200/80 dark:border-gray-800/80 rounded-3xl shadow-xs">
          <div className="flex flex-col items-center text-center gap-4">
            {/* Avatar with Verified Badge */}
            <div className="relative shrink-0">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden ring-2 ring-gray-200 dark:ring-gray-700 bg-gray-100 dark:bg-gray-800 shadow-sm">
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-gray-600 dark:text-gray-300">
                    {profile.name ? profile.name[0].toLowerCase() : 'u'}
                  </div>
                )}
              </div>

              {/* Blue verified badge for @kodewt */}
              {isKodewt && (
                <div
                  className="absolute bottom-0 right-0 transform translate-x-1 translate-y-1"
                  title="verified"
                >
                  <VerifiedBadge size="lg" />
                </div>
              )}
            </div>

            {/* User Meta */}
            <div className="w-full flex flex-col items-center text-center min-w-0">
              <div className="flex items-center justify-center gap-1.5 flex-wrap">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">
                  {profile.name}
                </h2>
                {isKodewt && <VerifiedBadge size="md" />}
              </div>

              <p className="text-xs font-medium text-[#007AFF] dark:text-[#3897f0] mt-0.5">
                @{profile.username}
              </p>

              {/* Bio */}
              <p className="text-xs text-gray-600 dark:text-gray-300 mt-2.5 leading-relaxed whitespace-pre-wrap max-w-md mx-auto text-center">
                {profile.bio || 'no bio yet.'}
              </p>

              {/* Verified highlight */}
              {isKodewt && (
                <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-900/40 text-[11px] text-[#007AFF] dark:text-sky-400 font-medium">
                  <ShieldCheck size={13} />
                  <span>verified</span>
                </div>
              )}

              {/* Stats Row */}
              <div className="flex items-center justify-center gap-6 mt-4 pt-3 border-t border-gray-100 dark:border-gray-800/80 w-full max-w-xs mx-auto">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                    {userPosts.length}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    posts
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Heart size={14} className="text-rose-500 fill-rose-500" />
                  <span className="text-sm font-bold text-gray-900 dark:text-gray-100 font-mono">
                    {totalLikes}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    likes
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Posts Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
              posts
            </h3>
            <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">
              {userPosts.length}
            </span>
          </div>

          {/* Quick composer if viewing own profile */}
          {isOwnProfile && (
            <form
              onSubmit={handlePostSubmit}
              className="p-3.5 bg-white dark:bg-[#151922] border border-gray-200/80 dark:border-gray-800/80 rounded-2xl shadow-2xs space-y-2.5"
            >
              <textarea
                rows={2}
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                placeholder="post an update..."
                maxLength={300}
                className="w-full resize-none bg-transparent border-none text-xs text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-hidden leading-relaxed"
              />

              {postError && (
                <p className="text-xs text-rose-500">{postError}</p>
              )}

              <div className="flex items-center justify-between pt-1 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-gray-400 dark:text-gray-500">
                    {300 - newPostContent.length}
                  </span>
                  {isRateLimited && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-lg border border-amber-200/60 dark:border-amber-900/50">
                      <Clock size={11} className="shrink-0" />
                      <span>cooldown: {formattedRemaining}</span>
                    </span>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={!newPostContent.trim() || isSubmittingPost || isRateLimited}
                  title={isRateLimited ? `Posting updates is limited to once every 5 minutes. Try again in ${formattedRemaining}.` : 'Post update'}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#007AFF] hover:bg-[#0066d6] text-white text-xs font-medium shadow-xs disabled:opacity-35 cursor-pointer"
                >
                  <span>{isSubmittingPost ? 'posting...' : isRateLimited ? `cooldown (${formattedRemaining})` : 'post'}</span>
                  <Send size={11} />
                </button>
              </div>
            </form>
          )}

          {/* List of user posts */}
          {userPosts.length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-[#151922] border border-gray-200/70 dark:border-gray-800/70 rounded-2xl text-xs text-gray-400 dark:text-gray-500">
              {isOwnProfile
                ? 'you have not posted anything yet. share your first thought!'
                : `@${profile.username} hasn't posted anything yet.`}
            </div>
          ) : (
            <div className="space-y-3">
              {userPosts.map((post) => (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <PostItem
                    post={post}
                    onLike={onLikePost}
                    onViewProfile={onViewProfile}
                    onDelete={onDeletePost}
                    canDelete={Boolean(
                      currentUser &&
                        (currentUser.id === post.userId ||
                          currentUser.username.toLowerCase() ===
                            post.authorUsername.toLowerCase())
                    )}
                  />
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
