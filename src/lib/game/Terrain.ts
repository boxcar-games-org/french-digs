export class Terrain {
	canvas: HTMLCanvasElement;
	ctx: CanvasRenderingContext2D;
	collisionGrid: Uint8Array;
	width: number;
	height: number;
	groundLevel: number;

	constructor(width: number, height: number, groundLevel: number = 200) {
		this.width = width;
		this.height = height;
		this.groundLevel = groundLevel;

		this.canvas = document.createElement('canvas');
		this.canvas.width = width;
		this.canvas.height = height;
		this.ctx = this.canvas.getContext('2d')!;

		this.collisionGrid = new Uint8Array(width * height);

		this.init();
	}

	init() {
		// --- 1. Visual Setup ---
		this.ctx.fillStyle = '#8B4513';
		this.ctx.fillRect(0, 0, this.width, this.height);

		// Carve initial Sky
		this.ctx.globalCompositeOperation = 'destination-out';
		this.ctx.fillRect(0, 0, this.width, this.groundLevel);
		this.ctx.globalCompositeOperation = 'source-over';

		// --- 2. Collision Grid Setup ---
		// Fill with "Solid" (1)
		this.collisionGrid.fill(1);
		// Clear "Sky" (0)
		this.collisionGrid.fill(0, 0, this.groundLevel * this.width);
	}

	resize(newWidth: number) {
		if (newWidth <= this.width) return;

		const oldCanvas = this.canvas;
		const oldGrid = this.collisionGrid;
		const oldWidth = this.width;

		// Create new buffers
		this.width = newWidth;
		this.canvas = document.createElement('canvas');
		this.canvas.width = newWidth;
		this.canvas.height = this.height;
		this.ctx = this.canvas.getContext('2d')!;
		this.collisionGrid = new Uint8Array(newWidth * this.height);

		// Re-init basic terrain
		this.init();

		// Draw old terrain on top
		this.ctx.clearRect(0, 0, this.width, this.height);
		this.ctx.drawImage(oldCanvas, 0, 0);

		// Fill right side
		this.ctx.globalCompositeOperation = 'destination-over';
		this.ctx.fillStyle = '#8B4513';
		this.ctx.fillRect(oldWidth, 0, newWidth - oldWidth, this.height);

		// Clear sky on right
		this.ctx.globalCompositeOperation = 'destination-out';
		this.ctx.fillRect(oldWidth, 0, newWidth - oldWidth, this.groundLevel);
		this.ctx.globalCompositeOperation = 'source-over';

		// Copy old grid data
		// Iterate rows and copy memory buffers
		for (let y = this.groundLevel; y < this.height; y++) {
			const oldStart = y * oldWidth;
			const newStart = y * newWidth;
			this.collisionGrid.set(oldGrid.subarray(oldStart, oldStart + oldWidth), newStart);
		}
	}

	isSolid(x: number, y: number): boolean {
		if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
			return false;
		}
		return this.collisionGrid[Math.floor(y) * this.width + Math.floor(x)] === 1;
	}

	dig(x: number, y: number, radius: number) {
		// 1. Update Visuals (Canvas API)
		this.ctx.globalCompositeOperation = 'destination-out';
		this.ctx.beginPath();
		this.ctx.arc(x, y, radius, 0, Math.PI * 2);
		this.ctx.fill();
		this.ctx.globalCompositeOperation = 'source-over';

		// 2. Update Physics (Optimized Scanline)
		this.carveCircle(x, y, radius);
	}

	// Optimized logic: Calculates the horizontal span of the circle for each row
	// and uses native array filling instead of per-pixel loops.
	private carveCircle(cx: number, cy: number, radius: number) {
		const rSq = radius * radius;
		const floorRadius = Math.floor(radius);

		// Determine vertical bounds clipped to world height
		const minY = Math.max(0, Math.floor(cy - floorRadius));
		const maxY = Math.min(this.height - 1, Math.ceil(cy + floorRadius));

		for (let y = minY; y <= maxY; y++) {
			const dy = y - cy;
			// Calculate chord width: x = sqrt(r^2 - y^2)
			// Math.max(0, ...) prevents NaN if rounding errors push slight negative
			const halfWidth = Math.sqrt(Math.max(0, rSq - dy * dy));

			// Determine horizontal bounds clipped to world width
			const startX = Math.max(0, Math.floor(cx - halfWidth));
			const endX = Math.min(this.width, Math.ceil(cx + halfWidth));

			// Use native fill for maximum performance
			if (startX < endX) {
				const rowOffset = y * this.width;
				this.collisionGrid.fill(0, rowOffset + startX, rowOffset + endX);
			}
		}
	}

	draw(ctx: CanvasRenderingContext2D, cameraY: number, viewHeight: number) {
		const sy = Math.max(0, cameraY);
		const dy = sy;
		const sh = Math.min(this.height - sy, viewHeight + 100);

		if (sh > 0) {
			ctx.drawImage(this.canvas, 0, sy, this.width, sh, 0, dy, this.width, sh);
		}
	}
}
