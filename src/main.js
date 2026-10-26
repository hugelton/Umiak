import { sampleLUT, Playhead } from './lut.js';
const $ = id => document.getElementById(id);
let ctx, timer, nextTime = 0, step = 0;
const notes = Array.from({length:16}, (_,i) => i % 4 === 0 ? 0 : i % 4 === 2 ? 7 : null);
const head = new Playhead();
function voice(midi, at, length = .2) {
  if (!ctx) return;
  const osc = ctx.createOscillator(), gain = ctx.createGain();
  osc.type = $('wave').value;
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
    const pitch = sampleLUT(notes.map(n => n ?? 0), step / notes.length, 'step');
    if (notes[step] !== null) voice(60 + pitch, nextTime, duration * .85);
    step = (step + 1) % notes.length;
    head.phase = step / notes.length;
    nextTime += duration;
  }
}
function draw() {
  const c = $('curve'), g = c.getContext('2d'), n = Number($('harmonic').value);
  g.clearRect(0,0,c.width,c.height);
  g.beginPath();
  for(let x=0;x<c.width;x++) {
    const phase=x/c.width, value=Math.sin(phase*2*Math.PI*n);
    const y=c.height/2-value*c.height*.42;
    if(x===0) g.moveTo(x,y); else g.lineTo(x,y);
  }
  g.stroke();
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
$('harmonic').oninput = draw;
const keys = $('keys');
for(let i=0;i<13;i++) {
  const b=document.createElement('button');
  b.textContent=['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B','C'][i];
  b.onclick=async()=>{if(!ctx) await $('audio').onclick();voice(60+i,ctx.currentTime,.4);};
  keys.append(b);
}
renderSteps();draw();
