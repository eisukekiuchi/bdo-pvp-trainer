import * as THREE from 'three';

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({canvas, antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x899aab);
scene.fog = new THREE.Fog(0x899aab, 38, 105);

const camera = new THREE.PerspectiveCamera(61, 1, 0.1, 180);
const hemi = new THREE.HemisphereLight(0xe7f1ff,0x3b342e,2.15); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff,2.7);
sun.position.set(14,24,10); sun.castShadow=true; sun.shadow.mapSize.set(1024,1024);
sun.shadow.camera.left=-35;sun.shadow.camera.right=35;sun.shadow.camera.top=35;sun.shadow.camera.bottom=-35;scene.add(sun);

const world=new THREE.Group(), actors=new THREE.Group(), fx=new THREE.Group();
scene.add(world,actors,fx);

const ui={
  menu:document.getElementById('menu'),start:document.getElementById('startBtn'),settings:document.getElementById('settingsBtn'),
  modes:[...document.querySelectorAll('.mode')],enemyCount:document.getElementById('enemyCount'),enemyVal:document.getElementById('enemyCountVal'),
  difficulty:document.getElementById('difficulty'),environment:document.getElementById('environment'),allyCount:document.getElementById('allyCount'),allyVal:document.getElementById('allyCountVal'),
  modeLabel:document.getElementById('modeLabel'),aiLabel:document.getElementById('aiLabel'),hpFill:document.getElementById('hpFill'),hpText:document.getElementById('hpText'),
  protection:document.getElementById('protection'),metrics:document.getElementById('metrics'),event:document.getElementById('eventText'),la:document.getElementById('laBanner'),
  staminaFill:document.getElementById('staminaFill'),staminaText:document.getElementById('staminaText'),rageText:document.getElementById('rageText'),
  currentSkill:document.getElementById('currentSkillText'),
  statLine:document.getElementById('statLine'),buffList:document.getElementById('buffList'),comboPanel:document.getElementById('comboPanel'),comboResult:document.getElementById('comboResult'),comboName:document.getElementById('comboName'),comboSteps:document.getElementById('comboSteps'),comboHint:document.getElementById('comboHint'),
  comboSelect:document.getElementById('comboSelect'),baseHP:document.getElementById('baseHP'),baseAP:document.getElementById('baseAP'),baseDR:document.getElementById('baseDR'),worldLabels:document.getElementById('worldLabels'),inputFlash:document.getElementById('inputFlash')
};

let selectedMode='duel';
ui.modes.forEach(b=>b.addEventListener('click',()=>{ui.modes.forEach(x=>x.classList.remove('active'));b.classList.add('active');selectedMode=b.dataset.mode;}));
ui.enemyCount.addEventListener('input',()=>ui.enemyVal.textContent=ui.enemyCount.value);
ui.allyCount.addEventListener('input',()=>ui.allyVal.textContent=ui.allyCount.value);
ui.settings.addEventListener('click',()=>{ui.menu.classList.add('show');document.exitPointerLock?.();});

const key=Object.create(null);
let mouseLeft=false,mouseRight=false,yaw=0,pitch=-0.18,started=false,last=performance.now();
let cameraShake=0;
const metrics={attempts:0,hits:0,cc:0,grabs:0,deaths:0,defenses:0};
const state={mode:'duel',difficulty:'Normal',environment:'arena',laTimer:0,laActive:false,enh56:'blastBash',enh57:'bestialDestroyer',enh58:'berserkerStorm'};
const SKILL_NAME={
  lava:'溶岩貫通',shake:'振り払い',grab:'チョップ＆スロー',predatory:'プレデターハンティング',falling:'フォーリングボルダー',
  beastly:'残酷な風斬',frenzy:'バーサークデストロイヤー',thunder:'ブラストライトニング',rage:'止められない野獣',
  blastBash:'ブラストバッシュ',blastRage:'ブラストレイジ',bestialDestroyer:'ベスティアルデストロイヤー',bestialRage:'ベスティアルレイス',
  berserkerStorm:'バーサーカーストーム',berserkerLord:'バーサーカーロード',predatoryLoop:'プレデターハンティング（連続ジャンプ）'
};
const combo={mode:'free',name:'自由練習',steps:[],index:0,result:'WAIT',lastAt:0,window:3.0,history:[],predatoryCount:0};

const clock=new THREE.Clock();

function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function lerp(a,b,t){return a+(b-a)*t;}
function easeOut(t){return 1-Math.pow(1-t,3);}
function mat(hex,rough=.78,metal=.05){return new THREE.MeshStandardMaterial({color:hex,roughness:rough,metalness:metal});}
function clearGroup(g){while(g.children.length){const o=g.children.pop();o.traverse?.(n=>{n.geometry?.dispose?.();const ms=n.material?(Array.isArray(n.material)?n.material:[n.material]):[];ms.forEach(m=>m.dispose?.());});}}

function makeArena(env){
  clearGroup(world);
  const gm=env==='field'?mat(0x687b50):env==='node'?mat(0x685e51):mat(0x716c63);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(100,100),gm);ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;world.add(ground);
  const grid=new THREE.GridHelper(100,50,0x303943,0x303943);grid.position.y=.012;grid.material.opacity=.13;grid.material.transparent=true;world.add(grid);
  if(env==='arena'){
    const stone=mat(0x5b5f64);
    for(let i=0;i<28;i++){const a=i/28*Math.PI*2;const p=new THREE.Mesh(new THREE.BoxGeometry(2.8,4.5,1.25),stone);p.position.set(Math.cos(a)*28,2.25,Math.sin(a)*28);p.rotation.y=-a;p.castShadow=p.receiveShadow=true;world.add(p);}
  }else if(env==='field'){
    const trunk=mat(0x483728),leaf=mat(0x405936);
    for(let i=0;i<22;i++){const a=Math.random()*Math.PI*2,r=20+Math.random()*27;const t=new THREE.Mesh(new THREE.CylinderGeometry(.25,.42,2.8,7),trunk);t.position.set(Math.cos(a)*r,1.4,Math.sin(a)*r);const l=new THREE.Mesh(new THREE.ConeGeometry(1.7,4.4,8),leaf);l.position.copy(t.position);l.position.y=4.3;world.add(t,l);}
  }else{
    const stone=mat(0x55504b);
    for(let i=0;i<14;i++){const h=1.2+Math.random()*3.2;const p=new THREE.Mesh(new THREE.BoxGeometry(2+Math.random()*4,h,1.2+Math.random()*2),stone);p.position.set((Math.random()-.5)*62,h/2,(Math.random()-.5)*62);p.rotation.y=Math.random()*Math.PI;world.add(p);}
    for(const x of [-10,10]){const pole=new THREE.Mesh(new THREE.CylinderGeometry(.08,.08,6.5,8),mat(0x493729));pole.position.set(x,3.25,12);const flag=new THREE.Mesh(new THREE.PlaneGeometry(3,1.6),mat(0x324b70));flag.position.set(x+1.5,5.5,12);world.add(pole,flag);}
  }
}

function box(w,h,d,m){const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.castShadow=true;return o;}
function sphere(r,m){const o=new THREE.Mesh(new THREE.SphereGeometry(r,14,10),m);o.castShadow=true;return o;}

function makeRig(team,isPlayer){
  const visual=new THREE.Group();
  const skin=mat(team==='blue'?0x8a7764:0x7d6860);
  const cloth=mat(team==='blue'?0x253e5c:0x632f32);
  const dark=mat(0x1c2025),metal=mat(0x737a80,.38,.42);

  if(isPlayer){
    const pelvis=new THREE.Group(); pelvis.position.y=1.05; visual.add(pelvis);
    const torso=box(1.35,1.35,.78,cloth);torso.position.y=.7;pelvis.add(torso);
    const chest=box(1.65,.48,.9,cloth);chest.position.y=1.22;pelvis.add(chest);
    const neck=new THREE.Group();neck.position.y=1.62;pelvis.add(neck);
    const head=sphere(.37,skin);head.position.y=.34;neck.add(head);

    const leftArm=new THREE.Group(),rightArm=new THREE.Group();
    leftArm.position.set(-.9,1.32,0);rightArm.position.set(.9,1.32,0);pelvis.add(leftArm,rightArm);
    const lua=box(.36,.92,.4,skin),rua=box(.36,.92,.4,skin);lua.position.y=-.43;rua.position.y=-.43;leftArm.add(lua);rightArm.add(rua);
    const leftFore=new THREE.Group(),rightFore=new THREE.Group();leftFore.position.y=-.86;rightFore.position.y=-.86;leftArm.add(leftFore);rightArm.add(rightFore);
    const lfa=box(.32,.78,.35,skin),rfa=box(.32,.78,.35,skin);lfa.position.y=-.36;rfa.position.y=-.36;leftFore.add(lfa);rightFore.add(rfa);

    function axe(parent,side){
      const h=box(.09,1.1,.09,dark);h.position.set(0,-.86,.08);h.rotation.z=.08*side;parent.add(h);
      const blade=box(.62,.27,.13,metal);blade.position.set(.18*side,-1.36,.08);blade.rotation.z=.08*side;parent.add(blade);
      const edge=box(.16,.42,.16,metal);edge.position.set(.46*side,-1.36,.08);parent.add(edge);
    }
    axe(leftFore,-1);axe(rightFore,1);

    const leftLeg=new THREE.Group(),rightLeg=new THREE.Group();
    leftLeg.position.set(-.42,.12,0);rightLeg.position.set(.42,.12,0);pelvis.add(leftLeg,rightLeg);
    const llu=box(.46,1.02,.5,dark),rlu=box(.46,1.02,.5,dark);llu.position.y=-.5;rlu.position.y=-.5;leftLeg.add(llu);rightLeg.add(rlu);
    const leftCalf=new THREE.Group(),rightCalf=new THREE.Group();leftCalf.position.y=-.96;rightCalf.position.y=-.96;leftLeg.add(leftCalf);rightLeg.add(rightCalf);
    const llc=box(.4,.92,.43,dark),rlc=box(.4,.92,.43,dark);llc.position.y=-.42;rlc.position.y=-.42;leftCalf.add(llc);rightCalf.add(rlc);

    return {visual,pelvis,torso,chest,neck,head,leftArm,rightArm,leftFore,rightFore,leftLeg,rightLeg,leftCalf,rightCalf,clothMats:[cloth],skinMats:[skin]};
  }

  const body=new THREE.Mesh(new THREE.CapsuleGeometry(.45,1.05,5,10),cloth);body.position.y=1.3;body.castShadow=true;visual.add(body);
  const head=sphere(.32,dark);head.position.y=2.25;visual.add(head);
  const sword=box(.08,.08,1.5,dark);sword.position.set(.55,1.2,.45);sword.rotation.x=-.6;visual.add(sword);
  return {visual,body,head,clothMats:[cloth]};
}

function makeActor(team,name,pos,isPlayer=false){
  const group=new THREE.Group();group.position.copy(pos);actors.add(group);
  const rig=makeRig(team,isPlayer);group.add(rig.visual);
  const ring=new THREE.Mesh(new THREE.RingGeometry(isPlayer?.82:.62,isPlayer?.98:.75,36),new THREE.MeshBasicMaterial({color:team==='blue'?0x4da2ff:0xff6262,side:THREE.DoubleSide,transparent:true,opacity:.75}));
  ring.rotation.x=-Math.PI/2;ring.position.y=.035;group.add(ring);
  return {
    group,rig,team,name,isPlayer,
    hp:isPlayer?180:100,maxHp:isPlayer?180:100,stamina:isPlayer?1000:0,maxStamina:isPlayer?1000:0,
    speed:isPlayer?7.1:4.45,cc:0,invuln:0,sa:0,fg:false,alive:true,respawn:0,decision:Math.random()*.5,target:null,
    attackCd:0,dodgeCd:0,moving:false,moveAmount:0,grabbedBy:null,
    cds:{lava:0,shake:0,grab:0,predatory:0,falling:0,beastly:0,frenzy:0,thunder:0,rage:0,enh56:0,enh57:0,enh58:0},
    rage:0,healTick:5,lavaChain:0,predatoryFollow:0,skill:null,lastSkill:'',status:'NORMAL',statusTimer:0,effects:{},statusEl:null,
    statsBase:{HP:isPlayer?5000:4200,AP:isPlayer?300:280,DR:isPlayer?400:360,AS:100,MS:100,CRIT:0},stats:{HP:isPlayer?5000:4200,AP:isPlayer?300:280,DR:isPlayer?400:360,AS:100,MS:100,CRIT:0},baseSpeed:isPlayer?7.1:4.45
  };
}

let player=null,bots=[],allies=[];

function nearestEnemy(a){
  let best=null,d=Infinity;
  const pool=a.team==='blue'?bots:[player,...allies].filter(Boolean);
  for(const x of pool){if(!x.alive||x.grabbedBy)continue;const dd=x.group.position.distanceToSquared(a.group.position);if(dd<d){d=dd;best=x;}}
  return best;
}

function spawnScenario(){
  clearGroup(actors);clearGroup(fx);bots=[];allies=[];Object.assign(metrics,{attempts:0,hits:0,cc:0,grabs:0,deaths:0,defenses:0});
  state.mode=selectedMode;state.difficulty=ui.difficulty.value;state.environment=ui.environment.value;state.laTimer=8;state.laActive=false;ui.la.hidden=true;readEnhancements();buildCombo();if(ui.worldLabels)ui.worldLabels.innerHTML='';
  makeArena(state.environment);
  player=makeActor('blue','Succession Berserker',new THREE.Vector3(0,0,-8),true);player.statsBase.HP=Number(ui.baseHP?.value||5000);player.statsBase.AP=Number(ui.baseAP?.value||300);player.statsBase.DR=Number(ui.baseDR?.value||400);refreshStats(player);player.hp=player.maxHp;
  if(state.mode==='duel')bots.push(makeActor('red','Enemy 1',new THREE.Vector3(0,0,5)));
  if(state.mode==='many'){
    const n=Number(ui.enemyCount.value);
    for(let i=0;i<n;i++){const a=i/n*Math.PI*2;bots.push(makeActor('red','Enemy '+(i+1),new THREE.Vector3(Math.cos(a)*7,0,Math.sin(a)*7+2)));}
  }
  if(state.mode==='la'){
    const en=Math.max(8,Number(ui.enemyCount.value)),al=Number(ui.allyCount.value);
    for(let i=0;i<al;i++)allies.push(makeActor('blue','Ally '+(i+1),new THREE.Vector3(-7+(i%4)*2,0,-1+Math.floor(i/4)*2)));
    for(let i=0;i<en;i++)bots.push(makeActor('red','Enemy '+(i+1),new THREE.Vector3(4+(i%4)*2,0,-2+Math.floor(i/4)*2)));
    const marker=new THREE.Mesh(new THREE.CylinderGeometry(3.6,3.6,.08,48),new THREE.MeshStandardMaterial({color:0x4b4c4e,emissive:0x111111}));marker.name='laMarker';marker.position.set(0,.04,6);world.add(marker);
  }
  bots.forEach(b=>{b.target=player;createActorLabel(b)});allies.forEach(a=>{a.target=nearestEnemy(a);createActorLabel(a)});
  ui.modeLabel.textContent=state.mode==='duel'?'1対1':state.mode==='many'?'1対'+bots.length:'ラストアタック';
  ui.aiLabel.textContent='AI：'+(state.difficulty==='Easy'?'簡単':state.difficulty==='Hard'?'上級':'標準');ui.event.textContent='伝承GA訓練開始';started=true;
}

function face(a,pos,speed=9,dt=.016){
  const dx=pos.x-a.group.position.x,dz=pos.z-a.group.position.z,t=Math.atan2(dx,dz);
  const diff=Math.atan2(Math.sin(t-a.group.rotation.y),Math.cos(t-a.group.rotation.y));
  a.group.rotation.y+=diff*Math.min(1,speed*dt);
}
function forwardFromActor(a){return new THREE.Vector3(Math.sin(a.group.rotation.y),0,Math.cos(a.group.rotation.y));}
function forwardVec(){return new THREE.Vector3(Math.sin(yaw),0,Math.cos(yaw));}
function rightVec(){const f=forwardVec();return new THREE.Vector3(f.z,0,-f.x);}
function moveActor(a,dir,dt,speed=a.speed){
  if(a.cc>0||!a.alive||a.grabbedBy)return;
  a.group.position.addScaledVector(dir,speed*dt);a.group.position.x=clamp(a.group.position.x,-45,45);a.group.position.z=clamp(a.group.position.z,-45,45);
}

function resetRig(a){
  if(!a.isPlayer)return;
  const r=a.rig;
  r.pelvis.rotation.set(0,0,0);r.pelvis.position.x=0;
  r.leftArm.rotation.set(0,0,.08);r.rightArm.rotation.set(0,0,-.08);
  r.leftFore.rotation.set(0,0,0);r.rightFore.rotation.set(0,0,0);
  r.leftLeg.rotation.set(0,0,0);r.rightLeg.rotation.set(0,0,0);
  r.leftCalf.rotation.set(0,0,0);r.rightCalf.rotation.set(0,0,0);
  r.neck.rotation.set(0,0,0);r.visual.rotation.set(0,0,0);r.visual.position.y=0;r.visual.scale.setScalar(a.rage>0?1.08:1);
}

function animateBase(a,time){
  if(!a.isPlayer)return;
  const r=a.rig;
  if(a.skill)return;
  resetRig(a);
  const swing=a.moving?Math.sin(time*10)*.62:Math.sin(time*2.3)*.045;
  r.leftArm.rotation.x=swing;r.rightArm.rotation.x=-swing;
  r.leftLeg.rotation.x=-swing*.72;r.rightLeg.rotation.x=swing*.72;
  r.pelvis.position.y=1.05+(a.moving?Math.abs(Math.sin(time*10))*.035:Math.sin(time*2.4)*.018);
}

function setProtectionVisual(a){
  if(!a.isPlayer)return;
  const base=a.rage>0?0x8d512d:0x253e5c;
  const c=a.cc>0?0xd88731:a.invuln>0?0x7857bc:a.sa>0?0x2d72b7:a.fg?0x348a59:base;
  a.rig.clothMats.forEach(m=>m.color.setHex(c));
}

function isInFront(target,attacker){
  const f=forwardFromActor(target),to=attacker.group.position.clone().sub(target.group.position).setY(0).normalize();
  return f.dot(to)>.05;
}

function readEnhancements(){
  state.enh56=document.querySelector('input[name="enh56"]:checked')?.value||'blastBash';
  state.enh57=document.querySelector('input[name="enh57"]:checked')?.value||'bestialDestroyer';
  state.enh58=document.querySelector('input[name="enh58"]:checked')?.value||'berserkerStorm';
}
function flashInput(id,success=true,extra=''){
  if(!ui.inputFlash)return;
  const name=SKILL_NAME[id]||id;
  ui.inputFlash.textContent=(success?'✓ ':'✕ ')+name+(extra?' '+extra:'');
  ui.inputFlash.classList.remove('show-ok','show-bad');
  void ui.inputFlash.offsetWidth;
  ui.inputFlash.classList.add(success?'show-ok':'show-bad');
  const node=[...ui.comboSteps.querySelectorAll('.comboStep')].find(x=>x.dataset.id===id || (id==='predatory'&&x.dataset.id==='predatoryLoop'));
  if(node){node.classList.remove('flash-ok','flash-bad');void node.offsetWidth;node.classList.add(success?'flash-ok':'flash-bad');}
}
function buildCombo(){
  combo.mode=ui.comboSelect?.value||'free';combo.index=0;combo.result='WAIT';combo.lastAt=0;combo.history=[];combo.predatoryCount=0;
  if(combo.mode==='catch'){combo.name='接近 → 横移動 → 再接近 → キャッチ → 追撃';combo.steps=['lava','shake','lava','grab','frenzy'];}
  else if(combo.mode==='predator'){combo.name='プレデターハンティング連続 → フォーリングボルダー';combo.steps=['predatoryLoop','falling'];}
  else if(combo.mode==='enhance'){combo.name='スキル練成3段ルート';combo.steps=[state.enh56,state.enh57,state.enh58];}
  else{combo.name='自由練習';combo.steps=[];}
  if(ui.comboHint)ui.comboHint.textContent=combo.mode==='free'?'好きな技を自由に練習':'次の入力を黄色で表示';
  renderCombo();
}
function recordPredatoryHop(){
  flashInput('predatory',true,'×'+(combo.predatoryCount+1));
  if(combo.mode!=='predator'||combo.result!=='WAIT'||combo.index!==0)return;
  combo.predatoryCount++;combo.lastAt=performance.now()/1000;
  if(ui.comboHint)ui.comboHint.textContent='S+F長押し継続中：'+combo.predatoryCount+'回';
  renderCombo();
}
function finishPredatoryChain(){
  if(combo.mode!=='predator'||combo.result!=='WAIT'||combo.index!==0)return;
  if(combo.predatoryCount>=3){
    combo.index=1;combo.lastAt=performance.now()/1000;
    if(ui.comboHint)ui.comboHint.textContent='次：左クリックでフォーリングボルダー';
    renderCombo();
  }else{
    combo.result='FAILED';if(ui.comboHint)ui.comboHint.textContent='連続ジャンプが足りません（3回以上）';flashInput('predatory',false,'×'+combo.predatoryCount);renderCombo();
  }
}
function recordCombo(id,success=true){
  flashInput(id,success);
  if(combo.mode==='free')return;
  if(combo.mode==='predator'&&id==='predatory')return;
  const now=performance.now()/1000;
  if(combo.result==='SUCCESS'||combo.result==='FAILED')return;
  const expected=combo.steps[combo.index];
  if(!success){combo.result='FAILED';combo.history.push({id,state:'fail'});ui.comboHint.textContent=(SKILL_NAME[id]||id)+' が失敗';renderCombo();return;}
  if(expected===id){
    combo.history.push({id,state:'done'});combo.index++;combo.lastAt=now;
    if(combo.index>=combo.steps.length){combo.result='SUCCESS';ui.comboHint.textContent='コンボ成功！';}
    else ui.comboHint.textContent='次：'+SKILL_NAME[combo.steps[combo.index]];
  }else{
    combo.result='FAILED';combo.history.push({id,state:'fail'});ui.comboHint.textContent='順番違い：'+(SKILL_NAME[id]||id)+' ／ 正解：'+(SKILL_NAME[expected]||expected);
  }
  renderCombo();
}
function comboTick(){
  if(combo.mode==='free'||combo.result!=='WAIT'||combo.index===0)return;
  const now=performance.now()/1000;
  if(now-combo.lastAt>combo.window){combo.result='FAILED';ui.comboHint.textContent='入力が遅すぎます';renderCombo();}
}
function renderCombo(){
  if(!ui.comboPanel)return;
  ui.comboName.textContent=combo.name;
  ui.comboResult.textContent=combo.result==='SUCCESS'?'成功':combo.result==='FAILED'?'失敗':combo.mode==='free'?'自由練習':'待機';
  ui.comboPanel.classList.toggle('success',combo.result==='SUCCESS');ui.comboPanel.classList.toggle('failed',combo.result==='FAILED');
  ui.comboSteps.innerHTML='';
  combo.steps.forEach((id,i)=>{
    const s=document.createElement('span');s.dataset.id=id;
    s.className='comboStep '+(i<combo.index?'done':i===combo.index&&combo.result==='WAIT'?'current':combo.result==='FAILED'&&i===combo.index?'fail':'');
    const label=id==='predatoryLoop'?'S+F 長押し：'+SKILL_NAME[id]+' '+(combo.predatoryCount?('×'+combo.predatoryCount):''):SKILL_NAME[id];
    s.textContent=(i+1)+'. '+label;ui.comboSteps.appendChild(s);
  });
}
function applyEffect(a,id,label,duration,mods={},kind='good'){
  a.effects[id]={id,label,time:duration,duration,mods,kind};
  refreshStats(a);
}
function refreshStats(a){
  const s={...a.statsBase};
  for(const e of Object.values(a.effects||{})){for(const [k,v] of Object.entries(e.mods||{})){s[k]=(s[k]??0)+v;}}
  a.stats=s;a.speed=a.baseSpeed*(s.MS/100);
  if(a.maxHp!==s.HP){const ratio=a.maxHp?Math.min(1,a.hp/a.maxHp):1;a.maxHp=s.HP;a.hp=Math.min(a.maxHp,Math.max(a.hp,a.maxHp*ratio));}
}
function setStatus(a,type,duration){
  a.status=type;a.statusTimer=Math.max(a.statusTimer||0,duration||0);
  if(type==='DOWN'||type==='BOUND')a.cc=Math.max(a.cc,duration||1.2);
  if(type==='FLOAT'||type==='STIFFNESS'||type==='STUN'||type==='GRABBED')a.cc=Math.max(a.cc,duration||.8);
}
function statusClass(a){return String(a.status||'NORMAL').toLowerCase();}
function statusLabel(a){
  const map={NORMAL:'通常',DOWN:'ダウン',BOUND:'バウンド',FLOAT:'浮かし',GRABBED:'キャッチ中',STIFFNESS:'硬直',STUN:'気絶'};
  return map[a.status]||a.status||'通常';
}
function createActorLabel(a){
  if(a.isPlayer||!ui.worldLabels)return;
  const el=document.createElement('div');el.className='actorLabel';
  el.innerHTML='<div class="actorName"></div><div class="actorHp"><i></i></div><span class="actorState normal">通常</span>';
  ui.worldLabels.appendChild(el);a.statusEl=el;
}
function updateActorLabels(){
  if(!camera)return;
  for(const a of [...bots,...allies]){
    const el=a.statusEl;if(!el)continue;
    if(!a.alive||!a.group.visible){el.style.display='none';continue;}
    const p=a.group.position.clone().add(new THREE.Vector3(0,3.0,0)).project(camera);
    if(p.z<-1||p.z>1){el.style.display='none';continue;}
    el.style.display='block';el.style.left=((p.x*.5+.5)*innerWidth)+'px';el.style.top=((-p.y*.5+.5)*innerHeight)+'px';
    el.querySelector('.actorName').textContent=a.name;
    el.querySelector('.actorHp i').style.width=(Math.max(0,a.hp/a.maxHp)*100)+'%';
    const st=el.querySelector('.actorState');st.textContent=statusLabel(a);st.className='actorState '+statusClass(a);
  }
}
function buffTick(a,dt){
  for(const [id,e] of Object.entries(a.effects||{})){
    e.time-=dt;
    if(e.mods?.DOT&&e.time>0){a.hp-=e.mods.DOT*dt;}
    if(e.time<=0)delete a.effects[id];
  }
  refreshStats(a);
}
function renderBuffs(){
  if(!ui.buffList||!player)return;
  const entries=Object.values(player.effects||{});
  ui.buffList.innerHTML='';
  if(!entries.length){ui.buffList.innerHTML='<span class="muted">なし</span>';return;}
  for(const e of entries){const x=document.createElement('span');x.className='buffChip '+(e.kind==='bad'?'bad':'good');x.textContent=e.label+' '+e.time.toFixed(1)+'s';ui.buffList.appendChild(x);}
}
function currentEnhancementName(level){return SKILL_NAME[level===56?state.enh56:level===57?state.enh57:state.enh58];}

function impact(pos,color=0xffb460,size=1){
  const ring=new THREE.Mesh(new THREE.RingGeometry(.45,.62,40),new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide,transparent:true,opacity:.95}));
  ring.rotation.x=-Math.PI/2;ring.position.copy(pos);ring.position.y=.04;ring.userData={life:.42,max:.42,expand:4.4*size};fx.add(ring);
  for(let i=0;i<7;i++){
    const p=sphere(.08+Math.random()*.08,new THREE.MeshBasicMaterial({color,transparent:true,opacity:.8}));
    p.position.copy(pos).add(new THREE.Vector3((Math.random()-.5)*.8,.08+Math.random()*.3,(Math.random()-.5)*.8));
    p.userData={life:.35,max:.35,vel:new THREE.Vector3((Math.random()-.5)*2,1+Math.random()*2,(Math.random()-.5)*2)};fx.add(p);
  }
  cameraShake=Math.max(cameraShake,.24*size);
}
function slashFx(pos,rot,color=0xa9d6ff){
  const g=new THREE.RingGeometry(.7,1.0,36,1,0,Math.PI*1.25);
  const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide,transparent:true,opacity:.75}));
  m.position.copy(pos).add(new THREE.Vector3(0,1.25,0));m.rotation.set(Math.PI/2,rot,0);m.userData={life:.22,max:.22,expand:2.2};fx.add(m);
}

function damage(attacker,target,amount,opts={}){
  if(!target||!target.alive)return false;
  if(attacker===player)metrics.attempts++;
  if(target.invuln>0){if(attacker===player)ui.event.textContent='回避されました — 無敵';else metrics.defenses++;return false;}
  if(target.fg&&isInFront(target,attacker)&&!opts.grab){if(attacker===player)ui.event.textContent='防がれました — 前方ガード';else metrics.defenses++;return false;}
  const ap=attacker.stats?.AP||300,dr=target.stats?.DR||350;
  const scaled=amount*clamp(ap/300,.55,2.6)*(1-clamp(dr/2200,0,.48));
  target.hp-=scaled;if(attacker===player)metrics.hits++;
  if(opts.cc&&target.sa<=0&&!target.fg){setStatus(target,opts.ccType||'STIFFNESS',opts.cc);if(attacker===player)metrics.cc++;}
  if(opts.grab){setStatus(target,'GRABBED',opts.cc||1.0);if(attacker===player)metrics.grabs++;}
  if(opts.heal&&attacker){attacker.hp=Math.min(attacker.maxHp,attacker.hp+opts.heal);}
  if(opts.targetEffect)applyEffect(target,opts.targetEffect.id,opts.targetEffect.label,opts.targetEffect.duration,opts.targetEffect.mods,'bad');
  if(opts.selfEffect&&attacker)applyEffect(attacker,opts.selfEffect.id,opts.selfEffect.label,opts.selfEffect.duration,opts.selfEffect.mods,'good');
  if(opts.impact!==false)impact(target.group.position,attacker.team==='blue'?0x77baff:0xff7474,.55);
  if(target.hp<=0)kill(target,attacker);return true;
}

function hitNearest(range,amount,opts={}){
  const t=nearestEnemy(player);if(!t)return false;
  if(player.group.position.distanceTo(t.group.position)>range){metrics.attempts++;return false;}
  return damage(player,t,amount,opts);
}
function aoeHit(radius,amount,opts={}){
  let any=false;
  for(const t of bots){
    if(!t.alive||t.grabbedBy)continue;
    if(player.group.position.distanceTo(t.group.position)<=radius){any=damage(player,t,amount,opts)||any;}
  }
  return any;
}

function kill(target,attacker){
  target.alive=false;target.group.visible=false;target.hp=0;target.grabbedBy=null;target.respawn=target===player?1.25:1.8;
  if(target===player){metrics.deaths++;ui.event.textContent='ダウン — 復帰まで少し待って';}else if(attacker===player)ui.event.textContent=target.name+' を撃破';
}

function respawnActor(a){
  a.hp=a.maxHp;a.alive=true;a.group.visible=true;a.cc=0;a.invuln=.45;a.sa=0;a.fg=false;a.grabbedBy=null;
  if(a===player){a.stamina=a.maxStamina;a.group.position.set(0,0,-8);a.skill=null;}
  else a.group.position.set((Math.random()-.5)*8,0,5+Math.random()*5);
}

function skillReady(n){return player&&player.cds[n]<=0;}
function spendStamina(v){if(player.stamina<v){ui.event.textContent='持久力が足りません';flashInput('持久力',false);return false;}player.stamina-=v;return true;}
function setSkill(name,duration,extra={}){
  player.skill=Object.assign({name,t:0,duration,events:{}},extra);player.lastSkill=name;
  if(ui.currentSkill){const n={Lava Piercer:'溶岩貫通',Shake Off:'振り払い',Smack Down:'チョップ＆スロー','Predatory Hunt':'プレデターハンティング','Beastly Wind Slash':'残酷な風斬','Frenzied Destroyer':'バーサークデストロイヤー','Raging Thunder':'ブラストライトニング','Unstoppable Beast':'止められない野獣','Falling Boulder':'フォーリングボルダー','Blast Bash':'ブラストバッシュ','Blast Rage':'ブラストレイジ','Bestial Destroyer':'ベスティアルデストロイヤー','Bestial Rage':'ベスティアルレイス','Berserker Storm':'バーサーカーストーム','Berserker Lord':'バーサーカーロード','Axe Strike':'通常斧攻撃'};ui.currentSkill.textContent=n[name]||name;}
}
function setCd(n,v){player.cds[n]=v;}

function useLava(){
  if(!skillReady('lava')||!spendStamina(150)||player.skill)return;recordCombo('lava',true);
  setCd('lava',8);player.sa=.78;player.lavaChain=1.25;player.attackCd=.7;
  setSkill('Lava Piercer',.72,{dir:forwardVec(),start:player.group.position.clone(),distance:8.5});
  ui.event.textContent='溶岩貫通 — スーパーアーマー突進';
}
function useShake(){
  if(!skillReady('shake')||!spendStamina(200)||player.skill)return;recordCombo('shake',true);
  setCd('shake',3);player.invuln=.22;player.cds.lava=0;player.lavaChain=1.0;
  const side=key.KeyA?-1:1;
  setSkill('Shake Off',.3,{dir:rightVec().multiplyScalar(side),start:player.group.position.clone(),distance:3.15,side});
  ui.event.textContent='振り払い — 横回避 / 溶岩貫通の再使用待機を初期化';
}
function useGrab(){
  if(!skillReady('grab')||player.skill)return;
  setCd('grab',15);player.sa=.62;player.attackCd=1.55;
  setSkill('Smack Down',1.62,{victim:null,grabChecked:false,slammed:false});
  ui.event.textContent='チョップ＆スロー — キャッチ開始';
}
function usePredatory(){
  if(!skillReady('predatory')||!spendStamina(250)||player.skill)return;
  setCd('predatory',13);player.sa=2.4;player.rage=Math.max(player.rage,20);player.healTick=5;
  setSkill('Predatory Hunt',.58,{hop:1,start:player.group.position.clone(),dir:forwardVec(),distance:3.7,height:3.2,landed:false});
  ui.event.textContent='プレデターハンティング — S+F長押しで連続ジャンプ';
}
function useBeastly(){
  if(!skillReady('beastly')||player.skill)return;recordCombo('beastly',true);
  setCd('beastly',6);const protectedChain=player.lavaChain>0;if(protectedChain)player.fg=true;applyEffect(player,'beastlyAS','攻撃速度 +20%',10,{AS:20});
  setSkill('Beastly Wind Slash',.78,{protectedChain,hit1:false,hit2:false});
  ui.event.textContent=protectedChain?'残酷な風斬 — 溶岩貫通連携・前方ガード':'残酷な風斬';
}
function useFrenzy(){
  if(!skillReady('frenzy')||player.skill)return;recordCombo('frenzy',true);
  setCd('frenzy',6);setSkill('Frenzied Destroyer',.82,{hit:false});
  ui.event.textContent='バーサークデストロイヤー — 斧叩きつけ';
}
function useThunder(){
  if(!skillReady('thunder')||player.skill)return;recordCombo('thunder',true);
  setCd('thunder',14);player.sa=1.7;setSkill('Raging Thunder',1.62,{nextHit:.16,hits:0});
  ui.event.textContent='ブラストライトニング — スーパーアーマー回転';
}
function useRage(){
  if(!skillReady('rage')||player.skill)return;
  setCd('rage',45);player.sa=.95;player.rage=20;player.healTick=5;player.hp=Math.min(player.maxHp,player.hp+18);
  setSkill('Unstoppable Beast',.88,{roared:false});ui.event.textContent='止められない野獣 — 野獣状態';
}

function useFallingBoulder(){
  if(player.skill||player.predatoryFollow<=0||!skillReady('falling'))return;
  setCd('falling',4);player.predatoryFollow=0;setSkill('Falling Boulder',.7,{hit:false});recordCombo('falling',true);ui.event.textContent='フォーリングボルダー';
}
function useEnh56(){
  if(player.skill||player.cds.enh56>0)return;
  if(state.enh56==='blastBash'){
    player.cds.enh56=8;applyEffect(player,'blastBashDR','全ダメージ減少 +20',10,{DR:20});
    setSkill('Blast Bash',.72,{hit:false,start:player.group.position.clone(),dir:forwardVec()});recordCombo('blastBash',true);ui.event.textContent='ブラストバッシュ';
  }else{
    player.cds.enh56=22;player.sa=1.35;applyEffect(player,'blastRageDR','全ダメージ減少 +20',10,{DR:20});
    setSkill('Blast Rage',1.45,{nextHit:.2,hits:0});recordCombo('blastRage',true);ui.event.textContent='ブラストレイジ — SA';
  }
}
function useEnh57(){
  if(player.skill||player.cds.enh57>0)return;
  if(state.enh57==='bestialDestroyer'){
    player.cds.enh57=10;applyEffect(player,'bestialAP','近接攻撃力 +32',10,{AP:32});
    setSkill('Bestial Destroyer',.88,{hit:false});recordCombo('bestialDestroyer',true);ui.event.textContent='ベスティアルデストロイヤー';
  }else{
    player.cds.enh57=15;player.sa=1.35;
    setSkill('Bestial Rage',1.3,{hit1:false,hit2:false});recordCombo('bestialRage',true);ui.event.textContent='ベスティアルレイス — SA';
  }
}
function useBerserkerStorm(){
  if(player.cds.enh58>0)return;
  player.cds.enh58=8;applyEffect(player,'stormMS','移動速度 +20%',10,{MS:20});
  setSkill('Berserker Storm',.95,{hit1:false,hit2:false});recordCombo('berserkerStorm',true);ui.event.textContent='バーサーカーストーム';
}
function useEnh58(){
  if(state.enh58==='berserkerStorm'){ui.event.textContent='バーサーカーストーム: 対応練成中に左クリック';return;}
  if(player.skill||player.cds.enh58>0)return;
  player.cds.enh58=12;applyEffect(player,'lordDR','全ダメージ減少 +20',10,{DR:20});
  setSkill('Berserker Lord',1.18,{nextHit:.25,hits:0});recordCombo('berserkerLord',true);ui.event.textContent='バーサーカーロード';
}
function useLight(){
  if(player.skill||player.attackCd>0)return;
  player.attackCd=.4;setSkill('Axe Strike',.4,{hit:false});
}

function updateSkill(dt){
  const s=player.skill;if(!s)return;
  s.t+=dt;const p=clamp(s.t/s.duration,0,1),r=player.rig;
  resetRig(player);

  if(s.name==='Lava Piercer'){
    const e=easeOut(p);player.group.position.x=lerp(s.start.x,s.start.x+s.dir.x*s.distance,e);player.group.position.z=lerp(s.start.z,s.start.z+s.dir.z*s.distance,e);
    r.visual.rotation.x=-.34;r.pelvis.rotation.x=-.22;r.leftArm.rotation.x=1.1;r.rightArm.rotation.x=1.1;r.leftFore.rotation.x=-.5;r.rightFore.rotation.x=-.5;
    if(!s.events.trail&&p>.18){s.events.trail=true;impact(player.group.position,0x7ec7ff,.55);}
    if(p>.62&&!s.events.hit){s.events.hit=true;hitNearest(2.7,16,{cc:.35});slashFx(player.group.position,player.group.rotation.y);}
  }

  if(s.name==='Shake Off'){
    const e=Math.sin(p*Math.PI/2);player.group.position.x=lerp(s.start.x,s.start.x+s.dir.x*s.distance,e);player.group.position.z=lerp(s.start.z,s.start.z+s.dir.z*s.distance,e);
    r.visual.rotation.z=-s.side*.38*Math.sin(Math.PI*p);r.leftArm.rotation.x=-.6;r.rightArm.rotation.x=.6;
  }

  if(s.name==='Smack Down'){
    face(player,nearestEnemy(player)?.group.position||player.group.position,16,dt);
    if(p<.18){r.pelvis.rotation.x=-.28;r.leftArm.rotation.x=-1.15;r.rightArm.rotation.x=-1.15;}
    if(!s.grabChecked&&p>=.18){
      s.grabChecked=true;const t=nearestEnemy(player);
      if(t&&player.group.position.distanceTo(t.group.position)<=2.35&&t.invuln<=0){
        s.victim=t;t.grabbedBy=player;t.cc=2.4;metrics.grabs++;metrics.attempts++;metrics.hits++;ui.event.textContent='チョップ＆スロー — キャッチ成功';
        cameraShake=.18;
      }else{metrics.attempts++;recordCombo('grab',false);ui.event.textContent='チョップ＆スロー — 空振り';}
    }
    if(s.victim&&s.victim.alive){
      const f=forwardFromActor(player),rr=new THREE.Vector3(f.z,0,-f.x);
      if(p<.55){
        const lift=clamp((p-.18)/.37,0,1);
        s.victim.group.position.copy(player.group.position).addScaledVector(f,.45).addScaledVector(rr,.62);
        s.victim.group.position.y=lerp(.3,3.0,lift);s.victim.group.rotation.y=player.group.rotation.y+Math.PI;
        r.leftArm.rotation.x=lerp(-1.0,-2.4,lift);r.rightArm.rotation.x=lerp(-1.0,-2.4,lift);
      }else{
        const slam=clamp((p-.55)/.27,0,1);
        s.victim.group.position.copy(player.group.position).addScaledVector(f,lerp(.5,1.65,slam));
        s.victim.group.position.y=lerp(3.0,.08,slam);s.victim.group.rotation.x=slam*1.2;
        r.leftArm.rotation.x=lerp(-2.4,.9,slam);r.rightArm.rotation.x=lerp(-2.4,.9,slam);r.pelvis.rotation.x=.38*slam;
        if(!s.slammed&&p>.81){s.slammed=true;s.victim.grabbedBy=null;damage(player,s.victim,28,{cc:1.8,ccType:'DOWN'});recordCombo('grab',true);impact(s.victim.group.position,0xffa55f,1.45);ui.event.textContent='チョップ＆スロー — DOWN';}
      }
    }
  }

  if(s.name==='Predatory Hunt'){
    const q=clamp(s.t/s.duration,0,1),e=easeOut(q);
    player.group.position.x=lerp(s.start.x,s.start.x+s.dir.x*s.distance,e);player.group.position.z=lerp(s.start.z,s.start.z+s.dir.z*s.distance,e);
    player.group.position.y=Math.sin(Math.PI*q)*s.height;
    r.leftLeg.rotation.x=-.75*Math.sin(Math.PI*q);r.rightLeg.rotation.x=-.75*Math.sin(Math.PI*q);r.leftCalf.rotation.x=1.05*Math.sin(Math.PI*q);r.rightCalf.rotation.x=1.05*Math.sin(Math.PI*q);
    r.leftArm.rotation.x=-1.15*Math.sin(Math.PI*q);r.rightArm.rotation.x=-1.15*Math.sin(Math.PI*q);r.visual.rotation.x=-.18*Math.sin(Math.PI*q);
    if(q>=.98&&!s.landed){
      s.landed=true;player.group.position.y=0;
      const keep=key.KeyS&&key.KeyF&&player.stamina>=90;
      recordPredatoryHop();
      if(keep){
        aoeHit(2.8,13,{cc:.3,ccType:'STIFFNESS'});impact(player.group.position,0xffa85e,.85);
        player.stamina-=90;s.hop++;s.t=0;s.start=player.group.position.clone();s.dir=forwardVec();s.distance=3.5;s.height=3.15;s.landed=false;
        player.sa=Math.max(player.sa,.72);
        ui.event.textContent='プレデターハンティング — 連続ジャンプ '+s.hop+'回目';
        return;
      }else{
        aoeHit(3.8,30,{cc:1.25,ccType:'DOWN'});impact(player.group.position,0xffa85e,1.7);
        player.predatoryFollow=1.25;finishPredatoryChain();
        ui.event.textContent='プレデターハンティング — 最終着地 / 左クリックでフォーリングボルダー';
      }
    }
  }

  if(s.name==='Beastly Wind Slash'){
    r.pelvis.rotation.y=p*Math.PI*1.5;r.leftArm.rotation.x=-1.2+Math.sin(p*Math.PI*2)*1.1;r.rightArm.rotation.x=-.9-Math.sin(p*Math.PI*2)*1.1;
    if(!s.hit1&&p>.32){s.hit1=true;aoeHit(2.9,13,{cc:.45});slashFx(player.group.position,player.group.rotation.y);}
    if(!s.hit2&&p>.7){s.hit2=true;aoeHit(3.4,20,{cc:1.0});impact(player.group.position,0x8cc9ff,.8);}
  }

  if(s.name==='Frenzied Destroyer'){
    if(p<.5){r.leftArm.rotation.x=lerp(0,-2.6,p*2);r.rightArm.rotation.x=lerp(0,-2.6,p*2);r.pelvis.rotation.x=-.28*p*2;}
    else{const q=(p-.5)*2;r.leftArm.rotation.x=lerp(-2.6,.75,q);r.rightArm.rotation.x=lerp(-2.6,.75,q);r.pelvis.rotation.x=lerp(-.28,.48,q);}
    if(!s.hit&&p>.66){s.hit=true;aoeHit(3.55,24,{cc:.4});impact(player.group.position,0xffb266,1.25);}
  }

  if(s.name==='Raging Thunder'){
    r.visual.rotation.y=p*Math.PI*7;r.leftArm.rotation.z=1.5;r.rightArm.rotation.z=-1.5;r.leftFore.rotation.z=.45;r.rightFore.rotation.z=-.45;
    if(s.t>=s.nextHit&&s.hits<7){s.hits++;s.nextHit+=.2;aoeHit(3.25,7,{cc:0});slashFx(player.group.position,player.group.rotation.y+s.hits*.7,0x9bd7ff);cameraShake=Math.max(cameraShake,.07);}
  }

  if(s.name==='Unstoppable Beast'){
    r.pelvis.rotation.x=.28*Math.sin(Math.PI*p);r.leftArm.rotation.z=lerp(.08,1.35,Math.sin(Math.PI*p));r.rightArm.rotation.z=lerp(-.08,-1.35,Math.sin(Math.PI*p));r.neck.rotation.x=-.35*Math.sin(Math.PI*p);
    r.visual.scale.setScalar(1+Math.sin(Math.PI*p)*.12);
    if(!s.roared&&p>.38){s.roared=true;impact(player.group.position,0xe59b4a,1.65);cameraShake=.26;}
  }


  if(s.name==='Falling Boulder'){
    r.leftArm.rotation.x=-2.0*Math.sin(Math.PI*p);r.rightArm.rotation.x=-2.0*Math.sin(Math.PI*p);r.pelvis.rotation.x=.35*p;
    if(!s.hit&&p>.58){s.hit=true;aoeHit(3.5,28,{cc:1.55,ccType:'DOWN'});impact(player.group.position,0xffb267,1.4);}
  }
  if(s.name==='Blast Bash'){
    const e=easeOut(p),dir=s.dir;player.group.position.x=lerp(s.start.x,s.start.x+dir.x*4.8,e);player.group.position.z=lerp(s.start.z,s.start.z+dir.z*4.8,e);r.pelvis.rotation.x=-.35;r.leftArm.rotation.x=1.1;r.rightArm.rotation.x=.8;
    if(!s.hit&&p>.52){s.hit=true;hitNearest(3.0,36,{cc:.8,ccType:'STIFFNESS',targetEffect:{id:'bashSlow',label:'移動速度 -15%',duration:5,mods:{MS:-15}}});impact(player.group.position,0xd4b274,.85);}
  }
  if(s.name==='Blast Rage'){
    r.visual.rotation.y=p*Math.PI*5;r.leftArm.rotation.z=1.3;r.rightArm.rotation.z=-1.3;
    if(s.t>=s.nextHit&&s.hits<5){s.hits++;s.nextHit+=.22;const final=s.hits===5;aoeHit(3.3,final?25:11,{cc:final?1.3:0,ccType:final?'DOWN':'STIFFNESS',heal:18});slashFx(player.group.position,player.group.rotation.y+s.hits);}
  }
  if(s.name==='Bestial Destroyer'){
    if(p<.5){r.leftArm.rotation.x=-2.4*p*2;r.rightArm.rotation.x=-2.4*p*2;}else{const q=(p-.5)*2;r.leftArm.rotation.x=lerp(-2.4,.9,q);r.rightArm.rotation.x=lerp(-2.4,.9,q);r.pelvis.rotation.x=.5*q;}
    if(!s.hit&&p>.62){s.hit=true;aoeHit(3.6,42,{cc:1.5,ccType:'DOWN'});impact(player.group.position,0xffa55f,1.5);}
  }
  if(s.name==='Bestial Rage'){
    r.pelvis.rotation.y=p*Math.PI*2.5;r.leftArm.rotation.x=-1.4*Math.sin(Math.PI*p*2);r.rightArm.rotation.x=1.4*Math.sin(Math.PI*p*2);
    if(!s.hit1&&p>.32){s.hit1=true;aoeHit(3.2,18,{targetEffect:{id:'bestialSlow',label:'移動速度 -20%',duration:5,mods:{MS:-20}}});}
    if(!s.hit2&&p>.72){s.hit2=true;aoeHit(3.7,28,{cc:1.0,ccType:'BOUND',targetEffect:{id:'bleed',label:'出血',duration:9,mods:{DOT:3}}});impact(player.group.position,0xb85e4a,1.1);}
  }
  if(s.name==='Berserker Storm'){
    r.visual.rotation.y=p*Math.PI*4.5;r.leftArm.rotation.z=1.3;r.rightArm.rotation.z=-1.3;
    if(!s.hit1&&p>.32){s.hit1=true;aoeHit(3.5,22,{cc:.75,ccType:'FLOAT'});}
    if(!s.hit2&&p>.72){s.hit2=true;aoeHit(3.8,28,{cc:1.15,ccType:'DOWN'});impact(player.group.position,0xd5b25f,1.2);}
  }
  if(s.name==='Berserker Lord'){
    r.pelvis.rotation.x=.3*Math.sin(Math.PI*p);r.leftArm.rotation.x=-2.0*Math.sin(Math.PI*p);r.rightArm.rotation.x=-2.0*Math.sin(Math.PI*p);
    if(s.t>=s.nextHit&&s.hits<3){s.hits++;s.nextHit+=.28;aoeHit(3.6,s.hits===3?38:22,{cc:s.hits===3?1.2:0,ccType:'DOWN',heal:75});impact(player.group.position,0xd89b54,.8);}
  }
  if(s.name==='Axe Strike'){
    r.rightArm.rotation.x=lerp(-1.1,1.15,Math.sin(Math.PI*p));r.rightFore.rotation.x=-.35;
    if(!s.hit&&p>.48){s.hit=true;hitNearest(2.45,9,{cc:0});slashFx(player.group.position,player.group.rotation.y);}
  }

  if(s.t>=s.duration){
    if(s.name==='Smack Down'&&s.victim)s.victim.grabbedBy=null;
    if(s.name==='Predatory Hunt'){player.group.position.y=0;}
    if(s.name==='Beastly Wind Slash')player.fg=false;
    player.skill=null;resetRig(player);
    if(ui.currentSkill)ui.currentSkill.textContent='—';
  }
}

function playerUpdate(dt,time){
  if(!player||!player.alive)return;
  player.moving=false;
  if(player.skill){updateSkill(dt);return;}
  const f=forwardVec(),r=rightVec(),mv=new THREE.Vector3();
  if(key.KeyW)mv.add(f);if(key.KeyS)mv.sub(f);if(key.KeyD)mv.add(r);if(key.KeyA)mv.sub(r);
  if(mv.lengthSq()>0&&player.cc<=0){mv.normalize();moveActor(player,mv,dt);face(player,player.group.position.clone().add(mv),17,dt);player.moving=true;}
  animateBase(player,time);
}

function aiParams(){return state.difficulty==='Easy'?{react:.88,aggr:.48,speed:.84}:state.difficulty==='Hard'?{react:.28,aggr:.9,speed:1.12}:{react:.52,aggr:.72,speed:1};}
function aiUpdate(a,dt){
  if(!a.alive||a.grabbedBy)return;
  a.target=a.target&&a.target.alive?a.target:nearestEnemy(a);const t=a.target;if(!t)return;
  const p=aiParams();a.decision-=dt;a.attackCd=Math.max(0,a.attackCd-dt);
  const to=t.group.position.clone().sub(a.group.position),dist=to.length();to.y=0;if(to.lengthSq()>0)to.normalize();face(a,t.group.position,7,dt);
  if(a.cc<=0){
    if(dist>2.05){moveActor(a,to,dt,a.speed*p.speed);a.moving=true;}
    else if(a.decision<=0&&a.attackCd<=0){
      a.moving=false;a.decision=p.react+Math.random()*.45;const roll=Math.random();
      if(roll<.14){a.invuln=.2;a.group.position.addScaledVector(to.clone().multiplyScalar(-1),1.5);}
      else if(roll<.42){a.sa=.42;a.attackCd=.55;damage(a,t,12,{cc:0});}
      else if(roll<.68){a.attackCd=.65;damage(a,t,10,{cc:1.0});}
      else if(roll<.82&&dist<1.8){a.attackCd=.9;damage(a,t,9,{grab:true,cc:1.25});}
      else{a.fg=true;a.attackCd=.45;}
    }
  }
}

function timers(a,dt){
  a.cc=Math.max(0,a.cc-dt);a.invuln=Math.max(0,a.invuln-dt);a.sa=Math.max(0,a.sa-dt);a.attackCd=Math.max(0,a.attackCd-dt);a.dodgeCd=Math.max(0,a.dodgeCd-dt);
  if(a.respawn>0){a.respawn-=dt;if(a.respawn<=0)respawnActor(a);}buffTick(a,dt);if(a.statusTimer>0){a.statusTimer-=dt;if(a.statusTimer<=0)a.status='NORMAL';}if(!a.isPlayer){a.rig.visual.rotation.z=(a.status==='DOWN'||a.status==='BOUND')?-1.15:a.status==='FLOAT'?.25:0;}
  if(a.fg&&a.attackCd<=0)a.fg=false;
  if(a.isPlayer){
    a.stamina=Math.min(a.maxStamina,a.stamina+72*dt);a.rage=Math.max(0,a.rage-dt);a.lavaChain=Math.max(0,a.lavaChain-dt);a.predatoryFollow=Math.max(0,a.predatoryFollow-dt);
    for(const k of Object.keys(a.cds))a.cds[k]=Math.max(0,a.cds[k]-dt);
    if(a.rage>0){a.healTick-=dt;if(a.healTick<=0){a.healTick=5;a.hp=Math.min(a.maxHp,a.hp+18);}}
    setProtectionVisual(a);
  }
}

function laUpdate(dt){
  if(state.mode!=='la')return;
  state.laTimer-=dt;
  if(state.laTimer<=0&&!state.laActive){state.laActive=true;state.laTimer=4;ui.la.hidden=false;ui.event.textContent='ラストアタック — 突入！';const m=world.getObjectByName('laMarker');if(m)m.material.color.setHex(0xe58a32);}
  else if(state.laTimer<=0&&state.laActive){state.laActive=false;state.laTimer=10;ui.la.hidden=true;const m=world.getObjectByName('laMarker');if(m)m.material.color.setHex(0x4b4c4e);}
}

function fxUpdate(dt){
  for(const o of [...fx.children]){
    o.userData.life-=dt;
    if(o.userData.vel){o.position.addScaledVector(o.userData.vel,dt);o.userData.vel.y-=5*dt;}
    else o.scale.addScalar(dt*(o.userData.expand||2));
    if(o.material)o.material.opacity=clamp(o.userData.life/(o.userData.max||.3),0,1);
    if(o.userData.life<=0)fx.remove(o);
  }
}

function cameraUpdate(dt){
  if(!player)return;
  const focus=player.group.position.clone().add(new THREE.Vector3(0,1.55,0)),dist=7.15,cp=Math.cos(pitch);
  const desired=focus.clone().add(new THREE.Vector3(-Math.sin(yaw)*cp*dist,-Math.sin(pitch)*dist+1.15,-Math.cos(yaw)*cp*dist));
  camera.position.lerp(desired,1-Math.exp(-11*dt));
  if(cameraShake>0){const s=cameraShake;camera.position.x+=(Math.random()-.5)*s;camera.position.y+=(Math.random()-.5)*s;camera.position.z+=(Math.random()-.5)*s;cameraShake=Math.max(0,cameraShake-dt*1.8);}
  camera.lookAt(focus);
}

function uiUpdate(){
  if(!player)return;
  const hp=clamp(player.hp/player.maxHp,0,1);ui.hpFill.style.width=(hp*100)+'%';ui.hpText.textContent='HP '+Math.ceil(player.hp)+' / '+player.maxHp;
  const st=clamp(player.stamina/player.maxStamina,0,1);if(ui.staminaFill)ui.staminaFill.style.width=(st*100)+'%';if(ui.staminaText)ui.staminaText.textContent='持久力 '+Math.ceil(player.stamina)+' / '+player.maxStamina;
  if(ui.rageText)ui.rageText.textContent=player.rage>0?'野獣状態：残り '+player.rage.toFixed(1)+'秒':'野獣状態：OFF';
  ui.protection.textContent=player.cc>0?'CC中':player.invuln>0?'無敵':player.sa>0?'スーパーアーマー':player.fg?'前方ガード':'保護なし';
  ui.metrics.textContent='命中 '+metrics.hits+'/'+metrics.attempts+' ・ CC '+metrics.cc+' ・ キャッチ '+metrics.grabs+' ・ 死亡 '+metrics.deaths;if(ui.statLine)ui.statLine.textContent='攻撃力 '+Math.round(player.stats.AP)+' ・ 防御力 '+Math.round(player.stats.DR)+' ・ 攻撃速度 '+Math.round(player.stats.AS)+'% ・ 移動速度 '+Math.round(player.stats.MS)+'% ・ クリ率 +'+Math.round(player.stats.CRIT)+'%';renderBuffs();
  for(const n of Object.keys(player.cds)){const el=document.getElementById('cd-'+n);if(!el)continue;const v=player.cds[n];el.textContent=v>0?v.toFixed(1)+'秒':'使用可';el.parentElement.classList.toggle('cooldown',v>0);el.parentElement.classList.toggle('rage',n==='rage'&&player.rage>0);}
}

function resize(){
  const w=canvas.clientWidth,h=canvas.clientHeight;
  if(canvas.width!==Math.floor(w*renderer.getPixelRatio())||canvas.height!==Math.floor(h*renderer.getPixelRatio())){renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
}

function loop(){
  const dt=Math.min(.033,clock.getDelta()),time=performance.now()/1000;
  resize();
  if(started&&player){
    timers(player,dt);playerUpdate(dt,time);
    for(const a of [...bots,...allies]){timers(a,dt);aiUpdate(a,dt);}
    laUpdate(dt);fxUpdate(dt);cameraUpdate(dt);uiUpdate();comboTick();updateActorLabels();
  }
  renderer.render(scene,camera);requestAnimationFrame(loop);
}

window.addEventListener('keydown',e=>{
  key[e.code]=true;
  if(e.repeat)return;
  if(e.code==='Space'&&(e.shiftKey||key.ShiftLeft||key.ShiftRight)){e.preventDefault();useLava();return;}
  if(e.code==='KeyE'){useGrab();return;}
  if(e.code==='KeyF'&&key.KeyS){usePredatory();return;}
  if(e.code==='KeyC'){useRage();return;}if(e.code==='KeyX'&&(e.shiftKey||key.ShiftLeft||key.ShiftRight)){useEnh56();return;}if(e.code==='KeyZ'&&(e.shiftKey||key.ShiftLeft||key.ShiftRight)){useEnh57();return;}if(e.code==='Digit3'){useEnh58();return;}
});
window.addEventListener('keyup',e=>{key[e.code]=false;});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('mousedown',e=>{
  if(!started)return;
  if(document.pointerLockElement!==canvas){canvas.requestPointerLock?.();return;}
  if(e.button===0)mouseLeft=true;if(e.button===2)mouseRight=true;
  if(e.button===0&&player?.predatoryFollow>0){useFallingBoulder();return;}if(e.button===0&&state.enh58==='berserkerStorm'&&player?.skill&&['Blast Bash','Bestial Rage','Bestial Destroyer'].includes(player.skill.name)){useBerserkerStorm();return;}if(mouseLeft&&mouseRight){useThunder();return;}
  if(e.button===2&&key.KeyS){useBeastly();return;}
  if(e.button===2&&(key.KeyA||key.KeyD)){useShake();return;}
  if(e.button===0&&key.KeyS){useFrenzy();return;}
  if(e.button===0)useLight();
});
window.addEventListener('mouseup',e=>{if(e.button===0)mouseLeft=false;if(e.button===2)mouseRight=false;});
document.addEventListener('mousemove',e=>{if(document.pointerLockElement!==canvas)return;yaw-=e.movementX*.0025;pitch=clamp(pitch-e.movementY*.0021,-.72,.27);});
ui.start.addEventListener('click',()=>{spawnScenario();ui.menu.classList.remove('show');setTimeout(()=>canvas.requestPointerLock?.(),80);});

makeArena('arena');
player=makeActor('blue','Succession Berserker',new THREE.Vector3(0,0,-8),true);
bots=[makeActor('red','Enemy 1',new THREE.Vector3(0,0,5))];
camera.position.set(0,5,-13);camera.lookAt(0,1,0);uiUpdate();loop();
