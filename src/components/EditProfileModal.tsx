import { FC, useState, useRef, ChangeEvent, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Camera, Check, AlertCircle } from 'lucide-react';
import { UserProfile } from '../types';
import { updateProfile } from '../lib/supabase';
import { VerifiedBadge } from './VerifiedBadge';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile;
  onProfileUpdated: (updated: UserProfile) => void;
}

export const EditProfileModal: FC<EditProfileModalProps> = ({
  isOpen,
  onClose,
  userProfile,
  onProfileUpdated,
}) => {
  const [name, setName] = useState(userProfile.name || '');
  const [username, setUsername] = useState(userProfile.username || '');
  const [bio, setBio] = useState(userProfile.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(userProfile.avatar_url || '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const isKodewt = username.toLowerCase() === 'kodewt' || userProfile.is_verified;

  const handleAvatarFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      setError('Image must be less than 8MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        const rawUrl = event.target.result as string;
        // Compress avatar with canvas to ensure it is lightweight (<10KB) and persists instantly
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            const maxDim = 128;
            let width = img.width;
            let height = img.height;
            if (width > height) {
              if (width > maxDim) {
                height = Math.round((height * maxDim) / width);
                width = maxDim;
              }
            } else {
              if (height > maxDim) {
                width = Math.round((width * maxDim) / height);
                height = maxDim;
              }
            }
            canvas.width = Math.max(1, width);
            canvas.height = Math.max(1, height);
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height);
              const compressed = canvas.toDataURL('image/jpeg', 0.72);
              setAvatarUrl(compressed);
              setError(null);
              return;
            }
          } catch {
            // fallback below
          }
          // If canvas compression failed, only use rawUrl if small enough (<30KB)
          if (rawUrl.length < 30000) {
            setAvatarUrl(rawUrl);
          }
          setError(null);
        };
        img.onerror = () => {
          if (rawUrl.length < 30000) {
            setAvatarUrl(rawUrl);
          }
          setError(null);
        };
        img.src = rawUrl;
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = (e: FormEvent) => {
    e.preventDefault();

    const trimmedUsername = username.trim().toLowerCase().replace(/^@/, '');
    if (!trimmedUsername) {
      setError('Username cannot be empty');
      return;
    }

    const updatedProfile: UserProfile = {
      ...userProfile,
      name: name.trim(),
      username: trimmedUsername,
      bio: bio.trim(),
      avatar_url: avatarUrl,
      is_verified: trimmedUsername === 'kodewt' || userProfile.is_verified,
    };

    // Instant visual update to interface & close modal
    onProfileUpdated(updatedProfile);
    onClose();

    // Persist to Supabase database in background
    updateProfile(userProfile.id, {
      name: name.trim(),
      username: trimmedUsername,
      bio: bio.trim(),
      avatar_url: avatarUrl,
    }).catch((err) => {
      console.warn('Profile background update notice:', err);
    });
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 select-none">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-xs"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-md bg-white dark:bg-[#151922] border border-gray-200/90 dark:border-gray-800/90 rounded-3xl shadow-2xl p-6 z-10 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-800/80">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              edit profile
            </h3>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          <form onSubmit={handleSave} className="mt-5 space-y-4">
            {/* Avatar picker */}
            <div className="flex flex-col items-center justify-center gap-2">
              <div className="relative group cursor-pointer">
                <div className="w-20 h-20 rounded-full overflow-hidden ring-2 ring-gray-200 dark:ring-gray-700 bg-gray-100 dark:bg-gray-800">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt="avatar preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xl font-bold text-gray-500">
                      {name ? name[0].toLowerCase() : 'u'}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 p-1.5 rounded-full bg-gray-900/80 hover:bg-gray-900 text-white shadow-xs cursor-pointer"
                  title="upload photo"
                >
                  <Camera size={14} />
                </button>

                {isKodewt && (
                  <div className="absolute top-0 right-0">
                    <VerifiedBadge size="md" />
                  </div>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarFile}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs text-[#007AFF] hover:underline font-medium cursor-pointer"
              >
                change photo
              </button>
            </div>

            {error && (
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
                <AlertCircle size={14} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Name */}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                display name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="your name"
                maxLength={40}
                required
                className="w-full px-3.5 py-2 rounded-xl bg-gray-50 dark:bg-[#181d26] border border-gray-200/90 dark:border-gray-800 text-xs sm:text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-hidden focus:ring-2 focus:ring-[#007AFF]"
              />
            </div>

            {/* Username */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  username
                </label>
                {isKodewt && (
                  <span className="flex items-center gap-1 text-[11px] text-[#007AFF] font-medium">
                    <VerifiedBadge size="sm" />
                    <span>verified badge active</span>
                  </span>
                )}
              </div>
              <div className="relative flex items-center">
                <span className="absolute left-3.5 text-xs text-gray-400">@</span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="username"
                  maxLength={30}
                  required
                  className="w-full pl-7 pr-3.5 py-2 rounded-xl bg-gray-50 dark:bg-[#181d26] border border-gray-200/90 dark:border-gray-800 text-xs sm:text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-hidden focus:ring-2 focus:ring-[#007AFF]"
                />
              </div>
            </div>

            {/* Bio */}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                bio
              </label>
              <textarea
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="bio..."
                maxLength={200}
                className="w-full px-3.5 py-2 rounded-xl bg-gray-50 dark:bg-[#181d26] border border-gray-200/90 dark:border-gray-800 text-xs sm:text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-hidden focus:ring-2 focus:ring-[#007AFF] resize-none"
              />
              <span className="text-[10px] text-gray-400 dark:text-gray-500 float-right mt-0.5 font-mono">
                {200 - bio.length}
              </span>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-800/80">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
              >
                cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#007AFF] hover:bg-[#0066d6] text-white text-xs font-medium shadow-xs transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {success ? (
                  <>
                    <Check size={14} />
                    <span>saved!</span>
                  </>
                ) : (
                  <>
                    <span>{isSaving ? 'saving...' : 'save changes'}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
