(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  let pin = '', playerId = '', isHost = false, poller = null, lastQuestion = -1, answered = false;
  const say = msg => { $('room-feedback').textContent = msg; };
  const api = () => window.CAHOOTS_API || {};
  const client = () => api().client;
  function quizOptions() {
    const select = $('host-quiz');
    const list = api().quizzes || [];
    select.innerHTML = list.map((q,i) => `<option value="${i}">${esc(q.title)} (${q.questions.length} Q)</option>`).join('');
    if (!list.length) select.innerHTML = '<option value="">Create a quiz first</option>';
  }
  const esc = s => String(s || '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  async function rpc(name,args) {
    const c=client(); if(!c) throw new Error('Supabase is not connected. Refresh and sign in again.');
    const {data,error}=await c.rpc(name,args); if(error) throw error; return data;
  }
  function showRoom() { $('host-setup').hidden=true; $('room-panel').hidden=false; $('room-panel').scrollIntoView({behavior:'smooth',block:'start'}); }
  async function hostRoom() {
    try {
      const user=api().session?.user; if(!user) throw new Error('Sign in with Google before hosting.');
      const list=api().quizzes||[]; const quiz=list[Number($('host-quiz').value)]; if(!quiz) throw new Error('Create a quiz first, then host it.');
      const questions=quiz.questions.map(q=>({text:q.text,answers:q.answers,correct:Number(q.correct),points:Number(q.points)||100}));
      const mode=$('host-mode').value;
      const result=await rpc('cahoots_create_room',{p_title:quiz.title,p_questions:questions,p_nickname:$('host-nickname').value.trim()||'Host',p_game_mode:mode});
      pin=result.pin; playerId=result.player_id; isHost=true; lastQuestion=-1; answered=false;
      $('room-pin').textContent=pin; $('room-title').textContent=quiz.title; $('room-mode-label').textContent='MODE: '+mode.toUpperCase(); $('host-start').hidden=false; $('host-next').hidden=true; showRoom(); await refresh(); startPolling();
    } catch(e) { window.alert(e.message||String(e)); }
  }
  async function joinRoom() {
    try {
      const result=await rpc('cahoots_join_room',{p_pin:$('pin-input').value.trim(),p_nickname:$('join-nickname').value.trim()});
      pin=result.pin; playerId=result.player_id; isHost=false; lastQuestion=-1; answered=false;
      $('room-pin').textContent=pin; $('room-title').textContent='You joined the game!'; $('host-start').hidden=true; $('host-next').hidden=true; showRoom(); await refresh(); startPolling();
      document.getElementById('multiplayer').classList.add('active'); document.querySelectorAll('.page').forEach(p=>{if(p.id!=='multiplayer')p.classList.remove('active')});
    } catch(e) { window.alert(e.message||String(e)); }
  }
  async function refresh() {
    if(!pin) return;
    try {
      const s=await rpc('cahoots_room_snapshot',{p_pin:pin});
      $('room-status').textContent=s.status.toUpperCase(); $('player-count').textContent=s.players.length; if(s.game_mode) $('room-mode-label').textContent='MODE: '+s.game_mode.toUpperCase();
      $('room-players').innerHTML=s.players.map((p,i)=>`<div class="recent-item"><strong>${i+1}. ${esc(p.nickname)}${p.eliminated?' · OUT':''}</strong><small>${p.score} pts${s.game_mode==='survival'?' · '+p.lives+' lives':''}${s.game_mode==='streak'?' · streak '+p.streak:''}</small></div>`).join('')||'<p>Waiting for players…</p>';
      if(s.game_mode==='boss') $('room-mode-label').textContent='MODE: QUIZ RAID · BOSS HP '+s.boss_hp;
      const me=s.players.find(p=>p.id===playerId); if(me&&me.eliminated&&!isHost){$('live-answers').innerHTML='<p>You are out of lives. Watch the leaderboard!</p>';}
      if(s.status==='waiting') { $('live-question').textContent='Waiting for the host to start…'; $('live-answers').innerHTML=''; }
      if(s.status==='active' && s.question) {
        $('live-question').textContent=`Q${s.question_index+1}/${s.total_questions} · ${s.question.points||100} PTS: ${s.question.text}`;
        if(lastQuestion!==s.question_index) {lastQuestion=s.question_index;answered=false;}
        if(!isHost && !(s.players.find(p=>p.id===playerId)||{}).eliminated) $('live-answers').innerHTML=s.question.answers.map((a,i)=>`<button class="live-choice" data-live-answer="${i}" ${answered?'disabled':''}>${'ABCD'[i]}. ${esc(a)}</button>`).join('');
        else $('live-answers').innerHTML='<p>Players are answering…</p>';
        $('host-start').hidden=true; $('host-next').hidden=!isHost;
      }
      if(s.status==='finished') { $('room-status').textContent='GAME FINISHED'; $('live-question').textContent='🏆 Final leaderboard'; $('live-answers').innerHTML=''; $('host-next').hidden=true; }
    } catch(e) { say(e.message||'Connection lost.'); }
  }
  function startPolling(){clearInterval(poller);poller=setInterval(refresh,2200);}
  async function submitAnswer(index) {
    if(answered) return; answered=true;
    document.querySelectorAll('[data-live-answer]').forEach(b=>b.disabled=true);
    try { const result=await rpc('cahoots_submit_answer',{p_pin:pin,p_player_id:playerId,p_answer:index}); say(result.correct?`Correct! +${result.awarded||result.points||'points'} ✦`:'Not quite — keep going!'); await refresh(); }
    catch(e){say(e.message||'Could not submit answer.');}
  }
  $('host-mode').addEventListener('change',()=>{const d={classic:'Standard rules. Each question awards its own points.',blitz:'Fast-round style. Question points are boosted by 50%.',survival:'Three lives per player. Three wrong answers eliminate a player.',boss:'Correct answers damage the shared quiz boss; points still count.',streak:'Correct answers build a combo bonus; a wrong answer resets the streak.',memory:'Focus mode. Questions and answer choices are presented in the same live room.',parkour:'Energy-run scoring. Correct answers award question points and charge progress.'};$('host-mode-description').textContent=d[$('host-mode').value]||d.classic;});
  $('host-create').addEventListener('click',hostRoom);
  $('join-form').addEventListener('submit',e=>{e.preventDefault();joinRoom();});
  $('host-start').addEventListener('click',async()=>{try{await rpc('cahoots_host_start',{p_pin:pin});await refresh();}catch(e){say(e.message);}});
  $('host-next').addEventListener('click',async()=>{try{await rpc('cahoots_host_next',{p_pin:pin});await refresh();}catch(e){say(e.message);}});
  $('live-answers').addEventListener('click',e=>{const b=e.target.closest('[data-live-answer]');if(b)submitAnswer(Number(b.dataset.liveAnswer));});
  $('room-leave').addEventListener('click',()=>{clearInterval(poller);pin='';playerId='';$('room-panel').hidden=true;$('host-setup').hidden=false;document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id==='home'));});
  document.addEventListener('click',e=>{if(e.target.closest('[data-go="multiplayer"]'))quizOptions();});
  window.addEventListener('cahoots-auth-ready',quizOptions);
  window.CAHOOTS_MULTIPLAYER={refresh};
})();
