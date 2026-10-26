import { Playhead } from './lut.js';
import { createWaveTable, periodicWave, sequencerValue } from './engine.js';
const $ = id => document.getElementById(id);
let ctx, timer, nextTime = 0, step = 0, customWave;
const activeCustomOscillators = new Set();
const curvePoints = Array.from(createWaveTable(1, 64));
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
    input.addEventListener('change', () => { notes[i] = input.value === '' ? null : Math.max(-24, Math.min(36, Number(input.value))); });
    label.append(input, document.createTextNode(' '));
    $('steps').append(label);
  });
}
function tick() {
  if (!ctx || !head.running) return;
  const duration = 60 / Math.max(20, Number($('bpm').value) || 120) / 4;
  while (nextTime < ctx.currentTime + .12) {
    const event = sequencerValue(notes, step / notes.length);
    if (event.gate) voice(60 + event.pitch, nextTime, duration * .85);
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
  $('status').textContent = 'Audio enabled';
};
$('start').onclick = async () => {
  if (!ctx) await $('audio').onclick();
  head.start(); nextTime=ctx.currentTime+.03;
  if (!timer) timer=setInterval(tick,25);
};
$('stop').onclick = () => head.stop();
$('reset').onclick = () => {head.reset();step=0; if(ctx && head.running) nextTime=ctx.currentTime+.03;};
function rebuildWave() {
  const table = createWaveTable(Number($('harmonic').value), curvePoints.length);
  curvePoints.splice(0, curvePoints.length, ...table);
  syncWave();
}
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
  syncWave();
}
canvas.addEventListener('pointerdown', e => {
  canvas.setPointerCapture(e.pointerId);
  lastPoint = point(e);
  curvePoints[lastPoint.x] = lastPoint.y;
  syncWave();
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
  b.onclick=async()=>{if(!ctx) await $('audio').onclick();voice(60+i,ctx.currentTime,.4);};
  keys.append(b);
}
renderSteps();rebuildWave();
