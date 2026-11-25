import { AudioControlsState, PowerTap } from '../types/paSystem';

/**
 * Procedural Web Audio API Engine for PA-Sim 3D
 * - 4-note Paging Chime via harmonic oscillators
 * - Modulated formant vocal synthesis for Paging speech simulation
 * - Ambient BGM chord synthesizer
 * - Automatic Priority Override ducking (-18 dB) when Paging is active
 * - Real-time Gain, Bass, Treble, Volume & Power Tap (3W/6W/10W)
 * - AnalyserNode for accurate 3D cone excursion & dB SPL telemetry
 */
export class PAAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private micPreGain: GainNode | null = null;
  private bgmBusGain: GainNode | null = null;
  private bgmDuckGain: GainNode | null = null;
  private bassFilter: BiquadFilterNode | null = null;
  private trebleFilter: BiquadFilterNode | null = null;
  private analyser: AnalyserNode | null = null;
  private micAnalyser: AnalyserNode | null = null;
  private timeData: Uint8Array<ArrayBuffer> = new Uint8Array(new ArrayBuffer(256));
  private micTimeData: Uint8Array<ArrayBuffer> = new Uint8Array(new ArrayBuffer(256));

  private bgmInterval: number | null = null;
  private vocalInterval: number | null = null;
  private chimeTimeout: number | null = null;
  private bgmStep = 0;

  private vocalActiveNodes: { stop: () => void } | null = null;
  private isPagingActive = false;
  private isBgmActive = false;
  private lastControls: AudioControlsState | null = null;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();

      this.micPreGain = this.ctx.createGain();
      this.micPreGain.gain.value = 0.7;

      this.bgmBusGain = this.ctx.createGain();
      this.bgmBusGain.gain.value = 0.35;

      this.bgmDuckGain = this.ctx.createGain();
      this.bgmDuckGain.gain.value = 1.0;

      this.bassFilter = this.ctx.createBiquadFilter();
      this.bassFilter.type = 'lowshelf';
      this.bassFilter.frequency.value = 180;
      this.bassFilter.gain.value = 0;

      this.trebleFilter = this.ctx.createBiquadFilter();
      this.trebleFilter.type = 'highshelf';
      this.trebleFilter.frequency.value = 3500;
      this.trebleFilter.gain.value = 0;

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.6;

      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.75;

      this.micAnalyser = this.ctx.createAnalyser();
      this.micAnalyser.fftSize = 256;
      this.micAnalyser.smoothingTimeConstant = 0.7;

      // Routing:
      // Mic -> micAnalyser & micPreGain -> bassFilter -> trebleFilter -> masterGain -> analyser -> destination
      this.micPreGain.connect(this.micAnalyser);
      this.micPreGain.connect(this.bassFilter);

      // BGM -> bgmBusGain -> bgmDuckGain -> bassFilter
      this.bgmBusGain.connect(this.bgmDuckGain);
      this.bgmDuckGain.connect(this.bassFilter);

      this.bassFilter.connect(this.trebleFilter);
      this.trebleFilter.connect(this.masterGain);
      this.masterGain.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public updateControls(controls: AudioControlsState): void {
    this.lastControls = controls;
    if (!this.ctx || !this.micPreGain || !this.bassFilter || !this.trebleFilter || !this.masterGain || !this.bgmDuckGain) {
      return;
    }

    const now = this.ctx.currentTime;
    const gainNorm = 0.25 + (controls.gain / 100) * 1.15;
    this.micPreGain.gain.setTargetAtTime(gainNorm, now, 0.04);

    this.bassFilter.gain.setTargetAtTime(controls.bass, now, 0.05);
    this.trebleFilter.gain.setTargetAtTime(controls.treble, now, 0.05);

    const tapScale = this.powerTapToGain(controls.powerTap);
    const volNorm = controls.isMuted ? 0 : (controls.volume / 100) * tapScale * 0.65;
    this.masterGain.gain.setTargetAtTime(volNorm, now, 0.04);

    // Priority override ducking (-18 dB when paging)
    const duckTarget = controls.isPaging ? 0.12 : 1.0;
    this.bgmDuckGain.gain.setTargetAtTime(duckTarget, now, 0.08);
  }

  private powerTapToGain(tap: PowerTap): number {
    if (tap === 3) return 0.55;
    if (tap === 6) return 0.78;
    return 1.0;
  }

  public startPaging(): void {
    const ctx = this.ensureContext();
    if (!ctx || this.isPagingActive) return;
    this.isPagingActive = true;

    if (this.lastControls) {
      this.updateControls({ ...this.lastControls, isPaging: true });
    }

    // Play 4-note warm PA chime (G4 - B4 - D5 - G5)
    this.playChimeSequence(ctx);

    // After chime (~1.05s), start simulated vocal announcement signal
    if (this.chimeTimeout !== null) {
      window.clearTimeout(this.chimeTimeout);
    }
    this.chimeTimeout = window.setTimeout(() => {
      if (this.isPagingActive) {
        this.startVocalSimulation(ctx);
      }
    }, 1050);
  }

  public stopPaging(): void {
    if (!this.isPagingActive) return;
    this.isPagingActive = false;

    if (this.chimeTimeout !== null) {
      window.clearTimeout(this.chimeTimeout);
      this.chimeTimeout = null;
    }

    this.stopVocalSimulation();

    if (this.ctx && this.bgmDuckGain) {
      this.bgmDuckGain.gain.setTargetAtTime(1.0, this.ctx.currentTime, 0.18);
    }
  }

  private playChimeSequence(ctx: AudioContext): void {
    if (!this.micPreGain) return;
    const notes = [392.0, 493.88, 587.33, 783.99]; // G4, B4, D5, G5
    const baseTime = ctx.currentTime + 0.02;

    notes.forEach((freq, idx) => {
      const start = baseTime + idx * 0.22;
      const dur = idx === notes.length - 1 ? 0.95 : 0.45;

      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const noteGain = ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(freq, start);

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(freq * 2, start);

      const harmonicGain = ctx.createGain();
      harmonicGain.gain.setValueAtTime(0.16, start);

      noteGain.gain.setValueAtTime(0.0001, start);
      noteGain.gain.linearRampToValueAtTime(0.42, start + 0.018);
      noteGain.gain.exponentialRampToValueAtTime(0.0008, start + dur);

      osc1.connect(noteGain);
      osc2.connect(harmonicGain);
      harmonicGain.connect(noteGain);
      noteGain.connect(this.micPreGain!);

      osc1.start(start);
      osc2.start(start);
      osc1.stop(start + dur + 0.05);
      osc2.stop(start + dur + 0.05);
    });
  }

  private startVocalSimulation(ctx: AudioContext): void {
    this.stopVocalSimulation();
    if (!this.micPreGain) return;

    // Synthesize human-like speech cadence using glottal sawtooth + dual formant filters
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(132, ctx.currentTime);

    const formant1 = ctx.createBiquadFilter();
    formant1.type = 'bandpass';
    formant1.frequency.setValueAtTime(520, ctx.currentTime);
    formant1.Q.value = 4.5;

    const formant2 = ctx.createBiquadFilter();
    formant2.type = 'bandpass';
    formant2.frequency.setValueAtTime(1450, ctx.currentTime);
    formant2.Q.value = 5.0;

    const syllableGain = ctx.createGain();
    syllableGain.gain.setValueAtTime(0.0, ctx.currentTime);

    osc.connect(formant1);
    osc.connect(formant2);
    formant1.connect(syllableGain);
    formant2.connect(syllableGain);
    syllableGain.connect(this.micPreGain);

    osc.start();

    const vowels = [
      [700, 1200, 138], // a
      [420, 1950, 146], // e
      [310, 2150, 152], // i
      [480, 920, 134],  // o
      [350, 820, 128],  // u
    ];

    let step = 0;
    const triggerSyllable = () => {
      if (!this.isPagingActive || !this.ctx) return;
      const now = this.ctx.currentTime;
      const isPause = step % 7 === 6;
      if (isPause) {
        syllableGain.gain.setTargetAtTime(0.01, now, 0.04);
      } else {
        const v = vowels[(step * 3 + 1) % vowels.length];
        formant1.frequency.setTargetAtTime(v[0] + (Math.random() - 0.5) * 60, now, 0.04);
        formant2.frequency.setTargetAtTime(v[1] + (Math.random() - 0.5) * 140, now, 0.04);
        osc.frequency.setTargetAtTime(v[2] + (Math.random() - 0.5) * 14, now, 0.05);

        syllableGain.gain.cancelScheduledValues(now);
        syllableGain.gain.setValueAtTime(0.05, now);
        syllableGain.gain.linearRampToValueAtTime(0.45, now + 0.05);
        syllableGain.gain.exponentialRampToValueAtTime(0.12, now + 0.19);
      }
      step++;
    };

    triggerSyllable();
    this.vocalInterval = window.setInterval(triggerSyllable, 210);

    this.vocalActiveNodes = {
      stop: () => {
        if (this.vocalInterval !== null) {
          window.clearInterval(this.vocalInterval);
          this.vocalInterval = null;
        }
        try {
          syllableGain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.03);
          osc.stop(ctx.currentTime + 0.08);
        } catch {
          // ignore if already stopped
        }
      },
    };
  }

  private stopVocalSimulation(): void {
    if (this.vocalActiveNodes) {
      this.vocalActiveNodes.stop();
      this.vocalActiveNodes = null;
    }
  }

  public startBgm(): void {
    const ctx = this.ensureContext();
    if (!ctx || this.isBgmActive) return;
    this.isBgmActive = true;
    this.bgmStep = 0;

    // Warm lounge chord progression (Cmaj7 -> Am7 -> Fmaj7 -> G6)
    const chords = [
      [261.63, 329.63, 392.0, 493.88],
      [220.0, 261.63, 329.63, 392.0],
      [174.61, 220.0, 261.63, 329.63],
      [196.0, 246.94, 293.66, 329.63],
    ];

    const playBar = () => {
      if (!this.isBgmActive || !this.ctx || !this.bgmBusGain) return;
      const now = this.ctx.currentTime;
      const chord = chords[this.bgmStep % chords.length];

      // Soft warm pad chord
      chord.forEach((freq, i) => {
        const osc = this.ctx!.createOscillator();
        const filter = this.ctx!.createBiquadFilter();
        const g = this.ctx!.createGain();

        osc.type = i === 0 ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq, now);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1400, now);

        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime(0.11, now + 0.14);
        g.gain.setValueAtTime(0.095, now + 1.1);
        g.gain.exponentialRampToValueAtTime(0.001, now + 1.58);

        osc.connect(filter);
        filter.connect(g);
        g.connect(this.bgmBusGain!);

        osc.start(now);
        osc.stop(now + 1.62);
      });

      // Gentle rhythmic bass pulse (2 beats per chord)
      [0, 0.8].forEach((offset, bIdx) => {
        const bassOsc = this.ctx!.createOscillator();
        const bassGain = this.ctx!.createGain();
        bassOsc.type = 'sine';
        bassOsc.frequency.setValueAtTime(chord[0] * (bIdx === 0 ? 0.5 : 0.75), now + offset);

        bassGain.gain.setValueAtTime(0.0001, now + offset);
        bassGain.gain.linearRampToValueAtTime(0.18, now + offset + 0.03);
        bassGain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.55);

        bassOsc.connect(bassGain);
        bassGain.connect(this.bgmBusGain!);
        bassOsc.start(now + offset);
        bassOsc.stop(now + offset + 0.6);
      });

      this.bgmStep++;
    };

    playBar();
    this.bgmInterval = window.setInterval(playBar, 1600);
  }

  public stopBgm(): void {
    this.isBgmActive = false;
    if (this.bgmInterval !== null) {
      window.clearInterval(this.bgmInterval);
      this.bgmInterval = null;
    }
  }

  public playRelayClick(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(1250, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.025);
    g.gain.setValueAtTime(0.09, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.035);
  }

  public playAlertBeep(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.setValueAtTime(660, now + 0.11);
    g.gain.setValueAtTime(0.08, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.26);
  }

  /**
   * Returns normalized RMS amplitude [0..1] for speaker output and mic input
   */
  public sampleSignalLevels(): { speakerRms: number; micRms: number } {
    if (!this.analyser || !this.micAnalyser || !this.ctx || this.ctx.state !== 'running') {
      return { speakerRms: 0, micRms: 0 };
    }

    this.analyser.getByteTimeDomainData(this.timeData);
    this.micAnalyser.getByteTimeDomainData(this.micTimeData);

    let sumSpk = 0;
    let sumMic = 0;
    for (let i = 0; i < this.timeData.length; i++) {
      const s = (this.timeData[i] - 128) / 128;
      sumSpk += s * s;
      const m = (this.micTimeData[i] - 128) / 128;
      sumMic += m * m;
    }

    const speakerRms = Math.min(1, Math.sqrt(sumSpk / this.timeData.length) * 3.2);
    const micRms = Math.min(1, Math.sqrt(sumMic / this.micTimeData.length) * 3.5);
    return { speakerRms, micRms };
  }

  public dispose(): void {
    this.stopPaging();
    this.stopBgm();
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}

export const paAudioEngine = new PAAudioEngine();
