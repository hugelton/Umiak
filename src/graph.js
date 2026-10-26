export const defaultPatch = () => ({
  nodes: [{id:'sequence',type:'step',x:20,y:30},{id:'oscillator',type:'osc',x:420,y:100}],
  connections:[{from:'sequence',out:'pitch',to:'oscillator',in:'pitch'}]
});
export function validateConnection(patch,connection){
  const types={step:{outputs:{pitch:'cv'}},keyboard:{outputs:{pitch:'cv'}},lfo:{outputs:{mod:'mod'}},merge:{inputs:{a:'cv',b:'cv'},outputs:{pitch:'cv'}},transpose:{inputs:{pitch:'cv'},outputs:{pitch:'cv'}},quantize:{inputs:{pitch:'cv'},outputs:{pitch:'cv'}},scale:{inputs:{pitch:'cv'},outputs:{pitch:'cv'}},invert:{inputs:{pitch:'cv'},outputs:{pitch:'cv'}},osc:{inputs:{pitch:'cv',morph:'mod'},outputs:{audio:'audio'}}};
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

export function evaluatePitch(patch,pitch,source='step'){
  const target=patch.nodes.find(n=>n.type==='osc');
  if(!target)return null;
  function resolve(id,visited=new Set()){
    if(visited.has(id))return null;
    visited.add(id);
    const node=patch.nodes.find(n=>n.id===id);
    if(!node)return null;
    if(node.type==='step'||node.type==='keyboard')return node.type===source?pitch:null;
    if(node.type==='merge'){
      const inputs=['a','b'].map(port=>patch.connections.find(c=>c.to===id&&c.in===port)).filter(Boolean);
      for(const edge of inputs){const result=resolve(edge.from,new Set(visited));if(result!==null)return result;}
      return null;
    }
    const edge=patch.connections.find(c=>c.to===id&&c.in==='pitch');
    if(!edge)return null;
    const input=resolve(edge.from);
    if(input===null)return null;
    if(node.type==='transpose')return input+Math.max(-24,Math.min(24,Number(node.semitones)||0));
    if(node.type==='scale')return input*Math.max(-4,Math.min(4,Number(node.factor ?? 1)));
    if(node.type==='invert')return 2*(Number(node.center)||0)-input;
    if(node.type==='quantize'){const amount=Math.max(1,Math.min(12,Number(node.interval)||1));return Math.round(input/amount)*amount;}
    return input;
  }
  return resolve(target.id);
}

export function evaluateMorph(patch,time,manual=0){
 const osc=patch?.nodes.find(n=>n.type==='osc');
 const edge=osc&&patch.connections.find(c=>c.to===osc.id&&c.in==='morph');
 const lfo=edge&&patch.nodes.find(n=>n.id===edge.from&&n.type==='lfo');
 if(!lfo)return manual;
 const rate=Math.max(.02,Math.min(20,Number(lfo.rate)||.5));
 const depth=Math.max(0,Math.min(3,Number(lfo.depth)??1.5));
 const center=Math.max(0,Math.min(3,Number(lfo.center)??1.5));
 const phase=2*Math.PI*rate*time;
 const wave=lfo.shape==='triangle'?2/Math.PI*Math.asin(Math.sin(phase)):Math.sin(phase);
 return Math.max(0,Math.min(3,center+wave*depth));
}
