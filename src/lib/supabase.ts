import { createClient } from '@supabase/supabase-js';
import {
  ChatSession,
  Message,
  UserProfile,
  Post,
  NIKILOW_AVATAR,
  CompanionPersonality,
} from '../types';
import { getPostRateLimitStatus, recordPostTimestamp } from '../utils/rateLimit';

export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://pbvistgowxkhoifafuky.supabase.co';

export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBidmlzdGdvd3hraG9pZmFmdWt5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2MTAzOTEsImV4cCI6MjEwNDE4NjM5MX0.HFoWbRbzY2nFl-2hGDcr2-2r5oQNtIjb3B4FIFJLINM';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Register a new user with name, username, email, and password.
 */
export async function signUpUser({
  name,
  username,
  email,
  password,
}: {
  name: string;
  username: string;
  email: string;
  password: string;
}) {
  const cleanUsername = username.trim().toLowerCase().replace(/^@/, '');
  const cleanEmail = email.trim().toLowerCase();

  // 1. Check if username is already taken in profiles table
  try {
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('id')
      .ilike('username', cleanUsername)
      .maybeSingle();

    if (existingUser) {
      throw new Error(`Username @${cleanUsername} is already taken. Please choose another.`);
    }
  } catch (err: unknown) {
    // If profiles table doesn't exist yet before user runs SQL script, proceed with auth signup
    const message = (err as Error)?.message || '';
    if (message.includes('already taken')) {
      throw err;
    }
  }

  // 2. Perform Supabase signup
  const { data, error } = await supabase.auth.signUp({
    email: cleanEmail,
    password,
    options: {
      data: {
        name: name.trim(),
        username: cleanUsername,
      },
    },
  });

  if (error) {
    throw error;
  }

  if (data.user) {
    // 3. Upsert profile row
    try {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        name: name.trim(),
        username: cleanUsername,
        email: cleanEmail,
        avatar_url: '',
        bio: 'Hey there! I am chatting with Nikilow.',
        updated_at: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('Could not auto-insert profile (run supabase_schema.sql):', e);
    }
  }

  return data;
}

/**
 * Login user using either username or email.
 */
export async function signInUser({
  identifier,
  password,
}: {
  identifier: string;
  password: string;
}) {
  const trimmed = identifier.trim();
  let emailToUse = trimmed;

  // Check if identifier is an email (contains @ and .)
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);

  if (!isEmail) {
    // User entered a username! Look up email from profiles table
    const cleanUsername = trimmed.toLowerCase().replace(/^@/, '');
    
    // First try RPC function if created
    let foundEmail: string | null = null;
    try {
      const { data: rpcEmail, error: rpcErr } = await supabase.rpc('get_email_by_username', {
        username_input: cleanUsername,
      });
      if (!rpcErr && rpcEmail) {
        foundEmail = rpcEmail;
      }
    } catch {
      // ignore
    }

    if (!foundEmail) {
      // Fallback query directly from profiles
      const { data: profileData, error: profileErr } = await supabase
        .from('profiles')
        .select('email')
        .ilike('username', cleanUsername)
        .maybeSingle();

      if (profileErr || !profileData?.email) {
        throw new Error(
          `No user found with username "@${cleanUsername}". You can also sign in with your email.`
        );
      }
      foundEmail = profileData.email;
    }

    emailToUse = foundEmail;
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: emailToUse,
    password,
  });

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Sign out
 */
export async function signOutUser() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.warn('Sign out notice:', error.message || error);
  }
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Helper to safely extract companion personality from database rows, metadata, or API payloads
 */
export function parseCompanionPersonality(raw: any): CompanionPersonality | undefined {
  if (!raw) return undefined;

  if (
    raw.companion_personality &&
    typeof raw.companion_personality === 'object' &&
    raw.companion_personality.name
  ) {
    return {
      name: raw.companion_personality.name,
      prompt: raw.companion_personality.prompt || '',
      avatarUrl:
        raw.companion_personality.avatarUrl ||
        raw.companion_personality.avatar_url ||
        '',
    };
  }

  if (raw.companion_name || raw.companion_prompt || raw.companion_avatar_url) {
    return {
      name: raw.companion_name || 'nikilow',
      prompt: raw.companion_prompt || '',
      avatarUrl: raw.companion_avatar_url || '',
    };
  }

  return undefined;
}

/**
 * Fetch profile for a user
 */
export async function fetchUserProfile(userId: string): Promise<UserProfile | null> {
  const isUuid = UUID_REGEX.test(userId);

  // 1. Check server-side persistent profile store (fastest, guaranteed persistent across reloads)
  try {
    const srvRes = await fetch(`/api/profile/${userId}`);
    if (srvRes.ok) {
      const srvData = await srvRes.json();
      if (srvData?.profile && (srvData.profile.name || srvData.profile.username)) {
        const isKodewt = srvData.profile.username?.toLowerCase() === 'kodewt';
        const companion = parseCompanionPersonality(srvData.profile);

        const profile: UserProfile = {
          id: srvData.profile.id || userId,
          name: srvData.profile.name || '',
          username: srvData.profile.username || '',
          email: srvData.profile.email || '',
          avatar_url: srvData.profile.avatar_url || '',
          bio: srvData.profile.bio || '',
          is_verified: isKodewt || srvData.profile.is_verified,
          companion_personality: companion,
          companion_name: companion?.name,
          companion_prompt: companion?.prompt,
          companion_avatar_url: companion?.avatarUrl,
        };

        try {
          localStorage.setItem(`nikilow_user_profile_${userId}`, JSON.stringify(profile));
          localStorage.setItem('nikilow_active_profile', JSON.stringify(profile));
          if (companion) {
            localStorage.setItem(`nikilow_companion_personality_${userId}`, JSON.stringify(companion));
          }
        } catch {
          // ignore
        }

        return profile;
      }
    }
  } catch {
    // Server fetch notice - continue to Supabase
  }

  // 2. If valid UUID, query Supabase profiles table
  if (isUuid) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (!error && data) {
        const isKodewt = data.username?.toLowerCase() === 'kodewt';
        const companion = parseCompanionPersonality(data);

        const profile: UserProfile = {
          id: data.id,
          name: data.name || '',
          username: data.username || '',
          email: data.email || '',
          avatar_url: data.avatar_url || '',
          bio: data.bio || '',
          is_verified: isKodewt || data.is_verified,
          companion_personality: companion,
          companion_name: companion?.name,
          companion_prompt: companion?.prompt,
          companion_avatar_url: companion?.avatarUrl,
        };

        // Update local cache
        try {
          localStorage.setItem(`nikilow_user_profile_${userId}`, JSON.stringify(profile));
          localStorage.setItem('nikilow_active_profile', JSON.stringify(profile));
          if (companion) {
            localStorage.setItem(`nikilow_companion_personality_${userId}`, JSON.stringify(companion));
          }
        } catch {
          // ignore
        }

        return profile;
      }
    } catch (err) {
      console.warn('fetchUserProfile query notice:', err);
    }
  }

  // 3. Fallback to auth session metadata
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const sessionUser = sessionData?.session?.user;
    if (sessionUser && (sessionUser.id === userId || !isUuid)) {
      const meta = sessionUser.user_metadata || {};
      const companion = parseCompanionPersonality(meta);

      const profile: UserProfile = {
        id: sessionUser.id,
        name: meta.name || sessionUser.email?.split('@')[0] || 'Anonymous',
        username: meta.username || sessionUser.email?.split('@')[0] || 'user',
        email: sessionUser.email || '',
        avatar_url: meta.avatar_url || '',
        bio: meta.bio || '',
        is_verified: meta.username?.toLowerCase() === 'kodewt',
        companion_personality: companion,
        companion_name: companion?.name,
        companion_prompt: companion?.prompt,
        companion_avatar_url: companion?.avatarUrl,
      };

      try {
        localStorage.setItem(`nikilow_user_profile_${userId}`, JSON.stringify(profile));
        localStorage.setItem('nikilow_active_profile', JSON.stringify(profile));
        if (companion) {
          localStorage.setItem(`nikilow_companion_personality_${userId}`, JSON.stringify(companion));
        }
      } catch {
        // ignore
      }

      return profile;
    }
  } catch (authErr) {
    console.warn('fetchUserProfile auth notice:', authErr);
  }

  // 4. Fallback to local storage cache
  try {
    const cached =
      localStorage.getItem(`nikilow_user_profile_${userId}`) ||
      localStorage.getItem('nikilow_active_profile');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && (parsed.id === userId || !userId)) {
        return parsed as UserProfile;
      }
    }
  } catch {
    // ignore
  }

  return null;
}

/**
 * Save companion personality to user's account across all layers:
 * 1. Supabase Auth user_metadata
 * 2. Supabase profiles table (companion_name, companion_prompt, companion_avatar_url, companion_personality)
 * 3. Server-side profile storage (/api/profile/personality)
 * 4. User-scoped LocalStorage cache
 */
export async function savePersonalityToAccount(
  userId: string,
  personality: CompanionPersonality
): Promise<boolean> {
  if (!userId) return false;

  // 1. Update Supabase Auth user_metadata
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData?.session?.user) {
      await supabase.auth.updateUser({
        data: {
          companion_personality: personality,
          companion_name: personality.name,
          companion_prompt: personality.prompt,
          companion_avatar_url: personality.avatarUrl,
        },
      });
    }
  } catch (authErr) {
    console.warn('savePersonalityToAccount auth metadata notice:', authErr);
  }

  // 2. Persist to server persistent store (/api/profile/personality)
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const authToken = sessionData?.session?.access_token || '';

    await fetch('/api/profile/personality', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        personality,
        authToken,
      }),
    });
  } catch (srvErr) {
    console.warn('savePersonalityToAccount server API notice:', srvErr);
  }

  // 3. Update Supabase profiles table directly if it exists
  const isUuid = UUID_REGEX.test(userId);
  if (isUuid) {
    try {
      await supabase
        .from('profiles')
        .update({
          companion_name: personality.name,
          companion_prompt: personality.prompt,
          companion_avatar_url: personality.avatarUrl,
          companion_personality: personality,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);
    } catch (dbErr) {
      console.warn('savePersonalityToAccount database notice:', dbErr);
    }
  }

  // 4. Update local storage caches
  try {
    localStorage.setItem(
      `nikilow_companion_personality_${userId}`,
      JSON.stringify(personality)
    );
    localStorage.setItem(
      'nikilow_companion_personality_v1',
      JSON.stringify(personality)
    );

    const cachedProfileKey = `nikilow_user_profile_${userId}`;
    const prev = localStorage.getItem(cachedProfileKey);
    if (prev) {
      const parsed = JSON.parse(prev);
      const merged = {
        ...parsed,
        companion_personality: personality,
        companion_name: personality.name,
        companion_prompt: personality.prompt,
        companion_avatar_url: personality.avatarUrl,
      };
      localStorage.setItem(cachedProfileKey, JSON.stringify(merged));
      localStorage.setItem('nikilow_active_profile', JSON.stringify(merged));
    }
  } catch {
    // ignore
  }

  return true;
}

/**
 * Load companion personality from user's account (or user's cached personality)
 */
export async function loadPersonalityFromAccount(
  userId: string
): Promise<CompanionPersonality | null> {
  if (!userId) return null;

  // 1. Check user-scoped local storage cache
  try {
    const cached = localStorage.getItem(`nikilow_companion_personality_${userId}`);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed?.name) return parsed as CompanionPersonality;
    }
  } catch {
    // ignore
  }

  // 2. Check profile
  try {
    const profile = await fetchUserProfile(userId);
    if (profile?.companion_personality) {
      return profile.companion_personality;
    }
  } catch {
    // ignore
  }

  return null;
}

/**
 * Update profile (persists to server storage, Supabase profiles table, auth metadata, and updates user's posts)
 */
export async function updateUserProfile(
  userId: string,
  updates: {
    name?: string;
    username?: string;
    avatar_url?: string;
    bio?: string;
  }
) {
  // 1. Get current authenticated user
  const { data: sessionData } = await supabase.auth.getSession();
  let authUser = sessionData?.session?.user;
  if (!authUser) {
    try {
      const { data: authData } = await supabase.auth.getUser();
      authUser = authData?.user;
    } catch {
      // ignore
    }
  }

  const targetId = authUser?.id || userId;
  const authEmail = authUser?.email || '';
  const authToken = sessionData?.session?.access_token || '';
  const isUuid = UUID_REGEX.test(targetId);

  const safeUpdates: Record<string, string> = {
    updated_at: new Date().toISOString(),
  };

  if (updates.name !== undefined) safeUpdates.name = updates.name.trim();
  if (updates.username !== undefined) {
    safeUpdates.username = updates.username.trim().toLowerCase().replace(/^@/, '');
  }
  if (updates.avatar_url !== undefined) {
    safeUpdates.avatar_url = updates.avatar_url;
  }
  if (updates.bio !== undefined) safeUpdates.bio = updates.bio.trim();

  // 2. Persist to server backend API immediately (guaranteed durable storage)
  try {
    await fetch('/api/profile/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: targetId,
        profile: {
          ...safeUpdates,
          email: authEmail,
        },
        authToken,
      }),
    });
  } catch (srvErr) {
    console.warn('Server profile update notice:', srvErr);
  }

  // 3. Persist to profiles table in Supabase directly
  if (isUuid) {
    try {
      const { error: updateErr, data: updatedRows } = await supabase
        .from('profiles')
        .update(safeUpdates)
        .eq('id', targetId)
        .select('id');

      if (updateErr || !updatedRows || updatedRows.length === 0) {
        const insertPayload: Record<string, any> = {
          id: targetId,
          name: safeUpdates.name || 'User',
          username: safeUpdates.username || authEmail.split('@')[0] || 'user',
          avatar_url: safeUpdates.avatar_url || '',
          bio: safeUpdates.bio || '',
          updated_at: new Date().toISOString(),
        };
        if (authEmail) {
          insertPayload.email = authEmail;
        }

        await supabase
          .from('profiles')
          .upsert(insertPayload, { onConflict: 'id' });
      }
    } catch (dbErr) {
      console.warn('profiles table persistence notice:', dbErr);
    }
  }

  // 4. Update Supabase Auth user_metadata
  try {
    const metaUpdates: Record<string, string> = {};
    if (safeUpdates.name) metaUpdates.name = safeUpdates.name;
    if (safeUpdates.username) metaUpdates.username = safeUpdates.username;
    if (safeUpdates.bio !== undefined) metaUpdates.bio = safeUpdates.bio;
    if (safeUpdates.avatar_url && safeUpdates.avatar_url.length < 35000) {
      metaUpdates.avatar_url = safeUpdates.avatar_url;
    }

    if (authUser && Object.keys(metaUpdates).length > 0) {
      await supabase.auth.updateUser({
        data: metaUpdates,
      });
    }
  } catch (authErr) {
    console.warn('auth.updateUser warning:', authErr);
  }

  // 5. Sync author info to user's posts in Supabase
  if (isUuid) {
    try {
      const postUpdates: Record<string, string> = {};
      if (safeUpdates.name) postUpdates.author_name = safeUpdates.name;
      if (safeUpdates.username) postUpdates.author_username = safeUpdates.username;
      if (safeUpdates.avatar_url && safeUpdates.avatar_url.length < 35000) {
        postUpdates.author_avatar = safeUpdates.avatar_url;
      }

      if (Object.keys(postUpdates).length > 0) {
        await supabase
          .from('posts')
          .update(postUpdates)
          .eq('user_id', targetId);
      }
    } catch (postSyncErr) {
      console.warn('Sync profile to posts skipped:', postSyncErr);
    }
  }

  // 6. Always persist to localStorage cache for instant offline restore
  try {
    const cachedProfileKey = `nikilow_user_profile_${targetId}`;
    const prev = localStorage.getItem(cachedProfileKey);
    const parsed = prev ? JSON.parse(prev) : {};
    const merged = { ...parsed, id: targetId, ...safeUpdates };
    localStorage.setItem(cachedProfileKey, JSON.stringify(merged));
    localStorage.setItem('nikilow_active_profile', JSON.stringify(merged));
  } catch {
    // ignore
  }

  return safeUpdates;
}

export const updateProfile = updateUserProfile;

/**
 * Upload avatar file to Supabase storage bucket or return local Base64/data URL fallback
 */
export async function uploadAvatarImage(userId: string, file: File): Promise<string> {
  try {
    const fileExt = file.name.split('.').pop() || 'jpg';
    const filePath = `${userId}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, {
        upsert: true,
      });

    if (!uploadError) {
      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      if (data?.publicUrl) {
        return data.publicUrl;
      }
    }
  } catch (err) {
    console.warn('Supabase storage upload failed, converting to data URL:', err);
  }

  // Fallback to reading file as base64 Data URL so avatar upload always works immediately
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Sync chats and messages to Supabase when user is logged in
 */
export async function syncChatToSupabase(chat: ChatSession, userId: string) {
  try {
    // Upsert chat
    await supabase.from('chats').upsert({
      id: chat.id,
      user_id: userId,
      title: chat.title,
      created_at: new Date(chat.createdAt).toISOString(),
      updated_at: new Date(chat.updatedAt).toISOString(),
    });

    // Upsert messages
    if (chat.messages.length > 0) {
      const msgRows = chat.messages.map((m) => ({
        id: m.id,
        chat_id: chat.id,
        user_id: userId,
        role: m.role,
        content: m.content,
        created_at: new Date(m.createdAt).toISOString(),
      }));

      await supabase.from('messages').upsert(msgRows);
    }
  } catch (e) {
    // Database tables might not be migrated yet; fail silently
    console.warn('Sync to Supabase skipped (run supabase_schema.sql if needed):', e);
  }
}

/**
 * Load chats from Supabase for current user
 */
export async function loadChatsFromSupabase(userId: string): Promise<ChatSession[] | null> {
  try {
    const { data: chatRows, error: chatErr } = await supabase
      .from('chats')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (chatErr || !chatRows || chatRows.length === 0) {
      return null;
    }

    const sessions: ChatSession[] = [];

    for (const c of chatRows) {
      const { data: msgRows } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', c.id)
        .order('created_at', { ascending: true });

      const messages: Message[] = (msgRows || []).map((m) => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        createdAt: new Date(m.created_at).getTime(),
      }));

      sessions.push({
        id: c.id,
        title: c.title,
        messages,
        createdAt: new Date(c.created_at).getTime(),
        updatedAt: new Date(c.updated_at).getTime(),
      });
    }

    return sessions;
  } catch (err) {
    console.warn('loadChatsFromSupabase skipped:', err);
    return null;
  }
}

/**
 * Delete a specific chat from Supabase
 */
export async function deleteChatFromSupabase(chatId: string, userId: string): Promise<void> {
  try {
    await supabase
      .from('chats')
      .delete()
      .eq('id', chatId)
      .eq('user_id', userId);
  } catch (err) {
    console.warn('deleteChatFromSupabase skipped:', err);
  }
}

/**
 * Clear all chats for a user from Supabase
 */
export async function clearAllChatsFromSupabase(userId: string): Promise<void> {
  try {
    await supabase
      .from('chats')
      .delete()
      .eq('user_id', userId);
  } catch (err) {
    console.warn('clearAllChatsFromSupabase skipped:', err);
  }
}

// ==============================================================================
// POSTS & LIKES LOGIC
// ==============================================================================

const LOCAL_STORAGE_POSTS_KEY = 'nikilow_feed_posts_v2';
const LOCAL_STORAGE_LIKES_KEY = 'nikilow_liked_posts_v2';

export const INITIAL_SEED_POSTS: Post[] = [];

function getStoredLocalPosts(): Post[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_POSTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveStoredLocalPosts(posts: Post[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_POSTS_KEY, JSON.stringify(posts));
  } catch {
    // ignore
  }
}

function getStoredUserLikes(): string[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_LIKES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveStoredUserLikes(likes: string[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_LIKES_KEY, JSON.stringify(likes));
  } catch {
    // ignore
  }
}

/**
 * Resend verification email for signup
 */
export async function resendVerificationEmail(email: string) {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: email.trim(),
  });
  if (error) {
    throw error;
  }
}

/**
 * Fetch all posts in reverse chronological order
 */
export async function fetchFeedPosts(currentUserId?: string): Promise<Post[]> {
  const userLikes = getStoredUserLikes();

  try {
    const { data: dbPosts, error } = await supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && dbPosts && dbPosts.length > 0) {
      // Map DB posts to Post interface
      const mapped: Post[] = dbPosts.map((p) => {
        const isKodewt = p.author_username?.toLowerCase() === 'kodewt';
        return {
          id: p.id,
          userId: p.user_id,
          authorName: p.author_name || p.author_username,
          authorUsername: p.author_username,
          authorAvatar: p.author_avatar || '',
          content: p.content,
          createdAt: new Date(p.created_at).getTime(),
          likesCount: p.likes_count || 0,
          isLiked: userLikes.includes(p.id),
          isVerified: isKodewt || p.is_verified,
        };
      });

      return mapped.sort((a, b) => b.createdAt - a.createdAt);
    }
  } catch (err) {
    console.warn('fetchFeedPosts fallback to local storage:', err);
  }

  // Fallback to local storage (only user's published posts)
  const localPosts = getStoredLocalPosts();
  return localPosts.map((p) => ({
    ...p,
    isLiked: userLikes.includes(p.id),
    isVerified: p.authorUsername.toLowerCase() === 'kodewt',
  }));
}

/**
 * Create a new post (max 300 chars)
 */
export async function createFeedPost(
  arg1: string | { content: string; userProfile: UserProfile },
  arg2?: UserProfile
): Promise<Post> {
  const content = typeof arg1 === 'string' ? arg1 : arg1.content;
  const userProfile = typeof arg1 === 'string' ? arg2! : arg1.userProfile;

  const trimmed = (content || '').trim();
  if (!trimmed) {
    throw new Error('Post content cannot be empty');
  }
  if (trimmed.length > 300) {
    throw new Error('Post cannot exceed 300 characters');
  }

  // Enforce 5-minute rate limit for posting updates
  const rateLimit = getPostRateLimitStatus(userProfile.id);
  if (rateLimit.isRateLimited) {
    throw new Error(
      `Rate limit active: you can only post updates once every 5 minutes (wait ${rateLimit.formattedRemaining}).`
    );
  }

  const postTime = Date.now();
  recordPostTimestamp(userProfile.id, postTime);

  const isKodewt = userProfile.username.toLowerCase() === 'kodewt';
  const newPost: Post = {
    id: 'post_' + postTime + '_' + Math.random().toString(36).substring(2, 6),
    userId: userProfile.id,
    authorName: userProfile.name || userProfile.username,
    authorUsername: userProfile.username,
    authorAvatar: userProfile.avatar_url || '',
    content: trimmed,
    createdAt: postTime,
    likesCount: 0,
    isLiked: false,
    isVerified: isKodewt,
  };

  // Try saving to Supabase if connected
  try {
    const { data, error } = await supabase
      .from('posts')
      .insert({
        user_id: userProfile.id,
        author_name: newPost.authorName,
        author_username: newPost.authorUsername,
        author_avatar: newPost.authorAvatar,
        content: newPost.content,
        likes_count: 0,
        is_verified: isKodewt,
      })
      .select()
      .single();

    if (!error && data) {
      newPost.id = data.id;
    }
  } catch (err) {
    console.warn('createFeedPost saved to local cache:', err);
  }

  // Always update local cache
  const localPosts = getStoredLocalPosts();
  saveStoredLocalPosts([newPost, ...localPosts]);

  return newPost;
}

/**
 * Toggle like on a post
 */
export async function togglePostLike(
  postId: string,
  userId?: string
): Promise<{ isLiked: boolean; newCount: number }> {
  const likes = getStoredUserLikes();
  const alreadyLiked = likes.includes(postId);
  const nextLiked = !alreadyLiked;

  let nextLikes: string[];
  if (alreadyLiked) {
    nextLikes = likes.filter((id) => id !== postId);
  } else {
    nextLikes = [...likes, postId];
  }
  saveStoredUserLikes(nextLikes);

  // Update local posts cache
  const localPosts = getStoredLocalPosts();
  let calculatedCount = 0;
  const updatedLocal = localPosts.map((p) => {
    if (p.id === postId) {
      const count = Math.max(0, p.likesCount + (nextLiked ? 1 : -1));
      calculatedCount = count;
      return { ...p, likesCount: count, isLiked: nextLiked };
    }
    return p;
  });
  saveStoredLocalPosts(updatedLocal);

  // Try updating Supabase
  try {
    if (userId && !postId.startsWith('seed_')) {
      if (nextLiked) {
        await supabase.from('post_likes').insert({
          post_id: postId,
          user_id: userId,
        });
        await supabase.rpc('increment_post_likes', { post_id_input: postId });
      } else {
        await supabase
          .from('post_likes')
          .delete()
          .match({ post_id: postId, user_id: userId });
        await supabase.rpc('decrement_post_likes', { post_id_input: postId });
      }
    }
  } catch (err) {
    console.warn('togglePostLike remote skipped:', err);
  }

  return { isLiked: nextLiked, newCount: calculatedCount };
}

/**
 * Delete a post by id
 */
export async function deleteFeedPost(postId: string, userId?: string): Promise<boolean> {
  // 1. Remove from local cache
  const localPosts = getStoredLocalPosts();
  const filtered = localPosts.filter((p) => p.id !== postId);
  saveStoredLocalPosts(filtered);

  // 2. Remove from Supabase if connected
  try {
    let query = supabase.from('posts').delete().eq('id', postId);
    if (userId) {
      query = query.eq('user_id', userId);
    }
    const { error } = await query;
    if (error) {
      console.warn('deleteFeedPost error:', error);
    }
    return true;
  } catch (err) {
    console.warn('deleteFeedPost remote skipped:', err);
    return true;
  }
}

/**
 * Fetch profile by username (for mention clicks and viewing someone else's profile)
 */
export async function fetchProfileByUsername(
  username: string
): Promise<UserProfile | null> {
  const cleanUsername = username.trim().toLowerCase().replace(/^@/, '');

  // Companion profile view is disabled as personality is customizable
  if (cleanUsername === 'nikilow') {
    return null;
  }

  // Synthetic default for kodewt if not yet registered in db
  if (cleanUsername === 'kodewt') {
    // First try fetching actual profile from db
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .ilike('username', 'kodewt')
        .maybeSingle();

      if (data) {
        return {
          id: data.id,
          name: data.name || 'kodewt',
          username: 'kodewt',
          email: data.email || 'kodewt@developer.com',
          avatar_url: data.avatar_url || '',
          bio: data.bio || 'developer & designer.',
          is_verified: true,
        };
      }
    } catch {
      // ignore
    }

    return {
      id: 'kodewt_dev',
      name: 'kodewt',
      username: 'kodewt',
      email: 'kodewt@developer.com',
      avatar_url: '',
      bio: 'building things with heart.',
      is_verified: true,
    };
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .ilike('username', cleanUsername)
      .maybeSingle();

    if (!error && data) {
      return {
        id: data.id,
        name: data.name || cleanUsername,
        username: data.username,
        email: data.email || '',
        avatar_url: data.avatar_url || '',
        bio: data.bio || 'Hey there! I am using Nikilow.',
        is_verified: cleanUsername === 'kodewt' || data.is_verified,
      };
    }
  } catch (err) {
    console.warn('fetchProfileByUsername query skipped:', err);
  }

  // If not found in DB, return a graceful placeholder profile
  return {
    id: 'user_' + cleanUsername,
    name: cleanUsername,
    username: cleanUsername,
    email: `${cleanUsername}@user.net`,
    avatar_url: '',
    bio: `@${cleanUsername} is on Nikilow.`,
    is_verified: cleanUsername === 'kodewt',
  };
}

