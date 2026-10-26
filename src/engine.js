import { sampleLUT } from './lut.js';

export function createWaveTable(harmonic = 1, size = 1024) {
  const count = Math.max(1, Math.min(8, Math.round(harmonic)));
  return Float32Array.from({ length: size }, (_, i) =>
    Math.sin(2 * Math.PI * i * count / size));
}
export function periodicWave(context, table) {
  const n = table.length, real = new Float32Array(n / 2 + 1), imag = new Float32Array(n / 2 + 1);
  // Fourier analysis converts the editable LUT to a Web Audio oscillator waveform.
  for (let k = 1; k <= n / 2; k++) {
    let re = 0, im = 0;
    for (let i = 0; i < n; i++) {
      const angle = 2 * Math.PI * k * i / n;
      re += table[i] * Math.cos(angle);
      im -= table[i] * Math.sin(angle);
    }
    real[k] = 2 * re / n; imag[k] = 2 * im / n;
  }
  return context.createPeriodicWave(real, imag, { disableNormalization: false });
}
export function sequencerValue(notes, phase) {
  const index = Math.floor((((phase % 1) + 1) % 1) * notes.length);
  return { index, pitch: sampleLUT(notes.map(n => n ?? 0), phase), gate: notes[index] !== null };
}
