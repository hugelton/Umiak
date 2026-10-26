import { defaultPatch, validateConnection } from './graph.js';
const board=document.getElementById('nodeboard'),svg=document.getElementById('wires');
const patch=defaultPatch();
const nodes=[...board.querySelectorAll('.node')];
let active=null,selected=null;
const byId=id=>nodes.find(n=>n.dataset.node===id);
function portCenter(id,direction){
  const node=byId(id),selector=direction==='out'?'.ports span:last-child .port':'.ports span:first-child .port';
  const p=node.querySelector(selector).getBoundingClientRect(),r=board.getBoundingClientRect();
  return {x:p.left+p.width/2-r.left,y:p.top+p.height/2-r.top};
}
function wire(){
  svg.setAttribute('viewBox',`0 0 ${board.clientWidth} ${board.clientHeight}`);
  svg.replaceChildren();
  for(const c of patch.connections){
    const a=portCenter(c.from,'out'),b=portCenter(c.to,'in');
    const path=document.createElementNS('http://www.w3.org/2000/svg','path');
    path.setAttribute('d',`M ${a.x} ${a.y} C ${(a.x+b.x)/2} ${a.y}, ${(a.x+b.x)/2} ${b.y}, ${b.x} ${b.y}`);
    svg.append(path);
  }
}
function notify(){window.dispatchEvent(new CustomEvent('umiak:patch',{detail:structuredClone(patch)}));}
function bindNode(node){
  const title=node.querySelector('.title');
  title.addEventListener('pointerdown',e=>{
    const r=node.getBoundingClientRect();
    active={node,id:e.pointerId,dx:e.clientX-r.left,dy:e.clientY-r.top};
    title.setPointerCapture(e.pointerId);
  });
  title.addEventListener('pointermove',e=>{
    if(!active||active.id!==e.pointerId)return;
    const r=board.getBoundingClientRect();
    const x=Math.max(0,Math.min(r.width-node.offsetWidth,e.clientX-r.left-active.dx));
    const y=Math.max(0,Math.min(r.height-node.offsetHeight,e.clientY-r.top-active.dy));
    node.style.left=x+'px';node.style.top=y+'px';
    const model=patch.nodes.find(n=>n.id===node.dataset.node);model.x=x;model.y=y;
    wire();
  });
  for(const type of ['pointerup','pointercancel'])title.addEventListener(type,()=>{active=null;notify();});
  node.querySelectorAll('.port').forEach((port,i)=>{
    const direction=['sequence','keyboard'].includes(node.dataset.node)?'out':i===0?'in':'out';
    port.style.cursor='pointer';
    port.addEventListener('click',()=>{
      if(direction==='out'){selected={from:node.dataset.node,out:node.dataset.node==='oscillator'?'audio':'pitch'};port.title='Output selected';return;}
      if(!selected)return;
      const c={...selected,to:node.dataset.node,in:'pitch'};
      if(validateConnection(patch,c)){
        patch.connections=patch.connections.filter(e=>!(e.to===c.to&&e.in===c.in));
        patch.connections.push(c);wire();notify();
      }
      selected=null;
    });
  });
}
for(const node of nodes)bindNode(node);
let noteValues=Array.from({length:16},(_,i)=>i%4===0?0:i%4===2?7:null);
function renderSequence(){
  const host=document.getElementById('node-seq-steps');if(!host)return;
  host.replaceChildren();
  noteValues.forEach((value,index)=>{
    const b=document.createElement('button');b.className='mini-step';b.textContent=value===null?'·':String(value);
    b.title='Step '+(index+1)+': click to cycle note / rest';
    b.onclick=()=>{
      const next=value===null?0:value===0?7:value===7?12:null;
      window.dispatchEvent(new CustomEvent('umiak:step-edit',{detail:{index,value:next}}));
    };host.append(b);
  });
}
window.addEventListener('umiak:notes',e=>{noteValues=e.detail;renderSequence();});
renderSequence();
function addKeyboard(id='keyboard',x=35,y=255){
 if(patch.nodes.some(n=>n.id===id))return;
 const model={id,type:'keyboard',x,y};patch.nodes.push(model);
 const node=document.createElement('div');node.className='node node-keyboard';node.dataset.node=id;
 node.style.left=x+'px';node.style.top=y+'px';
 node.innerHTML='<div class="title">Keyboard / MIDI notes</div><div class="ports"><span>C4 – C5</span><span>pitch <i class="port"></i></span></div><div class="mini-keys"></div>';
 const host=node.querySelector('.mini-keys');
 for(let i=0;i<13;i++){const b=document.createElement('button');b.textContent=['C','♯','D','♯','E','F','♯','G','♯','A','♯','B','C'][i];b.className=[1,3,6,8,10].includes(i)?'black-key':'';b.addEventListener('pointerdown',()=>window.dispatchEvent(new CustomEvent('umiak:key',{detail:i})));host.append(b);}
 board.append(node);nodes.push(node);bindNode(node);wire();notify();
}
document.getElementById('add-keyboard').onclick=()=>addKeyboard();
document.getElementById('add-sequence').onclick=()=>{document.querySelector('[data-node="sequence"]')?.scrollIntoView({block:'nearest'});};
function addProcessor(type='transpose',id=type+'-'+Date.now(),x=190,y=170,value=0){
  if(patch.nodes.some(n=>n.id===id))return;
  const key={transpose:'semitones',quantize:'interval',scale:'factor',invert:'center'}[type];
  if(!key)return;
  const model={id,type,[key]:value,x,y};patch.nodes.push(model);
  const node=document.createElement('div');node.className='node';node.dataset.node=id;
  node.style.left=x+'px';node.style.top=y+'px';
  node.innerHTML='<div class="title">'+({transpose:'Transpose',quantize:'Quantize',scale:'Scale',invert:'Invert'}[type])+'</div><div class="ports"><span><i class="port"></i> pitch</span><span>pitch <i class="port"></i></span></div><label style="display:block;padding:0 10px 10px">'+({transpose:'Semitones',quantize:'Interval',scale:'Factor',invert:'Center'}[type])+' <input type="number" step="0.1" style="width:70px"></label>';
  const input=node.querySelector('input');input.oninput=()=>{model[key]=Number(input.value)||0;notify();};
  input.value=value;
  board.append(node);nodes.push(node);bindNode(node);wire();notify();
}
for(const type of ['transpose','quantize','scale','invert'])document.getElementById('add-'+type).onclick=()=>addProcessor(type,undefined,190,170,type==='scale'||type==='quantize'?1:0);
document.getElementById('disconnect').onclick=()=>{patch.connections=[];wire();notify();};
document.getElementById('reconnect').onclick=()=>{patch.connections=defaultPatch().connections;wire();notify();};
window.addEventListener('umiak:restore',e=>{
  const p=e.detail;
  if(!p?.nodes||!Array.isArray(p.connections))return;
  for(const n of p.nodes)if(n.type==='keyboard'&&typeof n.id==='string'&&Number.isFinite(n.x)&&Number.isFinite(n.y))addKeyboard(n.id,n.x,n.y);
  for(const n of p.nodes)if(['transpose','quantize','scale','invert'].includes(n.type)&&typeof n.id==='string'&&Number.isFinite(n.x)&&Number.isFinite(n.y))addProcessor(n.type,n.id,n.x,n.y,Number(n[{transpose:'semitones',quantize:'interval',scale:'factor',invert:'center'}[n.type]])||0);
  for(const n of [...patch.nodes])if(!['step','osc'].includes(n.type)&&!p.nodes.some(x=>x.id===n.id)){
    byId(n.id)?.remove();nodes.splice(nodes.findIndex(x=>x.dataset.node===n.id),1);patch.nodes.splice(patch.nodes.indexOf(n),1);
  }
  patch.connections=[];
  for(const c of p.connections)if(validateConnection(patch,c))patch.connections.push(c);
  for(const n of p.nodes){const model=patch.nodes.find(x=>x.id===n.id),el=byId(n.id);if(model&&el&&Number.isFinite(n.x)&&Number.isFinite(n.y)){model.x=n.x;model.y=n.y;if(!['step','osc'].includes(model.type)){const key={transpose:'semitones',quantize:'interval',scale:'factor',invert:'center'}[model.type];model[key]=Number(n[key])||0;const input=el.querySelector('input');if(input)input.value=model[key];}el.style.left=n.x+'px';el.style.top=n.y+'px';}}
  wire();notify();
});
new ResizeObserver(wire).observe(board);wire();notify();
