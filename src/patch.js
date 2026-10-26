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
for(const node of nodes){
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
    const direction=node.dataset.node==='sequence'?'out':i===0?'in':'out';
    port.style.cursor='pointer';
    port.addEventListener('click',()=>{
      if(direction==='out'){selected={from:node.dataset.node,out:node.dataset.node==='sequence'?'pitch':'audio'};port.title='Output selected';return;}
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
document.getElementById('disconnect').onclick=()=>{patch.connections=[];wire();notify();};
document.getElementById('reconnect').onclick=()=>{patch.connections=defaultPatch().connections;wire();notify();};
window.addEventListener('umiak:restore',e=>{
  const p=e.detail;
  if(!p?.nodes||!Array.isArray(p.connections))return;
  patch.connections=p.connections.filter(c=>validateConnection(patch,c));
  for(const n of p.nodes){const model=patch.nodes.find(x=>x.id===n.id),el=byId(n.id);if(model&&el&&Number.isFinite(n.x)&&Number.isFinite(n.y)){model.x=n.x;model.y=n.y;el.style.left=n.x+'px';el.style.top=n.y+'px';}}
  wire();notify();
});
new ResizeObserver(wire).observe(board);wire();notify();
