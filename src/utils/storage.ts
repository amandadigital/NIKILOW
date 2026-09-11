import {
  ChatSession,
  ThemeMode,
  CompanionPersonality,
  DEFAULT_NIKILOW_NAME,
  DEFAULT_NIKILOW_AVATAR,
  DEFAULT_NIKILOW_PROMPT,
} from '../types';

const STORAGE_CHATS_KEY = 'nikilow_chats_v1';
const STORAGE_ACTIVE_CHAT_KEY = 'nikilow_active_chat_id';
const STORAGE_THEME_KEY = 'nikilow_theme_mode';
const STORAGE_PERSONALITY_KEY = 'nikilow_companion_personality_v1';

export function createNewSession(initialTitle?: string): ChatSession {
  const id = 'chat_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  return {
    id,
    title: (initialTitle || 'new conversation').toLowerCase(),
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export function loadSavedSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_CHATS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Failed to load saved chats from localStorage:', err);
  }
  return [];
}

export function saveSessions(sessions: ChatSession[]): void {
  try {
    localStorage.setItem(STORAGE_CHATS_KEY, JSON.stringify(sessions));
  } catch (err) {
    console.warn('Failed to save chats to localStorage:', err);
  }
}

export function loadActiveChatId(): string | null {
  try {
    return localStorage.getItem(STORAGE_ACTIVE_CHAT_KEY);
  } catch {
    return null;
  }
}

export function saveActiveChatId(id: string): void {
  try {
    localStorage.setItem(STORAGE_ACTIVE_CHAT_KEY, id);
  } catch {
    // ignore
  }
}

export function clearSavedSessions(): void {
  try {
    localStorage.removeItem(STORAGE_CHATS_KEY);
    localStorage.removeItem(STORAGE_ACTIVE_CHAT_KEY);
    localStorage.removeItem('nikilow_feed_posts_cache');
    localStorage.removeItem('nikilow_feed_posts_v2');
  } catch {
    // ignore
  }
}

export function loadSavedTheme(): ThemeMode {
  try {
    const saved = localStorage.getItem(STORAGE_THEME_KEY);
    if (saved === 'dark' || saved === 'light') {
      return saved;
    }
  } catch {
    // ignore
  }
  return 'dark'; // default to moody aesthetic dark theme
}

export function saveTheme(theme: ThemeMode): void {
  try {
    localStorage.setItem(STORAGE_THEME_KEY, theme);
  } catch {
    // ignore
  }
}

export function formatTimeAgo(timestamp: number): string {
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  }).toLowerCase();
}

export function loadCompanionPersonality(): CompanionPersonality {
  try {
    const raw = localStorage.getItem(STORAGE_PERSONALITY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.name === 'string') {
        return {
          name: parsed.name.trim() || DEFAULT_NIKILOW_NAME,
          prompt: typeof parsed.prompt === 'string' && parsed.prompt.trim() ? parsed.prompt : DEFAULT_NIKILOW_PROMPT,
          avatarUrl: parsed.avatarUrl || DEFAULT_NIKILOW_AVATAR,
        };
      }
    }
  } catch (err) {
    console.warn('Failed to load companion personality:', err);
  }
  return {
    name: DEFAULT_NIKILOW_NAME,
    prompt: DEFAULT_NIKILOW_PROMPT,
    avatarUrl: DEFAULT_NIKILOW_AVATAR,
  };
}

export function saveCompanionPersonality(personality: CompanionPersonality): void {
  try {
    localStorage.setItem(STORAGE_PERSONALITY_KEY, JSON.stringify(personality));
  } catch (err) {
    console.warn('Failed to save companion personality:', err);
  }
}

export function resetCompanionPersonality(): CompanionPersonality {
  const defaultPersonality: CompanionPersonality = {
    name: DEFAULT_NIKILOW_NAME,
    prompt: DEFAULT_NIKILOW_PROMPT,
    avatarUrl: DEFAULT_NIKILOW_AVATAR,
  };
  saveCompanionPersonality(defaultPersonality);
  return defaultPersonality;
}
