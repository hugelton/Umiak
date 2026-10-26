export function sampleLUT(values, phase, mode = 'step') {
  if (!values.length) return 0;
  const p = ((phase % 1) + 1) % 1;
  const x = p * values.length;
  const i = Math.floor(x);
  if (mode === 'step') return values[i];
  const t = x - i;
  return values[i] * (1 - t) + values[(i + 1) % values.length] * t;
}
export class Playhead {
  constructor(speed = 1) { this.phase = 0; this.speed = speed; this.running = false; }
  start() { this.running = true; }
  stop() { this.running = false; }
  reset() { this.phase = 0; }
  advance(seconds, externalPhase = null) {
    if (externalPhase !== null) { this.phase = ((externalPhase % 1) + 1) % 1; return this.phase; }
    if (this.running) this.phase = ((this.phase + this.speed * seconds) % 1 + 1) % 1;
    return this.phase;
  }
}
