import { AudioSettings } from '../types/game';

export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private ambienceGain: GainNode | null = null;

  private settings: AudioSettings;
  private isUnlocked: boolean = false;

  // Active looping sounds
  private laserOsc: OscillatorNode | null = null;
  private laserGain: GainNode | null = null;
  private ambienceOsc1: OscillatorNode | null = null;
  private ambienceOsc2: OscillatorNode | null = null;

  constructor(settings: AudioSettings) {
    this.settings = { ...settings };
  }

  public unlock(): void {
    if (this.isUnlocked) return;

    try {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtxClass();

      this.masterGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.ambienceGain = this.ctx.createGain();

      this.sfxGain.connect(this.masterGain);
      this.ambienceGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      this.applySettings();
      this.startAmbience();
      this.isUnlocked = true;
    } catch {
      // AudioContext unavailable or restricted
    }
  }

  public updateSettings(settings: AudioSettings): void {
    this.settings = { ...settings };
    this.applySettings();
  }

  private applySettings(): void {
    if (!this.ctx || !this.masterGain || !this.sfxGain || !this.ambienceGain) return;
    const now = this.ctx.currentTime;
    const vol = this.settings.muted ? 0 : this.settings.masterVolume;

    this.masterGain.gain.setValueAtTime(vol, now);
    this.sfxGain.gain.setValueAtTime(this.settings.effectsVolume, now);
    this.ambienceGain.gain.setValueAtTime(this.settings.ambienceVolume * 0.4, now);
  }

  private startAmbience(): void {
    if (!this.ctx || !this.ambienceGain) return;

    try {
      // Deep space atmospheric drone: dual detuned low sines
      this.ambienceOsc1 = this.ctx.createOscillator();
      this.ambienceOsc2 = this.ctx.createOscillator();

      this.ambienceOsc1.type = 'sine';
      this.ambienceOsc1.frequency.setValueAtTime(55, this.ctx.currentTime); // A1 note

      this.ambienceOsc2.type = 'triangle';
      this.ambienceOsc2.frequency.setValueAtTime(56.5, this.ctx.currentTime); // Slight detune for hypnotic phase beating

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(160, this.ctx.currentTime);

      this.ambienceOsc1.connect(filter);
      this.ambienceOsc2.connect(filter);
      filter.connect(this.ambienceGain);

      this.ambienceOsc1.start();
      this.ambienceOsc2.start();
    } catch {
      // Ignore audio start errors
    }
  }

  /**
   * Synthesize punchy meteor impact
   */
  public playMeteorImpact(): void {
    if (!this.ctx || !this.sfxGain || this.settings.muted) return;
    const now = this.ctx.currentTime;

    // Sub-bass thud
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(32, now + 0.45);

    oscGain.gain.setValueAtTime(0.9, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

    osc.connect(oscGain);
    oscGain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.6);

    // Crunchy rocky explosion noise
    this.playNoiseBurst(0.7, 450, 0.45);
  }

  /**
   * Synthesize massive cinematic nuclear detonation
   */
  public playNuclearBlast(): void {
    if (!this.ctx || !this.sfxGain || this.settings.muted) return;
    const now = this.ctx.currentTime;

    // Mega infrasound punch
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(90, now);
    osc.frequency.exponentialRampToValueAtTime(18, now + 1.2);

    oscGain.gain.setValueAtTime(1.0, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 1.4);

    osc.connect(oscGain);
    oscGain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 1.5);

    // Deep expanding blast wave rumble
    this.playNoiseBurst(1.2, 320, 1.3);
  }

  /**
   * Continuous laser hum
   */
  public startLaserHum(): void {
    if (!this.ctx || !this.sfxGain || this.laserOsc || this.settings.muted) return;
    const now = this.ctx.currentTime;

    this.laserOsc = this.ctx.createOscillator();
    this.laserGain = this.ctx.createGain();

    this.laserOsc.type = 'sawtooth';
    this.laserOsc.frequency.setValueAtTime(380, now);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(650, now);
    filter.Q.setValueAtTime(4.0, now);

    this.laserGain.gain.setValueAtTime(0.001, now);
    this.laserGain.gain.linearRampToValueAtTime(0.3, now + 0.1);

    this.laserOsc.connect(filter);
    filter.connect(this.laserGain);
    this.laserGain.connect(this.sfxGain);

    this.laserOsc.start(now);
  }

  public stopLaserHum(): void {
    if (!this.ctx || !this.laserOsc || !this.laserGain) return;
    const now = this.ctx.currentTime;

    this.laserGain.gain.linearRampToValueAtTime(0.001, now + 0.1);
    this.laserOsc.stop(now + 0.12);
    this.laserOsc = null;
    this.laserGain = null;
  }

  /**
   * Gravitational singularity warp sound
   */
  public playGravityPulse(): void {
    if (!this.ctx || !this.sfxGain || this.settings.muted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(350, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.8);

    gain.gain.setValueAtTime(0.7, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.95);
  }

  /**
   * Catastrophic planet breakup rumble
   */
  public playPlanetBreakup(): void {
    if (!this.ctx || !this.sfxGain || this.settings.muted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(75, now);
    osc.frequency.exponentialRampToValueAtTime(22, now + 2.0);

    gain.gain.setValueAtTime(0.8, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 2.2);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(200, now);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 2.3);

    this.playNoiseBurst(1.0, 250, 2.0);
  }

  /**
   * Pristine reset chime / swoosh
   */
  public playReset(): void {
    if (!this.ctx || !this.sfxGain || this.settings.muted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.35);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.45);
  }

  /**
   * Clean UI blip
   */
  public playUiClick(): void {
    if (!this.ctx || !this.sfxGain || this.settings.muted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(980, now);
    osc.frequency.exponentialRampToValueAtTime(440, now + 0.05);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.07);
  }

  private playNoiseBurst(duration: number, cutoffHz: number, volume: number): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;

    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoffHz, now);
    filter.frequency.exponentialRampToValueAtTime(60, now + duration);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    noise.start(now);
  }
}
