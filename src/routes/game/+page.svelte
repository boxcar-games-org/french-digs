<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	let canvas: HTMLCanvasElement;
	let ctx: CanvasRenderingContext2D;
	let animationId: number;

	let width = 0;
	let height = 0;

	// Game state
	let sprite = {
		x: 400,
		y: 50,
		width: 40,
		height: 40,
		velocityY: 0,
		gravity: 0.5,
		isDigging: false
	};

	let camera = {
		x: 0,
		y: 0
	};

	let blaster = {
		active: false,
		x: 0,
		y: 0,
		angle: 0,
		length: 50,
		radius: 30 // Dig radius
	};

	// Earth line (represents the surface that can be dug)
	let earthLine: { x: number; y: number }[] = [];
	const groundLevel = 200; // Increased initial ground level slightly

	// Input
	let keys: { [key: string]: boolean } = {};

	function resize() {
		width = window.innerWidth;
		height = window.innerHeight;
		canvas.width = width;
		canvas.height = height;

		// Re-initialize earth if it's too short for the new width
		// In a real game we'd preserve the old data, but for this simpler version:
		if (earthLine.length === 0 || earthLine[earthLine.length - 1].x < width) {
			// Extend or init
			const startX = earthLine.length > 0 ? earthLine[earthLine.length - 1].x + 5 : 0;
			for (let x = startX; x <= width + 50; x += 5) {
				earthLine.push({ x, y: groundLevel });
			}
		}
	}

	function handleKeyDown(e: KeyboardEvent) {
		keys[e.key] = true;
		if (e.key === ' ') {
			e.preventDefault();
			blaster.active = true;
		}
		if (e.key === 'Escape') {
			goto('/');
		}
	}

	function handleKeyUp(e: KeyboardEvent) {
		keys[e.key] = false;
		if (e.key === ' ') {
			blaster.active = false;
		}
	}

	function checkCollision() {
		const spriteBottom = sprite.y + sprite.height;
		const spriteLeft = sprite.x;
		const spriteRight = sprite.x + sprite.width;

		// Find the highest earth point under the sprite
		// Initialize with a value far below the sprite
		let highestY = Number.MAX_VALUE;
		let hasGround = false;

		// Optimization: only check points roughly near the sprite
		const startIndex = Math.max(0, Math.floor((spriteLeft - 50) / 5));
		const endIndex = Math.min(earthLine.length, Math.ceil((spriteRight + 50) / 5));

		for (let i = startIndex; i < endIndex; i++) {
			const point = earthLine[i];
			if (point.x >= spriteLeft - 10 && point.x <= spriteRight + 10) {
				if (point.y < highestY) {
					highestY = point.y;
					hasGround = true;
				}
			}
		}

		if (hasGround && spriteBottom >= highestY) {
			// Collision detected
			sprite.y = highestY - sprite.height;
			sprite.velocityY = 0;
			return true;
		}

		return false;
	}

	function dig() {
		if (!blaster.active) return;

		const blasterEndX = sprite.x + sprite.width / 2 + Math.cos(blaster.angle) * blaster.length;
		const blasterEndY = sprite.y + sprite.height + Math.sin(blaster.angle) * blaster.length;

		// Optimization: search only near blaster
		const startIndex = Math.max(0, Math.floor((blasterEndX - blaster.radius - 20) / 5));
		const endIndex = Math.min(earthLine.length, Math.ceil((blasterEndX + blaster.radius + 20) / 5));

		for (let i = startIndex; i < endIndex; i++) {
			const point = earthLine[i];
			const distance = Math.sqrt(
				Math.pow(point.x - blasterEndX, 2) + Math.pow(point.y - blasterEndY, 2)
			);

			if (distance < blaster.radius) {
				// Create a crater effect
				const digAmount = (1 - distance / blaster.radius) * 15;
				earthLine[i].y += digAmount;

				// We removed the depth cap here to allow infinite digging
			}
		}
	}

	function updateCamera() {
		// Target y is centering the player vertically
		const targetY = sprite.y - height / 3;
		// Smoothly interpolate current camera position to target
		camera.y += (targetY - camera.y) * 0.1;

		// Don't let camera go above the sky (optional, but keeps start clean)
		if (camera.y < -100) camera.y = -100;
	}

	function update() {
		// Horizontal movement
		if (keys['ArrowLeft'] || keys['a']) {
			sprite.x -= 3;
		}
		if (keys['ArrowRight'] || keys['d']) {
			sprite.x += 3;
		}

		// Keep sprite in bounds horizontally
		sprite.x = Math.max(0, Math.min(width - sprite.width, sprite.x));

		// Apply gravity
		sprite.velocityY += sprite.gravity;
		sprite.y += sprite.velocityY;

		// Check collision with earth
		checkCollision();

		// Dig if space is pressed
		if (blaster.active) {
			dig();
		}

		// Update blaster angle based on direction
		if (keys['ArrowLeft'] || keys['a']) {
			blaster.angle = Math.PI * 0.75; // Down-left
		} else if (keys['ArrowRight'] || keys['d']) {
			blaster.angle = Math.PI * 0.25; // Down-right
		} else {
			blaster.angle = Math.PI / 2; // Straight down
		}

		updateCamera();
	}

	function draw() {
		if (!ctx) return;

		// Clear canvas (using absolute coordinates since we transform context)
		ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform for clearing
		ctx.fillStyle = '#87CEEB';
		ctx.fillRect(0, 0, width, height);

		// Apply Camera Transform
		ctx.save();
		ctx.translate(-camera.x, -camera.y);

		// Draw earth
		// We need to draw a shape that goes deep enough to cover the screen even when deep underground
		const deepBottom = camera.y + height + 1000; // Extend well below view

		ctx.fillStyle = '#8B4513';
		ctx.beginPath();
		// Start from bottom-left far below
		ctx.moveTo(0, deepBottom);

		for (let point of earthLine) {
			ctx.lineTo(point.x, point.y);
		}
		// End at bottom-right far below
		ctx.lineTo(width, deepBottom);
		ctx.closePath();
		ctx.fill();

		// Draw earth surface line
		ctx.strokeStyle = '#654321';
		ctx.lineWidth = 3;
		ctx.beginPath();
		if (earthLine.length > 0) {
			ctx.moveTo(earthLine[0].x, earthLine[0].y);
			for (let point of earthLine) {
				ctx.lineTo(point.x, point.y);
			}
		}
		ctx.stroke();

		// Draw sprite
		ctx.fillStyle = '#FF6B35';
		ctx.fillRect(sprite.x, sprite.y, sprite.width, sprite.height);

		// Draw sprite details (helmet)
		ctx.fillStyle = '#FFD700';
		ctx.fillRect(sprite.x + 5, sprite.y + 5, sprite.width - 10, 15);

		// Draw blaster if active
		if (blaster.active) {
			const startX = sprite.x + sprite.width / 2;
			const startY = sprite.y + sprite.height;
			const endX = startX + Math.cos(blaster.angle) * blaster.length;
			const endY = startY + Math.sin(blaster.angle) * blaster.length;

			ctx.strokeStyle = '#00FF00';
			ctx.lineWidth = 4;
			ctx.beginPath();
			ctx.moveTo(startX, startY);
			ctx.lineTo(endX, endY);
			ctx.stroke();

			// Draw blaster glow
			ctx.strokeStyle = '#90EE90';
			ctx.lineWidth = 8;
			ctx.globalAlpha = 0.3;
			ctx.beginPath();
			ctx.moveTo(startX, startY);
			ctx.lineTo(endX, endY);
			ctx.stroke();
			ctx.globalAlpha = 1;

			// Draw dig radius indicator
			ctx.strokeStyle = '#00FF0055';
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.arc(endX, endY, blaster.radius, 0, Math.PI * 2);
			ctx.stroke();
		}

		ctx.restore(); // Restore camera transform

		// Draw HUD (static position)
		ctx.fillStyle = 'white';
		ctx.font = '16px Arial';
		ctx.fillText('Arrow Keys / A/D: Move', 20, 30);
		ctx.fillText('Space: Dig', 20, 50);
		ctx.fillText('ESC: Exit', 20, 70);
		ctx.fillText(`Depth: ${Math.floor(Math.max(0, (sprite.y - groundLevel) / 10))}m`, 20, 90);
	}

	function gameLoop() {
		update();
		draw();
		animationId = requestAnimationFrame(gameLoop);
	}

	onMount(() => {
		ctx = canvas.getContext('2d')!;
		resize(); // Initial setup
		gameLoop();

		return () => {
			cancelAnimationFrame(animationId);
		};
	});
</script>

<svelte:window on:keydown={handleKeyDown} on:keyup={handleKeyUp} on:resize={resize} />

<div class="game-container">
	<canvas bind:this={canvas}></canvas>
</div>

<style>
	.game-container {
		display: block;
		width: 100vw;
		height: 100vh;
		background-color: #87ceeb; /* Match sky color so resize flickers aren't jarring */
		margin: 0;
		padding: 0;
		overflow: hidden;
	}

	canvas {
		display: block; /* Removes default inline spacing */
	}

	:global(body) {
		margin: 0;
		padding: 0;
		overflow: hidden;
	}
</style>
