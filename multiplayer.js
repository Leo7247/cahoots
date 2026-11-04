(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  let pin='', playerId='', playerToken='', nickname='', isHost=false, poller=null, lastQuestion=-1, answered=false, latestSnapshot=null;
  const say = msg => { if ($('room-feedback')) $('room-feedback').textContent=msg; };
  const api = () => window.CAHOOTS_API || {};
  const client = () => api().client;
  const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function quizOptions(){ const s=$('host-quiz'); if(!s)return; const list=api().quizzes||[]; s.innerHTML=list.map((q,i)=>`<option value="${i}">${esc(q.title)} (${q.questions.length} Q)</option>`).join(''); if(!list.length)s.innerHTML='<option value="">Create a quiz first</option>'; }
  async function rpc(name,args){const c=client();if(!c)throw new Error('Supabase is not connected. Refresh and sign in again.');const {data,error}=await c.rpc(name,args);if(error)throw error;return data;}
  function publishRoom(s){latestSnapshot=s;window.dispatchEvent(new CustomEvent('cahoots-room-update',{detail:{snapshot:s,pin,playerId,playerToken,nickname,isHost}}));}
  function showRoom(){ $('host-setup').hidden=true; $('room-panel').hidden=false; $('room-panel').scrollIntoView({behavior:'smooth',block:'start'}); }
  async function hostRoom(){
    try{
      const user=api().session?.user;if(!user)throw new Error('Sign in with Google before hosting.');
      const list=api().quizzes||[];const quiz=list[Number($('host-quiz').value)];if(!quiz)throw new Error('Create a quiz first, then host it.');
      const questions=quiz.questions.map(q=>({text:q.text,answers:q.answers,correct:Number(q.correct),points:Number(q.points)||100}));
      const mode=$('host-game-mode')?.value||'classic';
      const result=await rpc('cahoots_create_room',{p_title:quiz.title,p_questions:questions,p_nickname:$('host-nickname').value.trim()||'Host',p_game_mode:mode});
      pin=result.pin;playerId=result.player_id;playerToken=result.player_token;nickname=$('host-nickname').value.trim()||'Host';isHost=true;lastQuestion=-1;answered=false;
      $('room-pin').textContent=pin;$('room-title').textContent=quiz.title;$('host-start').hidden=false;$('host-next').hidden=true;showRoom();await refresh();startPolling();
    }catch(e){window.alert(e.message||String(e));}
  }
  async function joinRoom(){
    try{
      const result=await rpc('cahoots_join_room',{p_pin:$('pin-input').value.trim(),p_nickname:$('join-nickname').value.trim()});
      pin=result.pin;playerId=result.player_id;playerToken=result.player_token;nickname=$('join-nickname').value.trim();isHost=false;lastQuestion=-1;answered=false;
      $('room-pin').textContent=pin;$('room-title').textContent='You joined the game!';$('host-start').hidden=true;$('host-next').hidden=true;showRoom();await refresh();startPolling();
      document.getElementById('multiplayer').classList.add('active');document.querySelectorAll('.page').forEach(p=>{if(p.id!=='multiplayer')p.classList.remove('active')});
    }catch(e){window.alert(e.message||String(e));}
  }
  async function refresh(){
    if(!pin)return;
    try{
      const s=await rpc('cahoots_room_snapshot',{p_pin:pin});publishRoom(s);
      $('room-status').textContent=s.status.toUpperCase();$('player-count').textContent=s.players.length;
      $('room-players').innerHTML=s.players.map((p,i)=>`<div class="recent-item"><strong>${i+1}. ${esc(p.nickname)}</strong><small>${p.score} pts${p.eliminated?' · OUT':''}</small></div>`).join('')||'<p>Waiting for players…</p>';
      const parkour=s.game_mode==='parkour';
      if(parkour){$('live-question').textContent='🏃 Parkour race — everyone plays, including the host!';$('live-answers').innerHTML='';$('host-start').hidden=s.status!=='waiting'||!isHost;$('host-next').hidden=true;}
      else if(s.status==='waiting'){$('live-question').textContent='Waiting for the host to start…';$('live-answers').innerHTML='';}
      else if(s.status==='active'&&s.question){$('live-question').textContent=`Q${s.question_index+1}/${s.total_questions}: ${s.question.text}`;if(lastQuestion!==s.question_index){lastQuestion=s.question_index;answered=false;}if(!isHost)$('live-answers').innerHTML=s.question.answers.map((a,i)=>`<button class="live-choice" data-live-answer="${i}" ${answered?'disabled':''}>${'ABCD'[i]}. ${esc(a)}</button>`).join('');else $('live-answers').innerHTML='<p>Players are answering…</p>';$('host-start').hidden=true;$('host-next').hidden=!isHost;}
      if(s.status==='finished'){$('room-status').textContent='GAME FINISHED';$('live-question').textContent='🏆 Final leaderboard';$('live-answers').innerHTML='';$('host-next').hidden=true;}
    }catch(e){say(e.message||'Connection lost.');}
  }
  function startPolling(){clearInterval(poller);poller=setInterval(refresh,1800);}
  async function submitAnswer(index){if(answered)return;answered=true;document.querySelectorAll('[data-live-answer]').forEach(b=>b.disabled=true);try{const result=await rpc('cahoots_submit_answer',{p_pin:pin,p_player_id:playerId,p_player_token:playerToken,p_answer:index});say(result.correct?`Correct! +${result.awarded} points ✦`:'Not quite — keep going!');await refresh();}catch(e){say(e.message||'Could not submit answer.');answered=false;}}
  $('host-create')?.addEventListener('click',hostRoom);
  $('join-form')?.addEventListener('submit',e=>{e.preventDefault();joinRoom();});
  $('host-start')?.addEventListener('click',async()=>{try{await rpc('cahoots_host_start',{p_pin:pin});await refresh();}catch(e){say(e.message);}});
  $('host-next')?.addEventListener('click',async()=>{try{await rpc('cahoots_host_next',{p_pin:pin});await refresh();}catch(e){say(e.message);}});
  $('live-answers')?.addEventListener('click',e=>{const b=e.target.closest('[data-live-answer]');if(b)submitAnswer(Number(b.dataset.liveAnswer));});
  $('room-leave')?.addEventListener('click',()=>{clearInterval(poller);pin='';playerId='';playerToken='';nickname='';isHost=false;latestSnapshot=null;$('room-panel').hidden=true;$('host-setup').hidden=false;window.dispatchEvent(new CustomEvent('cahoots-room-left'));document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id==='home'));});
  document.addEventListener('click',e=>{if(e.target.closest('[data-go="multiplayer"]'))quizOptions();});
  window.addEventListener('cahoots-auth-ready',quizOptions);
  window.CAHOOTS_MULTIPLAYER={refresh,getState:()=>({pin,playerId,playerToken,nickname,isHost,snapshot:latestSnapshot}),getClient:client};
})();