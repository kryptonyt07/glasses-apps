// minimal DOM shim so the game's script can run in node and surface real errors
global.localStorage={_d:{},getItem(k){return this._d[k]??null},setItem(k,v){this._d[k]=String(v)}};
// A canvas 2D context that records nothing and refuses nothing. Every draw call
// still RUNS, so a typo'd ctx method or a NaN coordinate surfaces here instead
// of on the user's screen.
const ctx2d=new Proxy({},{get(_,k){
  if(k==='canvas') return {width:400,height:400};
  if(k==='measureText') return ()=>({width:10});
  if(k==='createLinearGradient'||k==='createRadialGradient')
    return ()=>({addColorStop(){}});
  if(k==='getImageData') return ()=>({data:new Uint8ClampedArray(4)});
  return typeof k==='string' ? ()=>{} : undefined;
},set(){return true;}});
function El(){return{className:'',innerHTML:'',style:{},dataset:{},textContent:'',
  width:400,height:400,
  classList:{add(){},remove(){},toggle(){},contains(){return false;}},
  addEventListener(){},appendChild(){},setPointerCapture(){},blur(){},focus(){},
  getContext(){return ctx2d;},getBoundingClientRect(){return{left:0,top:0,width:400,height:400};},
  querySelectorAll(){return[]},querySelector(){return{onclick:null}},remove(){}};}
const board=El(); board._cells=[];
board.appendChild=function(c){this._cells.push(c)};
board.querySelectorAll=function(){return []};
global.document={getElementById:()=>El(),createElement:()=>El(),addEventListener(){},
  querySelector:()=>null};
global.window={addEventListener(){},AudioContext:function(){throw 0}};
global.navigator={};
