import { FC, useState, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Mail,
  Lock,
  User,
  AtSign,
  Eye,
  EyeOff,
  Loader2,
  Inbox,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { signInUser, signUpUser, resendVerificationEmail } from '../lib/supabase';
import { UserProfile, NIKILOW_AVATAR } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (profile: UserProfile) => void;
}

export const AuthModal: FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onAuthSuccess,
}) => {
  const [mode, setMode] = useState<'login' | 'register' | 'verify-email'>('login');

  // Form fields
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [identifier, setIdentifier] = useState(''); // username or email for login
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Status
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');

  const resetForm = () => {
    setName('');
    setUsername('');
    setEmail('');
    setIdentifier('');
    setPassword('');
    setErrorMsg('');
    setSuccessMsg('');
    setShowPassword(false);
    setLoading(false);
  };

  const handleSwitchMode = (newMode: 'login' | 'register') => {
    setMode(newMode);
    setErrorMsg('');
    setSuccessMsg('');
  };

  const handleResendLetter = async () => {
    const targetEmail = pendingEmail || email || identifier;
    if (!targetEmail) {
      setErrorMsg('please enter your email first.');
      return;
    }

    try {
      setResending(true);
      setErrorMsg('');
      await resendVerificationEmail(targetEmail);
      setSuccessMsg('verification letter has been resent! please check your inbox.');
    } catch (err: unknown) {
      const errMessage =
        (err as Error)?.message?.toLowerCase() || 'could not resend letter. please try again shortly.';
      setErrorMsg(errMessage);
    } finally {
      setResending(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      if (mode === 'register') {
        if (!name.trim()) throw new Error('please enter your name.');
        if (!username.trim()) throw new Error('please enter a username.');
        if (!email.trim()) throw new Error('please enter your email.');
        if (password.length < 6)
          throw new Error('password must be at least 6 characters.');

        const cleanEmail = email.trim();
        const cleanUsername = username.trim().toLowerCase().replace(/^@/, '');
        const cleanName = name.trim();

        await signUpUser({
          name: cleanName,
          username: cleanUsername,
          email: cleanEmail,
          password,
        });

        setPendingEmail(cleanEmail);
        setIdentifier(cleanEmail);
        setMode('verify-email');
        setSuccessMsg('a verification letter was sent to your inbox.');
      } else {
        // Login mode (can use username OR email)
        if (!identifier.trim())
          throw new Error('please enter your username or email.');
        if (!password) throw new Error('please enter your password.');

        const result = await signInUser({
          identifier: identifier.trim(),
          password,
        });

        if (result.user) {
          const meta = result.user.user_metadata || {};
          const profile: UserProfile = {
            id: result.user.id,
            name: meta.name || result.user.email?.split('@')[0] || 'user',
            username:
              meta.username || result.user.email?.split('@')[0] || 'user',
            email: result.user.email || '',
            avatar_url: meta.avatar_url || '',
            bio: meta.bio || '',
          };
          setSuccessMsg('welcome back');
          setTimeout(() => {
            onAuthSuccess(profile);
            onClose();
            resetForm();
          }, 400);
        }
      }
    } catch (err: unknown) {
      const rawMsg = (err as Error)?.message || 'an error occurred during authentication.';
      const lower = rawMsg.toLowerCase();
      if (lower.includes('email not confirmed') || lower.includes('email_not_confirmed')) {
        setErrorMsg('email not confirmed yet. a verification letter was sent to your inbox. please click the link to verify before signing in.');
        setPendingEmail(identifier.includes('@') ? identifier : '');
      } else {
        setErrorMsg(lower);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-md p-6 bg-white dark:bg-[#151922] border border-gray-200/80 dark:border-gray-800/80 rounded-3xl shadow-2xl overflow-hidden"
        >
          {/* Close button */}
          <button
            onClick={() => {
              onClose();
              resetForm();
            }}
            className="absolute top-5 right-5 p-1.5 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="close"
          >
            <X size={17} />
          </button>

          {mode === 'verify-email' ? (
            /* Email verification step */
            <div className="text-center py-2 space-y-4">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-900/40 flex items-center justify-center text-[#007AFF]">
                <Inbox size={28} />
              </div>

              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
                  verify email
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  a letter was sent to your inbox
                </p>
              </div>

              <div className="p-3 bg-gray-50 dark:bg-[#181d26] border border-gray-200/70 dark:border-gray-800/70 rounded-2xl">
                <span className="text-xs font-mono text-gray-800 dark:text-gray-200 font-medium break-all">
                  {pendingEmail || email || identifier}
                </span>
              </div>

              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed px-2">
                please open the letter in your inbox and click the confirmation link to activate your account.
              </p>

              {successMsg && (
                <div className="p-2.5 rounded-xl text-xs bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/60">
                  {successMsg}
                </div>
              )}

              {errorMsg && (
                <div className="p-2.5 rounded-xl text-xs bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60">
                  {errorMsg}
                </div>
              )}

              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setErrorMsg('');
                    setSuccessMsg('');
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#007AFF] hover:bg-[#0066d6] text-white text-xs font-medium shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>i verified my email — sign in</span>
                  <ArrowRight size={14} />
                </button>

                <button
                  type="button"
                  disabled={resending}
                  onClick={handleResendLetter}
                  className="w-full py-2 px-3 rounded-xl border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 text-xs text-gray-600 dark:text-gray-300 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw size={13} className={resending ? 'animate-spin' : ''} />
                  <span>resend verification letter</span>
                </button>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setMode('register')}
                  className="text-xs text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline cursor-pointer"
                >
                  back to register
                </button>
              </div>
            </div>
          ) : (
            /* Standard Login / Register form */
            <>
              {/* Header */}
              <div className="flex items-center gap-3 mb-5">
                <div className="w-8 h-8 rounded-full overflow-hidden ring-1 ring-gray-200 dark:ring-gray-700">
                  <img
                    src={NIKILOW_AVATAR}
                    alt="Nikilow"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      e.currentTarget.src = '/nikilow.jpg';
                    }}
                  />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
                    {mode === 'login' ? 'sign in' : 'create account'}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {mode === 'login'
                      ? 'login with username or email'
                      : 'email verification required'}
                  </p>
                </div>
              </div>

              {/* Mode Switch Tabs */}
              <div className="flex p-1 mb-5 bg-gray-100 dark:bg-gray-800/70 rounded-xl">
                <button
                  type="button"
                  onClick={() => handleSwitchMode('login')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                    mode === 'login'
                      ? 'bg-white dark:bg-[#1c222e] text-gray-900 dark:text-gray-100 shadow-xs'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  sign in
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchMode('register')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                    mode === 'register'
                      ? 'bg-white dark:bg-[#1c222e] text-gray-900 dark:text-gray-100 shadow-xs'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  register
                </button>
              </div>

              {/* Error / Success messages */}
              {errorMsg && (
                <div className="mb-4 p-3 rounded-xl text-xs bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60 leading-relaxed">
                  <p>{errorMsg}</p>
                  {(errorMsg.includes('email not confirmed') || errorMsg.includes('verification')) && (
                    <button
                      type="button"
                      onClick={handleResendLetter}
                      className="mt-2 text-[11px] font-semibold text-[#007AFF] hover:underline block cursor-pointer"
                    >
                      resend verification letter
                    </button>
                  )}
                </div>
              )}
              {successMsg && (
                <div className="mb-4 p-3 rounded-xl text-xs bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/60 leading-relaxed">
                  {successMsg}
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-3.5">
                {mode === 'register' && (
                  <>
                    <div>
                      <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">
                        your name
                      </label>
                      <div className="relative">
                        <User
                          size={15}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                        />
                        <input
                          type="text"
                          required
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="your full name"
                          className="w-full pl-9 pr-3 py-2 text-xs bg-gray-50 dark:bg-[#181d26] border border-gray-200 dark:border-gray-800 rounded-xl text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-hidden focus:border-gray-400 dark:focus:border-gray-600 transition-colors"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">
                        username
                      </label>
                      <div className="relative">
                        <AtSign
                          size={15}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                        />
                        <input
                          type="text"
                          required
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          placeholder="username"
                          className="w-full pl-9 pr-3 py-2 text-xs bg-gray-50 dark:bg-[#181d26] border border-gray-200 dark:border-gray-800 rounded-xl text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-hidden focus:border-gray-400 dark:focus:border-gray-600 transition-colors"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">
                        email address
                      </label>
                      <div className="relative">
                        <Mail
                          size={15}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                        />
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="name@example.com"
                          className="w-full pl-9 pr-3 py-2 text-xs bg-gray-50 dark:bg-[#181d26] border border-gray-200 dark:border-gray-800 rounded-xl text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-hidden focus:border-gray-400 dark:focus:border-gray-600 transition-colors"
                        />
                      </div>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                        a verification letter will come to your inbox.
                      </p>
                    </div>
                  </>
                )}

                {mode === 'login' && (
                  <div>
                    <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">
                      username or email
                    </label>
                    <div className="relative">
                      <AtSign
                        size={15}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                      />
                      <input
                        type="text"
                        required
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        placeholder="username or email"
                        className="w-full pl-9 pr-3 py-2 text-xs bg-gray-50 dark:bg-[#181d26] border border-gray-200 dark:border-gray-800 rounded-xl text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-hidden focus:border-gray-400 dark:focus:border-gray-600 transition-colors"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">
                    password
                  </label>
                  <div className="relative">
                    <Lock
                      size={15}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-9 pr-9 py-2 text-xs bg-gray-50 dark:bg-[#181d26] border border-gray-200 dark:border-gray-800 rounded-xl text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-hidden focus:border-gray-400 dark:focus:border-gray-600 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                    >
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 py-2.5 px-4 rounded-xl bg-gray-900 hover:bg-gray-800 dark:bg-gray-100 dark:hover:bg-white text-white dark:text-gray-900 text-xs font-medium transition-all shadow-xs flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-50 cursor-pointer"
                >
                  {loading && <Loader2 size={14} className="animate-spin" />}
                  <span>{mode === 'login' ? 'sign in' : 'register & verify email'}</span>
                </button>
              </form>

              {/* Footer note */}
              <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-800/80 text-center">
                {mode === 'login' ? (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    don't have an account yet?{' '}
                    <button
                      type="button"
                      onClick={() => handleSwitchMode('register')}
                      className="text-gray-900 dark:text-gray-100 font-medium hover:underline cursor-pointer"
                    >
                      register here
                    </button>
                  </p>
                ) : (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    already have an account?{' '}
                    <button
                      type="button"
                      onClick={() => handleSwitchMode('login')}
                      className="text-gray-900 dark:text-gray-100 font-medium hover:underline cursor-pointer"
                    >
                      sign in
                    </button>
                  </p>
                )}
              </div>
            </>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
