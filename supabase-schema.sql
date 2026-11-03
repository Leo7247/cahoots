-- CaHoOtS? starter schema outline.
-- Not a production-ready multiplayer backend. Review security/RLS policies before use.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  title text not null,
  description text not null default '',
  questions jsonb not null default '[]'::jsonb,
  is_public boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  pin text not null unique,
  host_id uuid references auth.users(id) on delete cascade,
  quiz_id uuid references public.quizzes(id) on delete set null,
  status text not null default 'waiting' check (status in ('waiting','active','finished')),
  created_at timestamptz not null default now()
);

create table if not exists public.room_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  nickname text not null,
  score integer not null default 0,
  battery integer not null default 20 check (battery between 0 and 100),
  position integer not null default 0 check (position >= 0),
  joined_at timestamptz not null default now()
);

create table if not exists public.answers (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  player_id uuid not null references public.room_players(id) on delete cascade,
  question_index integer not null,
  answer_index integer not null,
  is_correct boolean not null default false,
  answered_at timestamptz not null default now()
);

-- Deliberately do not enable permissive RLS policies here.
-- Before connecting a client, design policies so users can only edit their own
-- profiles/quizzes and cannot forge scores, answers, room state, or battery.
