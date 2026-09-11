import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Eye,
  EyeOff,
  Search,
  Trash2,
  RefreshCw,
  CheckSquare,
  Square,
  ArrowLeft,
  LogOut,
  Heart,
  Copy,
  Check,
  AlertTriangle,
  Calendar,
  Sparkles,
  X,
  SlidersHorizontal,
} from 'lucide-react';
import { VerifiedBadge } from './VerifiedBadge';
import { renderMentions } from '../utils/mentions';

interface AdminPost {
  id: string;
  user_id: string;
  author_name: string;
  author_username: string;
  author_avatar?: string;
  content: string;
  likes_count: number;
  is_verified?: boolean;
  created_at: string;
}

interface AdminPanelProps {
  onBackToApp: () => void;
  onViewProfile?: (username: string) => void;
}

const STORAGE_ADMIN_TOKEN = 'nikilow_admin_token';
const STORAGE_ADMIN_PWD = 'nikilow_admin_pwd';

export const AdminPanel: React.FC<AdminPanelProps> = ({ onBackToApp, onViewProfile }) => {
  // Authentication state
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(() => {
    return sessionStorage.getItem(STORAGE_ADMIN_TOKEN) || localStorage.getItem(STORAGE_ADMIN_TOKEN);
  });
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(true);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isSubmittingLogin, setIsSubmittingLogin] = useState<boolean>(false);

  // Posts & Moderation state
  const [posts, setPosts] = useState<AdminPost[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [authorFilter, setAuthorFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'likes'>('newest');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Action Modals & Toasts
  const [postToDelete, setPostToDelete] = useState<AdminPost | null>(null);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 4000);
  }, []);

  // Helper for authenticated headers
  const getAuthHeaders = useCallback(() => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
      headers['x-admin-password'] = authToken;
    }
    return headers;
  }, [authToken]);

  // Verify stored token on mount
  useEffect(() => {
    const verifySavedAuth = async () => {
      if (!authToken) {
        setIsVerifying(false);
        return;
      }
      try {
        const res = await fetch('/api/admin/verify', {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'x-admin-password': authToken,
          },
        });
        if (res.ok) {
          setIsAuthenticated(true);
        } else {
          // Token invalid, clear it
          sessionStorage.removeItem(STORAGE_ADMIN_TOKEN);
          localStorage.removeItem(STORAGE_ADMIN_TOKEN);
          setAuthToken(null);
          setIsAuthenticated(false);
        }
      } catch (err) {
        console.warn('Admin verify exception:', err);
      } finally {
        setIsVerifying(false);
      }
    };

    verifySavedAuth();
  }, [authToken]);

  // Fetch all posts via Supabase service role endpoint
  const fetchPosts = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoadingPosts(true);
    try {
      const res = await fetch('/api/admin/posts', {
        headers: getAuthHeaders(),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to fetch posts');
      }

      const data = await res.json();
      setPosts(data.posts || []);
    } catch (err) {
      const error = err as Error;
      showToast(error.message || 'Error loading posts', 'error');
    } finally {
      setIsLoadingPosts(false);
    }
  }, [isAuthenticated, getAuthHeaders, showToast]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchPosts();
    }
  }, [isAuthenticated, fetchPosts]);

  // Handle Login Submit
  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!passwordInput.trim()) {
      setLoginError('Please enter the admin password');
      return;
    }

    setIsSubmittingLogin(true);
    setLoginError(null);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordInput.trim() }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Invalid admin password');
      }

      const token = data.token || passwordInput.trim();
      sessionStorage.setItem(STORAGE_ADMIN_TOKEN, token);
      localStorage.setItem(STORAGE_ADMIN_TOKEN, token);
      setAuthToken(token);
      setIsAuthenticated(true);
      showToast('Admin access granted', 'success');
    } catch (err) {
      const error = err as Error;
      setLoginError(error.message || 'Authentication failed. Please verify password.');
    } finally {
      setIsSubmittingLogin(false);
    }
  };

  // Handle Logout
  const handleLogout = async () => {
    try {
      await fetch('/api/admin/logout', {
        method: 'POST',
        headers: getAuthHeaders(),
      });
    } catch {
      // ignore
    }
    sessionStorage.removeItem(STORAGE_ADMIN_TOKEN);
    localStorage.removeItem(STORAGE_ADMIN_TOKEN);
    sessionStorage.removeItem(STORAGE_ADMIN_PWD);
    setAuthToken(null);
    setIsAuthenticated(false);
    setPasswordInput('');
    showToast('Logged out of admin panel', 'info');
  };

  // Handle Delete Single Post
  const handleConfirmDelete = async () => {
    if (!postToDelete) return;
    setIsDeleting(true);

    try {
      const res = await fetch(`/api/admin/posts/${encodeURIComponent(postToDelete.id)}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete post');
      }

      setPosts((prev) => prev.filter((p) => p.id !== postToDelete.id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(postToDelete.id);
        return next;
      });

      showToast(`Post by @${postToDelete.author_username} permanently deleted`, 'success');
      setPostToDelete(null);
    } catch (err) {
      const error = err as Error;
      showToast(error.message || 'Error deleting post', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle Bulk Delete
  const handleConfirmBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setIsDeleting(true);
    const idsArray = Array.from(selectedIds);

    try {
      const res = await fetch('/api/admin/posts/bulk-delete', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ ids: idsArray }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to bulk delete posts');
      }

      setPosts((prev) => prev.filter((p) => !selectedIds.has(p.id)));
      showToast(`${idsArray.length} posts deleted permanently`, 'success');
      setSelectedIds(new Set());
      setIsBulkDeleteModalOpen(false);
    } catch (err) {
      const error = err as Error;
      showToast(error.message || 'Error in bulk deletion', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // Copy helper
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showToast('Copied to clipboard', 'info');
    setTimeout(() => {
      setCopiedId((prev) => (prev === id ? null : prev));
    }, 2000);
  };

  // Selection toggle
  const toggleSelectPost = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Select all / none
  const toggleSelectAll = (filteredList: AdminPost[]) => {
    if (selectedIds.size === filteredList.length && filteredList.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredList.map((p) => p.id)));
    }
  };

  // Filtered and sorted posts
  const filteredPosts = useMemo(() => {
    let result = [...posts];

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((p) => {
        return (
          p.content.toLowerCase().includes(q) ||
          p.author_name.toLowerCase().includes(q) ||
          p.author_username.toLowerCase().includes(q) ||
          p.id.toLowerCase().includes(q) ||
          p.user_id.toLowerCase().includes(q)
        );
      });
    }

    // Filter by specific author
    if (authorFilter) {
      result = result.filter(
        (p) => p.author_username.toLowerCase() === authorFilter.toLowerCase()
      );
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortBy === 'oldest') {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      if (sortBy === 'likes') {
        return (b.likes_count || 0) - (a.likes_count || 0);
      }
      return 0;
    });

    return result;
  }, [posts, searchQuery, authorFilter, sortBy]);

  // Overall feed statistics
  const stats = useMemo(() => {
    const totalPosts = posts.length;
    const uniqueAuthors = new Set(posts.map((p) => p.author_username.toLowerCase())).size;
    const totalLikes = posts.reduce((acc, p) => acc + (p.likes_count || 0), 0);
    const verifiedCount = posts.filter(
      (p) => p.is_verified || p.author_username.toLowerCase() === 'kodewt'
    ).length;

    return { totalPosts, uniqueAuthors, totalLikes, verifiedCount };
  }, [posts]);

  // Format date helper
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return dateString;
    }
  };

  // Format relative time helper
  const formatTimeAgo = (dateString: string) => {
    try {
      const ms = Date.now() - new Date(dateString).getTime();
      const seconds = Math.floor(ms / 1000);
      if (seconds < 60) return 'just now';
      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) return `${minutes}m ago`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      return `${days}d ago`;
    } catch {
      return '';
    }
  };

  // Loading screen while verifying token
  if (isVerifying) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#fbfbfa] dark:bg-[#0b0d11] text-gray-800 dark:text-gray-200">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="animate-spin text-gray-400 dark:text-gray-500" size={26} />
          <span className="text-sm font-medium text-gray-500">verifying admin privileges...</span>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // LOGIN SCREEN
  // --------------------------------------------------------------------------
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen w-full flex flex-col justify-center items-center px-4 bg-[#fbfbfa] dark:bg-[#0b0d11] text-gray-900 dark:text-gray-100 relative">
        {/* Top return link */}
        <div className="absolute top-6 left-6">
          <button
            onClick={onBackToApp}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white bg-gray-200/60 dark:bg-gray-800/60 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors cursor-pointer"
          >
            <ArrowLeft size={14} />
            <span>back to nikilow</span>
          </button>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-md bg-white dark:bg-[#151921] border border-gray-200 dark:border-gray-800/80 rounded-2xl shadow-xl p-8"
        >
          {/* Header */}
          <div className="flex flex-col items-center text-center mb-7">
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 dark:bg-red-500/15 text-red-500 flex items-center justify-center mb-4 ring-1 ring-red-500/20 shadow-xs">
              <ShieldAlert size={28} />
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
              Feed Moderation Portal
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 max-w-xs leading-relaxed">
              Authenticate with administrative credentials to manage, review, and moderate live feed posts.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label
                htmlFor="admin-password"
                className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5"
              >
                Admin Password
              </label>
              <div className="relative">
                <input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Enter moderation password"
                  autoFocus
                  className="w-full pl-3.5 pr-10 py-2.5 bg-gray-50 dark:bg-[#0e1218] border border-gray-300 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500 transition-all font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors cursor-pointer"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {loginError && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 rounded-xl text-xs text-red-600 dark:text-red-400 flex items-start gap-2"
              >
                <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                <span>{loginError}</span>
              </motion.div>
            )}

            <button
              type="submit"
              disabled={isSubmittingLogin || !passwordInput}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gray-900 hover:bg-black dark:bg-red-600 dark:hover:bg-red-700 text-white font-medium text-sm transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm cursor-pointer"
            >
              {isSubmittingLogin ? (
                <>
                  <RefreshCw className="animate-spin" size={16} />
                  <span>Verifying...</span>
                </>
              ) : (
                <>
                  <Lock size={16} />
                  <span>Access Moderation Panel</span>
                </>
              )}
            </button>
          </form>

          {/* Security footnote */}
          <div className="mt-6 pt-5 border-t border-gray-100 dark:border-gray-800/80 text-center">
            <div className="inline-flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
              <ShieldCheck size={13} className="text-emerald-500" />
              <span>Supabase Service Role Access Protected</span>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // AUTHENTICATED ADMIN MODERATION VIEW
  // --------------------------------------------------------------------------
  return (
    <div className="min-h-screen w-full bg-[#fbfbfa] dark:bg-[#0b0d11] text-gray-900 dark:text-gray-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white/90 dark:bg-[#12151c]/90 backdrop-blur-md border-b border-gray-200/80 dark:border-gray-800/80 px-4 lg:px-8 py-3.5 transition-colors">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Left Brand info */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-500/10 dark:bg-red-500/15 text-red-500 flex items-center justify-center ring-1 ring-red-500/20">
              <Shield size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm tracking-tight text-gray-900 dark:text-white">
                  Nikilow Admin Moderation
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Service Role Active
                </span>
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                Full authority to moderate, manage, and delete feed posts
              </p>
            </div>
          </div>

          {/* Right Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={fetchPosts}
              disabled={isLoadingPosts}
              title="Refresh feed list"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800/80 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors cursor-pointer"
            >
              <RefreshCw size={14} className={isLoadingPosts ? 'animate-spin text-blue-500' : ''} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button
              onClick={onBackToApp}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800/80 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors cursor-pointer"
            >
              <ArrowLeft size={14} />
              <span className="hidden sm:inline">Back to App</span>
            </button>

            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors cursor-pointer"
              title="End admin session"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Dashboard Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-8 space-y-6">
        {/* KPI Metrics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          <div className="bg-white dark:bg-[#151921] p-4 rounded-2xl border border-gray-200/80 dark:border-gray-800/80 shadow-2xs">
            <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Total Posts
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-semibold text-gray-900 dark:text-white">
                {stats.totalPosts}
              </span>
              <span className="text-xs text-gray-400">in database</span>
            </div>
          </div>

          <div className="bg-white dark:bg-[#151921] p-4 rounded-2xl border border-gray-200/80 dark:border-gray-800/80 shadow-2xs">
            <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Unique Authors
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-semibold text-gray-900 dark:text-white">
                {stats.uniqueAuthors}
              </span>
              <span className="text-xs text-gray-400">users posting</span>
            </div>
          </div>

          <div className="bg-white dark:bg-[#151921] p-4 rounded-2xl border border-gray-200/80 dark:border-gray-800/80 shadow-2xs">
            <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Total Likes
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-semibold text-rose-600 dark:text-rose-400">
                {stats.totalLikes}
              </span>
              <span className="text-xs text-gray-400">engagements</span>
            </div>
          </div>

          <div className="bg-white dark:bg-[#151921] p-4 rounded-2xl border border-gray-200/80 dark:border-gray-800/80 shadow-2xs">
            <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Verified Posts
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-semibold text-blue-600 dark:text-blue-400">
                {stats.verifiedCount}
              </span>
              <span className="text-xs text-gray-400">verified authors</span>
            </div>
          </div>
        </div>

        {/* Controls Toolbar: Search, Filters, and Bulk Actions */}
        <div className="bg-white dark:bg-[#151921] p-4 rounded-2xl border border-gray-200/80 dark:border-gray-800/80 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3.5">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search content, @username, author name, or post ID..."
              className="w-full pl-9 pr-8 py-2 bg-gray-50 dark:bg-[#0e1218] border border-gray-200 dark:border-gray-800 rounded-xl text-xs sm:text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-0.5"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filter Pills & Sorter */}
          <div className="flex flex-wrap items-center gap-2">
            {authorFilter && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 font-medium">
                <span>user: @{authorFilter}</span>
                <button
                  onClick={() => setAuthorFilter(null)}
                  className="hover:text-blue-900 dark:hover:text-white cursor-pointer"
                >
                  <X size={13} />
                </button>
              </div>
            )}

            {/* Sort options */}
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-[#0e1218] p-1 rounded-xl border border-gray-200 dark:border-gray-800 text-xs">
              <button
                onClick={() => setSortBy('newest')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                  sortBy === 'newest'
                    ? 'bg-white dark:bg-[#1e2430] text-gray-900 dark:text-white shadow-2xs'
                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                Newest
              </button>
              <button
                onClick={() => setSortBy('oldest')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                  sortBy === 'oldest'
                    ? 'bg-white dark:bg-[#1e2430] text-gray-900 dark:text-white shadow-2xs'
                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                Oldest
              </button>
              <button
                onClick={() => setSortBy('likes')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                  sortBy === 'likes'
                    ? 'bg-white dark:bg-[#1e2430] text-gray-900 dark:text-white shadow-2xs'
                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                Most Liked
              </button>
            </div>
          </div>
        </div>

        {/* Bulk Selection Bar (Shown if items exist) */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-3">
            <button
              onClick={() => toggleSelectAll(filteredPosts)}
              className="flex items-center gap-2 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors cursor-pointer"
            >
              {selectedIds.size > 0 && selectedIds.size === filteredPosts.length ? (
                <CheckSquare size={16} className="text-blue-500" />
              ) : (
                <Square size={16} />
              )}
              <span>
                {selectedIds.size > 0
                  ? `${selectedIds.size} of ${filteredPosts.length} selected`
                  : `Select All (${filteredPosts.length})`}
              </span>
            </button>

            {selectedIds.size > 0 && (
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-xs text-gray-500 hover:underline cursor-pointer"
              >
                Deselect
              </button>
            )}
          </div>

          {selectedIds.size > 0 && (
            <motion.button
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={() => setIsBulkDeleteModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-medium shadow-sm transition-colors cursor-pointer"
            >
              <Trash2 size={14} />
              <span>Delete Selected ({selectedIds.size})</span>
            </motion.button>
          )}
        </div>

        {/* Posts List / Table View */}
        {isLoadingPosts ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-gray-500">
            <RefreshCw size={28} className="animate-spin text-blue-500" />
            <p className="text-sm">Fetching posts with Supabase service role...</p>
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="bg-white dark:bg-[#151921] rounded-2xl border border-gray-200/80 dark:border-gray-800/80 p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-400 flex items-center justify-center mx-auto mb-3">
              <Search size={20} />
            </div>
            <h3 className="font-semibold text-gray-800 dark:text-gray-200 text-sm">
              No matching posts found
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-sm mx-auto">
              {searchQuery || authorFilter
                ? 'Try broadening your search query or removing the author filter.'
                : 'There are currently no posts recorded in the database.'}
            </p>
            {(searchQuery || authorFilter) && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setAuthorFilter(null);
                }}
                className="mt-4 px-3 py-1.5 rounded-xl text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredPosts.map((post) => {
              const isSelected = selectedIds.has(post.id);
              const isAuthorKodewt = post.author_username?.toLowerCase() === 'kodewt';

              return (
                <div
                  key={post.id}
                  className={`bg-white dark:bg-[#151921] rounded-2xl border transition-all p-4.5 sm:p-5 ${
                    isSelected
                      ? 'border-blue-500/50 bg-blue-50/20 dark:bg-blue-950/10 ring-1 ring-blue-500/30'
                      : 'border-gray-200/80 dark:border-gray-800/80 hover:border-gray-300 dark:hover:border-gray-700/80'
                  }`}
                >
                  <div className="flex items-start gap-3.5">
                    {/* Checkbox for batch action */}
                    <button
                      type="button"
                      onClick={() => toggleSelectPost(post.id)}
                      className="mt-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                      title={isSelected ? 'Deselect' : 'Select'}
                    >
                      {isSelected ? (
                        <CheckSquare size={18} className="text-blue-500" />
                      ) : (
                        <Square size={18} />
                      )}
                    </button>

                    {/* Author avatar */}
                    <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 bg-gray-100 dark:bg-gray-800 ring-1 ring-gray-200 dark:ring-gray-700/70">
                      {post.author_avatar ? (
                        <img
                          src={post.author_avatar}
                          alt={post.author_name}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center font-bold text-sm text-gray-500 uppercase">
                          {post.author_username ? post.author_username[0] : 'U'}
                        </div>
                      )}
                    </div>

                    {/* Post Content & Details */}
                    <div className="flex-1 min-w-0">
                      {/* Top Header metadata */}
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                            {post.author_name || post.author_username}
                          </span>
                          {(post.is_verified || isAuthorKodewt) && (
                            <VerifiedBadge size="sm" />
                          )}
                          <button
                            onClick={() => setAuthorFilter(post.author_username)}
                            className="text-xs text-gray-500 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 font-mono transition-colors cursor-pointer"
                            title={`Filter posts by @${post.author_username}`}
                          >
                            @{post.author_username}
                          </button>
                          <span className="text-gray-300 dark:text-gray-700">•</span>
                          <span
                            className="text-xs text-gray-400"
                            title={formatDate(post.created_at)}
                          >
                            {formatTimeAgo(post.created_at)}
                          </span>
                        </div>

                        {/* Badges / Likes */}
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-600 dark:text-rose-400">
                            <Heart size={12} className="fill-rose-500/20" />
                            <span>{post.likes_count || 0}</span>
                          </span>
                        </div>
                      </div>

                      {/* Content Body */}
                      <div className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed break-words whitespace-pre-wrap font-sans py-1">
                        {renderMentions(post.content, (uname) => {
                          if (onViewProfile) onViewProfile(uname);
                        })}
                      </div>

                      {/* Footer Details: ID tags & Moderation Actions */}
                      <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-gray-800/60 flex flex-wrap items-center justify-between gap-3 text-xs">
                        {/* ID tags */}
                        <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-gray-400 dark:text-gray-500">
                          <div className="flex items-center gap-1 bg-gray-50 dark:bg-[#0e1218] px-2 py-0.5 rounded-md border border-gray-200 dark:border-gray-800">
                            <span>ID: {post.id}</span>
                            <button
                              onClick={() => handleCopy(post.id, `id_${post.id}`)}
                              title="Copy Post ID"
                              className="hover:text-gray-700 dark:hover:text-gray-300"
                            >
                              {copiedId === `id_${post.id}` ? (
                                <Check size={12} className="text-emerald-500" />
                              ) : (
                                <Copy size={12} />
                              )}
                            </button>
                          </div>

                          <div className="flex items-center gap-1 bg-gray-50 dark:bg-[#0e1218] px-2 py-0.5 rounded-md border border-gray-200 dark:border-gray-800">
                            <span>UID: {post.user_id.substring(0, 8)}...</span>
                            <button
                              onClick={() => handleCopy(post.user_id, `uid_${post.user_id}`)}
                              title="Copy User ID"
                              className="hover:text-gray-700 dark:hover:text-gray-300"
                            >
                              {copiedId === `uid_${post.user_id}` ? (
                                <Check size={12} className="text-emerald-500" />
                              ) : (
                                <Copy size={12} />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleCopy(post.content, `content_${post.id}`)}
                            className="px-2.5 py-1 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center gap-1 cursor-pointer"
                            title="Copy post content"
                          >
                            {copiedId === `content_${post.id}` ? (
                              <>
                                <Check size={13} className="text-emerald-500" />
                                <span>Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy size={13} />
                                <span>Copy Text</span>
                              </>
                            )}
                          </button>

                          <button
                            onClick={() => setAuthorFilter(post.author_username)}
                            className="px-2.5 py-1 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors cursor-pointer"
                          >
                            Filter User
                          </button>

                          {/* Delete Action */}
                          <button
                            onClick={() => setPostToDelete(post)}
                            className="px-2.5 py-1 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 font-medium transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 size={13} />
                            <span>Delete Post</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Confirmation Modal for Single Delete */}
      <AnimatePresence>
        {postToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-white dark:bg-[#151921] border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                  <Trash2 size={20} />
                </div>
                <h3 className="font-semibold text-base text-gray-900 dark:text-white">
                  Delete this post permanently?
                </h3>
              </div>

              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                You are about to remove this post using administrative service privileges. This action directly purges the post and its likes from the database.
              </p>

              {/* Preview of the post */}
              <div className="p-3.5 bg-gray-50 dark:bg-[#0e1218] border border-gray-200 dark:border-gray-800 rounded-xl text-xs space-y-1.5">
                <div className="font-medium text-gray-700 dark:text-gray-300">
                  @{postToDelete.author_username}
                </div>
                <div className="text-gray-600 dark:text-gray-400 line-clamp-3 italic">
                  "{postToDelete.content}"
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setPostToDelete(null)}
                  disabled={isDeleting}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-medium transition-colors shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isDeleting ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 size={13} />
                      <span>Delete Permanently</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal for Bulk Delete */}
      <AnimatePresence>
        {isBulkDeleteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-white dark:bg-[#151921] border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                  <Trash2 size={20} />
                </div>
                <h3 className="font-semibold text-base text-gray-900 dark:text-white">
                  Bulk Delete {selectedIds.size} Posts?
                </h3>
              </div>

              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                You are about to permanently delete <strong>{selectedIds.size} selected posts</strong> from the database. This action is irreversible.
              </p>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsBulkDeleteModalOpen(false)}
                  disabled={isDeleting}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmBulkDelete}
                  disabled={isDeleting}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-medium transition-colors shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isDeleting ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      <span>Deleting {selectedIds.size} Posts...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 size={13} />
                      <span>Delete All Selected</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={`fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-xl shadow-lg border text-xs font-medium flex items-center gap-2 ${
              toast.type === 'error'
                ? 'bg-red-600 text-white border-red-700'
                : toast.type === 'info'
                ? 'bg-gray-900 text-white dark:bg-gray-800 border-gray-700'
                : 'bg-emerald-600 text-white border-emerald-700'
            }`}
          >
            {toast.type === 'error' ? (
              <AlertTriangle size={15} />
            ) : (
              <Check size={15} />
            )}
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
