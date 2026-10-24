/**
 * Procedural Web Audio API sound effects and Amapiano / Afro-house background groove.
 * 100% synthesized in code for zero 404s, instant low latency, and offline play on Android.
 */

class SoundManager {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private bgmOscillators: OscillatorNode[] = [];
  private bgmGain: GainNode | null = null;
  private bgmInterval: number | null = null;
  private coinPitchIndex: number = 0;

  constructor() {
    // Initialized on first user interaction
  }

  private initCtx() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.bgmGain) {
      this.bgmGain.gain.setValueAtTime(this.isMuted ? 0 : 0.12, this.ctx?.currentTime || 0);
    }
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public playCoin() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const pitches = [523.25, 659.25, 783.99, 1046.5, 1318.51]; // C5, E5, G5, C6, E6
    const freq = pitches[this.coinPitchIndex % pitches.length];
    this.coinPitchIndex++;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.5, this.ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.18, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.12);
  }

  public playJump(isSneakers: boolean = false) {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = isSneakers ? 'square' : 'sine';
    const startFreq = isSneakers ? 180 : 140;
    const endFreq = isSneakers ? 580 : 380;

    osc.frequency.setValueAtTime(startFreq, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(endFreq, this.ctx.currentTime + (isSneakers ? 0.22 : 0.15));

    gain.gain.setValueAtTime(isSneakers ? 0.15 : 0.12, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + (isSneakers ? 0.24 : 0.16));

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + (isSneakers ? 0.25 : 0.17));
  }

  /** Unique procedural sound per weapon strike. */
  public playWeaponSwing(weaponId: string) {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;

    if (weaponId === 'small_hammer') {
      // Deep metallic THUNK: low square blip + fast pitch drop
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(220, t);
      osc.frequency.exponentialRampToValueAtTime(70, t + 0.14);
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      osc.connect(gain); gain.connect(this.ctx.destination);
      osc.start(t); osc.stop(t + 0.18);
    } else if (weaponId === 'baseball_bat') {
      // Wooden CRACK: short noise burst through a bandpass
      const bufferSize = this.ctx.sampleRate * 0.12;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 3);
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 1.2;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.5, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      src.connect(bp); bp.connect(gain); gain.connect(this.ctx.destination);
      src.start(t);
    } else if (weaponId === 'crowbar') {
      // Scraping CLANG: metallic detuned dual osc
      const oscA = this.ctx.createOscillator();
      const oscB = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      oscA.type = 'sawtooth'; oscB.type = 'sawtooth';
      oscA.frequency.setValueAtTime(640, t);
      oscB.frequency.setValueAtTime(647, t);
      oscA.frequency.exponentialRampToValueAtTime(180, t + 0.2);
      oscB.frequency.exponentialRampToValueAtTime(184, t + 0.2);
      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      oscA.connect(gain); oscB.connect(gain); gain.connect(this.ctx.destination);
      oscA.start(t); oscB.start(t); oscA.stop(t + 0.24); oscB.stop(t + 0.24);
    } else if (weaponId === 'chainsaw') {
      // Revving roar: sawtooth + noise chug rev
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(60, t);
      osc.frequency.linearRampToValueAtTime(160, t + 0.08);
      osc.frequency.linearRampToValueAtTime(110, t + 0.3);
      gain.gain.setValueAtTime(0.22, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 1200;
      osc.connect(lp); lp.connect(gain); gain.connect(this.ctx.destination);
      osc.start(t); osc.stop(t + 0.38);
    }
  }

  public playSlide() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(70, this.ctx.currentTime + 0.18);

    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.2);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.2);
  }

  public playLaneSwitch() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, this.ctx.currentTime + 0.06);

    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.07);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.08);
  }

  public playPowerup() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const notes = [440, 554.37, 659.25, 880]; // A major arpeggio
    notes.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.06);

      gain.gain.setValueAtTime(0.15, now + idx * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.15);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.16);
    });
  }

  public playHoverboard() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, this.ctx.currentTime + 0.2);

    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.3);
  }

  public playCrash() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    // Noise burst + low boom
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(25, this.ctx.currentTime + 0.35);

    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.4);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.4);

    // Inspector whistle sound after crash
    setTimeout(() => {
      this.playWhistle();
    }, 180);
  }

  public playStumble() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(260, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(130, this.ctx.currentTime + 0.12);

    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.14);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.15);
  }

  public playWhistle() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    // Vibrato / whistle trill
    const now = this.ctx.currentTime;
    osc.frequency.setValueAtTime(1800, now);
    osc.frequency.setValueAtTime(2000, now + 0.05);
    osc.frequency.setValueAtTime(1800, now + 0.1);
    osc.frequency.setValueAtTime(2000, now + 0.15);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.3);
  }

  /**
   * Procedural Amapiano / Afro-house background groove.
   * Plays rhythmic syncopated chords and signature log drum bass kicks.
   */
  public startBGM() {
    if (this.bgmInterval) return;
    this.initCtx();
    if (!this.ctx) return;

    let step = 0;
    // Chords: Am7 -> Fmaj7 -> Cmaj7 -> G
    const chordProgressions = [
      [440, 523.25, 659.25], // Am
      [349.23, 440, 523.25], // F
      [261.63, 329.63, 392.0], // C
      [392.0, 493.88, 587.33]  // G
    ];

    const playBeat = () => {
      if (this.isMuted || !this.ctx) return;

      const chordIdx = Math.floor(step / 8) % chordProgressions.length;
      const chord = chordProgressions[chordIdx];
      const subStep = step % 8;

      // Log drum (deep punchy sub bass on beats 0, 3, 6)
      if (subStep === 0 || subStep === 3 || subStep === 6) {
        const bassOsc = this.ctx.createOscillator();
        const bassGain = this.ctx.createGain();
        bassOsc.type = 'sine';
        bassOsc.frequency.setValueAtTime(110, this.ctx.currentTime);
        bassOsc.frequency.exponentialRampToValueAtTime(45, this.ctx.currentTime + 0.12);

        bassGain.gain.setValueAtTime(0.14, this.ctx.currentTime);
        bassGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.16);

        bassOsc.connect(bassGain);
        bassGain.connect(this.ctx.destination);
        bassOsc.start();
        bassOsc.stop(this.ctx.currentTime + 0.16);
      }

      // Shaker on even beats
      if (subStep % 2 === 1) {
        const shakerOsc = this.ctx.createOscillator();
        const shakerGain = this.ctx.createGain();
        shakerOsc.type = 'triangle';
        shakerOsc.frequency.setValueAtTime(3500 + Math.random() * 500, this.ctx.currentTime);
        shakerGain.gain.setValueAtTime(0.015, this.ctx.currentTime);
        shakerGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.04);

        shakerOsc.connect(shakerGain);
        shakerGain.connect(this.ctx.destination);
        shakerOsc.start();
        shakerOsc.stop(this.ctx.currentTime + 0.04);
      }

      // Melodic Rhodes synth stab on beats 2 and 5
      if (subStep === 2 || subStep === 5) {
        chord.forEach((freq) => {
          const synth = this.ctx!.createOscillator();
          const gain = this.ctx!.createGain();
          synth.type = 'triangle';
          synth.frequency.setValueAtTime(freq, this.ctx!.currentTime);

          gain.gain.setValueAtTime(0.04, this.ctx!.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, this.ctx!.currentTime + 0.18);

          synth.connect(gain);
          gain.connect(this.ctx!.destination);
          synth.start();
          synth.stop(this.ctx!.currentTime + 0.18);
        });
      }

      step++;
    };

    // 120 BPM = 125ms per 16th step
    this.bgmInterval = window.setInterval(playBeat, 125);
  }

  public stopBGM() {
    if (this.bgmInterval) {
      clearInterval(this.bgmInterval);
      this.bgmInterval = null;
    }
  }
}

export const sound = new SoundManager();
