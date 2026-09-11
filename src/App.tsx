import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { FeedView } from './components/FeedView';
import { ProfileView } from './components/ProfileView';
import { AppleNavBar } from './components/AppleNavBar';
import { EditProfileModal } from './components/EditProfileModal';
import { ConfirmModal } from './components/ConfirmModal';
import { AuthModal } from './components/AuthModal';
import { AdminPanel } from './components/AdminPanel';
import {
  ActiveTab,
  ChatSession,
  Message,
  Post,
  ThemeMode,
  UserProfile,
  CompanionPersonality,
  DEFAULT_NIKILOW_PERSONALITY,
} from './types';
import {
  loadSavedSessions,
  saveSessions,
  loadActiveChatId,
  saveActiveChatId,
  clearSavedSessions,
  loadSavedTheme,
  saveTheme,
  createNewSession,
  loadCompanionPersonality,
  saveCompanionPersonality,
  resetCompanionPersonality,
} from './utils/storage';
import {
  getPostRateLimitStatus,
  recordPostTimestamp,
} from './utils/rateLimit';
import {
  supabase,
  fetchUserProfile,
  syncChatToSupabase,
  loadChatsFromSupabase,
  fetchFeedPosts,
  createFeedPost,
  deleteFeedPost,
  togglePostLike,
  fetchProfileByUsername,
  savePersonalityToAccount,
  loadPersonalityFromAccount,
} from './lib/supabase';

export default function App() {
  // Navigation active tab: 'feed' | 'chat' | 'profile'
  const [activeTab, setActiveTab] = useState<ActiveTab>('chat');

  // URL route path tracking (supports direct /admin navigation)
  const [currentPath, setCurrentPath] = useState<string>(() => window.location.pathname);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = useCallback((path: string) => {
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }
    setCurrentPath(path);
  }, []);

  // Viewing a specific profile (when clicking a mention or user avatar)
  const [viewedProfile, setViewedProfile] = useState<UserProfile | null>(null);

  // Theme state
  const [theme, setTheme] = useState<ThemeMode>(() => loadSavedTheme());

  // Apply theme class to document
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    saveTheme(theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // User Profile & Authentication state
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  // Companion personality state (Nikilow by default, customizable via menu)
  const [personality, setPersonality] = useState<CompanionPersonality>(() =>
    loadCompanionPersonality()
  );

  const handleSavePersonality = useCallback(
    async (updated: CompanionPersonality) => {
      saveCompanionPersonality(updated);
      setPersonality(updated);

      if (userProfile?.id) {
        await savePersonalityToAccount(userProfile.id, updated);
        setUserProfile((prev) =>
          prev
            ? {
                ...prev,
                companion_personality: updated,
                companion_name: updated.name,
                companion_prompt: updated.prompt,
                companion_avatar_url: updated.avatarUrl,
              }
            : null
        );
      }
    },
    [userProfile?.id]
  );

  const handleResetPersonality = useCallback(async () => {
    const reset = resetCompanionPersonality();
    setPersonality(reset);

    if (userProfile?.id) {
      await savePersonalityToAccount(userProfile.id, reset);
      setUserProfile((prev) =>
        prev
          ? {
                ...prev,
                companion_personality: reset,
                companion_name: reset.name,
                companion_prompt: reset.prompt,
                companion_avatar_url: reset.avatarUrl,
              }
          : null
      );
    }
  }, [userProfile?.id]);

  // Posts Feed State
  const [posts, setPosts] = useState<Post[]>([]);
  const [isRefreshingFeed, setIsRefreshingFeed] = useState(false);

  // Modals state
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);

  // Sessions state
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const saved = loadSavedSessions();
    if (saved.length > 0) return saved;
    const initial = createNewSession();
    return [initial];
  });

  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    const savedId = loadActiveChatId();
    if (savedId && sessions.some((s) => s.id === savedId)) {
      return savedId;
    }
    return sessions[0]?.id || '';
  });

  // Mobile sidebar (drawer) state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Streaming status & abort controller
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load Feed Posts on mount
  const refreshPosts = useCallback(async () => {
    try {
      setIsRefreshingFeed(true);
      const fetched = await fetchFeedPosts(userProfile?.id);
      setPosts(fetched);
    } catch (err) {
      console.warn('Refresh feed posts notice:', err);
    } finally {
      setIsRefreshingFeed(false);
    }
  }, [userProfile?.id]);

  useEffect(() => {
    refreshPosts();
  }, [refreshPosts]);

  // Helper: safely merge cloud chats with local sessions without overwriting active messages
  const mergeChatSessions = (cloudList: ChatSession[], currentList: ChatSession[]): ChatSession[] => {
    if (!cloudList || cloudList.length === 0) return currentList;
    const map = new Map<string, ChatSession>();

    // Index cloud sessions
    for (const c of cloudList) {
      map.set(c.id, c);
    }

    // Overlay current local sessions
    for (const cur of currentList) {
      const existing = map.get(cur.id);
      if (!existing) {
        // If current local session has any messages or map is empty, preserve it
        if (cur.messages.length > 0 || map.size === 0) {
          map.set(cur.id, cur);
        }
      } else {
        // Keep whichever has more messages or more recent updates
        const preferLocal =
          cur.messages.length >= existing.messages.length || cur.updatedAt >= existing.updatedAt;
        map.set(cur.id, {
          ...(preferLocal ? existing : cur),
          ...(preferLocal ? cur : existing),
          messages: cur.messages.length >= existing.messages.length ? cur.messages : existing.messages,
        });
      }
    }

    const merged = Array.from(map.values()).sort((a, b) => b.updatedAt - a.updatedAt);
    return merged.length > 0 ? merged : currentList;
  };

  // Sync profile, personality & chats on Supabase auth change
  useEffect(() => {
    // Check initial auth session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const profile = await fetchUserProfile(session.user.id);
        if (profile) {
          setUserProfile(profile);
        }

        // Restore companion personality saved to account
        const accountPersonality =
          profile?.companion_personality ||
          (await loadPersonalityFromAccount(session.user.id));
        if (accountPersonality) {
          setPersonality(accountPersonality);
          saveCompanionPersonality(accountPersonality);
        }

        // Safely merge chats from Supabase without deleting active messages
        const cloudChats = await loadChatsFromSupabase(session.user.id);
        if (cloudChats && cloudChats.length > 0) {
          setSessions((prev) => {
            const merged = mergeChatSessions(cloudChats, prev);
            saveSessions(merged);
            return merged;
          });
          setActiveSessionId((prevId) => {
            if (prevId) return prevId;
            return cloudChats[0].id;
          });
        }
      }
    });

    // Listen to auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const profile = await fetchUserProfile(session.user.id);
        if (profile) {
          setUserProfile(profile);
        }

        // Restore companion personality saved to account
        const accountPersonality =
          profile?.companion_personality ||
          (await loadPersonalityFromAccount(session.user.id));
        if (accountPersonality) {
          setPersonality(accountPersonality);
          saveCompanionPersonality(accountPersonality);
        }

        const cloudChats = await loadChatsFromSupabase(session.user.id);
        if (cloudChats && cloudChats.length > 0) {
          setSessions((prev) => {
            const merged = mergeChatSessions(cloudChats, prev);
            saveSessions(merged);
            return merged;
          });
        }
      } else {
        setUserProfile(null);
        const local = loadCompanionPersonality();
        setPersonality(local);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Ensure activeSessionId stays synchronized with valid sessions
  useEffect(() => {
    if (sessions.length > 0 && (!activeSessionId || !sessions.some((s) => s.id === activeSessionId))) {
      setActiveSessionId(sessions[0].id);
    }
  }, [sessions, activeSessionId]);

  // Save sessions to localStorage whenever they change
  useEffect(() => {
    if (sessions.length > 0) {
      saveSessions(sessions);
    }
  }, [sessions]);

  // Save active session id
  useEffect(() => {
    if (activeSessionId) {
      saveActiveChatId(activeSessionId);
    }
  }, [activeSessionId]);

  // Find active session
  const activeSession = useMemo(() => {
    return (
      sessions.find((s) => s.id === activeSessionId) ||
      sessions[0] ||
      createNewSession()
    );
  }, [sessions, activeSessionId]);

  const handleStopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  // Navigation handlers
  const handleTabChange = (tab: ActiveTab) => {
    // If switching to profile directly via bottom bar, show current user's profile
    if (tab === 'profile') {
      setViewedProfile(null);
    }
    setActiveTab(tab);
  };

  // Open/Close Menu drawer
  const handleOpenMenu = useCallback(() => {
    setIsSidebarOpen((prev) => !prev);
  }, []);

  const handleCloseSidebar = useCallback(() => {
    setIsSidebarOpen(false);
  }, []);

  const handleOpenClearModal = useCallback(() => {
    setIsClearModalOpen(true);
  }, []);

  const handleOpenAuthModal = useCallback(() => {
    setIsAuthModalOpen(true);
  }, []);

  // View user profile (e.g. from @mentions or clicking user avatar)
  const handleViewProfile = async (username: string) => {
    const clean = username.trim().toLowerCase().replace(/^@/, '');

    // Companion profile view is disabled as personality is dynamic and customizable
    if (clean === 'nikilow' || clean === personality.name.toLowerCase()) {
      return;
    }

    // If it's @kodewt
    if (clean === 'kodewt') {
      if (userProfile?.username.toLowerCase() === 'kodewt') {
        setViewedProfile(userProfile);
      } else {
        const found = await fetchProfileByUsername('kodewt');
        setViewedProfile(
          found || {
            id: 'kodewt_creator',
            name: 'kodewt',
            username: 'kodewt',
            email: 'kodewt@creator.dev',
            avatar_url:
              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
            bio: 'software architect and designer.',
            is_verified: true,
            created_at: new Date(Date.now() - 86400000 * 60).toISOString(),
            updated_at: new Date().toISOString(),
          }
        );
      }
      setActiveTab('profile');
      return;
    }

    // If it's the current user
    if (userProfile && userProfile.username.toLowerCase() === clean) {
      setViewedProfile(null);
      setActiveTab('profile');
      return;
    }

    // Lookup in Supabase or local posts
    const foundProfile = await fetchProfileByUsername(clean);
    if (foundProfile) {
      setViewedProfile(foundProfile);
    } else {
      // Find author from posts as fallback
      const matchingPost = posts.find(
        (p) => p.authorUsername.toLowerCase() === clean
      );
      setViewedProfile({
        id: matchingPost?.userId || `user_${clean}`,
        name: matchingPost?.authorName || clean,
        username: clean,
        email: `${clean}@community.local`,
        avatar_url: matchingPost?.authorAvatar || '',
        bio: `member of the nikilow community.`,
        is_verified: clean === 'kodewt',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    setActiveTab('profile');
  };

  // Back button handler when viewing another user's profile
  const handleBackFromProfile = () => {
    setViewedProfile(null);
  };

  // Add post handler (max 300 chars) - instant optimistic update with 5-minute rate limit
  const handleAddPost = async (content: string) => {
    if (!userProfile) {
      setIsAuthModalOpen(true);
      throw new Error('Please sign in to publish posts.');
    }

    const trimmed = content.trim();
    if (!trimmed) return;

    // Check 5-minute rate limit for posting updates
    const userPosts = posts.filter(
      (p) =>
        p.userId === userProfile.id ||
        p.authorUsername.toLowerCase() === userProfile.username.toLowerCase()
    );
    const rateLimit = getPostRateLimitStatus(userProfile.id, userPosts);
    if (rateLimit.isRateLimited) {
      throw new Error(
        `Rate limit active: you can only post updates once every 5 minutes (wait ${rateLimit.formattedRemaining}).`
      );
    }

    const now = Date.now();
    const tempId = 'post_' + now + '_' + Math.random().toString(36).substring(2, 6);
    const isKodewt = userProfile.username.toLowerCase() === 'kodewt';
    const optimisticPost: Post = {
      id: tempId,
      userId: userProfile.id,
      authorName: userProfile.name || userProfile.username,
      authorUsername: userProfile.username,
      authorAvatar: userProfile.avatar_url || '',
      content: trimmed,
      createdAt: now,
      likesCount: 0,
      isLiked: false,
      isVerified: isKodewt || Boolean(userProfile.is_verified),
    };

    // 1. Instant visual display
    setPosts((prev) => [optimisticPost, ...prev]);

    // 2. Background database persistence
    try {
      const savedPost = await createFeedPost(
        { content: trimmed, userProfile, skipRateLimitCheck: true },
        undefined,
        true
      );
      if (savedPost) {
        setPosts((prev) =>
          prev.map((p) => (p.id === tempId ? { ...savedPost, isLiked: false } : p))
        );
      }
    } catch (err) {
      // Revert optimistic post on failure
      setPosts((prev) => prev.filter((p) => p.id !== tempId));
      console.error('Failed to sync post to database:', err);
      throw err;
    }
  };

  // Delete post handler - instant removal
  const handleDeletePost = async (postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    try {
      await deleteFeedPost(postId, userProfile?.id);
    } catch (err) {
      console.warn('Failed to delete post from remote:', err);
    }
  };

  // Like post handler - instant toggle
  const handleLikePost = async (postId: string) => {
    const post = posts.find((p) => p.id === postId);
    if (!post) return;

    // Instant optimistic toggle
    const willBeLiked = !post.isLiked;
    const newLikesCount = willBeLiked
      ? (post.likesCount || 0) + 1
      : Math.max(0, (post.likesCount || 0) - 1);

    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, isLiked: willBeLiked, likesCount: newLikesCount }
          : p
      )
    );

    try {
      await togglePostLike(postId, userProfile?.id);
    } catch (err) {
      console.warn('togglePostLike error:', err);
    }
  };

  // Profile updated handler
  const handleProfileUpdated = (updated: UserProfile) => {
    setUserProfile(updated);
    if (viewedProfile?.id === updated.id) {
      setViewedProfile(updated);
    }

    // Also update any posts authored by this user
    setPosts((prev) =>
      prev.map((p) => {
        if (p.userId === updated.id || p.authorUsername === updated.username) {
          return {
            ...p,
            authorName: updated.name,
            authorUsername: updated.username,
            authorAvatar: updated.avatar_url,
            isVerified: updated.username === 'kodewt' || updated.is_verified,
          };
        }
        return p;
      })
    );
  };

  // Sign out handler
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUserProfile(null);
    setViewedProfile(null);
  };

  // Chat Sessions handlers
  const handleNewSession = () => {
    if (isStreaming) {
      handleStopStreaming();
    }
    const newSession = createNewSession();
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    setActiveTab('chat');
  };

  const handleSelectSession = (id: string) => {
    if (isStreaming) {
      handleStopStreaming();
    }
    setActiveSessionId(id);
    setActiveTab('chat');
  };

  const handleDeleteSession = (id: string) => {
    setSessions((prev) => {
      const remaining = prev.filter((s) => s.id !== id);
      if (remaining.length === 0) {
        const fresh = createNewSession();
        setActiveSessionId(fresh.id);
        return [fresh];
      }
      if (activeSessionId === id) {
        setActiveSessionId(remaining[0].id);
      }
      return remaining;
    });
  };

  const handleClearAllConfirm = () => {
    if (isStreaming) {
      handleStopStreaming();
    }
    clearSavedSessions();
    const fresh = createNewSession();
    setSessions([fresh]);
    setActiveSessionId(fresh.id);
    setIsClearModalOpen(false);
  };

  // Send message to Nikilow
  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isStreaming) return;

    const cleanUserText = text.trim();
    const currentSessionId = activeSession.id;

    const userMessage: Message = {
      id: 'msg_u_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      role: 'user',
      content: cleanUserText,
      createdAt: Date.now(),
    };

    const assistantPlaceholderId =
      'msg_a_' + (Date.now() + 1) + '_' + Math.random().toString(36).substring(2, 6);
    const assistantMessage: Message = {
      id: assistantPlaceholderId,
      role: 'assistant',
      content: '',
      createdAt: Date.now(),
    };

    // Grab current messages before state update for history
    const existingMessages = activeSession.messages || [];
    const conversationHistory = [
      ...existingMessages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      { role: 'user', content: cleanUserText },
    ];

    // Atomically update sessions state and persist to localStorage
    setSessions((prev) => {
      const exists = prev.some((s) => s.id === currentSessionId);
      let next: ChatSession[];
      if (exists) {
        next = prev.map((s) => {
          if (s.id === currentSessionId) {
            const isFirst = s.messages.length === 0;
            return {
              ...s,
              title: isFirst ? cleanUserText.slice(0, 32) : s.title,
              updatedAt: Date.now(),
              messages: [...s.messages, userMessage, assistantMessage],
            };
          }
          return s;
        });
      } else {
        const freshSession: ChatSession = {
          ...activeSession,
          id: currentSessionId,
          title: cleanUserText.slice(0, 32),
          updatedAt: Date.now(),
          messages: [...existingMessages, userMessage, assistantMessage],
        };
        next = [freshSession, ...prev];
      }
      saveSessions(next);
      return next;
    });

    setActiveSessionId(currentSessionId);

    // Build cross-chat context from all other sessions so Nikilow remembers everything across chats
    const otherSessions = sessions.filter((s) => s.id !== currentSessionId);
    const crossChatNotes: string[] = [];
    for (const s of otherSessions) {
      if (s.messages.length > 0) {
        const userMsgs = s.messages
          .filter((m) => m.role === 'user')
          .map((m) => m.content.trim())
          .filter(Boolean);
        if (userMsgs.length > 0) {
          crossChatNotes.push(
            `[Chat "${s.title}"]: ${userMsgs.slice(-3).join(' | ')}`
          );
        }
      }
    }
    const crossChatContext = crossChatNotes.slice(0, 10).join('\n');

    setIsStreaming(true);
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: conversationHistory,
          userProfile: userProfile
            ? { name: userProfile.name, username: userProfile.username }
            : undefined,
          crossChatContext: crossChatContext || undefined,
          customPersonality: personality,
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      if (!response.body) {
        throw new Error('No response stream body received');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedText = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const dataStr = trimmed.replace(/^data:\s*/, '');

          if (dataStr === '[DONE]') {
            break;
          }

          try {
            const parsed = JSON.parse(dataStr);
            if (parsed.error) {
              const errTxt = parsed.error;
              accumulatedText = accumulatedText
                ? `${accumulatedText}\n\n${errTxt}`
                : errTxt;
            } else if (parsed.text) {
              accumulatedText += parsed.text;
            }

            setSessions((prev) =>
              prev.map((s) => {
                if (s.id === currentSessionId) {
                  return {
                    ...s,
                    updatedAt: Date.now(),
                    messages: s.messages.map((m) =>
                      m.id === assistantPlaceholderId
                        ? { ...m, content: accumulatedText }
                        : m
                    ),
                  };
                }
                return s;
              })
            );
          } catch {
            // ignore non-json SSE frames
          }
        }
      }

      // Persist completed conversation state to localStorage and Supabase
      setSessions((prev) => {
        const updated = prev.map((s) => {
          if (s.id === currentSessionId) {
            return {
              ...s,
              updatedAt: Date.now(),
              messages: s.messages.map((m) =>
                m.id === assistantPlaceholderId
                  ? { ...m, content: accumulatedText || m.content }
                  : m
              ),
            };
          }
          return s;
        });
        saveSessions(updated);

        // Sync to Supabase if logged in
        if (userProfile?.id && accumulatedText) {
          const currentChat = updated.find((s) => s.id === currentSessionId);
          if (currentChat) {
            syncChatToSupabase(currentChat, userProfile.id);
          }
        }

        return updated;
      });
    } catch (err: unknown) {
      const error = err as Error;
      if (error.name !== 'AbortError') {
        console.warn('Chat request notice:', error.message || error);
        setSessions((prev) => {
          const updated = prev.map((s) => {
            if (s.id === currentSessionId) {
              return {
                ...s,
                messages: s.messages.map((m) =>
                  m.id === assistantPlaceholderId
                    ? {
                        ...m,
                        content:
                          m.content ||
                          "I got lost in thought for a second. Could you say that again?",
                      }
                    : m
                ),
              };
            }
            return s;
          });
          saveSessions(updated);
          return updated;
        });
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
      setSessions((prev) => {
        saveSessions(prev);
        return prev;
      });
    }
  };

  // Render Admin Moderation Portal if path is /admin
  if (currentPath === '/admin') {
    return (
      <div className={`min-h-screen w-full ${theme === 'dark' ? 'dark' : ''}`}>
        <AdminPanel
          onBackToApp={() => {
            navigateTo('/');
            refreshPosts();
          }}
          onViewProfile={(username) => {
            navigateTo('/');
            handleViewProfile(username);
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#fbfbfa] dark:bg-[#0b0d11] text-gray-900 dark:text-gray-100 font-sans selection:bg-gray-300 dark:selection:bg-gray-700 relative">
      {/* Slide-in menu & chat history drawer */}
      <Sidebar
        sessions={sessions}
        activeId={activeSession.id}
        onSelectSession={handleSelectSession}
        onNewSession={handleNewSession}
        onDeleteSession={handleDeleteSession}
        onClearAll={handleOpenClearModal}
        theme={theme}
        onToggleTheme={toggleTheme}
        isOpen={isSidebarOpen}
        onCloseMobile={handleCloseSidebar}
        userProfile={userProfile}
        onOpenProfile={() => {
          setViewedProfile(null);
          setActiveTab('profile');
        }}
        onOpenAuth={handleOpenAuthModal}
        personality={personality}
        onSavePersonality={handleSavePersonality}
        onResetPersonality={handleResetPersonality}
      />

      {/* Main Content Area switched by Apple Nav Bar */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {activeTab === 'feed' && (
          <FeedView
            posts={posts}
            userProfile={userProfile}
            onAddPost={handleAddPost}
            onLikePost={handleLikePost}
            onDeletePost={handleDeletePost}
            onViewProfile={handleViewProfile}
            onOpenAuth={() => setIsAuthModalOpen(true)}
            onRefreshFeed={refreshPosts}
            isRefreshing={isRefreshingFeed}
            onOpenMenu={handleOpenMenu}
          />
        )}

        {activeTab === 'chat' && (
          <ChatArea
            messages={activeSession.messages}
            isStreaming={isStreaming}
            onSendMessage={handleSendMessage}
            onStopStreaming={handleStopStreaming}
            onOpenMenu={handleOpenMenu}
            onNewChat={handleNewSession}
            userProfile={userProfile}
            onOpenProfile={() => setActiveTab('profile')}
            onOpenAuth={() => setIsAuthModalOpen(true)}
            personality={personality}
            onMentionClick={handleViewProfile}
          />
        )}

        {activeTab === 'profile' && (
          <ProfileView
            currentUser={userProfile}
            viewedUser={viewedProfile}
            posts={posts}
            onBack={viewedProfile ? handleBackFromProfile : undefined}
            onEditProfile={() => setIsEditProfileOpen(true)}
            onSignOut={handleSignOut}
            onOpenAuth={() => setIsAuthModalOpen(true)}
            onAddPost={handleAddPost}
            onLikePost={handleLikePost}
            onDeletePost={handleDeletePost}
            onViewProfile={handleViewProfile}
            onStartChatWithNikilow={() => {
              setViewedProfile(null);
              setActiveTab('chat');
            }}
            onOpenMenu={handleOpenMenu}
          />
        )}

        {/* Apple-style Bottom Navigation Bar (Both Desktop & Mobile) */}
        <AppleNavBar
          activeTab={activeTab}
          onTabChange={handleTabChange}
          userProfile={userProfile}
        />
      </main>

      {/* Edit Profile Modal */}
      {userProfile && (
        <EditProfileModal
          isOpen={isEditProfileOpen}
          onClose={() => setIsEditProfileOpen(false)}
          userProfile={userProfile}
          onProfileUpdated={handleProfileUpdated}
        />
      )}

      {/* Authentication Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={(profile) => {
          setUserProfile(profile);
          // If @kodewt, refresh posts to reflect status
          refreshPosts();
        }}
      />

      {/* Clear all conversations confirmation modal */}
      <ConfirmModal
        isOpen={isClearModalOpen}
        title="clear all conversations?"
        message={`all your past chats with ${personality.name.toLowerCase()} will be permanently deleted from this device. this action cannot be undone.`}
        confirmLabel="clear everything"
        cancelLabel="keep conversations"
        danger={true}
        onConfirm={handleClearAllConfirm}
        onCancel={() => setIsClearModalOpen(false)}
      />
    </div>
  );
}
