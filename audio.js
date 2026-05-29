class AudioManager {
    constructor() {
        this.ctx = null;
        this.engineOsc = null;
        this.engineGain = null;
        this.isMuted = false;
    }

    init() {
        if (this.ctx) return;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        this.ctx = new AudioContext();
        this.startEngine();
    }

    startEngine() {
        if (!this.ctx || this.isMuted) return;
        try {
            this.engineOsc = this.ctx.createOscillator();
            this.engineGain = this.ctx.createGain();

            this.engineOsc.type = 'sawtooth';
            this.engineOsc.frequency.setValueAtTime(60, this.ctx.currentTime); // Low engine idle hum

            // Add a lowpass filter to make it sound less harsh
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(150, this.ctx.currentTime);

            this.engineGain.gain.setValueAtTime(0.08, this.ctx.currentTime);

            this.engineOsc.connect(filter);
            filter.connect(this.engineGain);
            this.engineGain.connect(this.ctx.destination);

            this.engineOsc.start();
        } catch (e) {
            console.error("Failed to start engine audio:", e);
        }
    }

    updateEnginePitch(speedRatio) {
        if (!this.ctx || !this.engineOsc || this.isMuted) return;
        // Map speed ratio (0 to 1) to frequency (60Hz to 180Hz)
        const targetFreq = 60 + speedRatio * 120;
        this.engineOsc.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.1);
        this.engineGain.gain.setTargetAtTime(0.04 + speedRatio * 0.08, this.ctx.currentTime, 0.1);
    }

    stopEngine() {
        if (this.engineOsc) {
            try {
                this.engineOsc.stop();
            } catch (e) {}
            this.engineOsc = null;
        }
    }

    playHorn() {
        if (!this.ctx || this.isMuted) return;
        this.resumeContext();

        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();

        osc1.type = 'triangle';
        osc1.frequency.setValueAtTime(440, this.ctx.currentTime);
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(445, this.ctx.currentTime); // Slight detune for realistic horn

        gainNode.gain.setValueAtTime(0.15, this.ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);

        osc1.connect(gainNode);
        osc2.connect(gainNode);
        gainNode.connect(this.ctx.destination);

        osc1.start();
        osc2.start();
        osc1.stop(this.ctx.currentTime + 0.35);
        osc2.stop(this.ctx.currentTime + 0.35);
    }

    playScreech() {
        if (!this.ctx || this.isMuted) return;
        this.resumeContext();

        const osc = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(800, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(300, this.ctx.currentTime + 0.4);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1000, this.ctx.currentTime);

        gainNode.gain.setValueAtTime(0.08, this.ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.4);

        osc.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.45);
    }

    playCrash() {
        if (!this.ctx || this.isMuted) return;
        this.resumeContext();

        // White noise generation for crash
        const bufferSize = this.ctx.sampleRate * 0.5; // 0.5 seconds
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(300, this.ctx.currentTime);

        const gainNode = this.ctx.createGain();
        gainNode.gain.setValueAtTime(0.3, this.ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);

        noise.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.ctx.destination);

        noise.start();
        noise.stop(this.ctx.currentTime + 0.5);
    }

    playBonus() {
        if (!this.ctx || this.isMuted) return;
        this.resumeContext();

        const osc = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();

        osc.type = 'sine';
        const now = this.ctx.currentTime;
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
        osc.frequency.setValueAtTime(783.99, now + 0.2); // G5
        osc.frequency.setValueAtTime(1046.50, now + 0.3); // C6

        gainNode.gain.setValueAtTime(0.12, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

        osc.connect(gainNode);
        gainNode.connect(this.ctx.destination);

        osc.start();
        osc.stop(now + 0.5);
    }

    playWin() {
        if (!this.ctx || this.isMuted) return;
        this.resumeContext();
        const now = this.ctx.currentTime;

        const playNote = (freq, start, duration) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.15, start);
            gain.gain.exponentialRampToValueAtTime(0.01, start + duration - 0.02);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(start);
            osc.stop(start + duration);
        };

        playNote(523.25, now, 0.15); // C5
        playNote(659.25, now + 0.15, 0.15); // E5
        playNote(783.99, now + 0.3, 0.15); // G5
        playNote(1046.50, now + 0.45, 0.4); // C6
    }

    resumeContext() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        if (this.isMuted) {
            this.stopEngine();
        } else {
            this.startEngine();
        }
        return this.isMuted;
    }
}

const audioManager = new AudioManager();
window.audioManager = audioManager;
