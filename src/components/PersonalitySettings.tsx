import { FC, useState, useRef, ChangeEvent, FormEvent } from 'react';
import {
  Sparkles,
  RotateCcw,
  Check,
  Upload,
  Image as ImageIcon,
  User,
  HelpCircle,
} from 'lucide-react';
import {
  CompanionPersonality,
  DEFAULT_NIKILOW_NAME,
  DEFAULT_NIKILOW_AVATAR,
  DEFAULT_NIKILOW_PROMPT,
  UserProfile,
} from '../types';

interface PersonalitySettingsProps {
  personality: CompanionPersonality;
  onSave: (updated: CompanionPersonality) => void;
  onResetToDefault: () => void;
  onClose?: () => void;
  userProfile?: UserProfile | null;
}

const PRESET_AVATARS = [
  {
    name: 'nikilow (default)',
    url: DEFAULT_NIKILOW_AVATAR,
  },
  {
    name: 'cyber aesthetic',
    url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80',
  },
  {
    name: 'moody film',
    url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300&auto=format&fit=crop&q=80',
  },
  {
    name: 'minimalist dark',
    url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80',
  },
];

export const PersonalitySettings: FC<PersonalitySettingsProps> = ({
  personality,
  onSave,
  onResetToDefault,
  onClose,
  userProfile,
}) => {
  const [name, setName] = useState(personality.name);
  const [prompt, setPrompt] = useState(personality.prompt);
  const [avatarUrl, setAvatarUrl] = useState(personality.avatarUrl);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isDefaultNikilow =
    name.trim().toLowerCase() === DEFAULT_NIKILOW_NAME &&
    avatarUrl === DEFAULT_NIKILOW_AVATAR &&
    prompt.trim() === DEFAULT_NIKILOW_PROMPT.trim();

  // Compress and handle image file upload
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setFeedback('please select an image file');
      setTimeout(() => setFeedback(null), 3000);
      return;
    }

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 360;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height = Math.round((height * MAX_SIZE) / width);
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width = Math.round((width * MAX_SIZE) / height);
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setAvatarUrl(compressedDataUrl);
          setFeedback('image uploaded');
          setTimeout(() => setFeedback(null), 2500);
        }
        setIsUploading(false);
      };
      img.onerror = () => {
        setIsUploading(false);
        setFeedback('could not read image');
        setTimeout(() => setFeedback(null), 3000);
      };
      img.src = event.target?.result as string;
    };
    reader.onerror = () => {
      setIsUploading(false);
      setFeedback('failed to upload file');
      setTimeout(() => setFeedback(null), 3000);
    };
    reader.readAsDataURL(file);
  };

  // Roll back to Nikilow's original prompt and identity
  const handleRollback = () => {
    setName(DEFAULT_NIKILOW_NAME);
    setAvatarUrl(DEFAULT_NIKILOW_AVATAR);
    setPrompt(DEFAULT_NIKILOW_PROMPT);
    onResetToDefault();
    setFeedback("rolled back to nikilow's prompt");
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim() || DEFAULT_NIKILOW_NAME;
    const cleanPrompt = prompt.trim() || DEFAULT_NIKILOW_PROMPT;
    const cleanAvatar = avatarUrl.trim() || DEFAULT_NIKILOW_AVATAR;

    onSave({
      name: cleanName,
      prompt: cleanPrompt,
      avatarUrl: cleanAvatar,
    });

    setFeedback(
      userProfile ? 'personality saved to your account' : 'personality saved'
    );
    setTimeout(() => {
      setFeedback(null);
      onClose?.();
    }, 1200);
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 sm:p-5 space-y-5 select-none">
      {/* Header Info Banner */}
      <div className="flex items-start justify-between gap-3 p-3.5 rounded-2xl bg-white/70 dark:bg-[#161a22]/70 border border-gray-200/80 dark:border-gray-800/80 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-[#007AFF]">
            <Sparkles size={18} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <span>personality settings</span>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                  isDefaultNikilow
                    ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400'
                    : 'bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400'
                }`}
              >
                {isDefaultNikilow ? 'default nikilow' : 'custom'}
              </span>
            </h3>
            {userProfile ? (
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium">
                synced with account @{userProfile.username}
              </p>
            ) : (
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                saved locally (sign in to sync to your account)
              </p>
            )}
          </div>
        </div>
      </div>

      {feedback && (
        <div className="px-3.5 py-2 text-xs font-medium rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60 flex items-center gap-2">
          <Check size={14} />
          <span>{feedback}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Avatar Setup */}
        <div className="space-y-2.5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            avatar image
          </label>
          <div className="flex items-center gap-4">
            <div className="relative group">
              <div className="w-16 h-16 rounded-2xl overflow-hidden ring-2 ring-gray-200 dark:ring-gray-700 shadow-sm bg-gray-100 dark:bg-gray-800">
                <img
                  src={avatarUrl}
                  alt={name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    e.currentTarget.src = DEFAULT_NIKILOW_AVATAR;
                  }}
                />
              </div>
            </div>

            <div className="flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#181d26] hover:bg-gray-50 dark:hover:bg-[#202734] border border-gray-200 dark:border-gray-800 text-xs font-medium text-gray-800 dark:text-gray-200 flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                >
                  <Upload size={13} />
                  <span>{isUploading ? 'uploading...' : 'upload photo'}</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => setShowUrlInput((prev) => !prev)}
                  className="px-3 py-1.5 rounded-xl bg-transparent hover:bg-gray-200/50 dark:hover:bg-gray-800/40 text-xs font-medium text-gray-600 dark:text-gray-400 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <ImageIcon size={13} />
                  <span>image url</span>
                </button>
              </div>

              {/* Preset avatars selection */}
              <div className="flex items-center gap-1.5 pt-1">
                <span className="text-[11px] text-gray-400 mr-1">presets:</span>
                {PRESET_AVATARS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => setAvatarUrl(preset.url)}
                    title={preset.name}
                    className={`w-6 h-6 rounded-full overflow-hidden ring-1 transition-all cursor-pointer ${
                      avatarUrl === preset.url
                        ? 'ring-2 ring-[#007AFF] scale-110'
                        : 'ring-gray-300 dark:ring-gray-700 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={preset.url}
                      alt={preset.name}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {showUrlInput && (
            <div className="pt-1">
              <input
                type="url"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://example.com/avatar.jpg"
                className="w-full px-3 py-2 text-xs bg-white dark:bg-[#161a22] border border-gray-200 dark:border-gray-800 rounded-xl text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-hidden focus:border-gray-400 dark:focus:border-gray-600"
              />
            </div>
          )}
        </div>

        {/* Companion Name */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            companion name
          </label>
          <div className="relative">
            <User
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. nikilow, alice, eva"
              maxLength={32}
              className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-[#161a22] border border-gray-200 dark:border-gray-800 rounded-xl text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-hidden focus:border-gray-400 dark:focus:border-gray-600"
            />
          </div>
        </div>

        {/* Prompt / Instructions */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              personality prompt / instructions
            </label>
            <span className="text-[10px] text-gray-400 font-mono">
              {prompt.length} chars
            </span>
          </div>

          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={7}
            placeholder="describe how your companion should speak, behave, their tone, opinions, or specific rules..."
            className="w-full p-3 text-xs font-mono leading-relaxed bg-white dark:bg-[#161a22] border border-gray-200 dark:border-gray-800 rounded-xl text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-hidden focus:border-gray-400 dark:focus:border-gray-600 resize-none"
          />

          <p className="text-[11px] text-gray-400 dark:text-gray-500 flex items-center gap-1">
            <HelpCircle size={12} />
            <span>
              instruct her vibe, humor, favorite topics, or language rules (&quot;без воды&quot;).
            </span>
          </p>
        </div>

        {/* Actions row */}
        <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          {/* Roll back to Nikilow's prompt button */}
          <button
            type="button"
            onClick={handleRollback}
            className="flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white bg-gray-200/70 hover:bg-gray-200 dark:bg-gray-800/60 dark:hover:bg-gray-800 transition-colors cursor-pointer"
            title="Restore original Nikilow prompt and avatar"
          >
            <RotateCcw size={13} />
            <span>roll back to nikilow</span>
          </button>

          {/* Save button */}
          <button
            type="submit"
            className="flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 text-white dark:text-gray-900 text-xs font-semibold shadow-xs transition-all active:scale-[0.99] cursor-pointer"
          >
            <Check size={14} />
            <span>save personality</span>
          </button>
        </div>
      </form>
    </div>
  );
};
