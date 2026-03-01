import type { Terrain } from './Terrain';

export class Player {
	x: number;
	y: number;
	width: number = 30;
	height: number = 30;
	velocityY: number = 0;
	gravity: number = 0.5;

	blaster = {
		active: false,
		angle: 0,
		radius: 30,
		x: 0,
		y: 0,
		cooldown: 0,
		length: 60
	};

	constructor(x: number, y: number) {
		this.x = x;
		this.y = y;
	}

	update(
		mouse: { x: number; y: number; down: boolean },
		camera: { x: number; y: number },
		terrain: Terrain,
		worldWidth: number
	) {
		const cx = this.x + this.width / 2;
		const cy = this.y + this.height / 2;

		// --- Blaster Aiming ---
		let targetX = mouse.x + camera.x;
		let targetY = mouse.y + camera.y;

		// Clamp distance
		// Overlap the player slightly (by 10px) so the digging feels connected
		const overlap = 10;
		const maxDist = this.blaster.radius + this.width / 2 - overlap;

		const dxRaw = targetX - cx;
		const dyRaw = targetY - cy;
		const dist = Math.sqrt(dxRaw * dxRaw + dyRaw * dyRaw);

		if (dist > maxDist) {
			const ratio = maxDist / dist;
			targetX = cx + dxRaw * ratio;
			targetY = cy + dyRaw * ratio;
		}

		this.blaster.x = targetX;
		this.blaster.y = targetY;
		this.blaster.angle = Math.atan2(this.blaster.y - cy, this.blaster.x - cx);

		// --- Movement Input ---
		let dx = 0;
		if (mouse.down) {
			this.blaster.active = true;
			// Horizontal logic based on blaster position relative to player
			// Adjusted threshold from 20 to 15 for smaller sprite
			if (this.blaster.x < cx - 15) dx = -3;
			else if (this.blaster.x > cx + 15) dx = 3;

			// Jetpack logic
			if (this.blaster.y < cy - 15) {
				this.velocityY -= 0.8;
			}
		} else {
			this.blaster.active = false;
		}

		// --- Horizontal Collision ---
		if (dx !== 0) {
			const checkX = dx > 0 ? this.x + this.width + dx : this.x + dx;
			const kneeY = this.y + this.height - 10;
			const headY = this.y + 10;
			const waistY = this.y + this.height / 2;

			if (
				terrain.isSolid(checkX, waistY) ||
				terrain.isSolid(checkX, headY) ||
				terrain.isSolid(checkX, kneeY)
			) {
				dx = 0;
			}
		}

		this.x += dx;
		this.x = Math.max(0, Math.min(worldWidth - this.width, this.x));

		// --- Vertical Physics ---
		this.velocityY += this.gravity;
		this.velocityY = Math.max(-10, Math.min(12, this.velocityY));
		this.y += this.velocityY;

		this.checkTerrainCollision(terrain);

		// --- Cooldown ---
		if (this.blaster.cooldown > 0) this.blaster.cooldown--;
	}

	private checkTerrainCollision(terrain: Terrain) {
		const centerX = this.x + this.width / 2;
		const leftX = this.x + 10;
		const rightX = this.x + this.width - 10;

		if (this.velocityY >= 0) {
			// Falling
			const bottomY = this.y + this.height;
			if (
				terrain.isSolid(centerX, bottomY) ||
				terrain.isSolid(leftX, bottomY) ||
				terrain.isSolid(rightX, bottomY)
			) {
				let surfaceY = bottomY;
				let scanLimit = 20;
				while (terrain.isSolid(centerX, surfaceY - 1) && surfaceY > this.y && scanLimit > 0) {
					surfaceY--;
					scanLimit--;
				}
				this.y = surfaceY - this.height;
				this.velocityY = 0;
			}
		} else {
			// Jumping / Flying Up
			const topY = this.y;
			if (
				terrain.isSolid(centerX, topY) ||
				terrain.isSolid(leftX, topY) ||
				terrain.isSolid(rightX, topY)
			) {
				this.velocityY = 0;
				this.y = Math.floor(topY) + 1;
			}
		}
	}

	draw(ctx: CanvasRenderingContext2D) {
		// Player Body
		ctx.fillStyle = '#FF6B35';
		ctx.beginPath();
		if (ctx.roundRect) ctx.roundRect(this.x, this.y, this.width, this.height, 8);
		else ctx.fillRect(this.x, this.y, this.width, this.height);
		ctx.fill();

		// Visor
		ctx.fillStyle = '#FFD700';
		ctx.beginPath();
		if (ctx.roundRect) ctx.roundRect(this.x + 4, this.y + 6, this.width - 8, 9, 3);
		else ctx.fillRect(this.x + 4, this.y + 6, this.width - 8, 9);
		ctx.fill();

		// Blaster Guide Line
		const cx = this.x + this.width / 2;
		const cy = this.y + this.height / 2;

		ctx.beginPath();
		ctx.moveTo(cx, cy);
		ctx.lineTo(this.blaster.x, this.blaster.y);
		ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
		ctx.lineWidth = 2;
		ctx.stroke();

		// Dig Radius
		ctx.beginPath();
		ctx.arc(this.blaster.x, this.blaster.y, this.blaster.radius, 0, Math.PI * 2);
		ctx.strokeStyle = this.blaster.active ? '#00FF00' : 'rgba(255, 255, 255, 0.5)';
		ctx.lineWidth = 2;
		ctx.stroke();

		if (this.blaster.active) {
			ctx.fillStyle = 'rgba(0, 255, 0, 0.3)';
			ctx.fill();
		}
	}
}
