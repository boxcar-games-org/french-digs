import { goto } from '$app/navigation';
import { GROUND_LEVEL } from './Chunk';
import { Player } from './Player';
import { Terrain } from './Terrain';
import { WordManager } from './WordManager';

const WORLD_WIDTH = Math.max(typeof window !== 'undefined' ? window.innerWidth : 1024, 1024);

export class Game {
	canvas: HTMLCanvasElement;
	ctx: CanvasRenderingContext2D;
	animationId: number = 0;

	terrain: Terrain;
	player: Player;
	wordManager: WordManager;

	width: number = 0;
	height: number = 0;

	camera = { x: 0, y: 0 };
	mouse = { x: 0, y: 0, down: false };

	constructor(canvas: HTMLCanvasElement) {
		this.canvas = canvas;
		this.ctx = canvas.getContext('2d', { alpha: false })!;
		this.ctx.imageSmoothingEnabled = false;

		this.width = window.innerWidth;
		this.height = window.innerHeight;
		this.canvas.width = this.width;
		this.canvas.height = this.height;

		this.terrain = new Terrain(WORLD_WIDTH, GROUND_LEVEL);

		// Find the actual terrain surface at the spawn X
		const spawnX = WORLD_WIDTH / 2;
		let spawnY = GROUND_LEVEL;
		while (spawnY < GROUND_LEVEL + 512 && !this.terrain.isSolid(spawnX, spawnY)) {
			spawnY++;
		}
		this.player = new Player(spawnX - 15, spawnY - 32);

		this.wordManager = new WordManager();
		// Pass viewport dimensions + player for responsive spawning
		this.wordManager.spawn(this.width, this.height, GROUND_LEVEL, this.player);

		this.handleKeyDown = this.handleKeyDown.bind(this);
		this.handleMouseMove = this.handleMouseMove.bind(this);
		this.handleMouseDown = this.handleMouseDown.bind(this);
		this.handleMouseUp = this.handleMouseUp.bind(this);
		this.handleTouchStart = this.handleTouchStart.bind(this);
		this.handleTouchMove = this.handleTouchMove.bind(this);
		this.handleTouchEnd = this.handleTouchEnd.bind(this);
		this.resize = this.resize.bind(this);

		this.addEventListeners();
		this.resize();
		this.gameLoop();
	}

	private addEventListeners() {
		window.addEventListener('keydown', this.handleKeyDown);
		window.addEventListener('mousemove', this.handleMouseMove);
		window.addEventListener('mousedown', this.handleMouseDown);
		window.addEventListener('mouseup', this.handleMouseUp);
		window.addEventListener('touchstart', this.handleTouchStart, { passive: false });
		window.addEventListener('touchmove', this.handleTouchMove, { passive: false });
		window.addEventListener('touchend', this.handleTouchEnd, { passive: false });
		window.addEventListener('resize', this.resize);
	}

	public destroy() {
		cancelAnimationFrame(this.animationId);
		this.wordManager.stopSpeech();
		window.removeEventListener('keydown', this.handleKeyDown);
		window.removeEventListener('mousemove', this.handleMouseMove);
		window.removeEventListener('mousedown', this.handleMouseDown);
		window.removeEventListener('mouseup', this.handleMouseUp);
		window.removeEventListener('touchstart', this.handleTouchStart);
		window.removeEventListener('touchmove', this.handleTouchMove);
		window.removeEventListener('touchend', this.handleTouchEnd);
		window.removeEventListener('resize', this.resize);
	}

	private resize() {
		this.width = window.innerWidth;
		this.height = window.innerHeight;
		if (this.canvas) {
			this.canvas.width = this.width;
			this.canvas.height = this.height;
			this.ctx.imageSmoothingEnabled = false;
		}
	}

	private updateCamera() {
		// Vertical follow with smoothing
		const targetY = this.player.y - this.height / 3;
		this.camera.y += (targetY - this.camera.y) * 0.1;
		if (this.camera.y < -100) this.camera.y = -100;

		// Horizontal follow with smoothing and bounds
		const targetX = this.player.x - this.width / 2;
		this.camera.x += (targetX - this.camera.x) * 0.1;
		// Keep camera within world bounds
		this.camera.x = Math.max(0, Math.min(this.camera.x, this.terrain.width - this.width));
	}

	private update() {
		this.player.update(this.mouse, this.camera, this.terrain, this.terrain.width);

		this.terrain.tick(this.player.y, this.player.velocityY);

		if (this.player.blaster.active && this.player.blaster.cooldown <= 0) {
			this.terrain.dig(this.player.blaster.x, this.player.blaster.y, this.player.blaster.radius);
			this.player.blaster.cooldown = 3;
		}

		if (this.wordManager.checkFound(this.player)) {
			// Pass current viewport + player for responsive respawn
			this.wordManager.spawn(this.width, this.height, GROUND_LEVEL, this.player);
		}

		this.updateCamera();
	}

	private drawHUD() {
		this.ctx.fillStyle = 'white';
		this.ctx.textAlign = 'left';
		this.ctx.font = '16px Arial';
		this.ctx.fillText('Mouse/Touch: Aim / Hold to Dig & Move', 20, 30);
		this.ctx.fillText('Esc: Quit', 20, 50);
		this.ctx.fillText(
			`Depth: ${Math.floor(Math.max(0, (this.player.y - GROUND_LEVEL) / 10))}m`,
			20,
			70
		);
		this.ctx.fillText(`Score: ${this.wordManager.score}`, 20, 90);

		const starX = this.width - 80;
		const starY = 80;
		this.drawStarShape(this.ctx, starX, starY, 5, 60, 30);

		this.ctx.fillStyle = '#000';
		this.ctx.font = 'bold 16px Arial';
		this.ctx.textAlign = 'center';
		this.ctx.textBaseline = 'middle';
		this.ctx.fillText('FIND:', starX, starY - 15);
		this.ctx.font = 'bold 18px Arial';
		this.ctx.fillStyle = '#D00000';
		this.ctx.fillText(this.wordManager.currentWord.fr, starX, starY + 10);
	}

	private drawStarShape(
		ctx: CanvasRenderingContext2D,
		cx: number,
		cy: number,
		spikes: number,
		outerRadius: number,
		innerRadius: number
	) {
		let rot = (Math.PI / 2) * 3;
		const step = Math.PI / spikes;
		ctx.beginPath();
		ctx.moveTo(cx, cy - outerRadius);
		for (let i = 0; i < spikes; i++) {
			ctx.lineTo(cx + Math.cos(rot) * outerRadius, cy + Math.sin(rot) * outerRadius);
			rot += step;
			ctx.lineTo(cx + Math.cos(rot) * innerRadius, cy + Math.sin(rot) * innerRadius);
			rot += step;
		}
		ctx.lineTo(cx, cy - outerRadius);
		ctx.closePath();
		ctx.fillStyle = '#FFD700';
		ctx.fill();
		ctx.strokeStyle = '#DAA520';
		ctx.lineWidth = 3;
		ctx.stroke();
	}

	private drawNavigationArrow(ctx: CanvasRenderingContext2D) {
		const cx = this.player.x + this.player.width / 2;
		const cy = this.player.y + this.player.height / 2;
		const dx = this.wordManager.position.x - cx;
		const dy = this.wordManager.position.y - cy;

		const angle = Math.atan2(dy, dx);
		const dist = Math.sqrt(dx * dx + dy * dy);
		const t = Math.min(1, dist / 1000);
		const color = `hsl(${(1 - t) * 120}, 100%, 50%)`;

		const arrowX = cx + Math.cos(angle) * 95;
		const arrowY = cy + Math.sin(angle) * 95;

		ctx.save();
		ctx.translate(arrowX, arrowY);
		ctx.rotate(angle);
		ctx.fillStyle = color;
		ctx.strokeStyle = '#FFFFFF';
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo(10, 0);
		ctx.lineTo(-8, 6);
		ctx.lineTo(-8, -6);
		ctx.closePath();
		ctx.fill();
		ctx.stroke();
		ctx.restore();
	}

	private draw() {
		this.ctx.setTransform(1, 0, 0, 1, 0, 0);
		this.ctx.fillStyle = '#87CEEB';
		this.ctx.fillRect(0, 0, this.width, this.height);

		this.ctx.save();
		// Floor the camera translate to eliminate sub-pixel seams
		this.ctx.translate(-Math.floor(this.camera.x), -Math.floor(this.camera.y));

		this.terrain.draw(this.ctx);
		this.wordManager.draw(this.ctx, this.terrain);
		this.player.draw(this.ctx);
		this.drawNavigationArrow(this.ctx);

		this.ctx.restore();
		this.drawHUD();
	}

	private gameLoop = () => {
		this.update();
		this.draw();
		this.animationId = requestAnimationFrame(this.gameLoop);
	};

	/** Initialize audio on first user interaction - required for mobile autoplay policy */
	private handleUserGesture() {
		this.wordManager.initAudio();
	}

	private async handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			this.destroy();
			await goto('/');
		}
		// Initialize audio on any key press (for keyboard users)
		this.handleUserGesture();
	}
	private handleMouseMove(e: MouseEvent) {
		this.mouse.x = e.clientX;
		this.mouse.y = e.clientY;
	}
	private handleMouseDown(e: MouseEvent) {
		if (e.button === 0) {
			// Initialize audio on first mouse down (required for mobile)
			this.handleUserGesture();
			this.mouse.down = true;
		}
	}
	private handleMouseUp(e: MouseEvent) {
		if (e.button === 0) this.mouse.down = false;
	}

	private handleTouchStart(e: TouchEvent) {
		if (e.cancelable) e.preventDefault();
		// Initialize audio on first touch (critical for Android/iOS)
		this.handleUserGesture();
		if (e.touches.length > 0) {
			this.mouse.x = e.touches[0].clientX;
			this.mouse.y = e.touches[0].clientY;
			this.mouse.down = true;
		}
	}
	private handleTouchMove(e: TouchEvent) {
		if (e.cancelable) e.preventDefault();
		if (e.touches.length > 0) {
			this.mouse.x = e.touches[0].clientX;
			this.mouse.y = e.touches[0].clientY;
		}
	}
	private handleTouchEnd(e: TouchEvent) {
		if (e.cancelable) e.preventDefault();
		if (e.touches.length === 0) this.mouse.down = false;
		else {
			this.mouse.x = e.touches[0].clientX;
			this.mouse.y = e.touches[0].clientY;
		}
	}
}
