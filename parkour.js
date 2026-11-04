(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const canvas=$('pk-canvas'); if(!canvas)return;
  const ctx=canvas.getContext('2d');
  const W=1200,H=440,worldW=3600,gravity=0.72,moveSpeed=4.5,jumpPower=13.5;
  const platforms=[
    {x:0,y:390,w:430,h:50},{x:500,y:350,w:220,h:24},{x:790,y:310,w:190,h:24},
    {x:1040,y:365,w:270,h:25},{x:1380,y:320,w:190,h:24},{x:1640,y:275,w:230,h:24},
    {x:1950,y:350,w:260,h:25},{x:2290,y:305,w:210,h:24},{x:2570,y:255,w:220,h:24},
    {x:2860,y:345,w:250,h:25},{x:3190,y:390,w:410,h:50}
  ];
  const spikes=[{x:330,y:366,w:42},{x:630,y:326,w:36},{x:1120,y:341,w:48},{x:1760,y:251,w:42},{x:2040,y:326,w:52},{x:2390,y:281,w:42},{x:2920,y:321,w:52}];
  const checkpoints=[{x:0,label:'START'},{x:1320,label:'CHECKPOINT 1'},{x:2500,label:'CHECKPOINT 2'},{x:3200,label:'FINISH'}];
  const colors=['#ff5c91','#5fe1ff','#ffd45f','#a78bfa','#7cf29a','#ff9f68'];
  let active=false,channel=null,frame=0,lastBroadcast=0,keys={},touch={left:false,right:false},players=new Map(),finished=new Map(),camera=0,roomPin='',myId='',myName='Player',isHost=false;
  const me={x:55,y:300,vx:0,vy:0,w:28,h:42,onGround:false,checkpoint:0,dead:0,done:false};
  function say(t){$('pk-message').textContent=t;}
  function status(t){$('pk-status').textContent=t;}
  function openParkourPage(){document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id==='parkour'));document.querySelectorAll('.nav-link').forEach(b=>b.classList.remove('active'));window.scrollTo({top:0,behavior:'smooth'});}
  function currentCheckpoint(){let n=0;checkpoints.forEach((c,i)=>{if(me.x>=c.x)n=i;});return n;}
  function resize(){const dpr=Math.min(window.devicePixelRatio||1,2);const rect=canvas.getBoundingClientRect();canvas.width=Math.max(320,Math.floor(rect.width*dpr));canvas.height=Math.floor((rect.width*H/W)*dpr);ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);}
  function startSolo(){if(active)return;roomPin='';myId='solo-'+Math.random().toString(36).slice(2);myName='You';isHost=false;players.clear();finished.clear();reset();active=true;$('pk-overlay').hidden=true;$('pk-room').textContent='SOLO PRACTICE';status('RUNNING');say('Solo practice started. Reach the glowing finish gate!');}
  function reset(){me.x=55;me.y=300;me.vx=0;me.vy=0;me.onGround=false;me.checkpoint=0;me.dead=0;me.done=false;camera=0;}
  async function connectRoom(detail){
    const s=detail.snapshot,mp=window.CAHOOTS_MULTIPLAYER?.getState();
    if(!s||s.game_mode!=='parkour'||s.status!=='active'||!mp?.pin)return;
    if(roomPin===mp.pin&&active)return;
    await stopChannel();roomPin=mp.pin;myId=mp.playerId;myName=mp.nickname||'Player';isHost=!!mp.isHost;players.clear();finished.clear();reset();active=true;
    $('pk-overlay').hidden=true;$('pk-room').textContent='#'+roomPin;status('RACE LIVE');say(isHost?'Host joined the race! You are playing too.':'Race started! Beat the host and your friends.');openParkourPage();
    const client=window.CAHOOTS_MULTIPLAYER.getClient();if(!client)return;
    channel=client.channel('cahoots-parkour-'+roomPin,{config:{broadcast:{self:false}}});
    channel.on('broadcast',{event:'state'},({payload})=>{if(!payload||payload.id===myId)return;players.set(payload.id,{...payload,seen:Date.now()});});
    channel.on('broadcast',{event:'finish'},({payload})=>{if(!payload||payload.id===myId)return;finished.set(payload.id,payload);say(`${payload.name} reached the finish! 🏁`);});
    channel.on('broadcast',{event:'respawn'},({payload})=>{if(payload?.id!==myId&&payload?.id)players.set(payload.id,{...payload,seen:Date.now()});});
    channel.on('broadcast',{event:'race-reset'},()=>{if(active){reset();finished.clear();say('The host restarted the race. Go!');}});
    const result=await channel.subscribe();
    if(result==='CHANNEL_ERROR'||result==='TIMED_OUT')say('Realtime connection failed. Check Supabase Realtime and refresh.');
    broadcast(true);
  }
  async function stopChannel(){if(channel){const c=channel;channel=null;try{await c.unsubscribe();}catch(_){}}}
  async function send(event,payload){if(!channel)return;try{await channel.send({type:'broadcast',event,payload});}catch(_){} }
  function broadcast(force=false){if(!channel||!active)return;const now=performance.now();if(!force&&now-lastBroadcast<65)return;lastBroadcast=now;send('state',{id:myId,name:myName,x:Math.round(me.x),y:Math.round(me.y),checkpoint:me.checkpoint,done:me.done,at:Date.now()});}
  function respawn(){me.x=checkpoints[me.checkpoint].x+18;me.y=260;me.vx=0;me.vy=0;me.dead=0;say('Oof! Back to your last checkpoint.');send('respawn',{id:myId,name:myName,x:me.x,y:me.y,checkpoint:me.checkpoint});}
  function collide(){me.onGround=false;for(const p of platforms){if(me.x+me.w>p.x&&me.x<p.x+p.w&&me.y+me.h>=p.y&&me.y+me.h<=p.y+p.h+14&&me.vy>=0){me.y=p.y-me.h;me.vy=0;me.onGround=true;}}
    for(const h of spikes){if(me.x+me.w>h.x&&me.x<h.x+h.w&&me.y+me.h>h.y-20&&me.y<h.y+20){me.dead=1;}}
  }
  function update(){if(!active)return;if(me.done)return;
    const left=keys.ArrowLeft||keys.a||touch.left,right=keys.ArrowRight||keys.d||touch.right,jump=keys.Space||keys.ArrowUp||keys.w;
    me.vx=left?-moveSpeed:right?moveSpeed:0;me.x=Math.max(0,Math.min(worldW-me.w,me.x+me.vx));
    if(jump&&me.onGround){me.vy=-jumpPower;me.onGround=false;}
    me.vy=Math.min(17,me.vy+gravity);me.y+=me.vy;collide();
    if(me.dead||me.y>H+160){me.dead=0;respawn();}
    const cp=currentCheckpoint();if(cp>me.checkpoint){me.checkpoint=cp;$('pk-checkpoint').textContent=checkpoints[cp].label;say(cp===3?'You found the finish!':'Checkpoint saved. Keep going!');}
    if(me.x>3330&&!me.done){me.done=true;finished.set(myId,{id:myId,name:myName,at:Date.now()});status('FINISHED!');say('🏆 FINISH! You won your race!');send('finish',{id:myId,name:myName,at:Date.now()});}
    camera=Math.max(0,Math.min(worldW-W,me.x-W*0.36));broadcast();
  }
  function draw(){ctx.clearRect(0,0,W,H);const sky=ctx.createLinearGradient(0,0,0,H);sky.addColorStop(0,'#171631');sky.addColorStop(1,'#27204a');ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
    for(let i=0;i<55;i++){const x=((i*173-camera*.22)%W+W)%W;const y=(i*67)%250;ctx.fillStyle=i%3?'#ffffff55':'#65e6ff88';ctx.fillRect(x,y,2,2);}
    ctx.save();ctx.translate(-camera,0);
    // distant scenery
    for(let i=0;i<9;i++){ctx.fillStyle='#302b5d';ctx.fillRect(i*440+80,235,90,155);ctx.fillStyle='#484078';ctx.fillRect(i*440+100,205,50,30);}
    // platforms
    for(const p of platforms){ctx.fillStyle='#51477f';ctx.fillRect(p.x,p.y,p.w,p.h);ctx.fillStyle='#70e8ef';ctx.fillRect(p.x,p.y,p.w,5);ctx.fillStyle='#ffffff18';ctx.fillRect(p.x+8,p.y+10,p.w-16,3);}
    // spikes
    for(const h of spikes){ctx.fillStyle='#ff5b83';for(let x=h.x;x<h.x+h.w;x+=14){ctx.beginPath();ctx.moveTo(x,h.y+20);ctx.lineTo(x+7,h.y-2);ctx.lineTo(x+14,h.y+20);ctx.fill();}}
    // checkpoint flags and finish
    checkpoints.forEach((c,i)=>{ctx.fillStyle=i<=me.checkpoint?'#7cf29a':'#aaa2d8';ctx.fillRect(c.x+4,220,5,170);ctx.fillStyle=i===3?'#ffd45f':'#7cf29a';ctx.beginPath();ctx.moveTo(c.x+9,222);ctx.lineTo(c.x+70,242);ctx.lineTo(c.x+9,262);ctx.fill();});
    // opponents
    let idx=0;for(const p of players.values()){if(Date.now()-p.seen>5000)continue;ctx.globalAlpha=.72;ctx.fillStyle=colors[idx++%colors.length];ctx.fillRect(p.x,p.y,26,40);ctx.fillStyle='#fff';ctx.font='12px system-ui';ctx.fillText(String(p.name||'Player').slice(0,12),p.x-8,p.y-10);ctx.globalAlpha=1;}
    // local player
    ctx.fillStyle='#ff5c91';ctx.fillRect(me.x,me.y,me.w,me.h);ctx.fillStyle='#fff';ctx.fillRect(me.x+17,me.y+9,5,5);ctx.fillStyle='#311a42';ctx.fillRect(me.x+5,me.y+me.h-5,8,5);ctx.fillRect(me.x+18,me.y+me.h-5,8,5);
    ctx.restore();
    // finish HUD
    ctx.fillStyle='#fff';ctx.font='bold 16px system-ui';ctx.fillText('🏁 '+Math.max(0,Math.ceil((3330-me.x)/10))+' m to finish',22,30);
    drawLeaderboard();
  }
  function drawLeaderboard(){const all=[{id:myId,name:myName,x:me.x,done:me.done},...Array.from(players.values()).filter(p=>Date.now()-p.seen<5000)];all.sort((a,b)=>(b.done?1:0)-(a.done?1:0)||((b.x||0)-(a.x||0)));$('pk-leaderboard').innerHTML=all.slice(0,6).map((p,i)=>`<span>${i+1}. ${String(p.name||'Player').replace(/[&<>"']/g,'')} ${p.done?'🏁':Math.floor((p.x||0)/3330*100)+'%'}</span>`).join('');}
  function loop(){update();draw();frame=requestAnimationFrame(loop);}
  function setHold(id,key){const el=$(id);if(!el)return;const down=e=>{e.preventDefault();touch[key]=true;};const up=e=>{e.preventDefault();touch[key]=false;};el.addEventListener('pointerdown',down);['pointerup','pointercancel','pointerleave'].forEach(n=>el.addEventListener(n,up));}
  setHold('pk-left','left');setHold('pk-right','right');setHold('pk-jump','jump');
  $('pk-jump').addEventListener('pointerdown',()=>{keys.Space=true;setTimeout(()=>keys.Space=false,180);});
  window.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp',' ','Space'].includes(e.key))e.preventDefault();keys[e.key===' '?'Space':e.key]=true;});
  window.addEventListener('keyup',e=>{keys[e.key===' '?'Space':e.key]=false;});
  window.addEventListener('blur',()=>{keys={};touch={left:false,right:false};});
  window.addEventListener('cahoots-room-update',e=>{const d=e.detail;if(d?.snapshot?.game_mode==='parkour'&&d.snapshot.status==='active')connectRoom(d);else if(d?.snapshot?.game_mode==='parkour'&&d.snapshot.status==='finished'){active=false;status('RACE FINISHED');say('The host has ended the room. Race results are shown above.');}});
  window.addEventListener('cahoots-room-left',()=>{active=false;stopChannel();roomPin='';status('READY');$('pk-overlay').hidden=false;$('pk-overlay').innerHTML='<strong>🏁 Ready to race?</strong><span>Join a parkour room, then press Start game.</span>';});
  document.addEventListener('click',e=>{if(e.target.closest('[data-go="parkour"]')){if(!active)startSolo();}});
  window.addEventListener('resize',resize);resize();loop();
  window.CAHOOTS_PARKOUR={startSolo,stop:()=>{active=false;stopChannel();}};
})();