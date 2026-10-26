import { defaultPatch, validateConnection } from './graph.js';
const board=document.getElementById('nodeboard'),svg=document.getElementById('wires');
const patch=defaultPatch();
const nodes=[...board.querySelectorAll('.node')];
let active=null,selected=null,dragWire=null;
const svgNS='http://www.w3.org/2000/svg';
const byId=id=>nodes.find(n=>n.dataset.node===id);
function portCenter(id,direction,portName){
  const node=byId(id),selector=direction==='out'?'.ports span:last-child .port':'.ports span:first-child .port';
  const target=node.querySelector('.port[data-port="'+portName+'"][data-direction="'+direction+'"]')||node.querySelector(selector);
  const p=target.getBoundingClientRect(),r=board.getBoundingClientRect();
  return {x:p.left+p.width/2-r.left,y:p.top+p.height/2-r.top};
}
function wire(){
  svg.setAttribute('viewBox',`0 0 ${board.clientWidth} ${board.clientHeight}`);
  svg.replaceChildren();
  for(const c of patch.connections){
    if(!byId(c.from)||!byId(c.to))continue;
    const a=portCenter(c.from,'out',c.out),b=portCenter(c.to,'in',c.in);
    const path=document.createElementNS('http://www.w3.org/2000/svg','path');
    path.setAttribute('d',`M ${a.x} ${a.y} C ${(a.x+b.x)/2} ${a.y}, ${(a.x+b.x)/2} ${b.y}, ${b.x} ${b.y}`);
    svg.append(path);
  }
}
function connectPorts(from,out,to,input){
 const c={from,out,to,in:input};
 if(!validateConnection(patch,c))return false;
 patch.connections=patch.connections.filter(e=>!(e.to===to&&e.in===input));
 patch.connections.push(c);wire();notify();return true;
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
    const x=Math.max(0,Math.min(Math.max(0,r.width-node.offsetWidth),e.clientX-r.left-active.dx));
    const y=Math.max(0,Math.min(Math.max(0,r.height-node.offsetHeight),e.clientY-r.top-active.dy));
    node.style.left=x+'px';node.style.top=y+'px';
    const model=patch.nodes.find(n=>n.id===node.dataset.node);model.x=x;model.y=y;
    wire();
  });
  for(const type of ['pointerup','pointercancel'])title.addEventListener(type,()=>{active=null;notify();});
  node.querySelectorAll('.port').forEach((port,i)=>{
    const direction=port.dataset.direction||(['sequence','keyboard'].includes(node.dataset.node)?'out':i===0?'in':'out');
    const name=port.dataset.port||(direction==='out'&&node.dataset.node==='oscillator'?'audio':'pitch');
    port.dataset.direction=direction;port.dataset.port=name;
    port.title=direction==='out'?'Drag to an input or click to select output':'Connect an output here';
    port.addEventListener('pointerdown',e=>{
      e.stopPropagation();
      if(direction!=='out')return;
      e.preventDefault();port.setPointerCapture(e.pointerId);
      dragWire={from:node.dataset.node,out:name,origin:port};
      selected={from:node.dataset.node,out:name};
      port.classList.add('port-selected');
      wire();
    });
    port.addEventListener('pointermove',e=>{
      if(!dragWire||dragWire.origin!==port)return;
      const r=board.getBoundingClientRect();
      const start=portCenter(dragWire.from,'out',dragWire.out);
      const x=e.clientX-r.left,y=e.clientY-r.top;
      const path=document.createElementNS(svgNS,'path');
      path.classList.add('wire-preview');
      path.setAttribute('d',`M ${start.x} ${start.y} C ${(start.x+x)/2} ${start.y}, ${(start.x+x)/2} ${y}, ${x} ${y}`);
      svg.querySelector('.wire-preview')?.remove();svg.append(path);
    });
    port.addEventListener('pointerup',e=>{
      if(!dragWire||dragWire.origin!==port)return;
      const hit=document.elementFromPoint(e.clientX,e.clientY)?.closest('.port');
      if(hit&&hit.dataset.direction==='in'){
        const target=hit.closest('.node');
        if(connectPorts(dragWire.from,dragWire.out,target.dataset.node,hit.dataset.port))selected=null;
      }
      port.classList.remove('port-selected');dragWire=null;wire();
    });
    port.addEventListener('pointercancel',()=>{
      port.classList.remove('port-selected');dragWire=null;wire();
    });
    port.addEventListener('click',()=>{
      if(direction==='out'){selected={from:node.dataset.node,out:name};return;}
      if(selected){connectPorts(selected.from,selected.out,node.dataset.node,name);selected=null;}
    });
  });
}
const oscillatorNode=byId('oscillator');
if(oscillatorNode){const jack=document.createElement('div');jack.className='osc-mod-port';jack.innerHTML='<span><i class="port" data-direction="in" data-port="morph"></i> MORPH CV</span>';oscillatorNode.append(jack);}
for(const node of nodes)bindNode(node);
let playingStep=-1;
window.addEventListener('umiak:playhead',e=>{playingStep=e.detail;document.querySelectorAll('#node-seq-steps .mini-step').forEach((b,i)=>b.classList.toggle('is-playing',i===playingStep));});
let noteValues=Array.from({length:16},(_,i)=>i%4===0?0:i%4===2?7:null);
function renderSequence(){
  const host=document.getElementById('node-seq-steps');if(!host)return;
  host.replaceChildren();
  noteValues.forEach((value,index)=>{
    const b=document.createElement('button');b.className='mini-step'+(index===playingStep?' is-playing':'');b.textContent=value===null?'·':String(value);
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
function addLFO(id='lfo-'+Date.now(),x=285,y=270,params={}){
 if(patch.nodes.some(n=>n.id===id))return;
 const model={id,type:'lfo',x,y,rate:params.rate??.5,depth:params.depth??1.5,center:params.center??1.5,shape:params.shape||'sine'};
 patch.nodes.push(model);
 const node=document.createElement('div');node.className='node node-lfo';node.dataset.node=id;
 node.style.left=x+'px';node.style.top=y+'px';
 node.innerHTML='<div class="title">LFO / Morph</div><div class="ports"><span>0.02–20 Hz</span><span>mod <i class="port" data-direction="out" data-port="mod"></i></span></div><div class="lfo-controls"><label>Rate <input data-param="rate" type="number" min="0.02" max="20" step="0.1"></label><label>Depth <input data-param="depth" type="number" min="0" max="3" step="0.1"></label><label>Center <input data-param="center" type="number" min="0" max="3" step="0.1"></label><select data-param="shape"><option value="sine">Sine</option><option value="triangle">Triangle</option></select></div>';
 node.querySelectorAll('[data-param]').forEach(input=>{input.value=model[input.dataset.param];input.oninput=()=>{model[input.dataset.param]=input.dataset.param==='shape'?input.value:Number(input.value);notify();};});
 board.append(node);nodes.push(node);bindNode(node);wire();notify();
}
const lfoButton=document.createElement('button');lfoButton.textContent='+ LFO';lfoButton.id='add-lfo';document.querySelector('.module-tools').prepend(lfoButton);lfoButton.onclick=()=>addLFO();
function addMerge(id='merge-'+Date.now(),x=245,y=240){
 if(patch.nodes.some(n=>n.id===id))return;
 patch.nodes.push({id,type:'merge',x,y});
 const node=document.createElement('div');node.className='node';node.dataset.node=id;
 node.style.left=x+'px';node.style.top=y+'px';
 node.innerHTML='<div class="title">Merge / Note sources</div><div class="ports merge-ports"><span><i class="port" data-port="a" data-direction="in"></i> A</span><span><i class="port" data-port="b" data-direction="in"></i> B</span><span>pitch <i class="port" data-port="pitch" data-direction="out"></i></span></div>';
 board.append(node);nodes.push(node);bindNode(node);wire();notify();
}
document.getElementById('add-merge').onclick=()=>addMerge();
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
  for(const n of p.nodes)if(n.type==='lfo'&&typeof n.id==='string'&&Number.isFinite(n.x)&&Number.isFinite(n.y))addLFO(n.id,n.x,n.y,n);
  for(const n of p.nodes)if(n.type==='merge'&&typeof n.id==='string'&&Number.isFinite(n.x)&&Number.isFinite(n.y))addMerge(n.id,n.x,n.y);
  for(const n of p.nodes)if(n.type==='keyboard'&&typeof n.id==='string'&&Number.isFinite(n.x)&&Number.isFinite(n.y))addKeyboard(n.id,n.x,n.y);
  for(const n of p.nodes)if(['transpose','quantize','scale','invert'].includes(n.type)&&typeof n.id==='string'&&Number.isFinite(n.x)&&Number.isFinite(n.y))addProcessor(n.type,n.id,n.x,n.y,Number(n[{transpose:'semitones',quantize:'interval',scale:'factor',invert:'center'}[n.type]])||0);
  for(const n of [...patch.nodes])if(!['step','osc'].includes(n.type)&&!p.nodes.some(x=>x.id===n.id)){
    byId(n.id)?.remove();nodes.splice(nodes.findIndex(x=>x.dataset.node===n.id),1);patch.nodes.splice(patch.nodes.indexOf(n),1);
  }
  patch.connections=[];
  for(const c of p.connections)if(validateConnection(patch,c))patch.connections.push(c);
  for(const n of p.nodes){const model=patch.nodes.find(x=>x.id===n.id),el=byId(n.id);if(model&&el&&Number.isFinite(n.x)&&Number.isFinite(n.y)){model.x=n.x;model.y=n.y;const key={transpose:'semitones',quantize:'interval',scale:'factor',invert:'center'}[model.type];if(model.type==='lfo'){for(const param of ['rate','depth','center','shape']){if(n[param]!==undefined){model[param]=n[param];const input=el.querySelector('[data-param="'+param+'"]');if(input)input.value=model[param];}}}if(key){model[key]=Number(n[key])||0;const input=el.querySelector('input');if(input)input.value=model[key];}el.style.left=n.x+'px';el.style.top=n.y+'px';}}
  wire();notify();
});
new ResizeObserver(wire).observe(board);wire();notify();
