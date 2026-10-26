export const defaultPatch = () => ({
  nodes: [{id:'sequence',type:'step',x:20,y:30},{id:'oscillator',type:'osc',x:210,y:100}],
  connections:[{from:'sequence',out:'pitch',to:'oscillator',in:'pitch'}]
});
export function validateConnection(patch,connection){
  const types={step:{outputs:{pitch:'cv'}},osc:{inputs:{pitch:'cv'},outputs:{audio:'audio'}}};
  const a=patch.nodes.find(n=>n.id===connection.from),b=patch.nodes.find(n=>n.id===connection.to);
  if(!a||!b||a.id===b.id)return false;
  return types[a.type]?.outputs?.[connection.out]===types[b.type]?.inputs?.[connection.in];
}
export function isConnected(patch,from,to){
  return patch.connections.some(c=>c.from===from&&c.to===to);
}
