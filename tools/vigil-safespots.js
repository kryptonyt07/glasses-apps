// Safe-spot prober for vigil.
//
// The bug it exists to catch: "the first 4 bosses all have spots where you
// don't have to move". A bullet-hell pattern that leaves ANY static position
// uncontested is not a pattern, it is a puzzle with one answer. This runs the
// REAL emit()/stepBullets()/collide() lifted out of index.html against a grid
// of players who never move, and reports every cell that survives.
//
// usage: node tools/vigil-safespots.js [seconds]
'use strict';
const fs=require('fs'), path=require('path');
const src=fs.readFileSync(path.join(__dirname,'..','vigil','index.html'),'utf8');
const js=(src.match(/<script>([\s\S]*?)<\/script>/)||[])[1];

// Lift only the physics. Everything else in the file is DOM.
function grab(name){
  const i=js.indexOf('function '+name+'(');
  if(i<0) throw new Error('missing function '+name);
  let d=0, started=false;
  for(let k=i;k<js.length;k++){
    if(js[k]==='{'){d++;started=true;}
    else if(js[k]==='}'){d--; if(started&&d===0) return js.slice(i,k+1);}
  }
  throw new Error('unbalanced '+name);
}
const CONSTS=['W\\s*=\\s*\\d+,\\s*H','BOX_PAD','BOSSES'].map(n=>{
  const m=js.match(new RegExp('^const '+n+'\\s*=[\\s\\S]*?;\\s*$','m'));
  if(!m) throw new Error('missing const '+n);
  return m[0];
}).join('\n');

const harness = CONSTS+'\n'+
  ['shot','emit','stepBullets','collide','stepBoss'].map(grab).join('\n')+`
let bullets=[], beams=[], px=0, py=0, bx=W/2, by=96, iframeUntil=0, shield=false, bRage=false, drift=0;
const PR=()=>6.5;
const boxTop=()=>by+BOX_PAD;
function beep(){}
module.exports={
  reset(){ bullets=[]; beams=[]; },
  setBoss(b){ bx=W/2; by=96; },
  setPlayer(x,y){ px=x; py=y; },
  emit, stepBullets, collide, stepBoss,
  boxTop, W, H, BOSSES,
  counts(){ return {b:bullets.length, m:beams.length}; }
};`;
const tmp=path.join(require('os').tmpdir(),'_vigil_phys.js');
fs.writeFileSync(tmp, harness);
const P=require(tmp);
const {W,H,BOSSES}=P;

// performance.now is used for bullet ageing and beam timing; drive it from the
// simulated clock so 1000 trials do not take 1000 real seconds.
let CLOCK=0;
global.performance={now:()=>CLOCK};

const SECS=Number(process.argv[2]||5);
const DT=1/60, STEP=14;   // 14px grid over the 400px arena

// Mirror the live spawn cadence from frame(). Kept in sync by eye; the absolute
// numbers matter less than whether ANY cell is never contested.
function intensityAt(t,secs,rage){
  const prog=Math.min(1,t/secs), open=Math.max(0,1-t/0.9);
  const ramp=Math.pow(prog,1.7)*Math.min(2.0,0.55+secs*0.15);
  return (1+open*1.15+ramp*1.15)*(rage?1.22:1);
}

function probe(boss, secs, trials){
  const cells=[];
  const top=P.boxTop()+8;
  for(let y=top;y<H;y+=STEP) for(let x=10;x<W;x+=STEP) cells.push([x,y,0]);
  for(let tr=0;tr<trials;tr++){
    // one shared bullet timeline per trial, replayed against every cell
    P.reset(); CLOCK=tr*100000;
    const frames=[];
    let acc=0, t=0;
    for(let f=0; f<Math.ceil(secs/DT); f++){
      t+=DT; CLOCK+=DT*1000; acc+=DT; P.stepBoss(DT);
      const rate=0.42/(boss.speed*intensityAt(t,secs,false));
      if(acc>rate){ acc=0; P.emit(boss.pat[Math.floor(Math.random()*boss.pat.length)], t, boss.speed); }
      P.stepBullets(DT);
      frames.push(f);
      for(const c of cells){
        if(c[2]) continue;
        P.setPlayer(c[0],c[1]);
        if(P.collide()) c[2]=1;
      }
    }
  }
  cellCount=cells.length;
  return cells.filter(c=>!c[2]);
}

let bad=0, cellCount=0;
for(const b of BOSSES){
  const safe=probe(b,SECS,Number(process.env.TRIALS||8));
  const total=Math.ceil((H-10)/STEP)*Math.ceil((W-10)/STEP);
  const pct=(safe.length/total*100).toFixed(1);
  console.log(`${b.name.padEnd(8)} ${String(safe.length).padStart(4)}/${total} cells never touched  (${pct}%)`);
  if(safe.length){
    const xs=safe.map(c=>c[0]), ys=safe.map(c=>c[1]);
    console.log(`         x ${Math.min(...xs)}-${Math.max(...xs)}  y ${Math.min(...ys)}-${Math.max(...ys)}`);
    const sample=safe.slice(0,8).map(c=>`(${c[0]},${c[1]})`).join(' ');
    console.log(`         e.g. ${sample}`);
    bad++;
  }
}
