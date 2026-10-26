# Umiak

A browser-based LUT instrument prototype. No visual design system is imposed.

## Run
Open `index.html` in a modern browser. Click **Enable audio** to unlock playback.

## Model
A LUT is a periodic table with `step` or `curve` interpolation. Phase is normalized to [0,1). Speed is cycles per second. A player supports start, stop, reset and external phase. The same evaluator drives oscillator and sequencer.

This is a functional prototype, not a finished audio engine. Audio uses Web Audio oscillators; timing is scheduled ahead on the audio clock. For native portability, move the pure LUT logic into a shared DSP module before adding effects.
