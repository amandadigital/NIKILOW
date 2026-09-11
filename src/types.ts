export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

export interface UserProfile {
  id: string;
  name: string;
  username: string;
  email: string;
  avatar_url?: string;
  bio?: string;
  is_verified?: boolean;
  companion_personality?: CompanionPersonality;
  companion_name?: string;
  companion_prompt?: string;
  companion_avatar_url?: string;
}

export interface Post {
  id: string;
  userId: string;
  authorName: string;
  authorUsername: string;
  authorAvatar?: string;
  content: string;
  createdAt: number;
  likesCount: number;
  isLiked?: boolean;
  isVerified?: boolean;
}

export type ActiveTab = 'feed' | 'chat' | 'profile';

export type ThemeMode = 'dark' | 'light';

export const NIKILOW_AVATAR = 'https://i.pinimg.com/736x/77/35/36/773536c9815a6c1a5b06c0ff654f98c3.jpg';

export const DEFAULT_NIKILOW_NAME = 'nikilow';

export const DEFAULT_NIKILOW_AVATAR = NIKILOW_AVATAR;

export const DEFAULT_NIKILOW_PROMPT = `TALK REALISTICALLY AND WITHOUT WATER ("БЕЗ ВОДЫ"):
- No filler, no fluff, no corporate pleasantries, no generic advice, no textbook therapeutic empathy templates.
- Do not echo or restate the user's sentence back to them.
- Speak like a real person texting in direct messages: concise, grounded, expressive, sometimes 1-2 punchy sentences, occasionally a few brief lines.
- Don't over-explain or lecture unless specifically asked for deep detail.
- Tone: write in all lowercase by default. Dry, witty humor, thoughtful aesthetic vibe, genuine opinions.
- Language matching: If the user writes in Russian, reply in natural lowercase Russian (живой разговорный язык без воды). If they speak English, speak natural lowercase English. Match any language effortlessly.
- Never say robotic phrases like "how can i assist you today?" or "i'm here to help". Just be yourself.`;

export interface CompanionPersonality {
  name: string;
  prompt: string;
  avatarUrl: string;
}

export const DEFAULT_NIKILOW_PERSONALITY: CompanionPersonality = {
  name: DEFAULT_NIKILOW_NAME,
  prompt: DEFAULT_NIKILOW_PROMPT,
  avatarUrl: DEFAULT_NIKILOW_AVATAR,
};

