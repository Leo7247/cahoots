/* CaHoOtS pArKoUr? — real-time 2D multiplayer platformer.
   Movement is synchronized with Supabase Realtime Broadcast; no extra SQL tables are needed. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  let channel = null, roomPin = '', myId = '', nickname = 'Runner', active = false;
  let canvas, ctx, raf = 0, lastFrame = 0, lastSend = 0, camera = 0;
  const world = { width: 2600, height: 520, floor: 440 };
  const keys = { left:false, right:false, jump:false };
  const players = new Map();
  const me = { x:90, y:390, vx:0, vy:0, w:30, h:42, grounded:false, jumpsUsed:0, facing:1, finished:false, color:'#73f7d3' };
  const platforms = [
    {x:0,y:440,w:520,h:80},{x:610,y:390,w:230,h:24},{x:920,y:340,w:220,h:24},
    {x:1210,y:400,w:250,h:24},{x:1530,y:350,w:220,h:24},{x:1810,y:300,w:250,h:24},
    {x:2130,y:390,w:470,h:130}
  ];
  const spikes = [{x:350,y:416,w:70,h:24},{x:700,y:366,w:58,h:24},{x:1010,y:316,w:58,h:24},{x:1320,y:376,w:58,h:24},{x:1620,y:326,w:58,h:24},{x:1900,y:276,w:58,h:24},{x:2240,y:366,w:58,h:24}];
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function ensureStage(){
    let stage=$('parkour-stage');
    if(!stage){
      stage=document.createElement('section'); stage.id='parkour-stage'; stage.className='parkour-stage';
      stage.innerHTML=`<div class="parkour-top"><strong>🏃 pArKoUr? — LIVE RACE</strong><span id="parkour-status">Reach the finish!</span></div><div class="parkour-canvas-wrap"><canvas id="parkour-canvas" aria-label="Multiplayer parkour game"></canvas></div><div class="parkour-controls"><button type="button" data-pk="left" aria-label="Move left">◀</button><button type="button" data-pk="right" aria-label="Move right">▶</button><button type="button" data-pk="jump" class="jump">JUMP ⤴</button></div><p class="parkour-help">Hold ◀ / ▶ to move · Tap JUMP to leap twice · Keyboard: A/D or ←/→, Space/W/↑ to jump twice</p><div id="parkour-finishers" class="parkour-finishers"></div>`;
      const anchor=$('live-answers'); anchor.parentNode.insertBefore(stage,anchor.nextSibling);
      stage.querySelectorAll('[data-pk]').forEach(btn=>{
        const k=btn.dataset.pk;
        const down=e=>{e.preventDefault();keys[k]=true; if(k==='jump') jump();};
        const up=e=>{e.preventDefault();keys[k]=false;};
        btn.addEventListener('pointerdown',down); ['pointerup','pointercancel','pointerleave'].forEach(ev=>btn.addEventListener(ev,up));
      });
    }
    canvas=$('parkour-canvas'); ctx=canvas.getContext('2d'); resize();
  }
  function resize(){ if(!canvas)return; const w=canvas.parentElement.clientWidth||700; canvas.width=Math.floor(w*devicePixelRatio);canvas.height=Math.floor(300*devicePixelRatio);canvas.style.height='300px';ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0); }
  function jump(){ if(active && (me.grounded || me.jumpsUsed < 2)){me.vy=-570;me.grounded=false;me.jumpsUsed++;} }
  function keyDown(e){
    if(!active || e.target?.matches?.('input,textarea,select,[contenteditable=\"true\"]')) return;
    if(['ArrowLeft','ArrowRight',' ','a','A','d','D','w','W','ArrowUp'].includes(e.key)) e.preventDefault();
    if(e.key==='ArrowLeft'||e.key==='a'||e.key==='A')keys.left=true;
    if(e.key==='ArrowRight'||e.key==='d'||e.key==='D')keys.right=true;
    if(e.key===' '||e.key==='ArrowUp'||e.key==='w'||e.key==='W')jump();
  }
  function keyUp(e){if(e.key==='ArrowLeft'||e.key==='a'||e.key==='A')keys.left=false;if(e.key==='ArrowRight'||e.key==='d'||e.key==='D')keys.right=false;}
  window.addEventListener('keydown',keyDown);window.addEventListener('keyup',keyUp);window.addEventListener('blur',()=>{keys.left=false;keys.right=false;});window.addEventListener('resize',resize);
  function connect(pin,id,name){
    roomPin=pin;myId=id;nickname=name||'Runner';
    if(channel) { try{window.CAHOOTS_API?.client?.removeChannel(channel);}catch(_){} }
    const client=window.CAHOOTS_API?.client;if(!client)return;
    channel=client.channel('cahoots-parkour-'+pin,{config:{broadcast:{self:false}}});
    channel.on('broadcast',{event:'runner'},({payload})=>{
      if(!payload||typeof payload.id!=='string'||payload.id===myId)return;
      players.set(payload.id,{id:payload.id,name:String(payload.name||'Runner').slice(0,24),x:clamp(Number(payload.x)||0,0,world.width),y:clamp(Number(payload.y)||0,0,world.height+100),facing:Number(payload.facing)<0?-1:1,finished:!!payload.finished,color:'#ffcb6b',seen:Date.now()});
    });
    channel.on('broadcast',{event:'finish'},({payload})=>{if(payload?.id!==myId){const p=players.get(payload.id)||{};players.set(payload.id,{...p,...payload,finished:true});updateFinishers();}});
    channel.subscribe(status=>{if(status==='SUBSCRIBED')sendPosition(true);});
  }
  function sendPosition(force=false){if(!channel||!active)return;const now=Date.now();if(!force&&now-lastSend<65)return;lastSend=now;Promise.resolve(channel.send({type:'broadcast',event:'runner',payload:{id:myId,name:String(nickname).slice(0,24),x:Math.round(me.x),y:Math.round(me.y),facing:me.facing,finished:me.finished}})).catch(()=>{if($('parkour-status'))$('parkour-status').textContent='Reconnecting to race…';});}
  function announceFinish(){if(!channel)return;Promise.resolve(channel.send({type:'broadcast',event:'finish',payload:{id:myId,name:String(nickname).slice(0,24),finished:true,at:Date.now()}})).catch(()=>{});$('parkour-status').textContent='🏆 You reached the finish!';}
  function start(){ensureStage();active=true;me.x=90;me.y=world.floor-me.h;me.vx=0;me.vy=0;me.grounded=false;me.jumpsUsed=0;me.finished=false;camera=0;players.clear();$('parkour-stage').hidden=false;$('live-answers').hidden=true;$('live-question').hidden=true;cancelAnimationFrame(raf);lastFrame=performance.now();raf=requestAnimationFrame(frame);sendPosition(true);}
  function stop(){
    active=false;cancelAnimationFrame(raf);
    if($('parkour-stage'))$('parkour-stage').hidden=true;
    if($('live-answers'))$('live-answers').hidden=false;
    if($('live-question'))$('live-question').hidden=false;
    if(channel){const old=channel;channel=null;try{window.CAHOOTS_API?.client?.removeChannel(old);}catch(_){}}
    roomPin='';myId='';players.clear();keys.left=false;keys.right=false;
  }
  function reset(){me.x=90;me.y=world.floor-me.h;me.vx=0;me.vy=0;me.grounded=false;me.jumpsUsed=0;me.finished=false;$('parkour-status').textContent='Race restarted — go!';}
  function collidePlatforms(oldY){me.grounded=false;for(const p of platforms){if(me.x+me.w>p.x&&me.x<p.x+p.w&&me.y+me.h>=p.y&&oldY+me.h<=p.y+8&&me.vy>=0){me.y=p.y-me.h;me.vy=0;me.grounded=true;me.jumpsUsed=0;}}}
  function update(dt){if(!active)return;const oldY=me.y;const dir=(keys.right?1:0)-(keys.left?1:0);me.vx=dir*245;if(dir)me.facing=dir;me.x=clamp(me.x+me.vx*dt,0,world.width-me.w);me.vy=Math.min(850,me.vy+1450*dt);me.y+=me.vy*dt;collidePlatforms(oldY);
    if(me.y>world.height+100){me.x=Math.max(30,me.x-160);me.y=world.floor-me.h;me.vy=0;me.grounded=true;me.jumpsUsed=0;}
    for(const s of spikes){if(me.x+me.w>s.x&&me.x<s.x+s.w&&me.y+me.h>s.y&&me.y<s.y+s.h){me.x=Math.max(30,me.x-180);me.y=world.floor-me.h;me.vy=0;me.grounded=true;me.jumpsUsed=0;$('parkour-status').textContent='Ouch! Watch the spikes!';}}
    if(me.x>world.width-100&&!me.finished){me.finished=true;announceFinish();}
    const viewW=canvas.width/devicePixelRatio;camera=clamp(me.x-viewW*.35,0,world.width-viewW);sendPosition();
  }
  function drawRunner(x,y,color,facing,name,isMe){ctx.fillStyle=color||'#ffcb6b';ctx.fillRect(x,y,28,38);ctx.fillStyle='#182033';ctx.fillRect(x+(facing>0?17:5),y+9,5,5);ctx.fillStyle='#fff';ctx.font='bold 11px system-ui';ctx.textAlign='center';ctx.fillText((name||'Runner').slice(0,13),x+14,y-7);if(isMe){ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.strokeRect(x-2,y-2,32,42);}}
  function render(){if(!ctx||!canvas)return;const w=canvas.width/devicePixelRatio,h=canvas.height/devicePixelRatio;ctx.clearRect(0,0,w,h);ctx.save();ctx.translate(-camera,0);
    ctx.fillStyle='#101a32';ctx.fillRect(camera,0,w,h);for(let x=0;x<world.width;x+=80){ctx.fillStyle='rgba(255,255,255,.045)';ctx.fillRect(x,0,1,h);}
    platforms.forEach(p=>{ctx.fillStyle='#33466e';ctx.fillRect(p.x,p.y,p.w,p.h);ctx.fillStyle='#73f7d3';ctx.fillRect(p.x,p.y,p.w,5);});
    spikes.forEach(s=>{ctx.fillStyle='#ff657a';for(let x=s.x;x<s.x+s.w;x+=14){ctx.beginPath();ctx.moveTo(x,s.y+s.h);ctx.lineTo(x+7,s.y);ctx.lineTo(x+14,s.y+s.h);ctx.fill();}});
    ctx.fillStyle='#ffe27a';ctx.fillRect(world.width-75,180,8,260);ctx.fillStyle='#ffe27a';ctx.font='bold 18px system-ui';ctx.fillText('FINISH',world.width-125,165);
    players.forEach(p=>{if(Date.now()-(p.seen||0)<6000)drawRunner(p.x-camera,p.y,p.color,p.facing,p.name,false);});drawRunner(me.x,me.y,me.color,me.facing,nickname,true);ctx.restore();
    ctx.fillStyle='rgba(255,255,255,.9)';ctx.font='12px system-ui';ctx.textAlign='left';ctx.fillText(`DISTANCE ${Math.min(100,Math.floor(me.x/(world.width-100)*100))}%`,12,20);
  }
  function updateFinishers(){const names=[];players.forEach(p=>{if(p.finished)names.push(p.name||'Runner');});if(me.finished)names.unshift(nickname+' (YOU)');$('parkour-finishers').textContent=names.length?'🏁 Finished: '+names.join(' · '):'Be the first to reach the finish!';}
  function frame(now){if(!active)return;const dt=Math.min(.035,(now-lastFrame)/1000||0);lastFrame=now;update(dt);render();updateFinishers();raf=requestAnimationFrame(frame);}
  window.addEventListener('cahoots-parkour-state',e=>{const d=e.detail||{};if(d.mode!=='parkour'||d.status!=='active'){if(active)stop();return;}if(!active||roomPin!==d.pin||myId!==d.playerId){connect(d.pin,d.playerId,d.nickname);start();}if(d.status==='finished')stop();});
  window.CAHOOTS_PARKOUR={stop,reset};
})();
