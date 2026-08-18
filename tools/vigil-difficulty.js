// Difficulty probe for vigil. The safe-spot prober proves the patterns CONTEST
// every cell; this one asks the opposite question — whether a competent player
// can still live in them. It runs the real emit()/stepBullets()/collide()
// against a greedy dodging agent and reports hits per phase.
//
// Caveat worth keeping in mind: this agent is a poor proxy for a human. It has
// perfect information and no nerves, so treat the numbers as a floor on
// survivability, not a prediction of how the fight feels.
//
// usage: node tools/vigil-difficulty.js [trials]
'use strict';
const fs=require('fs'), path=require('path'), os=require('os');
const src=fs.readFileSync(path.join(__dirname,'..','vigil','index.html'),'utf8');
const js=(src.match(/<script>([\s\S]*?)<\/script>/)||[])[1];
function grab(name){
  const i=js.indexOf('function '+name+'(');
  if(i<0) throw new Error('missing '+name);
  let d=0,started=false;
  for(let k=i;k<js.length;k++){
    if(js[k]==='{'){d++;started=true;} else if(js[k]==='}'){d--; if(started&&d===0) return js.slice(i,k+1);}
  }
  throw new Error('unbalanced '+name);
}
const CONSTS=['W\\s*=\\s*\\d+,\\s*H','BOX_PAD','BY_MAX','DESCENT','BOSSES','ACTS'].map(n=>{
  const m=js.match(new RegExp('^const '+n+'\\s*=[\\s\\S]*?;\\s*$','m'));
  if(!m) throw new Error('missing const '+n); return m[0];
}).join('\n');
const harness=CONSTS+'\n'+['shot','emit','stepBullets','collide','stepBoss'].map(grab).join('\n')+`
let bullets=[], beams=[], px=200, py=288, bx=W/2, by=96, iframeUntil=0, shield=false, bRage=false, drift=0;
const PR=()=>6.5;
const boxTop=()=>by+BOX_PAD;
function beep(){}
module.exports={ emit, stepBullets, collide, stepBoss, boxTop, W, H, BOSSES, ACTS, BY_MAX, DESCENT, BOX_PAD,
  reset(rage,byStart){ bullets=[]; beams=[]; by=byStart==null?96:byStart;
               drift=Math.random()*9; bRage=!!rage;
               px=W/2; py=Math.max(boxTop()+8,H*0.72); iframeUntil=0; },
  get bullets(){return bullets;}, get beams(){return beams;},
  get bx(){return bx;}, get by(){return by;},
  pos(){return [px,py];}, setPos(x,y){px=x;py=y;},
  iframe(t){ iframeUntil=t; } };`;
const tmp=path.join(os.tmpdir(),'_vigil_diff.js');
fs.writeFileSync(tmp,harness);
let CLOCK=0; global.performance={now:()=>CLOCK};
const P=require(tmp); const {W,H,BOSSES,ACTS,BY_MAX,DESCENT,BOX_PAD}=P;

const DT=1/60, SPD=265;
function intensityAt(t,secs,rage){
  const prog=Math.min(1,t/secs), open=Math.max(0,1-t/0.9);
  const ramp=Math.pow(prog,1.7)*Math.min(2.0,0.55+secs*0.15);
  return (1+open*2.2+ramp*1.15)*(rage?1.22:1);
}
// greedy: of nine candidate headings, take the one whose worst-case proximity
// to any threat over the next half second is largest.
const DIRS=[[0,0],[1,0],[-1,0],[0,1],[0,-1],[.7,.7],[-.7,.7],[.7,-.7],[-.7,-.7]];
function think(){
  const [x,y]=P.pos(), top=P.boxTop()+7, k=SPD*DT;
  let best=null, bestScore=-1e9;
  for(const [dx,dy] of DIRS){
    const nx=Math.max(7,Math.min(W-7,x+dx*k)), ny=Math.max(top,Math.min(H-7,y+dy*k));
    let worst=1e9;
    for(let f=1;f<=18;f+=3){
      const ft=f*DT;
      for(const b of P.bullets){
        const d=Math.hypot(b.x+b.vx*ft-nx, b.y+b.vy*ft-ny)-b.r;
        if(d<worst) worst=d;
      }
      for(const bm of P.beams){
        const d=(bm.vert?Math.abs(nx-bm.pos):Math.abs(ny-bm.pos))-9;
        if(d<worst) worst=d;
      }
    }
    const room=Math.min(nx,W-nx,ny-top,H-ny);
    const score=Math.min(worst,90)+room*0.35;
    if(score>bestScore){bestScore=score;best=[nx,ny];}
  }
  P.setPos(best[0],best[1]);
}
function runPhase(boss,secs,rage,byStart){
  P.reset(rage,byStart); CLOCK+=1e6;
  let acc=0,t=0,hits=0;
  P.emit(boss.pat[Math.floor(Math.random()*boss.pat.length)],0,boss.speed);
  for(let f=0;f<Math.ceil(secs/DT);f++){
    t+=DT; CLOCK+=DT*1000; acc+=DT;
    P.stepBoss(DT);
    const rate=0.42/(boss.speed*intensityAt(t,secs,rage));
    if(acc>rate){ acc=0; P.emit(boss.pat[Math.floor(Math.random()*boss.pat.length)],t,boss.speed); }
    P.stepBullets(DT);
    think();
    if(P.collide()){ hits++; P.iframe(CLOCK+900); }
  }
  return hits;
}
// A FULL KILL, with the descent applied — because the descent is the whole
// point: the phase-by-phase numbers say grind, and the only way to see the cost
// of grinding is to play out the boss and let the box close.
const TR=Number(process.argv[2]||60);
const strike=ACTS.find(a=>a.k==='strike'), surge=ACTS.find(a=>a.k==='surge');
function kill(boss, act, rage){
  let by=96, hp=boss.hp, hits=0, t=0;
  while(hp>0){
    by=Math.min(BY_MAX, by+DESCENT);
    hits+=runPhase(boss, act.secs, rage, by);
    hp-=act.dmg; t+=act.secs;
  }
  return [hits,t,by];
}
const avg=a=>a.reduce((x,y)=>x+y,0)/a.length;
console.log('full kill, descent applied (simulated perfect dodger — a FLOOR on survivability)\n');
console.log('boss      all-STRIKE '+strike.secs+'s/'+strike.dmg+'dmg      all-SURGE '+surge.secs+'s/'+surge.dmg+'dmg');
let TS=0,TU=0,TST=0,TUT=0;
for(const b of BOSSES){
  const S=[],U=[];
  for(let i=0;i<TR;i++){ S.push(kill(b,strike,false)); U.push(kill(b,surge,true)); }
  const sh=avg(S.map(r=>r[0])), uh=avg(U.map(r=>r[0]));
  TS+=sh; TU+=uh; TST+=S[0][1]; TUT+=U[0][1];
  console.log(`${b.name.padEnd(9)} ${sh.toFixed(1).padStart(5)} hits · ${S[0][1]}s · room ${Math.round((H-(S[0][2]+BOX_PAD))/(H-96-BOX_PAD)*100)}%   `+
              `${uh.toFixed(1).padStart(5)} hits · ${U[0][1]}s · room ${Math.round((H-(U[0][2]+BOX_PAD))/(H-96-BOX_PAD)*100)}%`);
}
console.log(`\nRUN       ${TS.toFixed(1).padStart(5)} hits · ${TST}s              ${TU.toFixed(1).padStart(5)} hits · ${TUT}s`);
