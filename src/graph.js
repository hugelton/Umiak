export const defaultPatch = () => ({
  nodes: [{id:'sequence',type:'step',x:20,y:30},{id:'oscillator',type:'osc',x:210,y:100}],
  connections:[{from:'sequence',out:'pitch',to:'oscillator',in:'pitch'}]
});
export function validateConnection(patch,connection){
  const types={step:{outputs:{pitch:'cv'}},transpose:{inputs:{pitch:'cv'},outputs:{pitch:'cv'}},osc:{inputs:{pitch:'cv'},outputs:{audio:'audio'}}};
  const a=patch.nodes.find(n=>n.id===connection.from),b=patch.nodes.find(n=>n.id===connection.to);
  if(!a||!b||a.id===b.id)return false;
  if(types[a.type]?.outputs?.[connection.out]!==types[b.type]?.inputs?.[connection.in])return false;
  const seen=new Set([connection.to]),queue=[connection.to];
  while(queue.length){const id=queue.shift();if(id===connection.from)return false;
    for(const e of patch.connections.filter(e=>e.from===id&&!(e.to===connection.to&&e.in===connection.in)))if(!seen.has(e.to)){seen.add(e.to);queue.push(e.to);}}
  return true;
}
export function isConnected(patch,from,to){
  return patch.connections.some(c=>c.from===from&&c.to===to);
}

export function evaluatePitch(patch,pitch){
  const target=patch.nodes.find(n=>n.type==='osc');
  if(!target)return null;
  const visited=new Set();
  function resolve(id){
    if(visited.has(id))return null;
    visited.add(id);
    const node=patch.nodes.find(n=>n.id===id);
    if(!node)return null;
    if(node.type==='step')return pitch;
    const edge=patch.connections.find(c=>c.to===id&&c.in==='pitch');
    if(!edge)return null;
    const input=resolve(edge.from);
    if(input===null)return null;
    return node.type==='transpose'?input+Math.max(-24,Math.min(24,Number(node.semitones)||0)):input;
  }
  return resolve(target.id);
}
