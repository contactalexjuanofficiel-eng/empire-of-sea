// Test de fumée du client : exécute client/index.html dans un faux navigateur (sans dépendance),
// simule ~90 s de jeu (pilotage, tirs, souris, objets, abordage) et échoue au moindre plantage.
// Lancer : node tests/client-smoke.cjs   (depuis la racine du projet)
const fs=require('fs'),vm=require('vm');
const html=fs.readFileSync('client/index.html','utf8');
const code=html.match(/<script>([\s\S]*)<\/script>/)[1];
const handlers={win:{},cv:{}};
const ctxStub=new Proxy({},{get:(t,k)=>k in t?t[k]:(k==='measureText'?()=>({width:10}):()=>{}),set:(t,k,v)=>{t[k]=v;return true}});
const mkEl=()=>({style:{},classList:{add(){},toggle(){},remove(){}},addEventListener(){},appendChild(){},set innerHTML(v){},get innerHTML(){return ''},textContent:'',value:'',disabled:false,focus(){},blur(){}});
const els={};
const cv=Object.assign(mkEl(),{getContext:()=>ctxStub,addEventListener:(n,f)=>{handlers.cv[n]=f},width:0,height:0});
const document={getElementById:id=>id==='c'?cv:(els[id]=els[id]||mkEl()),createElement:()=>mkEl(),activeElement:null};
let raf=null;
const win={innerWidth:1280,innerHeight:720,devicePixelRatio:1,addEventListener:(n,f)=>{handlers.win[n]=f},matchMedia:()=>({matches:false}),requestAnimationFrame:f=>{raf=f}};
const store={};
const sandbox={window:win,document,localStorage:{getItem:k=>store[k]||null,setItem:(k,v)=>{store[k]=v}},performance:{now:()=>0},requestAnimationFrame:win.requestAnimationFrame,Math,JSON,Date,console,setTimeout,String,Number,Array,Object,Proxy,Set,Map,isFinite};
sandbox.window.AudioContext=undefined;
vm.createContext(sandbox);
vm.runInContext(code,sandbox);
let now=0;
const frame=(n)=>{for(let i=0;i<n;i++){now+=16;const f=raf;raf=null;f(now)}};
frame(60);
const key=(code)=>{handlers.win.keydown&&handlers.win.keydown({code,target:{tagName:'BODY'},repeat:false,preventDefault(){}})};
// pilotage + tirs + souris pendant ~90 s de jeu simulé
for(let s=0;s<90;s++){
  key('KeyW');key('Space');key('KeyJ');key('KeyL');key('KeyQ');key('Digit2');key('Digit6');key('KeyR');
  handlers.cv.pointerdown&&handlers.cv.pointerdown({pointerType:'mouse',button:0,clientX:300+s*5,clientY:200+s*3,preventDefault(){}});
  frame(62);
}
key('KeyB');frame(10);key('KeyB');frame(10);
console.log('SMOKE_OK frames simulées jusqu’à t=',now);
