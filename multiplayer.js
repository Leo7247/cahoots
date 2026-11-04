(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  let pin = '', playerId = '', playerToken = '', isHost = false, poller = null, lastQuestion = -1, answered = false, liveSnapshot = null, modeTick = null, memoryRevealed = false;
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
      pin=result.pin; playerId=result.player_id; playerToken=result.player_token; isHost=true; lastQuestion=-1; answered=false;
      $('room-pin').textContent=pin; $('room-title').textContent=quiz.title; $('room-mode-label').textContent='MODE: '+mode.toUpperCase(); $('host-start').hidden=false; $('host-next').hidden=true; showRoom(); await refresh(); startPolling();
    } catch(e) { window.alert(e.message||String(e)); }
  }
  async function joinRoom() {
    try {
      const result=await rpc('cahoots_join_room',{p_pin:$('pin-input').value.trim(),p_nickname:$('join-nickname').value.trim()});
      pin=result.pin; playerId=result.player_id; playerToken=result.player_token; isHost=false; lastQuestion=-1; answered=false;
      $('room-pin').textContent=pin; $('room-title').textContent='You joined the game!'; $('host-start').hidden=true; $('host-next').hidden=true; showRoom(); await refresh(); startPolling();
      document.getElementById('multiplayer').classList.add('active'); document.querySelectorAll('.page').forEach(p=>{if(p.id!=='multiplayer')p.classList.remove('active')});
    } catch(e) { window.alert(e.message||String(e)); }
  }
  function modeHud(s, me) {
    const mode=s.game_mode||'classic';
    if(mode==='blitz') return `<div class="mode-hud blitz-hud"><strong>⚡ BLITZ ROUND</strong><span id="mode-clock">15s</span><small>Answer within 15 seconds · 1.5× points</small></div>`;
    if(mode==='survival') return `<div class="mode-hud survival-hud"><strong>❤️ LAST BRAIN STANDING</strong><span>${'❤️'.repeat(Math.max(0,me?.lives??3))}${'🖤'.repeat(Math.max(0,3-(me?.lives??3)))}</span><small>Three lives. Wrong answers cost one life.</small></div>`;
    if(mode==='boss') return `<div class="mode-hud boss-hud"><strong>🐉 QUIZ RAID · BOSS HP ${s.boss_hp}</strong><div class="boss-track"><i style="width:${Math.max(0,Math.min(100,(s.boss_hp/Math.max(3,s.total_questions))*100))}%"></i></div><small>Every correct answer deals 1 damage.</small></div>`;
    if(mode==='streak') return `<div class="mode-hud streak-hud"><strong>🔥 STREAK MACHINE</strong><span>${me?.streak||0}× COMBO</span><small>Each consecutive correct answer boosts points by 20%, up to 2×.</small></div>`;
    if(mode==='memory') return `<div class="mode-hud memory-hud"><strong>🧠 MEMORY FLIP</strong><span>${memoryRevealed?'RECALL THE LETTER':'MEMORIZE THE CHOICES'}</span><small>Choices show for 5 seconds, then only A/B/C/D remain.</small></div>`;
    if(mode==='parkour') { const progress=me?.parkour_progress||0; const pct=Math.min(100,progress/Math.max(1,s.total_questions)*100); return `<div class="mode-hud parkour-hud"><strong>🏃 pArKoUr? · CHECKPOINT ${progress}/${s.total_questions}</strong><div class="boss-track"><i style="width:${pct}%"></i></div><small>Each correct answer moves you one checkpoint toward the finish.</small></div>`; }
    return `<div class="mode-hud"><strong>🎯 CLASSIC</strong><small>Earn the points assigned to each question.</small></div>`;
  }
  async function refresh() {
    if(!pin) return;
    try {
      const s=await rpc('cahoots_room_snapshot',{p_pin:pin}); liveSnapshot=s;
      $('room-status').textContent=s.status.toUpperCase(); $('player-count').textContent=s.players.length;
      if(s.game_mode) $('room-mode-label').textContent='MODE: '+s.game_mode.toUpperCase();
      $('room-players').innerHTML=s.players.map((p,i)=>`<div class="recent-item"><strong>${i+1}. ${esc(p.nickname)}${p.eliminated?' · OUT':''}</strong><small>${p.score} pts${s.game_mode==='survival'?' · '+p.lives+' lives':''}${s.game_mode==='streak'?' · streak '+p.streak:''}${s.game_mode==='parkour'?' · checkpoint '+p.parkour_progress:''}</small></div>`).join('')||'<p>Waiting for players…</p>';
      const me=s.players.find(p=>p.id===playerId);
      window.dispatchEvent(new CustomEvent('cahoots-parkour-state',{detail:{mode:s.game_mode||'classic',status:s.status,pin,playerId,nickname:me?.nickname||'Runner'}}));
      if(s.status==='waiting') { $('live-question').textContent='Waiting for the host to start…'; $('live-answers').innerHTML=''; $('host-start').hidden=!isHost; $('host-next').hidden=true; }
      if(s.status==='active' && s.question) {
        if(lastQuestion!==s.question_index) {lastQuestion=s.question_index;answered=false;memoryRevealed=false;}
        const mode=s.game_mode||'classic';
        const elapsed=Math.max(0,(Date.now()-new Date(s.question_started_at||Date.now()).getTime())/1000);
        memoryRevealed=mode==='memory' && elapsed>=5;
        $('live-question').innerHTML=`<div class="question-points">QUESTION ${s.question_index+1}/${s.total_questions} · ${s.question.points||100} PTS</div><div>${esc(s.question.text)}</div>${modeHud(s,me)}`;
        if(!isHost && !(me||{}).eliminated) {
          if(mode==='memory') {
            const labels=!memoryRevealed?s.question.answers.map((a,i)=>`${'ABCD'[i]}. ${esc(a)}`).join(' · '):'Choices are hidden. Pick the letter you memorized.';
            const choices=s.question.answers.map((a,i)=>`<button class="live-choice" data-live-answer="${i}" ${answered||!memoryRevealed?'disabled':''}>${memoryRevealed?'CHOOSE '+ 'ABCD'[i]:'◉ '+esc(a)}</button>`).join('');
            $('live-answers').innerHTML=`<p class="memory-recall">${labels}</p>${choices}`;
          } else {
            $('live-answers').innerHTML=s.question.answers.map((a,i)=>`<button class="live-choice" data-live-answer="${i}" ${answered?'disabled':''}>${'ABCD'[i]}. ${esc(a)}</button>`).join('');
          }
        } else $('live-answers').innerHTML=(me||{}).eliminated?'<p class="game-message">You are eliminated. Watch the leaderboard!</p>':'<p>Players are answering…</p>';
        $('host-start').hidden=true; $('host-next').hidden=!isHost;
        if(mode==='blitz' && !isHost) { const remaining=Math.max(0,15-Math.floor(elapsed)); const clock=document.getElementById('mode-clock'); if(clock) clock.textContent=remaining+'s'; if(remaining===0){document.querySelectorAll('[data-live-answer]').forEach(b=>b.disabled=true);say('Time is up! Wait for the host to advance.');} }
      }
      if(s.status==='finished') { $('room-status').textContent='GAME FINISHED'; $('live-question').innerHTML='🏆 Final leaderboard'; $('live-answers').innerHTML=''; $('host-next').hidden=true; $('host-start').hidden=true; }
    } catch(e) { say(e.message||'Connection lost.'); }
  }
  function startPolling(){clearInterval(poller);clearInterval(modeTick);poller=setInterval(refresh,900);}
  async function submitAnswer(index) {
    if(answered) return; answered=true;
    document.querySelectorAll('[data-live-answer]').forEach(b=>b.disabled=true);
    try { const result=await rpc('cahoots_submit_answer',{p_pin:pin,p_player_id:playerId,p_player_token:playerToken,p_answer:index}); say(result.correct?`Correct! +${result.awarded||result.points||'points'} ✦`:'Not quite — keep going!'); await refresh(); }
    catch(e){say(e.message||'Could not submit answer.');}
  }
  $('host-mode').addEventListener('change',()=>{const d={classic:'Standard rules. Each question awards its own points.',blitz:'15-second shared question timer. Correct answers earn 1.5× points.',survival:'Three lives per player. Three wrong answers eliminate a player.',boss:'Correct answers damage the shared quiz boss; points still count.',streak:'Correct answers build a combo bonus; a wrong answer resets the streak.',memory:'Memorize the four choices for 5 seconds, then answer using A/B/C/D.',parkour:'Real-time 2D platformer race: run, jump, double-jump, dodge spikes, and reach the finish.'};$('host-mode-description').textContent=d[$('host-mode').value]||d.classic;});
  $('host-create').addEventListener('click',hostRoom);
  $('join-form').addEventListener('submit',e=>{e.preventDefault();joinRoom();});
  $('host-start').addEventListener('click',async()=>{try{await rpc('cahoots_host_start',{p_pin:pin});await refresh();}catch(e){say(e.message);}});
  $('host-next').addEventListener('click',async()=>{try{await rpc('cahoots_host_next',{p_pin:pin});await refresh();}catch(e){say(e.message);}});
  $('live-answers').addEventListener('click',e=>{const b=e.target.closest('[data-live-answer]');if(b)submitAnswer(Number(b.dataset.liveAnswer));});
  $('room-leave').addEventListener('click',()=>{clearInterval(poller);clearInterval(modeTick);window.dispatchEvent(new CustomEvent('cahoots-parkour-state',{detail:{mode:'none',status:'left'}}));window.CAHOOTS_PARKOUR?.stop();pin='';playerId='';playerToken='';$('room-panel').hidden=true;$('host-setup').hidden=false;document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id==='home'));});
  document.addEventListener('click',e=>{if(e.target.closest('[data-go="multiplayer"]'))quizOptions();});
  window.addEventListener('cahoots-auth-ready',quizOptions);
  window.CAHOOTS_MULTIPLAYER={refresh};
})();
