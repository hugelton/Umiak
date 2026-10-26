const board=document.getElementById('nodeboard'),svg=document.getElementById('wires');
const nodes=[...board.querySelectorAll('.node')];
let active=null;
function wire(){
  const a=nodes[0].querySelector('.ports span:last-child .port').getBoundingClientRect();
  const b=nodes[1].querySelector('.ports span:first-child .port').getBoundingClientRect();
  const r=board.getBoundingClientRect();
  const x1=a.left+a.width/2-r.left,y1=a.top+a.height/2-r.top;
  const x2=b.left+b.width/2-r.left,y2=b.top+b.height/2-r.top;
  svg.setAttribute('viewBox',`0 0 ${board.clientWidth} ${board.clientHeight}`);
  svg.innerHTML=`<path d="M ${x1} ${y1} C ${(x1+x2)/2} ${y1}, ${(x1+x2)/2} ${y2}, ${x2} ${y2}"/>`;
}
for(const node of nodes){
  node.querySelector('.title').addEventListener('pointerdown',e=>{
    const r=node.getBoundingClientRect();
    active={node,id:e.pointerId,dx:e.clientX-r.left,dy:e.clientY-r.top};
    e.currentTarget.setPointerCapture(e.pointerId);
  });
  node.querySelector('.title').addEventListener('pointermove',e=>{
    if(!active||active.id!==e.pointerId)return;
    const r=board.getBoundingClientRect();
    active.node.style.left=Math.max(0,Math.min(r.width-active.node.offsetWidth,e.clientX-r.left-active.dx))+'px';
    active.node.style.top=Math.max(0,Math.min(r.height-active.node.offsetHeight,e.clientY-r.top-active.dy))+'px';
    wire();
  });
  for(const type of ['pointerup','pointercancel'])node.querySelector('.title').addEventListener(type,()=>active=null);
}
new ResizeObserver(wire).observe(board);
wire();
