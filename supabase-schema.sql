-- ============================================================
-- CaHoOtS COMPLETE DATABASE SCHEMA
-- Combines the original starter schema, original live multiplayer
-- MVP, and the game-mode / per-question-points upgrade.
-- Designed to be run as one script in Supabase SQL Editor.
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 1. ORIGINAL CaHoOtS APPLICATION TABLES
-- ------------------------------------------------------------

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

-- The original starter schema deliberately did not enable RLS on these
-- five tables or add client policies. Their existing security behavior is
-- therefore preserved; configure policies separately before using them
-- directly from an untrusted client.

-- ------------------------------------------------------------
-- 2. ORIGINAL LIVE MULTIPLAYER MVP TABLES
-- ------------------------------------------------------------

create table if not exists public.cahoots_rooms (
  id uuid primary key default gen_random_uuid(),
  pin text unique not null,
  host_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  status text not null default 'waiting' check(status in ('waiting','active','finished')),
  question_index int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.cahoots_room_questions (
  room_id uuid not null references public.cahoots_rooms(id) on delete cascade,
  q_index int not null,
  question_text text not null,
  answers jsonb not null,
  correct_index int not null check(correct_index between 0 and 3),
  primary key(room_id,q_index)
);

create table if not exists public.cahoots_room_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.cahoots_rooms(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  nickname text not null,
  score int not null default 0,
  joined_at timestamptz not null default now(),
  unique(room_id,nickname)
);

create table if not exists public.cahoots_room_answers (
  player_id uuid not null references public.cahoots_room_players(id) on delete cascade,
  q_index int not null,
  answer_index int not null,
  correct boolean not null,
  created_at timestamptz not null default now(),
  primary key(player_id,q_index)
);

-- Enable RLS on live multiplayer tables, as in the original MVP.
alter table public.cahoots_rooms enable row level security;
alter table public.cahoots_room_questions enable row level security;
alter table public.cahoots_room_players enable row level security;
alter table public.cahoots_room_answers enable row level security;

drop policy if exists cahoots_room_read on public.cahoots_rooms;
create policy cahoots_room_read on public.cahoots_rooms
  for select to anon, authenticated using (true);

drop policy if exists cahoots_players_read on public.cahoots_room_players;
create policy cahoots_players_read on public.cahoots_room_players
  for select to anon, authenticated using (true);

-- Questions and answers are accessed only through security-definer RPCs;
-- no direct table access is granted to anon/authenticated.
revoke all on public.cahoots_room_questions from anon, authenticated;
revoke all on public.cahoots_room_answers from anon, authenticated;
revoke insert, update, delete on public.cahoots_rooms from anon, authenticated;
revoke insert, update, delete on public.cahoots_room_players from anon, authenticated;

-- ------------------------------------------------------------
-- 3. ORIGINAL MVP RPC FUNCTIONS
-- These are retained so the complete schema includes the original
-- functionality. The upgraded overloads/functions follow in section 4.
-- ------------------------------------------------------------

create or replace function public.cahoots_create_room(
  p_title text, p_questions jsonb, p_nickname text
)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  r public.cahoots_rooms;
  player public.cahoots_room_players;
  pin_code text;
begin
  if auth.uid() is null then raise exception 'Sign in to host a game.'; end if;
  if jsonb_typeof(p_questions) <> 'array'
     or jsonb_array_length(p_questions)<1
     or jsonb_array_length(p_questions)>40 then
    raise exception 'Add between 1 and 40 questions.';
  end if;
  if length(trim(p_title))=0 or length(trim(p_nickname))=0 then
    raise exception 'Enter a game title and nickname.';
  end if;
  loop
    pin_code := lpad((floor(random()*1000000))::int::text,6,'0');
    exit when not exists(select 1 from public.cahoots_rooms where pin=pin_code);
  end loop;
  insert into public.cahoots_rooms(pin,host_id,title)
    values(pin_code,auth.uid(),left(trim(p_title),80)) returning * into r;
  insert into public.cahoots_room_questions(room_id,q_index,question_text,answers,correct_index)
  select r.id,(x.ordinality-1)::int,x.value->>'text',x.value->'answers',(x.value->>'correct')::int
  from jsonb_array_elements(p_questions) with ordinality x(value,ordinality)
  where jsonb_typeof(x.value->'answers')='array'
    and jsonb_array_length(x.value->'answers')=4;
  if (select count(*) from public.cahoots_room_questions where room_id=r.id)
     <> jsonb_array_length(p_questions) then
    raise exception 'Every question needs four answers and a correct answer.';
  end if;
  insert into public.cahoots_room_players(room_id,user_id,nickname)
    values(r.id,auth.uid(),left(trim(p_nickname),24)) returning * into player;
  return jsonb_build_object('pin',r.pin,'player_id',player.id,'room_id',r.id);
end $$;

create or replace function public.cahoots_join_room(p_pin text,p_nickname text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  r public.cahoots_rooms;
  p public.cahoots_room_players;
  n text;
begin
  select * into r from public.cahoots_rooms
    where pin=upper(trim(p_pin)) and status='waiting';
  if not found then raise exception 'Room not found or it has already started.'; end if;
  n:=left(trim(p_nickname),24);
  if n='' then raise exception 'Enter a nickname.'; end if;
  if exists(select 1 from public.cahoots_room_players
    where room_id=r.id and lower(nickname)=lower(n)) then
    raise exception 'That nickname is already taken.';
  end if;
  insert into public.cahoots_room_players(room_id,user_id,nickname)
    values(r.id,auth.uid(),n) returning * into p;
  return jsonb_build_object('pin',r.pin,'player_id',p.id,'room_id',r.id);
end $$;

create or replace function public.cahoots_room_snapshot(p_pin text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  r public.cahoots_rooms;
  q public.cahoots_room_questions;
  players jsonb;
begin
  select * into r from public.cahoots_rooms where pin=upper(trim(p_pin));
  if not found then raise exception 'Room not found.'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'nickname',nickname,'score',score)
    order by score desc,joined_at),'[]'::jsonb)
    into players from public.cahoots_room_players where room_id=r.id;
  select * into q from public.cahoots_room_questions
    where room_id=r.id and q_index=r.question_index;
  return jsonb_build_object(
    'pin',r.pin,'title',r.title,'status',r.status,
    'question_index',r.question_index,'players',players,
    'question',case when r.status='active' and q.room_id is not null
      then jsonb_build_object('text',q.question_text,'answers',q.answers) else null end,
    'total_questions',(select count(*) from public.cahoots_room_questions where room_id=r.id)
  );
end $$;

create or replace function public.cahoots_host_start(p_pin text)
returns void language plpgsql security definer set search_path=public as $$
begin
  update public.cahoots_rooms set status='active',question_index=0
    where pin=upper(trim(p_pin)) and host_id=auth.uid() and status='waiting';
  if not found then raise exception 'Only the host can start this waiting room.'; end if;
end $$;

create or replace function public.cahoots_host_next(p_pin text)
returns void language plpgsql security definer set search_path=public as $$
declare
  r public.cahoots_rooms;
  total int;
begin
  select * into r from public.cahoots_rooms
    where pin=upper(trim(p_pin)) and host_id=auth.uid();
  if not found then raise exception 'Only the host can control this room.'; end if;
  select count(*) into total from public.cahoots_room_questions where room_id=r.id;
  if r.question_index+1>=total then
    update public.cahoots_rooms set status='finished' where id=r.id;
  else
    update public.cahoots_rooms set question_index=question_index+1 where id=r.id;
  end if;
end $$;

create or replace function public.cahoots_submit_answer(p_pin text,p_player_id uuid,p_answer int)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  r public.cahoots_rooms;
  q public.cahoots_room_questions;
  p public.cahoots_room_players;
  ok boolean;
begin
  if p_answer<0 or p_answer>3 then raise exception 'Invalid answer.'; end if;
  select * into r from public.cahoots_rooms
    where pin=upper(trim(p_pin)) and status='active';
  if not found then raise exception 'This game is not accepting answers.'; end if;
  select * into p from public.cahoots_room_players where id=p_player_id and room_id=r.id;
  if not found then raise exception 'Player not found.'; end if;
  select * into q from public.cahoots_room_questions
    where room_id=r.id and q_index=r.question_index;
  ok := (q.correct_index=p_answer);
  insert into public.cahoots_room_answers(player_id,q_index,answer_index,correct)
    values(p.id,r.question_index,p_answer,ok) on conflict do nothing;
  if not found then raise exception 'You already answered this question.'; end if;
  if ok then
    update public.cahoots_room_players set score=score+100 where id=p.id;
  end if;
  return jsonb_build_object('correct',ok,
    'score',(select score from public.cahoots_room_players where id=p.id));
end $$;

-- ------------------------------------------------------------
-- 4. GAME-MODE + PER-QUESTION-POINTS UPGRADE
-- ------------------------------------------------------------

alter table public.cahoots_rooms
  add column if not exists game_mode text not null default 'classic';
alter table public.cahoots_rooms
  add column if not exists boss_hp int not null default 5;
alter table public.cahoots_room_questions
  add column if not exists points int not null default 100;
alter table public.cahoots_room_players
  add column if not exists lives int not null default 3;
alter table public.cahoots_room_players
  add column if not exists streak int not null default 0;
alter table public.cahoots_room_players
  add column if not exists eliminated boolean not null default false;

-- New 4-argument function; the original 3-argument function is retained.
create or replace function public.cahoots_create_room(
  p_title text, p_questions jsonb, p_nickname text,
  p_game_mode text default 'classic'
)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  r public.cahoots_rooms;
  player public.cahoots_room_players;
  pin_code text;
  mode text;
begin
  if auth.uid() is null then raise exception 'Sign in to host a game.'; end if;
  if jsonb_typeof(p_questions) <> 'array'
     or jsonb_array_length(p_questions)<1
     or jsonb_array_length(p_questions)>40 then
    raise exception 'Add between 1 and 40 questions.';
  end if;
  if length(trim(p_title))=0 or length(trim(p_nickname))=0 then
    raise exception 'Enter a game title and nickname.';
  end if;
  mode:=coalesce(nullif(p_game_mode,''),'classic');
  if mode not in ('classic','blitz','survival','boss','streak','memory','parkour') then
    raise exception 'Unknown game mode.';
  end if;
  loop
    pin_code := lpad((floor(random()*1000000))::int::text,6,'0');
    exit when not exists(select 1 from public.cahoots_rooms where pin=pin_code);
  end loop;
  insert into public.cahoots_rooms(pin,host_id,title,game_mode,boss_hp)
    values(pin_code,auth.uid(),left(trim(p_title),80),mode,
      greatest(3,jsonb_array_length(p_questions))) returning * into r;
  insert into public.cahoots_room_questions(
    room_id,q_index,question_text,answers,correct_index,points
  )
  select r.id,(x.ordinality-1)::int,x.value->>'text',x.value->'answers',
    (x.value->>'correct')::int,
    greatest(0,least(10000,coalesce((x.value->>'points')::int,100)))
  from jsonb_array_elements(p_questions) with ordinality x(value,ordinality)
  where jsonb_typeof(x.value->'answers')='array'
    and jsonb_array_length(x.value->'answers')=4
    and coalesce((x.value->>'correct')::int,-1) between 0 and 3
    and length(trim(coalesce(x.value->>'text','')))>0;
  if (select count(*) from public.cahoots_room_questions where room_id=r.id)
     <> jsonb_array_length(p_questions) then
    raise exception 'Every question needs text, four answers, and a valid correct answer.';
  end if;
  insert into public.cahoots_room_players(room_id,user_id,nickname)
    values(r.id,auth.uid(),left(trim(p_nickname),24)) returning * into player;
  return jsonb_build_object(
    'pin',r.pin,'player_id',player.id,'room_id',r.id,'game_mode',r.game_mode
  );
end $$;

-- Replace snapshot so clients receive mode, question points, boss HP,
-- and each player's survival/streak state.
create or replace function public.cahoots_room_snapshot(p_pin text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  r public.cahoots_rooms;
  q public.cahoots_room_questions;
  players jsonb;
begin
  select * into r from public.cahoots_rooms where pin=upper(trim(p_pin));
  if not found then raise exception 'Room not found.'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',id,'nickname',nickname,'score',score,'lives',lives,
    'streak',streak,'eliminated',eliminated
  ) order by score desc,joined_at),'[]'::jsonb)
  into players from public.cahoots_room_players where room_id=r.id;
  select * into q from public.cahoots_room_questions
    where room_id=r.id and q_index=r.question_index;
  return jsonb_build_object(
    'pin',r.pin,'title',r.title,'status',r.status,
    'game_mode',r.game_mode,'boss_hp',r.boss_hp,
    'question_index',r.question_index,'players',players,
    'question',case when r.status='active' and q.room_id is not null
      then jsonb_build_object('text',q.question_text,'answers',q.answers,'points',q.points)
      else null end,
    'total_questions',(select count(*) from public.cahoots_room_questions where room_id=r.id)
  );
end $$;

-- Replace answer scoring with mode-specific rules.
create or replace function public.cahoots_submit_answer(
  p_pin text, p_player_id uuid, p_answer int
)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  r public.cahoots_rooms;
  q public.cahoots_room_questions;
  p public.cahoots_room_players;
  ok boolean;
  awarded int:=0;
  next_streak int:=0;
begin
  if p_answer<0 or p_answer>3 then raise exception 'Invalid answer.'; end if;
  select * into r from public.cahoots_rooms
    where pin=upper(trim(p_pin)) and status='active';
  if not found then raise exception 'This game is not accepting answers.'; end if;
  select * into p from public.cahoots_room_players
    where id=p_player_id and room_id=r.id;
  if not found then raise exception 'Player not found.'; end if;
  if p.eliminated then raise exception 'You have been eliminated from this round.'; end if;
  select * into q from public.cahoots_room_questions
    where room_id=r.id and q_index=r.question_index;
  ok := (q.correct_index=p_answer);
  insert into public.cahoots_room_answers(player_id,q_index,answer_index,correct)
    values(p.id,r.question_index,p_answer,ok) on conflict do nothing;
  if not found then raise exception 'You already answered this question.'; end if;
  if ok then
    next_streak:=p.streak+1;
    awarded:=q.points;
    if r.game_mode='blitz' then
      awarded:=round(awarded*1.5)::int;
    end if;
    if r.game_mode='streak' then
      awarded:=round(awarded*(1+least(next_streak-1,5)*0.2))::int;
    end if;
    update public.cahoots_room_players
      set score=score+awarded,streak=next_streak where id=p.id;
    if r.game_mode='boss' then
      update public.cahoots_rooms set boss_hp=greatest(0,boss_hp-1) where id=r.id;
    end if;
  else
    update public.cahoots_room_players
      set streak=0,
          lives=case when r.game_mode='survival' then greatest(0,lives-1) else lives end,
          eliminated=case when r.game_mode='survival' and lives<=1 then true else eliminated end
      where id=p.id;
  end if;
  return jsonb_build_object(
    'correct',ok,
    'awarded',awarded,
    'score',(select score from public.cahoots_room_players where id=p.id),
    'lives',(select lives from public.cahoots_room_players where id=p.id),
    'eliminated',(select eliminated from public.cahoots_room_players where id=p.id)
  );
end $$;

-- ------------------------------------------------------------
-- 5. RPC PERMISSIONS
-- ------------------------------------------------------------

revoke all on function public.cahoots_create_room(text,jsonb,text) from public;
revoke all on function public.cahoots_create_room(text,jsonb,text,text) from public;
revoke all on function public.cahoots_join_room(text,text) from public;
revoke all on function public.cahoots_room_snapshot(text) from public;
revoke all on function public.cahoots_host_start(text) from public;
revoke all on function public.cahoots_host_next(text) from public;
revoke all on function public.cahoots_submit_answer(text,uuid,int) from public;

grant execute on function public.cahoots_create_room(text,jsonb,text) to authenticated;
grant execute on function public.cahoots_create_room(text,jsonb,text,text) to authenticated;
grant execute on function public.cahoots_join_room(text,text) to anon,authenticated;
grant execute on function public.cahoots_room_snapshot(text) to anon,authenticated;
grant execute on function public.cahoots_host_start(text) to authenticated;
grant execute on function public.cahoots_host_next(text) to authenticated;
grant execute on function public.cahoots_submit_answer(text,uuid,int) to anon,authenticated;

-- END OF COMPLETE CaHoOtS SCHEMA
