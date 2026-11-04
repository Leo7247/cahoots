-- CaHoOtS multiplayer upgrade: per-question points + host-selected game mode.
-- Run this entire script in Supabase SQL Editor for project himuumvqxfvoywvtqvxp.
create extension if not exists pgcrypto;
alter table public.cahoots_rooms add column if not exists game_mode text not null default 'classic';
alter table public.cahoots_rooms add column if not exists boss_hp int not null default 5;
alter table public.cahoots_room_questions add column if not exists points int not null default 100;
alter table public.cahoots_room_players add column if not exists lives int not null default 3;
alter table public.cahoots_room_players add column if not exists streak int not null default 0;
alter table public.cahoots_room_players add column if not exists eliminated boolean not null default false;

create or replace function public.cahoots_create_room(p_title text,p_questions jsonb,p_nickname text,p_game_mode text default 'classic')
returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.cahoots_rooms; player public.cahoots_room_players; pin_code text; mode text;
begin
 if auth.uid() is null then raise exception 'Sign in to host a game.'; end if;
 if jsonb_typeof(p_questions) <> 'array' or jsonb_array_length(p_questions)<1 or jsonb_array_length(p_questions)>40 then raise exception 'Add between 1 and 40 questions.'; end if;
 if length(trim(p_title))=0 or length(trim(p_nickname))=0 then raise exception 'Enter a game title and nickname.'; end if;
 mode:=coalesce(nullif(p_game_mode,''),'classic');
 if mode not in ('classic','blitz','survival','boss','streak','memory','parkour') then raise exception 'Unknown game mode.'; end if;
 loop pin_code := lpad((floor(random()*1000000))::int::text,6,'0'); exit when not exists(select 1 from cahoots_rooms where pin=pin_code); end loop;
 insert into cahoots_rooms(pin,host_id,title,game_mode,boss_hp) values(pin_code,auth.uid(),left(trim(p_title),80),mode,greatest(3,jsonb_array_length(p_questions))) returning * into r;
 insert into cahoots_room_questions(room_id,q_index,question_text,answers,correct_index,points)
 select r.id,(x.ordinality-1)::int,x.value->>'text',x.value->'answers',(x.value->>'correct')::int,greatest(0,least(10000,coalesce((x.value->>'points')::int,100)))
 from jsonb_array_elements(p_questions) with ordinality x(value,ordinality)
 where jsonb_typeof(x.value->'answers')='array' and jsonb_array_length(x.value->'answers')=4
 and coalesce((x.value->>'correct')::int,-1) between 0 and 3 and length(trim(coalesce(x.value->>'text','')))>0;
 if (select count(*) from cahoots_room_questions where room_id=r.id) <> jsonb_array_length(p_questions) then raise exception 'Every question needs text, four answers, and a valid correct answer.'; end if;
 insert into cahoots_room_players(room_id,user_id,nickname) values(r.id,auth.uid(),left(trim(p_nickname),24)) returning * into player;
 return jsonb_build_object('pin',r.pin,'player_id',player.id,'room_id',r.id,'game_mode',r.game_mode);
end $$;

create or replace function public.cahoots_room_snapshot(p_pin text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r cahoots_rooms; q cahoots_room_questions; players jsonb;
begin
 select * into r from cahoots_rooms where pin=upper(trim(p_pin)); if not found then raise exception 'Room not found.'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'nickname',nickname,'score',score,'lives',lives,'streak',streak,'eliminated',eliminated) order by score desc,joined_at),'[]'::jsonb) into players from cahoots_room_players where room_id=r.id;
 select * into q from cahoots_room_questions where room_id=r.id and q_index=r.question_index;
 return jsonb_build_object('pin',r.pin,'title',r.title,'status',r.status,'game_mode',r.game_mode,'boss_hp',r.boss_hp,'question_index',r.question_index,'players',players,
 'question',case when r.status='active' and q.room_id is not null then jsonb_build_object('text',q.question_text,'answers',q.answers,'points',q.points) else null end,
 'total_questions',(select count(*) from cahoots_room_questions where room_id=r.id));
end $$;

create or replace function public.cahoots_submit_answer(p_pin text,p_player_id uuid,p_answer int)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r cahoots_rooms; q cahoots_room_questions; p cahoots_room_players; ok boolean; awarded int:=0; next_streak int:=0;
begin
 if p_answer<0 or p_answer>3 then raise exception 'Invalid answer.'; end if;
 select * into r from cahoots_rooms where pin=upper(trim(p_pin)) and status='active'; if not found then raise exception 'This game is not accepting answers.'; end if;
 select * into p from cahoots_room_players where id=p_player_id and room_id=r.id; if not found then raise exception 'Player not found.'; end if;
 if p.eliminated then raise exception 'You have been eliminated from this round.'; end if;
 select * into q from cahoots_room_questions where room_id=r.id and q_index=r.question_index;
 ok := (q.correct_index=p_answer);
 insert into cahoots_room_answers(player_id,q_index,answer_index,correct) values(p.id,r.question_index,p_answer,ok) on conflict do nothing;
 if not found then raise exception 'You already answered this question.'; end if;
 if ok then
   next_streak:=p.streak+1;
   awarded:=q.points;
   if r.game_mode='blitz' then awarded:=round(awarded*1.5)::int; end if;
   if r.game_mode='streak' then awarded:=round(awarded*(1+least(next_streak-1,5)*0.2))::int; end if;
   update cahoots_room_players set score=score+awarded,streak=next_streak where id=p.id;
   if r.game_mode='boss' then update cahoots_rooms set boss_hp=greatest(0,boss_hp-1) where id=r.id; end if;
 else
   update cahoots_room_players set streak=0,lives=case when r.game_mode='survival' then greatest(0,lives-1) else lives end,
     eliminated=case when r.game_mode='survival' and lives<=1 then true else eliminated end where id=p.id;
 end if;
 return jsonb_build_object('correct',ok,'awarded',awarded,'score',(select score from cahoots_room_players where id=p.id),'lives',(select lives from cahoots_room_players where id=p.id),'eliminated',(select eliminated from cahoots_room_players where id=p.id));
end $$;

revoke all on function public.cahoots_create_room(text,jsonb,text) from public;
revoke all on function public.cahoots_create_room(text,jsonb,text,text) from public;
revoke all on function public.cahoots_join_room(text,text) from public;
revoke all on function public.cahoots_room_snapshot(text) from public;
revoke all on function public.cahoots_host_start(text) from public;
revoke all on function public.cahoots_host_next(text) from public;
revoke all on function public.cahoots_submit_answer(text,uuid,int) from public;
grant execute on function public.cahoots_create_room(text,jsonb,text,text) to authenticated;
grant execute on function public.cahoots_join_room(text,text) to anon,authenticated;
grant execute on function public.cahoots_room_snapshot(text) to anon,authenticated;
grant execute on function public.cahoots_host_start(text) to authenticated;
grant execute on function public.cahoots_host_next(text) to authenticated;
grant execute on function public.cahoots_submit_answer(text,uuid,int) to anon,authenticated;
