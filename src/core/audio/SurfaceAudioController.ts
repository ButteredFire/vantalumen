import { Howl } from 'howler';
import { useCosmosStore } from '../../store/useCosmosStore';
import type { BodyId } from '../../types/cosmos.types';

class SurfaceAudioController {
    private static instance: SurfaceAudioController;
    private ambience: Howl | null = null;
    private ambienceId: number | null = null;
    private isPlayingAmbience = false;
    private ambienceRequested = false;
    private currentAmbienceBody: BodyId | null = null;

    // Web Audio synthesizer drone for Lunar vacuum ambience
    private audioCtx: AudioContext | null = null;
    private lunarDroneGain: GainNode | null = null;
    private lunarOsc1: OscillatorNode | null = null;
    private lunarOsc2: OscillatorNode | null = null;

    private sounds: {
        popup?: Howl;
        popupImportant?: Howl;
        collapse?: Howl;
        error?: Howl;
        select?: Howl;
        analyze?: Howl;
        riseAiClickStart?: Howl;
        riseAiClickEnd?: Howl;
        mouseHover: Howl[];
    } = {
        mouseHover: [],
    };

    private constructor() {
        this.initSounds();
    }

    public static getInstance(): SurfaceAudioController {
        if (!SurfaceAudioController.instance) {
            SurfaceAudioController.instance = new SurfaceAudioController();
        }
        return SurfaceAudioController.instance;
    }

    private initSounds() {
        try {
            this.ambience = new Howl({
                src: ['/mars_ambience.mp3'],
                loop: true,
                volume: 0,
                html5: false,
            });

            this.sounds.popup = new Howl({ src: ['/ui_popup.mp3'], volume: 0.08 });
            this.sounds.popupImportant = new Howl({ src: ['/ui_popup_important.mp3'], volume: 0.1 });
            this.sounds.collapse = new Howl({ src: ['/ui_collapse.mp3'], volume: 0.08 });
            this.sounds.error = new Howl({ src: ['/ui_error.mp3'], volume: 0.12 });
            this.sounds.select = new Howl({ src: ['/ui_select.mp3'], volume: 0.08 });
            this.sounds.analyze = new Howl({ src: ['/ui_analyze.mp3'], volume: 0.22 });
            this.sounds.riseAiClickStart = new Howl({ src: ['/rise_ai_click_start.mp3'], volume: 0.1 });
            this.sounds.riseAiClickEnd = new Howl({ src: ['/rise_ai_click_end.mp3'], volume: 0.1 });

            this.sounds.mouseHover = [
                new Howl({ src: ['/ui_mouse_1.mp3'], volume: 0.04 }),
                new Howl({ src: ['/ui_mouse_2.mp3'], volume: 0.04 }),
                new Howl({ src: ['/ui_mouse_3.mp3'], volume: 0.04 }),
                new Howl({ src: ['/ui_mouse_4.mp3'], volume: 0.04 }),
            ];
        } catch (e) {
            console.warn('SurfaceAudioController initialization error:', e);
        }
    }

    private initLunarDrone() {
        if (this.audioCtx) return;
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return;
        try {
            this.audioCtx = new AudioCtx();
            this.lunarDroneGain = this.audioCtx.createGain();
            this.lunarDroneGain.gain.value = 0.001;

            const filter = this.audioCtx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 140;

            this.lunarOsc1 = this.audioCtx.createOscillator();
            this.lunarOsc2 = this.audioCtx.createOscillator();
            this.lunarOsc1.type = 'sine';
            this.lunarOsc2.type = 'triangle';
            this.lunarOsc1.frequency.value = 48.0;
            this.lunarOsc2.frequency.value = 72.3;

            this.lunarOsc1.connect(filter);
            this.lunarOsc2.connect(filter);
            filter.connect(this.lunarDroneGain);
            this.lunarDroneGain.connect(this.audioCtx.destination);

            this.lunarOsc1.start();
            this.lunarOsc2.start();
        } catch {
            // AudioContext autoplay restriction fallback
        }
    }

    public startAmbience(bodyId: BodyId = 'mars', targetVolume = 0.22, fadeMs = 2500) {
        this.ambienceRequested = true;
        this.currentAmbienceBody = bodyId;
        if (useCosmosStore.getState().audioMuted) return;
        this.isPlayingAmbience = true;

        if (bodyId === 'moon') {
            this.stopMarsAmbience(fadeMs);
            this.initLunarDrone();
            if (this.audioCtx && this.lunarDroneGain) {
                if (this.audioCtx.state === 'suspended') {
                    void this.audioCtx.resume();
                }
                const now = this.audioCtx.currentTime;
                this.lunarDroneGain.gain.cancelScheduledValues(now);
                this.lunarDroneGain.gain.setValueAtTime(this.lunarDroneGain.gain.value, now);
                this.lunarDroneGain.gain.linearRampToValueAtTime(0.18, now + fadeMs / 1000);
            }
        } else {
            this.stopLunarDrone(fadeMs);
            if (!this.ambience) return;
            if (!this.ambience.playing()) {
                this.ambienceId = this.ambience.play();
            }
            if (this.ambienceId !== null) {
                const currentVolume = this.ambience.volume(this.ambienceId) as number;
                this.ambience.fade(currentVolume, targetVolume, fadeMs, this.ambienceId);
            }
        }
    }

    private stopMarsAmbience(fadeMs = 1200) {
        if (this.ambience && this.ambienceId !== null && this.ambience.playing(this.ambienceId)) {
            const currentVol = (this.ambience.volume(this.ambienceId) as number) || 0.2;
            this.ambience.fade(currentVol, 0, fadeMs, this.ambienceId);
            setTimeout(() => {
                if (!this.isPlayingAmbience || this.currentAmbienceBody === 'moon') {
                    this.ambience?.stop(this.ambienceId!);
                }
            }, fadeMs);
        }
    }

    private stopLunarDrone(fadeMs = 1200) {
        if (this.audioCtx && this.lunarDroneGain) {
            const now = this.audioCtx.currentTime;
            this.lunarDroneGain.gain.cancelScheduledValues(now);
            this.lunarDroneGain.gain.setValueAtTime(this.lunarDroneGain.gain.value, now);
            this.lunarDroneGain.gain.linearRampToValueAtTime(0.0001, now + fadeMs / 1000);
        }
    }

    public stopAmbience(fadeMs = 1500) {
        this.ambienceRequested = false;
        this.isPlayingAmbience = false;
        this.stopMarsAmbience(fadeMs);
        this.stopLunarDrone(fadeMs);
    }

    public updateMuteState(isMuted: boolean) {
        if (isMuted) {
            this.isPlayingAmbience = false;
            this.stopMarsAmbience(500);
            this.stopLunarDrone(500);
        } else if (this.ambienceRequested) {
            this.startAmbience(this.currentAmbienceBody ?? 'mars', 0.22, 1000);
        }
    }

    public playHover() {
        if (useCosmosStore.getState().audioMuted) return;
        if (this.sounds.mouseHover.length === 0) return;
        const idx = Math.floor(Math.random() * this.sounds.mouseHover.length);
        this.sounds.mouseHover[idx]?.play();
    }

    public playPopup(important = false) {
        if (useCosmosStore.getState().audioMuted) return;
        if (important) {
            this.sounds.popupImportant?.play();
        } else {
            this.sounds.popup?.play();
        }
    }

    public playCollapse() {
        if (useCosmosStore.getState().audioMuted) return;
        this.sounds.collapse?.play();
    }

    public playSelect() {
        if (useCosmosStore.getState().audioMuted) return;
        this.sounds.select?.play();
    }

    public playAnalyze() {
        if (useCosmosStore.getState().audioMuted) return;
        this.sounds.analyze?.play();
    }

    public playRiseAiClickStart() {
        if (useCosmosStore.getState().audioMuted) return;
        this.sounds.riseAiClickStart?.play();
    }

    public playRiseAiClickEnd() {
        if (useCosmosStore.getState().audioMuted) return;
        this.sounds.riseAiClickEnd?.play();
    }

    public playError() {
        if (useCosmosStore.getState().audioMuted) return;
        this.sounds.error?.play();
    }
}

export const surfaceAudio = SurfaceAudioController.getInstance();
