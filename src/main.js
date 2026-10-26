import { Playhead } from './lut.js';
import { evaluatePitch, evaluateMorph } from './graph.js';
import { createWaveTable, periodicWave, sequencerValue, morphWaveTables } from './engine.js';
const $ = id => document.getElementById(id);
let ctx, timer, nextTime = 0, step = 0, customWave;
let patchSnapshot = null;
const activeCustomOscillators = new Set();
const waveSlots = [1,2,3,4].map(h => Array.from(createWaveTable(h,64)));
const curvePoints = Array.from(waveSlots[0]);
let editingSlot = 0;
let lastMorphPosition=-1;
function animateMorph(){
 const position=evaluateMorph(patchSnapshot,ctx?.currentTime??0,Number($('morph').value));
 if(Math.abs(position-lastMorphPosition)>.015){lastMorphPosition=position;refreshMorph(position);}
}
setInterval(animateMorph,50);
const notes = Array.from({length:16}, (_,i) => i % 4 === 0 ? 0 : i % 4 === 2 ? 7 : null);
const head = new Playhead();
function voice(midi, at, length = .2) {
  if (!ctx) return;
  const osc = ctx.createOscillator(), gain = ctx.createGain();
  if ($('wave').value === 'custom') {
    osc.setPeriodicWave(customWave ?? periodicWave(ctx, createWaveTable(1)));
    activeCustomOscillators.add(osc);
    osc.addEventListener('ended', () => activeCustomOscillators.delete(osc), { once: true });
  }
  else osc.type = $('wave').value;
  osc.frequency.setValueAtTime(440 * 2 ** ((midi - 69) / 12), at);
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(.16, at + .008);
  gain.gain.exponentialRampToValueAtTime(.001, at + length);
  osc.connect(gain).connect(ctx.destination);
  osc.start(at); osc.stop(at + length + .01);
}
function renderSteps() {
  $('steps').replaceChildren();
  notes.forEach((value, i) => {
    const label = document.createElement('label');
    label.textContent = String(i+1).padStart(2,'0') + ' ';
    const input = document.createElement('input');
    input.type = 'number'; input.min = '-24'; input.max = '36'; input.placeholder = 'rest';
    input.value = value ?? '';
    input.style.width = '4em';
    input.addEventListener('change', () => { notes[i] = input.value === '' ? null : Math.max(-24, Math.min(36, Number(input.value)));window.dispatchEvent(new CustomEvent('umiak:notes',{detail:[...notes]})); });
    label.append(input, document.createTextNode(' '));
    $('steps').append(label);
  });
  window.dispatchEvent(new CustomEvent('umiak:notes',{detail:[...notes]}));
}
function tick() {
  if (!ctx || !head.running) return;
  const duration = 60 / Math.max(20, Number($('bpm').value) || 120) / 4;
  while (nextTime < ctx.currentTime + .12) {
    const event = sequencerValue(notes, step / notes.length);
    window.dispatchEvent(new CustomEvent('umiak:playhead',{detail:step}));
    const pitch=patchSnapshot?evaluatePitch(patchSnapshot,event.pitch,'step'):null;
    if (event.gate && pitch!==null) voice(60 + pitch, nextTime, duration * .85);
    step = (step + 1) % notes.length;
    head.phase = step / notes.length;
    nextTime += duration;
  }
}
function draw() {
  const c = $('curve'), g = c.getContext('2d');
  g.clearRect(0, 0, c.width, c.height);
  g.beginPath();
  for (let x = 0; x <= c.width; x++) {
    const phase = x / c.width * curvePoints.length;
    const i = Math.min(curvePoints.length - 1, Math.floor(phase));
    const fraction = phase - i;
    const value = curvePoints[i] * (1 - fraction) +
      curvePoints[(i + 1) % curvePoints.length] * fraction;
    const y = c.height * (1 - value) / 2;
    if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.stroke();
}
function syncWave() {
  if (ctx) {
    customWave = periodicWave(ctx, Float32Array.from(curvePoints));
    for (const osc of activeCustomOscillators) osc.setPeriodicWave(customWave);
  }
  draw();
}
$('audio').onclick = async () => {
  ctx ??= new AudioContext();
  await ctx.resume();
  syncWave();
  $('status').textContent = 'Audio enabled';
};
$('start').onclick = async () => {
  if (!ctx) await $('audio').onclick();
  head.start(); nextTime=ctx.currentTime+.03;
  if (!timer) timer=setInterval(tick,25);
};
$('stop').onclick = () => {head.stop();window.dispatchEvent(new CustomEvent('umiak:playhead',{detail:-1}));};
$('reset').onclick = () => {head.reset();step=0;window.dispatchEvent(new CustomEvent('umiak:playhead',{detail:0})); if(ctx && head.running) nextTime=ctx.currentTime+.03;};
function rebuildWave() {
  const table = createWaveTable(Number($('harmonic').value), curvePoints.length);
  waveSlots[editingSlot] = Array.from(table);
  refreshMorph();
}
function refreshMorph(position=Number($('morph').value)) {
  const table = morphWaveTables(waveSlots, position);
  curvePoints.splice(0, curvePoints.length, ...table);
  $('morph-value').textContent = position.toFixed(2);
  syncWave();
}
function editSlot(index) {
  editingSlot=index;
  $('slot-label').textContent=String(index+1);
  document.querySelectorAll('[data-slot]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.slot)===index)));
  $('morph').value=String(index);
  refreshMorph();
}
document.querySelectorAll('[data-slot]').forEach(b=>b.onclick=()=>editSlot(Number(b.dataset.slot)));
$('morph').oninput=refreshMorph;
$('harmonic').oninput = rebuildWave;
const canvas = $('curve');
canvas.style.touchAction = 'none';
let lastPoint = null;
function point(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(curvePoints.length - 1, Math.floor((e.clientX - r.left) / r.width * curvePoints.length))),
    y: Math.max(-1, Math.min(1, 1 - 2 * (e.clientY - r.top) / r.height))
  };
}
function paint(e) {
  if (!lastPoint) return;
  const current = point(e);
  const start = lastPoint;
  const distance = Math.abs(current.x - start.x);
  for (let n = 0; n <= distance; n++) {
    const t = distance ? n / distance : 1;
    const i = Math.round(start.x + (current.x - start.x) * t);
    curvePoints[i] = start.y + (current.y - start.y) * t;
  }
  lastPoint = current;
  waveSlots[editingSlot]=[...curvePoints];
  refreshMorph();
}
canvas.addEventListener('pointerdown', e => {
  canvas.setPointerCapture(e.pointerId);
  $('morph').value=String(editingSlot);
  refreshMorph();
  lastPoint = point(e);
  curvePoints[lastPoint.x] = lastPoint.y;
  waveSlots[editingSlot]=[...curvePoints];
  refreshMorph();
});
canvas.addEventListener('pointermove', e => {
  if (canvas.hasPointerCapture(e.pointerId)) paint(e);
});
function endPaint() { lastPoint = null; }
canvas.addEventListener('pointerup', endPaint);
canvas.addEventListener('pointercancel', endPaint);
const keys = $('keys');
for(let i=0;i<13;i++) {
  const b=document.createElement('button');
  b.textContent=['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B','C'][i];
  b.onclick=()=>window.dispatchEvent(new CustomEvent('umiak:key',{detail:i}));
  keys.append(b);
}
window.addEventListener('umiak:key',async e=>{
  if(!ctx)await $('audio').onclick();
  const pitch=patchSnapshot?evaluatePitch(patchSnapshot,Number(e.detail),'keyboard'):null;
  if(pitch!==null)voice(60+pitch,ctx.currentTime,.4);
});
window.addEventListener('umiak:step-edit',e=>{
  const {index,value}=e.detail;
  if(index>=0&&index<notes.length){notes[index]=value;renderSteps();}
});
window.addEventListener('umiak:patch', e => {
  patchSnapshot=e.detail;
  lastMorphPosition=-1;
});
$('save').onclick=()=>{
  const project={version:1,bpm:Number($('bpm').value),wave:$('wave').value,
    notes:[...notes],curve:[...curvePoints],waveSlots:waveSlots.map(t=>[...t]),morph:Number($('morph').value),patch:patchSnapshot};
  const url=URL.createObjectURL(new Blob([JSON.stringify(project,null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='umiak-project.json';a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
};
$('load').addEventListener('change',async e=>{
  const file=e.target.files?.[0];if(!file)return;
  try{
    const p=JSON.parse(await file.text());
    if(p.version!==1||!Array.isArray(p.notes)||p.notes.length!==16||
      !Array.isArray(p.curve)||p.curve.length!==curvePoints.length||
      !p.notes.every(n=>n===null||(Number.isFinite(n)&&n>=-24&&n<=36))||
      !p.curve.every(n=>Number.isFinite(n)&&n>=-1&&n<=1))throw Error('Invalid project');
    notes.splice(0,notes.length,...p.notes);
    if(p.waveSlots!==undefined){
      if(!Array.isArray(p.waveSlots)||p.waveSlots.length!==4||!p.waveSlots.every(t=>Array.isArray(t)&&t.length===64&&t.every(v=>Number.isFinite(v)&&v>=-1&&v<=1)))throw Error('Invalid wave slots');
      p.waveSlots.forEach((t,i)=>waveSlots[i]=[...t]);
    }else waveSlots[0]=[...p.curve];
    $('morph').value=String(Math.max(0,Math.min(3,Number(p.morph)||0)));
    editingSlot=Math.floor(Number($('morph').value));
    $('slot-label').textContent=String(editingSlot+1);
    $('bpm').value=Math.max(20,Math.min(300,Number(p.bpm)||120));
    if(['sine','triangle','sawtooth','square','custom'].includes(p.wave))$('wave').value=p.wave;
    renderSteps();refreshMorph();
    if(p.patch)window.dispatchEvent(new CustomEvent('umiak:restore',{detail:p.patch}));
    $('status').textContent='Project loaded';
  }catch(error){$('status').textContent='Could not load project: '+error.message;}
  e.target.value='';
});
renderSteps();editSlot(0);
