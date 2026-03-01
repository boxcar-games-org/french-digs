import { goto } from '$app/navigation';
import { Player } from './Player';
import { Terrain } from './Terrain';
import { WordManager } from './WordManager';

export class Game {
	canvas: HTMLCanvasElement;
	ctx: CanvasRenderingContext2D;
	animationId: number = 0;

	// Game Modules
	terrain: Terrain;
	player: Player;
	wordManager: WordManager;

	// Viewport
	width: number = 0;
	height: number = 0;
	readonly worldHeight = 5000;
	readonly groundLevel = 200;

	camera = { x: 0, y: 0 };
	mouse = { x: 0, y: 0, down: false };

	constructor(canvas: HTMLCanvasElement) {
		this.canvas = canvas;
		// alpha: false tells the browser we don't need transparency on the backbuffer, speeding up compositing
		this.ctx = canvas.getContext('2d', { alpha: false })!;
		// Disable smoothing for faster rendering and sharper edges
		this.ctx.imageSmoothingEnabled = false;

		this.width = window.innerWidth;
		this.height = window.innerHeight;
		this.canvas.width = this.width;
		this.canvas.height = this.height;

		// Initialize Modules
		this.terrain = new Terrain(this.width, this.worldHeight, this.groundLevel);
		this.player = new Player(400, 50);
		this.wordManager = new WordManager();

		// Spawn first word with world height knowledge
		this.wordManager.spawn(this.width, this.groundLevel, this.worldHeight);

		// Bind methods for event listeners
		this.handleKeyDown = this.handleKeyDown.bind(this);
		this.handleMouseMove = this.handleMouseMove.bind(this);
		this.handleMouseDown = this.handleMouseDown.bind(this);
		this.handleMouseUp = this.handleMouseUp.bind(this);
		this.handleTouchStart = this.handleTouchStart.bind(this);
		this.handleTouchMove = this.handleTouchMove.bind(this);
		this.handleTouchEnd = this.handleTouchEnd.bind(this);
		this.resize = this.resize.bind(this);

		this.addEventListeners();
		this.resize(); // Ensure initial sizing
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
			this.ctx.imageSmoothingEnabled = false; // Re-apply after resize
		}

		if (this.terrain) {
			this.terrain.resize(Math.max(this.width, window.innerWidth));
		}
	}

	private updateCamera() {
		const targetY = this.player.y - this.height / 3;
		this.camera.y += (targetY - this.camera.y) * 0.1;
		if (this.camera.y < -100) this.camera.y = -100;
	}

	private update() {
		// 1. Update Player & Physics
		this.player.update(this.mouse, this.camera, this.terrain, this.terrain.width);

		// 2. Handle Digging
		if (this.player.blaster.active && this.player.blaster.cooldown <= 0) {
			this.terrain.dig(this.player.blaster.x, this.player.blaster.y, this.player.blaster.radius);
			this.player.blaster.cooldown = 3;
		}

		// 3. Check for Word
		if (this.wordManager.checkFound(this.player)) {
			this.wordManager.spawn(this.terrain.width, this.groundLevel, this.worldHeight);
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
			`Depth: ${Math.floor(Math.max(0, (this.player.y - this.groundLevel) / 10))}m`,
			20,
			70
		);
		this.ctx.fillText(`Score: ${this.wordManager.score}`, 20, 90);

		// Target Word Indicator
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
			let x = cx + Math.cos(rot) * outerRadius;
			let y = cy + Math.sin(rot) * outerRadius;
			ctx.lineTo(x, y);
			rot += step;

			x = cx + Math.cos(rot) * innerRadius;
			y = cy + Math.sin(rot) * innerRadius;
			ctx.lineTo(x, y);
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
		const { x: px, y: py, width: pw, height: ph } = this.player;
		const { x: wx, y: wy } = this.wordManager.position;

		const cx = px + pw / 2;
		const cy = py + ph / 2;

		const dx = wx - cx;
		const dy = wy - cy;

		// Calculate angle to target
		const angle = Math.atan2(dy, dx);

		// Color based on distance (Red -> Green as we get closer)
		const dist = Math.sqrt(dx * dx + dy * dy);
		const maxDist = 1000; // Distance for full red
		// t goes from 0 (close) to 1 (far)
		const t = Math.min(1, dist / maxDist);
		// Hue: 120 (Green) at t=0, 0 (Red) at t=1
		const hue = (1 - t) * 120;
		const color = `hsl(${hue}, 100%, 50%)`;

		// Determine arrow position: orbit the player
		const orbitRadius = 95; // Distance from player center (Increased from 60)
		const arrowX = cx + Math.cos(angle) * orbitRadius;
		const arrowY = cy + Math.sin(angle) * orbitRadius;

		ctx.save();
		ctx.translate(arrowX, arrowY);
		ctx.rotate(angle);

		// Draw Arrow
		ctx.fillStyle = color;
		ctx.strokeStyle = '#FFFFFF';
		ctx.lineWidth = 2;

		ctx.beginPath();
		ctx.moveTo(10, 0); // Tip
		ctx.lineTo(-8, 6); // Back Bottom
		ctx.lineTo(-8, -6); // Back Top
		ctx.closePath();

		ctx.fill();
		ctx.stroke();

		ctx.restore();
	}

	private draw() {
		// Clear background
		this.ctx.setTransform(1, 0, 0, 1, 0, 0);
		this.ctx.fillStyle = '#87CEEB';
		this.ctx.fillRect(0, 0, this.width, this.height);

		this.ctx.save();
		this.ctx.translate(-this.camera.x, -this.camera.y);

		// Render Game Objects
		this.terrain.draw(this.ctx, this.camera.y, this.height);
		this.wordManager.draw(this.ctx, this.terrain);
		this.player.draw(this.ctx);
		this.drawNavigationArrow(this.ctx);

		this.ctx.restore();

		// Render UI
		this.drawHUD();
	}

	private gameLoop = () => {
		this.update();
		this.draw();
		this.animationId = requestAnimationFrame(this.gameLoop);
	};

	// --- Input Handlers ---

	private async handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			this.destroy();
			await goto('/');
		}
	}

	private handleMouseMove(e: MouseEvent) {
		this.mouse.x = e.clientX;
		this.mouse.y = e.clientY;
	}

	private handleMouseDown(e: MouseEvent) {
		if (e.button === 0) this.mouse.down = true;
	}

	private handleMouseUp(e: MouseEvent) {
		if (e.button === 0) this.mouse.down = false;
	}

	private handleTouchStart(e: TouchEvent) {
		if (e.cancelable) e.preventDefault();
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
