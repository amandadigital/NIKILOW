-- ==============================================================================
-- NIKILOW SUPABASE DATABASE SCHEMA
-- Run this script in the Supabase SQL Editor:
-- Dashboard -> SQL Editor -> New query -> Paste & Run
-- ==============================================================================

-- 1. Create Profiles Table
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  name text,
  username text unique,
  email text,
  avatar_url text,
  bio text,
  companion_name text default 'nikilow',
  companion_prompt text,
  companion_avatar_url text,
  companion_personality jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- In case profiles table already exists, safely add the companion personality columns
alter table public.profiles
  add column if not exists companion_name text default 'nikilow',
  add column if not exists companion_prompt text,
  add column if not exists companion_avatar_url text,
  add column if not exists companion_personality jsonb;

-- Case-insensitive index for fast username lookups
create index if not exists idx_profiles_username_lower on public.profiles (lower(username));

-- 2. Create Chats Table
create table if not exists public.chats (
  id text primary key,
  user_id uuid references auth.users on delete cascade not null,
  title text not null default 'New Conversation',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_chats_user_id on public.chats (user_id);

-- 3. Create Messages Table
create table if not exists public.messages (
  id text primary key,
  chat_id text references public.chats(id) on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_messages_chat_id on public.messages (chat_id);
create index if not exists idx_messages_user_id on public.messages (user_id);

-- 4. Enable Row Level Security (RLS)
alter table public.profiles enable row level security;
alter table public.chats enable row level security;
alter table public.messages enable row level security;

-- Profiles Policies
-- Allow anyone (including anon during login) to read profiles for username lookup and avatars
drop policy if exists "Profiles are viewable by everyone" on public.profiles;
create policy "Profiles are viewable by everyone"
  on public.profiles for select
  using (true);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Chats Policies (Only owner can access their own chats)
drop policy if exists "Users can view own chats" on public.chats;
create policy "Users can view own chats"
  on public.chats for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own chats" on public.chats;
create policy "Users can insert own chats"
  on public.chats for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own chats" on public.chats;
create policy "Users can update own chats"
  on public.chats for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own chats" on public.chats;
create policy "Users can delete own chats"
  on public.chats for delete
  using (auth.uid() = user_id);

-- Messages Policies
drop policy if exists "Users can view own messages" on public.messages;
create policy "Users can view own messages"
  on public.messages for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own messages" on public.messages;
create policy "Users can insert own messages"
  on public.messages for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own messages" on public.messages;
create policy "Users can delete own messages"
  on public.messages for delete
  using (auth.uid() = user_id);

-- 5. Helper function: Get email by username (for login with username)
create or replace function public.get_email_by_username(username_input text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_username text;
  found_email text;
begin
  clean_username := lower(trim(replace(username_input, '@', '')));
  select email into found_email
  from public.profiles
  where lower(username) = clean_username
  limit 1;
  return found_email;
end;
$$;

-- Allow anon and authenticated users to invoke this helper
grant execute on function public.get_email_by_username(text) to anon, authenticated;

-- 6. Trigger to automatically create profile row when user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta_name text;
  meta_username text;
begin
  meta_name := coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1));
  meta_username := coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1));
  meta_username := lower(trim(replace(meta_username, '@', '')));

  insert into public.profiles (id, name, username, email, avatar_url, bio)
  values (
    new.id,
    meta_name,
    meta_username,
    new.email,
    coalesce(new.raw_user_meta_data->>'avatar_url', ''),
    'hey there, i am using nikilow.'
  )
  on conflict (id) do update set
    name = excluded.name,
    username = excluded.username,
    email = excluded.email;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 7. Storage Bucket for Avatars (Optional Supabase Storage)
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "Avatar images are publicly accessible" on storage.objects;
create policy "Avatar images are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "Users can upload their own avatar" on storage.objects;
create policy "Users can upload their own avatar"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.role() = 'authenticated');

-- ==============================================================================
-- 8. Profile Verification & Blue Mark for @kodewt
-- ==============================================================================
alter table public.profiles add column if not exists is_verified boolean default false;

-- Guarantee @kodewt is verified
update public.profiles set is_verified = true where lower(username) = 'kodewt';

-- ==============================================================================
-- 9. Posts Table (Chronological Feed & Profile Posts, up to 300 characters)
-- ==============================================================================
create table if not exists public.posts (
  id text primary key default ('post_' || extract(epoch from now())::bigint || '_' || substr(md5(random()::text), 1, 6)),
  user_id uuid references auth.users on delete cascade not null,
  author_name text not null,
  author_username text not null,
  author_avatar text default '',
  content text not null check (char_length(content) <= 300),
  likes_count integer default 0,
  is_verified boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_posts_created_at on public.posts (created_at desc);
create index if not exists idx_posts_user_id on public.posts (user_id);
create index if not exists idx_posts_author_username on public.posts (lower(author_username));

-- ==============================================================================
-- 10. Post Likes Table
-- ==============================================================================
create table if not exists public.post_likes (
  post_id text references public.posts(id) on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (post_id, user_id)
);

create index if not exists idx_post_likes_user on public.post_likes (user_id);

-- Enable RLS
alter table public.posts enable row level security;
alter table public.post_likes enable row level security;

-- Posts policies
drop policy if exists "Posts are viewable by everyone" on public.posts;
create policy "Posts are viewable by everyone"
  on public.posts for select
  using (true);

drop policy if exists "Authenticated users can create posts" on public.posts;
create policy "Authenticated users can create posts"
  on public.posts for insert
  with check (auth.uid() = user_id and char_length(content) <= 300);

drop policy if exists "Users can delete own posts" on public.posts;
create policy "Users can delete own posts"
  on public.posts for delete
  using (auth.uid() = user_id);

-- Likes policies
drop policy if exists "Likes are viewable by everyone" on public.post_likes;
create policy "Likes are viewable by everyone"
  on public.post_likes for select
  using (true);

drop policy if exists "Authenticated users can toggle like" on public.post_likes;
create policy "Authenticated users can toggle like"
  on public.post_likes for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can remove own like" on public.post_likes;
create policy "Users can remove own like"
  on public.post_likes for delete
  using (auth.uid() = user_id);

-- Like Counter Helper Functions
create or replace function public.increment_post_likes(post_id_input text)
returns void
language plpgsql
security definer
as $$
begin
  update public.posts
  set likes_count = coalesce(likes_count, 0) + 1
  where id = post_id_input;
end;
$$;

create or replace function public.decrement_post_likes(post_id_input text)
returns void
language plpgsql
security definer
as $$
begin
  update public.posts
  set likes_count = greatest(0, coalesce(likes_count, 0) - 1)
  where id = post_id_input;
end;
$$;

grant execute on function public.increment_post_likes(text) to anon, authenticated;
grant execute on function public.decrement_post_likes(text) to anon, authenticated;

