export const CHUNK_SIZE = 512;
export const GROUND_LEVEL = 200;

export class Chunk {
	canvas: HTMLCanvasElement;
	ctx: CanvasRenderingContext2D;
	grid: Uint8Array;
	chunkY: number;
	worldWidth: number;
	generated: boolean = false;
	fullyGenerated: boolean = false;

	// Incremental generation state
	private _seed: number = 0;
	private _nextRow: number = 0;
	private _imageData: ImageData | null = null;

	constructor(chunkY: number, worldWidth: number) {
		this.chunkY = chunkY;
		this.worldWidth = worldWidth;

		this.canvas = document.createElement('canvas');
		this.canvas.width = worldWidth;
		this.canvas.height = CHUNK_SIZE;
		this.ctx = this.canvas.getContext('2d')!;

		this.grid = new Uint8Array(worldWidth * CHUNK_SIZE);
	}

	/** Legacy sync generate — used for pre-warming only */
	generate(seed: number) {
		this._seed = seed;
		this.grid.fill(1);
		this._imageData = this.ctx.createImageData(this.worldWidth, CHUNK_SIZE);
		this.generateRows(seed, 0, CHUNK_SIZE);
		this.flushImageData();
		this.generated = true;
		this.fullyGenerated = true;
	}

	/** Begin incremental generation — call generateRows() each frame */
	startGeneration(seed: number) {
		this._seed = seed;
		this._nextRow = 0;
		this.grid.fill(1);
		this._imageData = this.ctx.createImageData(this.worldWidth, CHUNK_SIZE);
		this.generated = true;
		this.fullyGenerated = false;
	}

	/**
	 * Generate up to `rowCount` rows. Returns true when fully done.
	 * Also applies any dig-history diffs passed in via `diffMask`.
	 */
	generateRows(seed: number, startRow: number, rowCount: number, diffMask?: Uint8Array): boolean {
		const endRow = Math.min(startRow + rowCount, CHUNK_SIZE);
		const imageData = this._imageData!;
		const data = imageData.data;

		const { r, g, b } = this.terrainColor();
		const chunkWorldY = this.chunkY * CHUNK_SIZE;
		const solidThreshold = this.solidThreshold();

		for (let y = startRow; y < endRow; y++) {
			if (this.chunkY === 0 && y < GROUND_LEVEL) {
				// Sky rows — force air
				this.grid.fill(0, y * this.worldWidth, (y + 1) * this.worldWidth);
				// imageData already zeroed (transparent)
				continue;
			}

			const wy = chunkWorldY + y;

			for (let x = 0; x < this.worldWidth; x++) {
				const idx = y * this.worldWidth + x;
				const p = idx * 4;

				// Apply dig history first (overrides noise)
				if (diffMask && diffMask[idx] === 1) {
					this.grid[idx] = 0;
					data[p] = data[p + 1] = data[p + 2] = data[p + 3] = 0;
					continue;
				}

				const n1 = this.smoothNoise(x, wy, 120, seed);
				const n2 = this.smoothNoise(x, wy, 40, seed + 1);
				const value = n1 * 0.7 + n2 * 0.3;

				if (value > solidThreshold) {
					this.grid[idx] = 0;
					// air — leave transparent
				} else {
					this.grid[idx] = 1;
					data[p] = r;
					data[p + 1] = g;
					data[p + 2] = b;
					data[p + 3] = 255;
				}
			}
		}

		this._nextRow = endRow;

		if (endRow >= CHUNK_SIZE) {
			this.flushImageData();
			this.fullyGenerated = true;
			return true;
		}

		// Partial flush so the player sees progress
		this.flushImageData();
		return false;
	}

	/** Continue incremental generation by `rowCount` rows. Returns true when done. */
	continueGeneration(rowCount: number, diffMask?: Uint8Array): boolean {
		if (this.fullyGenerated) return true;
		return this.generateRows(this._seed, this._nextRow, rowCount, diffMask);
	}

	private flushImageData() {
		if (this._imageData) {
			this.ctx.putImageData(this._imageData, 0, 0);
		}
	}

	private solidThreshold(): number {
		if (this.chunkY === 0) return 0.62;
		if (this.chunkY === 1) return 0.58;
		if (this.chunkY <= 4) return 0.54;
		return 0.5;
	}

	private terrainColor(): { r: number; g: number; b: number } {
		if (this.chunkY === 0) return { r: 65, g: 139, b: 19 };
		if (this.chunkY === 1) return { r: 93, g: 64, b: 55 };
		if (this.chunkY <= 3) return { r: 121, g: 85, b: 72 };
		return { r: 69, g: 90, b: 100 };
	}

	private smoothNoise(wx: number, wy: number, scale: number, seed: number): number {
		const gx = wx / scale;
		const gy = wy / scale;
		const x0 = Math.floor(gx);
		const y0 = Math.floor(gy);
		const fx = gx - x0;
		const fy = gy - y0;
		const ux = fx * fx * (3 - 2 * fx);
		const uy = fy * fy * (3 - 2 * fy);

		const n00 = this.hash(x0, y0, seed);
		const n10 = this.hash(x0 + 1, y0, seed);
		const n01 = this.hash(x0, y0 + 1, seed);
		const n11 = this.hash(x0 + 1, y0 + 1, seed);

		return n00 * (1 - ux) * (1 - uy) + n10 * ux * (1 - uy) + n01 * (1 - ux) * uy + n11 * ux * uy;
	}

	private hash(x: number, y: number, seed: number): number {
		const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.3) * 43758.5453;
		return n - Math.floor(n);
	}

	dig(worldX: number, worldY: number, radius: number) {
		const localY = worldY - this.chunkY * CHUNK_SIZE;

		this.ctx.globalCompositeOperation = 'destination-out';
		this.ctx.beginPath();
		this.ctx.arc(worldX, localY, radius, 0, Math.PI * 2);
		this.ctx.fill();
		this.ctx.globalCompositeOperation = 'source-over';

		this.carveCircle(worldX, localY, radius);
	}

	carveCircle(cx: number, cy: number, radius: number) {
		const rSq = radius * radius;
		const minY = Math.max(0, Math.floor(cy - radius));
		const maxY = Math.min(CHUNK_SIZE - 1, Math.ceil(cy + radius));

		for (let y = minY; y <= maxY; y++) {
			const dy = y - cy;
			const halfWidth = Math.sqrt(Math.max(0, rSq - dy * dy));
			const startX = Math.max(0, Math.floor(cx - halfWidth));
			const endX = Math.min(this.worldWidth, Math.ceil(cx + halfWidth));
			if (startX < endX) {
				this.grid.fill(0, y * this.worldWidth + startX, y * this.worldWidth + endX);
			}
		}
	}

	isSolid(worldX: number, worldY: number): boolean {
		const localY = worldY - this.chunkY * CHUNK_SIZE;
		if (localY < 0 || localY >= CHUNK_SIZE) return false;
		if (worldX < 0 || worldX >= this.worldWidth) return false;
		return this.grid[Math.floor(localY) * this.worldWidth + Math.floor(worldX)] === 1;
	}

	draw(ctx: CanvasRenderingContext2D) {
		const worldY = this.chunkY * CHUNK_SIZE;

		if (!this.fullyGenerated) {
			// Draw a solid placeholder rectangle so there are no transparent holes
			const { r, g, b } = this.terrainColor();
			ctx.fillStyle = `rgb(${r},${g},${b})`;
			ctx.fillRect(0, worldY, this.worldWidth, CHUNK_SIZE);
		}

		// Fix 3: overdraw by 1px to cover seam between chunks
		ctx.drawImage(this.canvas, 0, worldY, this.worldWidth, CHUNK_SIZE + 1);
	}
}
