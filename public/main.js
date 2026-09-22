import * as THREE from 'three';

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fa2b5);
scene.fog = new THREE.Fog(0x8fa2b5, 35, 95);
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 160);

const hemi = new THREE.HemisphereLight(0xdbe9ff, 0x4b4033, 2.0); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 2.6); sun.position.set(14,22,8); sun.castShadow = true; scene.add(sun);
sun.shadow.mapSize.set(1024,1024); sun.shadow.camera.left=-28; sun.shadow.camera.right=28; sun.shadow.camera.top=28; sun.shadow.camera.bottom=-28;

const world = new THREE.Group(); scene.add(world);
const actors = new THREE.Group(); scene.add(actors);
const fx = new THREE.Group(); scene.add(fx);
let ground;

const ui = {
  menu: document.getElementById('menu'), start: document.getElementById('startBtn'), settings: document.getElementById('settingsBtn'),
  modes:[...document.querySelectorAll('.mode')], enemyCount:document.getElementById('enemyCount'), enemyVal:document.getElementById('enemyCountVal'),
  difficulty:document.getElementById('difficulty'), environment:document.getElementById('environment'), allyCount:document.getElementById('allyCount'), allyVal:document.getElementById('allyCountVal'),
  modeLabel:document.getElementById('modeLabel'), aiLabel:document.getElementById('aiLabel'), hpFill:document.getElementById('hpFill'), hpText:document.getElementById('hpText'),
  protection:document.getElementById('protection'), metrics:document.getElementById('metrics'), event:document.getElementById('eventText'), la:document.getElementById('laBanner'),
  staminaFill:document.getElementById('staminaFill'), staminaText:document.getElementById('staminaText'), rageText:document.getElementById('rageText')
};
let selectedMode='duel';
ui.modes.forEach(b=>b.addEventListener('click',()=>{ui.modes.forEach(x=>x.classList.remove('active'));b.classList.add('active');selectedMode=b.dataset.mode;}));
ui.enemyCount.addEventListener('input',()=>ui.enemyVal.textContent=ui.enemyCount.value);
ui.allyCount.addEventListener('input',()=>ui.allyVal.textContent=ui.allyCount.value);
ui.settings.addEventListener('click',()=>{ui.menu.classList.add('show');document.exitPointerLock?.();});

const key = Object.create(null); let mouseLeft=false, mouseRight=false; let yaw=0, pitch=-0.18; let started=false; let last=performance.now();
const metrics={attempts:0,hits:0,cc:0,grabs:0,deaths:0,defenses:0};
const state={mode:'duel',difficulty:'Normal',environment:'arena',laTimer:0,laActive:false,laPhase:0};

function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function clearGroup(g){while(g.children.length){const o=g.children.pop();o.traverse?.(n=>{n.geometry?.dispose?.();if(n.material){const arr=Array.isArray(n.material)?n.material:[n.material];arr.forEach(m=>m.dispose?.());}});}}
function mat(hex){return new THREE.MeshStandardMaterial({color:hex,roughness:.8,metalness:.05});}

function makeArena(env){
  clearGroup(world);
  const groundMat = env==='field'?mat(0x667a4b):env==='node'?mat(0x665b4b):mat(0x716b61);
  ground=new THREE.Mesh(new THREE.PlaneGeometry(90,90),groundMat);ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;world.add(ground);
  const grid=new THREE.GridHelper(90,45,0x39434d,0x39434d);grid.position.y=.012;grid.material.opacity=.16;grid.material.transparent=true;world.add(grid);
  if(env==='arena'){
    const stone=mat(0x5d6167); for(let i=0;i<24;i++){const a=i/24*Math.PI*2;const p=new THREE.Mesh(new THREE.BoxGeometry(2.6,3.8,1.2),stone);p.position.set(Math.cos(a)*25,1.9,Math.sin(a)*25);p.rotation.y=-a;p.castShadow=p.receiveShadow=true;world.add(p);}
  } else if(env==='field'){
    const trunk=mat(0x4c3927), leaf=mat(0x425d35); for(let i=0;i<18;i++){const a=Math.random()*Math.PI*2,r=18+Math.random()*24;const t=new THREE.Mesh(new THREE.CylinderGeometry(.25,.4,2.5,6),trunk);t.position.set(Math.cos(a)*r,1.25,Math.sin(a)*r);const l=new THREE.Mesh(new THREE.ConeGeometry(1.5,4,7),leaf);l.position.copy(t.position);l.position.y=4;world.add(t,l);}
  } else {
    const stone=mat(0x55504b); for(let i=0;i<10;i++){const p=new THREE.Mesh(new THREE.BoxGeometry(2+Math.random()*3,1+Math.random()*3,1.4),stone);p.position.set((Math.random()-.5)*55,(p.geometry.parameters.height)/2,(Math.random()-.5)*55);p.rotation.y=Math.random()*Math.PI;world.add(p);}
    const flagMat=mat(0x354c70); for(const x of [-9,9]){const pole=new THREE.Mesh(new THREE.CylinderGeometry(.08,.08,6,8),mat(0x4d3a2b));pole.position.set(x,3,10);const flag=new THREE.Mesh(new THREE.PlaneGeometry(2.5,1.4),flagMat);flag.position.set(x+1.25,5.3,10);world.add(pole,flag);}
  }
}

function makeActor(team,name,pos,isPlayer=false){
  const group=new THREE.Group(); group.position.copy(pos); actors.add(group);
  const bodyMat=mat(team==='blue'?0x355f9b:0x8c3f40); const dark=mat(0x20252a); const metal=mat(0x606a73);
  let body;
  if(isPlayer){
    body=new THREE.Mesh(new THREE.CapsuleGeometry(.68,1.2,6,12),bodyMat);body.position.y=1.48;body.scale.x=1.18;body.castShadow=true;group.add(body);
    const shoulderGeo=new THREE.SphereGeometry(.38,10,8);
    const ls=new THREE.Mesh(shoulderGeo,bodyMat),rs=new THREE.Mesh(shoulderGeo,bodyMat);
    ls.position.set(-.72,1.78,0);rs.position.set(.72,1.78,0);group.add(ls,rs);
    const head=new THREE.Mesh(new THREE.SphereGeometry(.36,12,10),dark);head.position.y=2.48;head.castShadow=true;group.add(head);
    for(const side of [-1,1]){
      const handle=new THREE.Mesh(new THREE.CylinderGeometry(.045,.055,1.18,8),dark);handle.position.set(.58*side,1.12,.35);handle.rotation.z=.25*side;handle.rotation.x=-.48;group.add(handle);
      const axe=new THREE.Mesh(new THREE.BoxGeometry(.42,.18,.12),metal);axe.position.set(.72*side,1.55,.62);axe.rotation.z=.18*side;group.add(axe);
    }
  }else{
    body=new THREE.Mesh(new THREE.CapsuleGeometry(.45,1.05,5,10),bodyMat);body.position.y=1.3;body.castShadow=true;group.add(body);
    const head=new THREE.Mesh(new THREE.SphereGeometry(.32,12,10),dark);head.position.y=2.25;head.castShadow=true;group.add(head);
    const sword=new THREE.Mesh(new THREE.BoxGeometry(.08,.08,1.5),dark);sword.position.set(.55,1.2,.45);sword.rotation.x=-.6;group.add(sword);
  }
  const ring=new THREE.Mesh(new THREE.RingGeometry(isPlayer?.78:.62,isPlayer?.92:.75,32),new THREE.MeshBasicMaterial({color:team==='blue'?0x50a4ff:0xff6464,side:THREE.DoubleSide,transparent:true,opacity:.75}));ring.rotation.x=-Math.PI/2;ring.position.y=.035;group.add(ring);
  return {
    group,team,name,isPlayer,
    hp:isPlayer?180:100,maxHp:isPlayer?180:100,
    stamina:isPlayer?1000:0,maxStamina:isPlayer?1000:0,
    speed:isPlayer?7.2:4.5,cc:0,invuln:0,sa:0,fg:false,attackCd:0,decision:Math.random()*.5,target:null,alive:true,body,dodgeCd:0,
    cds:{lava:0,shake:0,grab:0,predatory:0,beastly:0,frenzy:0,thunder:0,rage:0},
    rage:0,healTick:5,skillMove:null,skillTask:null,lavaChain:0,lastSkill:''
  };
}

let player=null,bots=[],allies=[];
function spawnScenario(){
  clearGroup(actors); clearGroup(fx); bots=[];allies=[]; Object.assign(metrics,{attempts:0,hits:0,cc:0,grabs:0,deaths:0,defenses:0});
  state.mode=selectedMode; state.difficulty=ui.difficulty.value; state.environment=ui.environment.value;state.laTimer=8;state.laActive=false;state.laPhase=0;ui.la.hidden=true;
  makeArena(state.environment);
  player=makeActor('blue','Player',new THREE.Vector3(0,0,-7),true);
  if(state.mode==='duel') bots.push(makeActor('red','Enemy 1',new THREE.Vector3(0,0,5)));
  if(state.mode==='many'){
    const n=Number(ui.enemyCount.value); for(let i=0;i<n;i++){const a=i/n*Math.PI*2;bots.push(makeActor('red',`Enemy ${i+1}`,new THREE.Vector3(Math.cos(a)*7,0,Math.sin(a)*7+2)));}
  }
  if(state.mode==='la'){
    const enemyN=Math.max(8,Number(ui.enemyCount.value)); const allyN=Number(ui.allyCount.value);
    for(let i=0;i<allyN;i++) allies.push(makeActor('blue',`Ally ${i+1}`,new THREE.Vector3(-7+(i%4)*2,0,-1+Math.floor(i/4)*2)));
    for(let i=0;i<enemyN;i++) bots.push(makeActor('red',`Enemy ${i+1}`,new THREE.Vector3(4+(i%4)*2,0,-2+Math.floor(i/4)*2)));
    const marker=new THREE.Mesh(new THREE.CylinderGeometry(3.5,3.5,.08,48),new THREE.MeshStandardMaterial({color:0x4b4c4e,emissive:0x111111}));marker.name='laMarker';marker.position.set(0,.04,6);world.add(marker);
  }
  bots.forEach(b=>b.target=player); allies.forEach(a=>a.target=nearestEnemy(a));
  ui.modeLabel.textContent=state.mode==='duel'?'1v1':state.mode==='many'?`1v${bots.length}`:'LA Scenario'; ui.aiLabel.textContent=`AI: ${state.difficulty}`; ui.event.textContent='Training started';
  started=true;
}

function nearestEnemy(a){let best=null,d=Infinity;const pool=a.team==='blue'?bots:[player,...allies].filter(Boolean);for(const x of pool){if(!x.alive)continue;const dd=x.group.position.distanceToSquared(a.group.position);if(dd<d){d=dd;best=x;}}return best;}
function face(a,pos,speed=9,dt=.016){const dx=pos.x-a.group.position.x,dz=pos.z-a.group.position.z;const t=Math.atan2(dx,dz);let diff=Math.atan2(Math.sin(t-a.group.rotation.y),Math.cos(t-a.group.rotation.y));a.group.rotation.y+=diff*Math.min(1,speed*dt);}
function moveActor(a,dir,dt,speed=a.speed){if(a.cc>0||!a.alive)return;a.group.position.addScaledVector(dir,speed*dt);a.group.position.x=clamp(a.group.position.x,-42,42);a.group.position.z=clamp(a.group.position.z,-42,42);}
function setProtectionVisual(a){let c=a.team==='blue'?0x355f9b:0x8c3f40;if(a.rage>0)c=0x9b5b2e;if(a.cc>0)c=0xe58a32;else if(a.invuln>0)c=0x8a5ed1;else if(a.sa>0)c=0x397cc7;else if(a.fg)c=0x3e9b63;a.body.material.color.setHex(c);}

function deal(attacker,target,kind='light'){
  if(!target||!target.alive)return false; metrics.attempts += attacker===player?1:0;
  const d=attacker.group.position.distanceTo(target.group.position); const range=kind==='grab'?1.85:kind==='cc'?2.4:2.2; if(d>range)return false;
  if(target.invuln>0){if(attacker===player)ui.event.textContent='MISS: target iframe'; else metrics.defenses++;return false;}
  if(target.fg && isInFront(target,attacker)){if(kind!=='grab'){if(attacker===player)ui.event.textContent='BLOCKED: Forward Guard';else metrics.defenses++;return false;}}
  let dmg=kind==='grab'?10:kind==='sa'?16:kind==='cc'?11:8; target.hp-=dmg; if(attacker===player)metrics.hits++;
  if(kind==='cc' && target.sa<=0 && !target.fg){target.cc=Math.max(target.cc,1.3);if(attacker===player){metrics.cc++;ui.event.textContent='CC SUCCESS';}}
  if(kind==='grab'){target.cc=Math.max(target.cc,1.8);if(attacker===player){metrics.grabs++;ui.event.textContent='GRAB SUCCESS';}}
  flash(target.group.position,attacker.team==='blue'?0x66b3ff:0xff6f6f);
  if(target.hp<=0)kill(target,attacker); return true;
}
function isInFront(target,attacker){const f=new THREE.Vector3(Math.sin(target.group.rotation.y),0,Math.cos(target.group.rotation.y));const to=attacker.group.position.clone().sub(target.group.position).setY(0).normalize();return f.dot(to)>.05;}
function kill(target,attacker){target.alive=false;target.group.visible=false;target.hp=0;if(target===player){metrics.deaths++;ui.event.textContent='You were defeated — restarting';setTimeout(()=>{if(!started)return;player.hp=player.maxHp;player.stamina=player.maxStamina;player.alive=true;player.group.visible=true;player.group.position.set(0,0,-7);},1100);}else if(attacker===player){ui.event.textContent=`${target.name} defeated`;setTimeout(()=>{if(!started)return;target.hp=100;target.alive=true;target.group.visible=true;target.group.position.set((Math.random()-.5)*8,0,5+Math.random()*5);},1600);}}
function flash(pos,color){const m=new THREE.Mesh(new THREE.SphereGeometry(.12,8,6),new THREE.MeshBasicMaterial({color,transparent:true,opacity:1}));m.position.copy(pos).add(new THREE.Vector3(0,1.4,0));m.userData.life=.28;fx.add(m);}

function forwardVec(){return new THREE.Vector3(Math.sin(yaw),0,Math.cos(yaw));}
function rightVec(){const f=forwardVec();return new THREE.Vector3(f.z,0,-f.x);}
function skillReady(name){return player && player.cds && player.cds[name]<=0;}
function spendStamina(amount){if(!player||player.stamina<amount){ui.event.textContent='STAMINA不足';return false;}player.stamina-=amount;return true;}
function setCd(name,time){player.cds[name]=time;}
function startMove(dir,distance,duration,arc=0){
  player.skillMove={dir:dir.clone().normalize(),speed:distance/duration,time:duration,total:duration,arc:arc};
}
function queueSkill(delay,fn){player.skillTask={time:delay,fn:fn};}
function aoeHit(radius,kind,damage,ccTime=0){
  const center=player.group.position;
  for(const t of bots){
    if(!t.alive||center.distanceTo(t.group.position)>radius)continue;
    if(t.invuln>0)continue;
    if(t.fg && isInFront(t,player) && kind!=='grab')continue;
    t.hp-=damage;metrics.attempts++;metrics.hits++;flash(t.group.position,0x66b3ff);
    if(ccTime>0 && t.sa<=0 && !(t.fg&&isInFront(t,player))){t.cc=Math.max(t.cc,ccTime);metrics.cc++;}
    if(t.hp<=0)kill(t,player);
  }
}
function useSuccessionSkill(name){
  if(!player||!player.alive||player.cc>0)return;
  const f=forwardVec();
  if(name==='lava'){
    if(!skillReady('lava')||!spendStamina(150))return;
    setCd('lava',8);player.sa=.75;player.attackCd=.55;player.lavaChain=1.2;player.lastSkill='Lava Piercer';
    startMove(f,7.4,0.55,0);ui.event.textContent='Lava Piercer — SA';
    return;
  }
  if(name==='shake'){
    if(!skillReady('shake')||!spendStamina(200))return;
    setCd('shake',3);player.invuln=.24;player.attackCd=.26;player.cds.lava=0;player.lavaChain=.8;player.lastSkill='Shake Off';
    const dir=(key.KeyA?-1:1);startMove(rightVec().multiplyScalar(dir),2.7,.24,0);ui.event.textContent='Shake Off — iframe / Lava Piercer reset';
    return;
  }
  if(name==='grab'){
    if(!skillReady('grab'))return;
    setCd('grab',15);player.sa=.55;player.attackCd=.65;player.lastSkill='Smack Down';
    ui.event.textContent='Smack Down — 0.3s grab wind-up';
    queueSkill(.30,()=>{const t=nearestEnemy(player);if(deal(player,t,'grab'))ui.event.textContent='Smack Down — GRAB';else ui.event.textContent='Smack Down — whiff (SA)';});
    return;
  }
  if(name==='predatory'){
    if(!skillReady('predatory')||!spendStamina(250))return;
    setCd('predatory',13);player.sa=1.05;player.attackCd=.9;player.rage=Math.max(player.rage,20);player.healTick=Math.min(player.healTick,5);player.lastSkill='Predatory Hunt';
    startMove(f,5.8,.62,1.65);ui.event.textContent='Predatory Hunt — SA leap';
    queueSkill(.60,()=>{aoeHit(3.15,'cc',22,1.45);ui.event.textContent='Predatory Hunt — final Bound';});
    return;
  }
  if(name==='beastly'){
    if(!skillReady('beastly'))return;
    setCd('beastly',6);player.attackCd=.62;player.lastSkill='Beastly Wind Slash';
    if(player.lavaChain>0){player.fg=true;queueSkill(.58,()=>{player.fg=false;aoeHit(3.2,'cc',18,1.05);});ui.event.textContent='Beastly Wind Slash — FG from Lava chain';}
    else{queueSkill(.42,()=>{aoeHit(3.0,'cc',18,1.05);});ui.event.textContent='Beastly Wind Slash';}
    startMove(f,2.8,.42,.55);return;
  }
  if(name==='frenzy'){
    if(!skillReady('frenzy'))return;
    setCd('frenzy',6);player.attackCd=.72;player.lastSkill='Frenzied Destroyer';ui.event.textContent='Frenzied Destroyer — ground smash';
    queueSkill(.28,()=>{aoeHit(3.4,'light',20,0);});return;
  }
  if(name==='thunder'){
    if(!skillReady('thunder'))return;
    setCd('thunder',14);player.sa=1.15;player.attackCd=1.05;player.lastSkill='Raging Thunder';ui.event.textContent='Raging Thunder — SA spin';
    aoeHit(3.1,'light',12,0);queueSkill(.72,()=>{aoeHit(3.45,'light',17,0);});return;
  }
  if(name==='rage'){
    if(!skillReady('rage'))return;
    setCd('rage',45);player.sa=.8;player.rage=20;player.healTick=5;player.attackCd=.7;player.lastSkill='Unstoppable Beast';player.hp=Math.min(player.maxHp,player.hp+18);
    ui.event.textContent='Unstoppable Beast — Bestial Rage 20s';return;
  }
}

function playerUpdate(dt){
  if(!player||!player.alive)return;
  if(player.skillMove){
    const m=player.skillMove;const step=Math.min(dt,m.time);player.group.position.addScaledVector(m.dir,m.speed*step);m.time-=step;
    if(m.arc>0){const p=1-m.time/m.total;player.group.position.y=Math.sin(Math.PI*p)*m.arc;}
    if(m.time<=0){player.skillMove=null;player.group.position.y=0;}
  }else if(player.attackCd<=0.12){
    const fwd=forwardVec(),right=rightVec(),mv=new THREE.Vector3();
    if(key.KeyW)mv.add(fwd);if(key.KeyS)mv.sub(fwd);if(key.KeyD)mv.add(right);if(key.KeyA)mv.sub(right);
    if(mv.lengthSq()>0){mv.normalize();moveActor(player,mv,dt);face(player,player.group.position.clone().add(mv),16,dt);}
  }
  player.group.position.x=clamp(player.group.position.x,-42,42);player.group.position.z=clamp(player.group.position.z,-42,42);
}

function actPlayer(type){
  if(!player||!player.alive)return;
  const target=nearestEnemy(player);
  if(type==='light' && player.attackCd<=0){player.attackCd=.34;player.lastSkill='Axe Strike';deal(player,target,'light');}
}

function aiParams(){return state.difficulty==='Easy'?{react:.8,aggr:.55,speed:.86}:state.difficulty==='Hard'?{react:.3,aggr:.9,speed:1.12}:{react:.5,aggr:.72,speed:1};}
function aiUpdate(a,dt){if(!a.alive)return;a.target=a.target&&a.target.alive?a.target:nearestEnemy(a);const t=a.target;if(!t)return;const p=aiParams();a.decision-=dt;a.attackCd-=dt;
  const to=t.group.position.clone().sub(a.group.position);const dist=to.length();to.y=0;if(to.lengthSq()>0)to.normalize();face(a,t.group.position,7,dt);
  if(a.cc<=0){if(dist>2.1)moveActor(a,to,dt,a.speed*p.speed);else if(a.decision<=0){a.decision=p.react+Math.random()*.45;const roll=Math.random();if(roll<p.aggr*.18){a.invuln=.28;a.group.position.addScaledVector(to.clone().multiplyScalar(-1),1.4);}else if(roll<p.aggr*.43){a.sa=.5;deal(a,t,'sa');}else if(roll<p.aggr*.68){deal(a,t,'cc');}else if(roll<p.aggr*.82 && dist<1.9){deal(a,t,'grab');}else{a.fg=true;setTimeout(()=>{a.fg=false;},300+Math.random()*350);}}}}

function timers(a,dt){
  a.cc=Math.max(0,a.cc-dt);a.invuln=Math.max(0,a.invuln-dt);a.sa=Math.max(0,a.sa-dt);a.attackCd=Math.max(0,a.attackCd-dt);a.dodgeCd=Math.max(0,a.dodgeCd-dt);
  if(a.isPlayer){
    a.stamina=Math.min(a.maxStamina,a.stamina+75*dt);a.rage=Math.max(0,a.rage-dt);a.lavaChain=Math.max(0,a.lavaChain-dt);
    for(const k of Object.keys(a.cds))a.cds[k]=Math.max(0,a.cds[k]-dt);
    if(a.skillTask){a.skillTask.time-=dt;if(a.skillTask.time<=0){const fn=a.skillTask.fn;a.skillTask=null;fn();}}
    if(a.rage>0){a.healTick-=dt;if(a.healTick<=0){a.healTick=5;a.hp=Math.min(a.maxHp,a.hp+18);}}
  }
  setProtectionVisual(a);
}
function laUpdate(dt){if(state.mode!=='la')return;state.laTimer-=dt;if(state.laTimer<=0&&!state.laActive){state.laActive=true;state.laTimer=4;ui.la.hidden=false;ui.event.textContent='LAST ATTACK — objective push!';const m=world.getObjectByName('laMarker');if(m)m.material.color.setHex(0xe58a32);bots.forEach(b=>b.target=player);allies.forEach(a=>{a.target=nearestEnemy(a);});}
  else if(state.laTimer<=0&&state.laActive){state.laActive=false;state.laTimer=10;ui.la.hidden=true;const m=world.getObjectByName('laMarker');if(m)m.material.color.setHex(0x4b4c4e);}}
function fxUpdate(dt){for(const o of [...fx.children]){o.userData.life-=dt;o.scale.multiplyScalar(1+dt*5);o.material.opacity=clamp(o.userData.life/.28,0,1);if(o.userData.life<=0)fx.remove(o);}}

function cameraUpdate(dt){if(!player)return;const focus=player.group.position.clone().add(new THREE.Vector3(0,1.45,0));const dist=6.5;const cp=Math.cos(pitch);const desired=focus.clone().add(new THREE.Vector3(-Math.sin(yaw)*cp*dist,-Math.sin(pitch)*dist+1.1,-Math.cos(yaw)*cp*dist));camera.position.lerp(desired,1-Math.exp(-10*dt));camera.lookAt(focus);}
function uiUpdate(){
  if(!player)return;
  const hp=clamp(player.hp/player.maxHp,0,1);ui.hpFill.style.width=(hp*100)+'%';ui.hpText.textContent='HP '+Math.ceil(player.hp)+' / '+player.maxHp;
  const st=clamp(player.stamina/player.maxStamina,0,1);if(ui.staminaFill)ui.staminaFill.style.width=(st*100)+'%';if(ui.staminaText)ui.staminaText.textContent='STAMINA '+Math.ceil(player.stamina)+' / '+player.maxStamina;
  if(ui.rageText)ui.rageText.textContent=player.rage>0?'BESTIAL RAGE: '+player.rage.toFixed(1)+'s':'BESTIAL RAGE: OFF';
  ui.protection.textContent=player.cc>0?'CC':player.invuln>0?'IFRAME':player.sa>0?'SA':player.fg?'FG':'NONE';
  ui.metrics.textContent='Hits '+metrics.hits+'/'+metrics.attempts+' ・ CC '+metrics.cc+' ・ Grab '+metrics.grabs+' ・ Deaths '+metrics.deaths;
  const cds={lava:'lava',shake:'shake',grab:'grab',predatory:'predatory',beastly:'beastly',frenzy:'frenzy',thunder:'thunder',rage:'rage'};
  for(const name of Object.keys(cds)){const el=document.getElementById('cd-'+name);if(!el)continue;const v=player.cds[name]||0;el.textContent=v>0?v.toFixed(1)+'s':'READY';el.parentElement.classList.toggle('cooldown',v>0);el.parentElement.classList.toggle('rage',name==='rage'&&player.rage>0);}
}
function resize(){const w=canvas.clientWidth,h=canvas.clientHeight;const need=canvas.width!==Math.floor(w*renderer.getPixelRatio())||canvas.height!==Math.floor(h*renderer.getPixelRatio());if(need){renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}}
function loop(now){const dt=Math.min(.033,(now-last)/1000);last=now;resize();if(started){playerUpdate(dt);timers(player,dt);for(const a of [...bots,...allies]){timers(a,dt);aiUpdate(a,dt);}laUpdate(dt);fxUpdate(dt);cameraUpdate(dt);uiUpdate();}renderer.render(scene,camera);requestAnimationFrame(loop);}requestAnimationFrame(loop);

window.addEventListener('keydown',e=>{
  key[e.code]=true;
  if(e.code==='Space'&&(e.shiftKey||key.ShiftLeft||key.ShiftRight)){e.preventDefault();if(!e.repeat)useSuccessionSkill('lava');return;}
  if(e.repeat)return;
  if(e.code==='KeyE')useSuccessionSkill('grab');
  if(e.code==='KeyF'&&key.KeyS)useSuccessionSkill('predatory');
  if(e.code==='KeyC')useSuccessionSkill('rage');
});
window.addEventListener('keyup',e=>{key[e.code]=false;});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('mousedown',e=>{
  if(!started)return;
  if(document.pointerLockElement!==canvas){canvas.requestPointerLock?.();return;}
  if(e.button===0)mouseLeft=true;if(e.button===2)mouseRight=true;
  if(mouseLeft&&mouseRight){useSuccessionSkill('thunder');return;}
  if(e.button===2&&key.KeyS){useSuccessionSkill('beastly');return;}
  if(e.button===2&&(key.KeyA||key.KeyD)){useSuccessionSkill('shake');return;}
  if(e.button===0&&key.KeyS){useSuccessionSkill('frenzy');return;}
  if(e.button===0)actPlayer('light');
});
window.addEventListener('mouseup',e=>{if(e.button===0)mouseLeft=false;if(e.button===2)mouseRight=false;});
document.addEventListener('mousemove',e=>{if(document.pointerLockElement!==canvas)return;yaw-=e.movementX*.0025;pitch=clamp(pitch-e.movementY*.0021,-.72,.25);});
ui.start.addEventListener('click',()=>{spawnScenario();ui.menu.classList.remove('show');setTimeout(()=>canvas.requestPointerLock?.(),80);});

makeArena('arena');player=makeActor('blue','Player',new THREE.Vector3(0,0,-7),true);bots=[makeActor('red','Enemy 1',new THREE.Vector3(0,0,5))];camera.position.set(0,5,-12);camera.lookAt(0,1,0);uiUpdate();
