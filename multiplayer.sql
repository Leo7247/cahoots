-- CaHoOtS multiplayer + real-time parkour upgrade.
-- Run once in Supabase SQL Editor after the original CaHoOtS multiplayer tables exist.
create extension if not exists pgcrypto;

alter table public.cahoots_rooms add column if not exists game_mode text not null default 'classic';
alter table public.cahoots_rooms add column if not exists boss_hp int not null default 5;
alter table public.cahoots_rooms add column if not exists question_started_at timestamptz;
alter table public.cahoots_room_questions add column if not exists points int not null default 100;
alter table public.cahoots_room_players add column if not exists lives int not null default 3;
alter table public.cahoots_room_players add column if not exists streak int not null default 0;
alter table public.cahoots_room_players add column if not exists eliminated boolean not null default false;
alter table public.cahoots_room_players add column if not exists parkour_progress int not null default 0;
alter table public.cahoots_room_players add column if not exists player_token uuid not null default gen_random_uuid();
create unique index if not exists cahoots_room_players_player_token_uidx on public.cahoots_room_players(player_token);

-- Player secrets must never be readable through the table REST endpoint.
drop policy if exists cahoots_players_read on public.cahoots_room_players;
revoke all on public.cahoots_room_players from anon, authenticated;

create or replace function public.cahoots_create_room(
  p_title text, p_questions jsonb, p_nickname text, p_game_mode text default 'classic'
) returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.cahoots_rooms; player public.cahoots_room_players; pin_code text; mode text;
begin
  if auth.uid() is null then raise exception 'Sign in to host a game.'; end if;
  if jsonb_typeof(p_questions) <> 'array' or jsonb_array_length(p_questions)<1 or jsonb_array_length(p_questions)>40 then raise exception 'Add between 1 and 40 questions.'; end if;
  if length(trim(coalesce(p_title,'')))=0 or length(trim(coalesce(p_nickname,'')))=0 then raise exception 'Enter a game title and nickname.'; end if;
  mode:=coalesce(nullif(p_game_mode,''),'classic');
  if mode not in ('classic','blitz','survival','boss','streak','memory','parkour') then raise exception 'Unknown game mode.'; end if;
  loop pin_code:=lpad((floor(random()*1000000))::int::text,6,'0'); exit when not exists(select 1 from public.cahoots_rooms where pin=pin_code); end loop;
  insert into public.cahoots_rooms(pin,host_id,title,game_mode,boss_hp) values(pin_code,auth.uid(),left(trim(p_title),80),mode,greatest(3,jsonb_array_length(p_questions))) returning * into r;
  insert into public.cahoots_room_questions(room_id,q_index,question_text,answers,correct_index,points)
  select r.id,(x.ordinality-1)::int,x.value->>'text',x.value->'answers',(x.value->>'correct')::int,greatest(0,least(10000,coalesce((x.value->>'points')::int,100)))
  from jsonb_array_elements(p_questions) with ordinality x(value,ordinality)
  where jsonb_typeof(x.value->'answers')='array' and jsonb_array_length(x.value->'answers')=4
    and coalesce((x.value->>'correct')::int,-1) between 0 and 3 and length(trim(coalesce(x.value->>'text','')))>0;
  if (select count(*) from public.cahoots_room_questions where room_id=r.id) <> jsonb_array_length(p_questions) then raise exception 'Every question needs text, four answers, and a valid correct answer.'; end if;
  insert into public.cahoots_room_players(room_id,user_id,nickname) values(r.id,auth.uid(),left(trim(p_nickname),24)) returning * into player;
  return jsonb_build_object('pin',r.pin,'player_id',player.id,'player_token',player.player_token,'room_id',r.id,'game_mode',r.game_mode);
end $$;

create or replace function public.cahoots_join_room(p_pin text,p_nickname text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.cahoots_rooms; p public.cahoots_room_players; n text;
begin
  select * into r from public.cahoots_rooms where pin=upper(trim(p_pin)) and status='waiting';
  if not found then raise exception 'Room not found or it has already started.'; end if;
  n:=left(trim(coalesce(p_nickname,'')),24); if n='' then raise exception 'Enter a nickname.'; end if;
  if exists(select 1 from public.cahoots_room_players where room_id=r.id and lower(nickname)=lower(n)) then raise exception 'That nickname is already taken.'; end if;
  insert into public.cahoots_room_players(room_id,user_id,nickname) values(r.id,auth.uid(),n) returning * into p;
  return jsonb_build_object('pin',r.pin,'player_id',p.id,'player_token',p.player_token,'room_id',r.id);
end $$;

create or replace function public.cahoots_room_snapshot(p_pin text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.cahoots_rooms; q public.cahoots_room_questions; players jsonb;
begin
  select * into r from public.cahoots_rooms where pin=upper(trim(p_pin)); if not found then raise exception 'Room not found.'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'nickname',nickname,'score',score,'lives',lives,'streak',streak,'eliminated',eliminated,'parkour_progress',parkour_progress) order by score desc,joined_at),'[]'::jsonb)
    into players from public.cahoots_room_players where room_id=r.id;
  select * into q from public.cahoots_room_questions where room_id=r.id and q_index=r.question_index;
  return jsonb_build_object('pin',r.pin,'title',r.title,'status',r.status,'game_mode',r.game_mode,'boss_hp',r.boss_hp,'question_index',r.question_index,'question_started_at',r.question_started_at,'players',players,
    'question',case when r.status='active' and q.room_id is not null then jsonb_build_object('text',q.question_text,'answers',q.answers,'points',q.points) else null end,
    'total_questions',(select count(*) from public.cahoots_room_questions where room_id=r.id));
end $$;

create or replace function public.cahoots_host_start(p_pin text)
returns void language plpgsql security definer set search_path=public as $$
begin
  update public.cahoots_rooms set status='active',question_index=0,question_started_at=now() where pin=upper(trim(p_pin)) and host_id=auth.uid() and status='waiting';
  if not found then raise exception 'Only the host can start this waiting room.'; end if;
end $$;

create or replace function public.cahoots_host_next(p_pin text)
returns void language plpgsql security definer set search_path=public as $$
declare r public.cahoots_rooms; total int;
begin
  select * into r from public.cahoots_rooms where pin=upper(trim(p_pin)) and host_id=auth.uid(); if not found then raise exception 'Only the host can control this room.'; end if;
  select count(*) into total from public.cahoots_room_questions where room_id=r.id;
  if r.question_index+1>=total then update public.cahoots_rooms set status='finished',question_started_at=null where id=r.id;
  else update public.cahoots_rooms set question_index=question_index+1,question_started_at=now() where id=r.id; end if;
end $$;

-- The private player_token prevents one guest from submitting answers for another player.
drop function if exists public.cahoots_submit_answer(text,uuid,int);
create or replace function public.cahoots_submit_answer(p_pin text,p_player_id uuid,p_player_token uuid,p_answer int)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.cahoots_rooms; q public.cahoots_room_questions; p public.cahoots_room_players; ok boolean; awarded int:=0; next_streak int:=0; elapsed numeric;
begin
  if p_answer<0 or p_answer>3 then raise exception 'Invalid answer.'; end if;
  select * into r from public.cahoots_rooms where pin=upper(trim(p_pin)) and status='active'; if not found then raise exception 'This game is not accepting answers.'; end if;
  select * into p from public.cahoots_room_players where id=p_player_id and room_id=r.id and player_token=p_player_token;
  if not found then raise exception 'Player session is invalid. Rejoin the room.'; end if;
  if p.eliminated then raise exception 'You have been eliminated from this game.'; end if;
  select * into q from public.cahoots_room_questions where room_id=r.id and q_index=r.question_index;
  elapsed:=extract(epoch from (now()-coalesce(r.question_started_at,now())));
  if r.game_mode='blitz' and elapsed>15 then raise exception 'Time is up! Blitz answers close after 15 seconds.'; end if;
  if r.game_mode='memory' and elapsed<5 then raise exception 'Memorize the choices first! You can answer after the 5-second reveal.'; end if;
  ok:=(q.correct_index=p_answer);
  insert into public.cahoots_room_answers(player_id,q_index,answer_index,correct) values(p.id,r.question_index,p_answer,ok) on conflict do nothing;
  if not found then raise exception 'You already answered this question.'; end if;
  if ok then
    next_streak:=p.streak+1; awarded:=q.points;
    if r.game_mode='blitz' then awarded:=round(awarded*1.5)::int; end if;
    if r.game_mode='streak' then awarded:=round(awarded*(1+least(next_streak-1,5)*0.2))::int; end if;
    update public.cahoots_room_players set score=score+awarded,streak=next_streak,parkour_progress=case when r.game_mode='parkour' then parkour_progress+1 else parkour_progress end where id=p.id;
    if r.game_mode='boss' then update public.cahoots_rooms set boss_hp=greatest(0,boss_hp-1) where id=r.id; end if;
  else
    update public.cahoots_room_players set streak=0,lives=case when r.game_mode='survival' then greatest(0,lives-1) else lives end,eliminated=case when r.game_mode='survival' and lives<=1 then true else eliminated end where id=p.id;
  end if;
  return jsonb_build_object('correct',ok,'awarded',awarded,'score',(select score from public.cahoots_room_players where id=p.id),'lives',(select lives from public.cahoots_room_players where id=p.id),'eliminated',(select eliminated from public.cahoots_room_players where id=p.id),'streak',(select streak from public.cahoots_room_players where id=p.id),'parkour_progress',(select parkour_progress from public.cahoots_room_players where id=p.id));
end $$;

-- Remove the legacy 3-argument room creator so the defaulted 4-argument RPC is unambiguous.
drop function if exists public.cahoots_create_room(text,jsonb,text);

revoke all on function public.cahoots_create_room(text,jsonb,text,text) from public;
revoke all on function public.cahoots_join_room(text,text) from public;
revoke all on function public.cahoots_room_snapshot(text) from public;
revoke all on function public.cahoots_host_start(text) from public;
revoke all on function public.cahoots_host_next(text) from public;
revoke all on function public.cahoots_submit_answer(text,uuid,uuid,int) from public;
grant execute on function public.cahoots_create_room(text,jsonb,text,text) to authenticated;
grant execute on function public.cahoots_join_room(text,text) to anon,authenticated;
grant execute on function public.cahoots_room_snapshot(text) to anon,authenticated;
grant execute on function public.cahoots_host_start(text) to authenticated;
grant execute on function public.cahoots_host_next(text) to authenticated;
grant execute on function public.cahoots_submit_answer(text,uuid,uuid,int) to anon,authenticated;
