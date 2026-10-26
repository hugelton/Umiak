class UmiakLUTProcessor extends AudioWorkletProcessor {
 static get parameterDescriptors(){return [
  {name:'frequency',defaultValue:440,minValue:1,maxValue:20000,automationRate:'a-rate'},
  {name:'morph',defaultValue:0,minValue:0,maxValue:3,automationRate:'a-rate'}
 ];}
 constructor(){
  super();this.phase=0;this.tables=Array.from({length:4},(_,k)=>Float32Array.from({length:64},(_,i)=>Math.sin(2*Math.PI*(k+1)*i/64)));
  this.lfo=null;
  this.port.onmessage=e=>{
   const d=e.data;
   if(d.type==='tables'&&Array.isArray(d.tables)&&d.tables.length===4&&d.tables.every(t=>t.length===64&&Array.from(t).every(Number.isFinite)))
    this.tables=d.tables.map(t=>Float32Array.from(t));
   if(d.type==='lfo')this.lfo=d.config||null;
  };
 }
 process(inputs,outputs,params){
  const channels=outputs[0];if(!channels?.length)return true;
  const size=this.tables[0].length, frequency=params.frequency,morph=params.morph;
  for(let i=0;i<channels[0].length;i++){
   const hz=frequency.length===1?frequency[0]:frequency[i];
   let position=morph.length===1?morph[0]:morph[i];
   if(this.lfo){
    const {rate=.5,depth=1.5,center=1.5,shape='sine'}=this.lfo;
    const angle=2*Math.PI*Math.max(.02,Math.min(20,rate))*(currentFrame+i)/sampleRate;
    const modulation=shape==='triangle'?2/Math.PI*Math.asin(Math.sin(angle)):Math.sin(angle);
    position=center+depth*modulation;
   }
   position=Math.max(0,Math.min(3,position));
   const a=Math.floor(position),b=Math.min(3,a+1),blend=position-a;
   const sampleIndex=this.phase*size,j=Math.floor(sampleIndex),k=(j+1)%size,t=sampleIndex-j;
   const va=this.tables[a][j]*(1-t)+this.tables[a][k]*t;
   const vb=this.tables[b][j]*(1-t)+this.tables[b][k]*t;
   const value=va+(vb-va)*blend;
   for(const channel of channels)channel[i]=value;
   this.phase=(this.phase+Math.max(0,hz)/sampleRate)%1;
  }
  return true;
 }
}
registerProcessor('umiak-lut',UmiakLUTProcessor);
