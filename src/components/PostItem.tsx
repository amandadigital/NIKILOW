import { FC, MouseEvent } from 'react';
import { Heart, User, Trash2 } from 'lucide-react';
import { Post } from '../types';
import { VerifiedBadge } from './VerifiedBadge';
import { renderMentions } from '../utils/mentions';
import { formatTimeAgo } from '../utils/storage';

interface PostItemProps {
  post: Post;
  onLike: (postId: string) => void;
  onViewProfile: (username: string) => void;
  onDelete?: (postId: string) => void;
  canDelete?: boolean;
}

export const PostItem: FC<PostItemProps> = ({
  post,
  onLike,
  onViewProfile,
  onDelete,
  canDelete = false,
}) => {
  const isKodewt =
    post.authorUsername.toLowerCase() === 'kodewt' || post.isVerified;

  const handleLikeClick = (e: MouseEvent) => {
    e.stopPropagation();
    onLike(post.id);
  };

  const handleDeleteClick = (e: MouseEvent) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete(post.id);
    }
  };

  return (
    <article
      id={`post-${post.id}`}
      className="p-4 bg-white dark:bg-[#151922] border border-gray-200/80 dark:border-gray-800/80 rounded-2xl shadow-2xs hover:border-gray-300 dark:hover:border-gray-700 transition-all select-text"
    >
      {/* Header: Author info & default-visible delete */}
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div
          onClick={() => onViewProfile(post.authorUsername)}
          className="flex items-center gap-2.5 cursor-pointer group select-none"
        >
          <div className="relative w-10 h-10 rounded-full overflow-hidden ring-1 ring-gray-200 dark:ring-gray-700 bg-gray-100 dark:bg-gray-800 shrink-0 group-hover:ring-2 group-hover:ring-[#007AFF] transition-all">
            {post.authorAvatar ? (
              <img
                src={post.authorAvatar}
                alt={post.authorName}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-600 dark:text-gray-300 text-sm font-semibold">
                {post.authorName ? (
                  post.authorName[0].toUpperCase()
                ) : (
                  <User size={16} />
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 group-hover:text-[#007AFF] dark:group-hover:text-[#3897f0] transition-colors truncate">
                {post.authorName}
              </span>
              {isKodewt && <VerifiedBadge size="sm" />}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
              <span className="truncate">@{post.authorUsername}</span>
              <span>•</span>
              <span className="font-mono text-[11px]">
                {formatTimeAgo(post.createdAt)}
              </span>
            </div>
          </div>
        </div>

        {/* Delete button: always visible without hover for author */}
        {canDelete && onDelete && (
          <button
            type="button"
            onClick={handleDeleteClick}
            className="p-1.5 rounded-lg text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
            title="delete post"
            aria-label="delete post"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {/* Post text content with mentions */}
      <div className="text-sm leading-relaxed text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words pl-0.5">
        {renderMentions(post.content, onViewProfile)}
      </div>

      {/* Post action bar: Likes */}
      <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-gray-100 dark:border-gray-800/60 text-xs">
        <button
          type="button"
          onClick={handleLikeClick}
          className={`flex items-center gap-1.5 px-2 py-1 -ml-1 rounded-lg transition-all active:scale-90 cursor-pointer ${
            post.isLiked
              ? 'text-red-500 font-medium'
              : 'text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400'
          }`}
          aria-label={post.isLiked ? 'unlike post' : 'like post'}
        >
          <Heart
            size={15}
            className={`transition-all duration-200 ${
              post.isLiked
                ? 'fill-red-500 text-red-500 scale-110'
                : 'fill-transparent text-gray-400 dark:text-gray-500'
            }`}
          />
          <span className="font-mono text-[11px]">{post.likesCount}</span>
        </button>

        <span className="text-[10px] text-gray-400 dark:text-gray-600 font-mono">
          {post.content.length}/300
        </span>
      </div>
    </article>
  );
};
