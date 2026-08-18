// minimal DOM shim so the game's script can run in node and surface real errors
global.localStorage={_d:{},getItem(k){return this._d[k]??null},setItem(k,v){this._d[k]=String(v)}};
function El(){return{className:'',innerHTML:'',style:{},dataset:{},textContent:'',
  classList:{add(){},remove(){},toggle(){}},addEventListener(){},appendChild(){},
  querySelectorAll(){return[]},querySelector(){return{onclick:null}},remove(){}};}
const board=El(); board._cells=[];
board.appendChild=function(c){this._cells.push(c)};
board.querySelectorAll=function(){return []};
global.document={getElementById:()=>El(),createElement:()=>El(),addEventListener(){},
  querySelector:()=>null};
global.window={addEventListener(){},AudioContext:function(){throw 0}};
global.navigator={};
