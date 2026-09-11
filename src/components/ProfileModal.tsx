import React, { FC, useState, useRef, ChangeEvent, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  User,
  AtSign,
  Mail,
  Camera,
  Lock,
  Loader2,
  LogOut,
  Sparkles,
  Heart,
  Check,
} from 'lucide-react';
import { UserProfile } from '../types';
import { updateUserProfile, uploadAvatarImage, signOutUser } from '../lib/supabase';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile | null;
  onProfileUpdated: (updated: UserProfile) => void;
  onSignOut: () => void;
}

export const ProfileModal: FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  profile,
  onProfileUpdated,
  onSignOut,
}) => {
  const [name, setName] = useState(profile?.name || '');
  const [username, setUsername] = useState(profile?.username || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');

  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state when profile changes
  React.useEffect(() => {
    if (profile) {
      setName(profile.name || '');
      setUsername(profile.username || '');
      setBio(profile.bio || '');
      setAvatarUrl(profile.avatar_url || '');
    }
  }, [profile]);

  if (!isOpen || !profile) return null;

  const isNaisuru =
    profile.username.toLowerCase() === 'naisuru' ||
    profile.name.toLowerCase().includes('naisuru');

  const handleAvatarFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setMessage(null);

    try {
      const url = await uploadAvatarImage(profile.id, file);
      setAvatarUrl(url);
      setMessage({ text: 'Avatar uploaded! Click Save to apply.', type: 'success' });
    } catch (err: unknown) {
      const msg = (err as Error)?.message || 'Failed to upload avatar';
      setMessage({ text: msg, type: 'error' });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);

    try {
      if (!name.trim()) throw new Error('Name cannot be empty.');
      if (!username.trim()) throw new Error('Username cannot be empty.');

      const cleanUsername = username.trim().toLowerCase().replace(/^@/, '');

      await updateUserProfile(profile.id, {
        name: name.trim(),
        username: cleanUsername,
        avatar_url: avatarUrl,
        bio: bio.trim(),
      });

      const updated: UserProfile = {
        ...profile,
        name: name.trim(),
        username: cleanUsername,
        avatar_url: avatarUrl,
        bio: bio.trim(),
      };

      onProfileUpdated(updated);
      setMessage({ text: 'Profile updated successfully!', type: 'success' });
      setTimeout(() => {
        setMessage(null);
      }, 3000);
    } catch (err: unknown) {
      const msg = (err as Error)?.message || 'Could not update profile.';
      setMessage({ text: msg, type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    await signOutUser();
    onSignOut();
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          className="relative w-full max-w-lg bg-white dark:bg-[#151922] border border-gray-200 dark:border-gray-800 rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800/80">
            <div className="flex items-center gap-2">
              <User size={18} className="text-gray-700 dark:text-gray-300" />
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                Your Profile
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <div className="p-6 overflow-y-auto space-y-6">
            {/* Special Creator / Naisuru Banner */}
            {isNaisuru && (
              <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Heart size={16} className="fill-white" />
                </div>
                <div>
                  <div className="text-xs font-semibold flex items-center gap-1.5">
                    Nikilow's Boyfriend & Creator
                    <Sparkles size={12} />
                  </div>
                  <div className="text-[11px] text-rose-500/80 dark:text-rose-400/80">
                    Nikilow recognizes you with special affection, teasing, and romantic warmth.
                  </div>
                </div>
              </div>
            )}

            {/* Avatar Section */}
            <div className="flex items-center gap-4">
              <div className="relative group">
                <div className="w-20 h-20 rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-800 ring-2 ring-gray-200 dark:ring-gray-700 shadow-sm flex items-center justify-center">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-2xl font-bold text-gray-400">
                      {name ? name[0].toUpperCase() : 'U'}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="absolute inset-0 bg-black/40 text-white flex flex-col items-center justify-center rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Upload avatar"
                >
                  <Camera size={18} />
                  <span className="text-[10px] mt-0.5">Upload</span>
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarFileSelect}
                  className="hidden"
                />
              </div>

              <div className="flex-1 space-y-1.5">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="py-1.5 px-3 text-xs font-medium bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-xl transition-colors inline-flex items-center gap-1.5"
                  >
                    {isUploading ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Camera size={13} />
                    )}
                    <span>Change Avatar</span>
                  </button>
                  {avatarUrl && (
                    <button
                      type="button"
                      onClick={() => setAvatarUrl('')}
                      className="py-1.5 px-2.5 text-xs text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-gray-400">
                  Upload an image or paste a direct image URL below.
                </p>
              </div>
            </div>

            {/* Notification alert */}
            {message && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  message.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50'
                    : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50'
                }`}
              >
                {message.type === 'success' ? <Check size={14} /> : <X size={14} />}
                <span>{message.text}</span>
              </div>
            )}

            {/* Form for editable fields */}
            <form onSubmit={handleSave} className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Display Name
                </label>
                <div className="relative">
                  <User
                    size={15}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your Name"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-gray-50 dark:bg-[#181d26] border border-gray-200 dark:border-gray-800 rounded-xl text-gray-900 dark:text-gray-100 focus:outline-hidden focus:border-gray-400 dark:focus:border-gray-600"
                  />
                </div>
              </div>

              {/* Username */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Username
                </label>
                <div className="relative">
                  <AtSign
                    size={15}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="username"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-gray-50 dark:bg-[#181d26] border border-gray-200 dark:border-gray-800 rounded-xl text-gray-900 dark:text-gray-100 focus:outline-hidden focus:border-gray-400 dark:focus:border-gray-600"
                  />
                </div>
                <p className="text-[10px] text-gray-400 mt-1">
                  Used for signing in and how Nikilow addresses you.
                </p>
              </div>

              {/* Avatar URL alternative */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Avatar Image URL (Optional)
                </label>
                <input
                  type="text"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-[#181d26] border border-gray-200 dark:border-gray-800 rounded-xl text-gray-900 dark:text-gray-100 focus:outline-hidden focus:border-gray-400 dark:focus:border-gray-600"
                />
              </div>

              {/* Bio */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  About You / Bio
                </label>
                <textarea
                  rows={2}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell Nikilow a bit about yourself..."
                  className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-[#181d26] border border-gray-200 dark:border-gray-800 rounded-xl text-gray-900 dark:text-gray-100 focus:outline-hidden focus:border-gray-400 dark:focus:border-gray-600 resize-none"
                />
              </div>

              {/* Protected Fields (Cannot be changed as requested) */}
              <div className="pt-2 border-t border-gray-100 dark:border-gray-800/80 space-y-2.5">
                <div className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                  Protected Credentials (Cannot be changed)
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail
                      size={15}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                    <input
                      type="email"
                      disabled
                      value={profile.email}
                      className="w-full pl-9 pr-9 py-2 text-xs bg-gray-100 dark:bg-[#13161c] border border-gray-200/60 dark:border-gray-800/60 rounded-xl text-gray-500 dark:text-gray-400 cursor-not-allowed select-none"
                    />
                    <Lock
                      size={13}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <Lock
                      size={15}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                    <input
                      type="password"
                      disabled
                      value="••••••••••••"
                      className="w-full pl-9 pr-9 py-2 text-xs bg-gray-100 dark:bg-[#13161c] border border-gray-200/60 dark:border-gray-800/60 rounded-xl text-gray-500 dark:text-gray-400 cursor-not-allowed select-none"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">
                      Locked
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-3">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-gray-900 hover:bg-gray-800 dark:bg-gray-100 dark:hover:bg-white text-white dark:text-gray-900 text-xs font-medium transition-all shadow-xs flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-50"
                >
                  {isSaving && <Loader2 size={14} className="animate-spin" />}
                  <span>Save Changes</span>
                </button>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="py-2.5 px-4 rounded-xl border border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs font-medium transition-colors flex items-center gap-2"
                >
                  <LogOut size={14} />
                  <span>Sign Out</span>
                </button>
              </div>
            </form>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
