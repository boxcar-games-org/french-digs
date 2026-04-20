import words from '$lib/assets/words.json';
import type { Player } from './Player';
import type { Terrain } from './Terrain';

type WordPair = {
	fr: string;
	en: string;
};

export class WordManager {
	words: WordPair[] = words;

	currentWord: WordPair = { fr: '', en: '' };
	position: { x: number; y: number } = { x: 0, y: 0 };
	score: number = 0;

	// Web Audio API context for sound effects
	private audioContext: AudioContext | null = null;
	private audioInitialized = false;

	/**
	 * Initialize/resume audio context - must be called from a user gesture handler
	 */
	initAudio() {
		if (this.audioInitialized) return;

		try {
			if (!this.audioContext) {
				this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
			}
			// Resume if suspended (required on mobile after user gesture)
			if (this.audioContext.state === 'suspended') {
				this.audioContext.resume();
			}
			this.audioInitialized = true;
		} catch (e) {
			console.warn('Audio init failed:', e);
		}
	}

	/**
	 * Spawn a new word at a reachable location.
	 * @param viewportWidth - Actual screen width in pixels
	 * @param viewportHeight - Actual screen height in pixels
	 * @param groundLevel - Y position where ground starts
	 * @param player - Current player state for relative positioning
	 */
	spawn(viewportWidth: number, viewportHeight: number, groundLevel: number, player: Player) {
		this.currentWord = this.words[Math.floor(Math.random() * this.words.length)];

		const playerCenterX = player.x + player.width / 2;

		// Spawn within viewport bounds, with padding
		const padding = 40;
		const minX = padding;
		const maxX = viewportWidth - padding;

		// Place word 300–900px below the player's current position
		const minDepth = Math.max(groundLevel + 150, player.y + 300);
		const maxDepth = minDepth + 600;

		this.position = {
			// Spawn near player horizontally (within ~1/3 of viewport)
			x: Math.max(
				minX,
				Math.min(maxX, playerCenterX + (Math.random() - 0.5) * viewportWidth * 0.6)
			),
			y: minDepth + Math.random() * (maxDepth - minDepth)
		};

		// Speak the new word: French once, then English once
		this.speak(this.currentWord);
	}

	checkFound(player: Player): boolean {
		const centerX = player.x + player.width / 2;
		const centerY = player.y + player.height / 2;

		const dx = centerX - this.position.x;
		const dy = centerY - this.position.y;
		const dist = Math.sqrt(dx * dx + dy * dy);

		if (dist < 50) {
			// Play happy chime on collection (no speech repeat)
			this.playChime();
			this.score++;
			return true;
		}
		return false;
	}

	/** Play a pleasant ascending chime using Web Audio API */
	private playChime() {
		try {
			// Initialize audio context on first use
			if (!this.audioContext) {
				this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
			}

			// Critical fix for mobile: resume if suspended
			if (this.audioContext.state === 'suspended') {
				this.audioContext.resume();
			}

			const now = this.audioContext.currentTime;

			// Create three ascending tones for a happy chime effect
			const frequencies = [784, 988, 1175]; // G5, B5, D6 - pleasant major arpeggio

			frequencies.forEach((freq, i) => {
				const oscillator = this.audioContext!.createOscillator();
				const gainNode = this.audioContext!.createGain();

				oscillator.connect(gainNode);
				gainNode.connect(this.audioContext!.destination);

				oscillator.type = 'sine';
				oscillator.frequency.value = freq;

				// Stagger each note slightly
				const startTime = now + i * 0.08;
				const duration = 0.15;

				// Smooth envelope to avoid clicks
				gainNode.gain.setValueAtTime(0, startTime);
				gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.02);
				gainNode.gain.linearRampToValueAtTime(0, startTime + duration);

				oscillator.start(startTime);
				oscillator.stop(startTime + duration);
			});
		} catch (e) {
			// Silently fail if audio isn't available
			console.warn('Chime playback failed:', e);
		}
	}

	stopSpeech() {
		if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
			window.speechSynthesis.cancel();
		}
	}

	private speak(word: WordPair) {
		if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
			// Cancel any pending speech to avoid queue buildup
			window.speechSynthesis.cancel();

			const frUtterance = new SpeechSynthesisUtterance(word.fr);
			frUtterance.lang = 'fr-FR';

			const enUtterance = new SpeechSynthesisUtterance(word.en);
			enUtterance.lang = 'en-US';

			// Speak French first, then English
			window.speechSynthesis.speak(frUtterance);
			window.speechSynthesis.speak(enUtterance);
		}
	}

	draw(ctx: CanvasRenderingContext2D, terrain: Terrain) {
		const isSolid = terrain.isSolid(this.position.x, this.position.y);
		const exposed = !isSolid;

		ctx.save();
		ctx.globalAlpha = exposed ? 1.0 : 0.5;

		const { x, y } = this.position;

		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';

		ctx.font = '900 36px "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
		ctx.lineWidth = 6;
		ctx.lineJoin = 'round';
		ctx.strokeStyle = '#3E2723';
		ctx.strokeText(this.currentWord.fr, x, y);

		ctx.fillStyle = '#FFD700';
		ctx.fillText(this.currentWord.fr, x, y);

		ctx.lineWidth = 1;
		ctx.strokeStyle = '#FFFFE0';
		ctx.strokeText(this.currentWord.fr, x, y);

		ctx.restore();
	}
}
