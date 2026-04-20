import { Chunk, CHUNK_SIZE, initChunkSize } from './Chunk';

const MAX_DIG_HISTORY = 50;
const BASE_ROWS_PER_FRAME = 32; // Reduced from 64 for mobile

export class Terrain {
	chunks: Map<number, Chunk> = new Map();
	worldWidth: number;
	groundLevel: number;
	seed: number;
	private _isMobile: boolean;
	private _rowsPerFrame: number;
	private _lastFrameTime: number = 0;
	private _frameCount: number = 0;
	private _fps: number = 60;

	// Fix 2: sparse dig history — key = chunkY, value = flat diff mask
	private digHistory: Map<number, Uint8Array> = new Map();
	private digHistoryOrder: number[] = [];

	// Fix 1: async generation queue — sorted closest-first
	private generationQueue: number[] = [];

	get width(): number {
		return this.worldWidth;
	}

	constructor(worldWidth: number, groundLevel: number, viewportHeight?: number) {
		this.worldWidth = worldWidth;
		this.groundLevel = groundLevel;
		this.seed = Math.floor(Math.random() * 100000);
		this._isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

		// Initialize chunk size based on viewport
		if (viewportHeight) {
			initChunkSize(viewportHeight);
		}

		// Set adaptive rows per frame
		this._rowsPerFrame = this._isMobile ? 16 : BASE_ROWS_PER_FRAME;

		// Pre-warm chunks 0 and 1 synchronously
		this._generateSync(0);
		this._generateSync(1);
	}

	private _generateSync(chunkY: number) {
		if (this.chunks.has(chunkY)) return;
		const chunk = new Chunk(chunkY, this.worldWidth, this._isMobile);
		chunk.generate(this.seed);
		this._applyDigHistory(chunk);
		this.chunks.set(chunkY, chunk);
	}

	private _applyDigHistory(chunk: Chunk) {
		const diff = this.digHistory.get(chunk.chunkY);
		if (!diff) return;
		const size = this.worldWidth * CHUNK_SIZE;
		for (let i = 0; i < size; i++) {
			if (diff[i] === 1) {
				const x = i % this.worldWidth;
				const localY = Math.floor(i / this.worldWidth);
				chunk.grid[i] = 0;
				chunk['ctx'].clearRect(x, localY, 1, 1);
			}
		}
	}

	/** Update FPS tracking for adaptive throttling */
	private _updateFPS(timestamp: number) {
		if (this._lastFrameTime) {
			this._frameCount++;
			const elapsed = timestamp - this._lastFrameTime;
			if (elapsed >= 1000) {
				this._fps = Math.round((this._frameCount * 1000) / elapsed);
				this._frameCount = 0;
				this._lastFrameTime = timestamp;

				// Adaptive throttling: reduce load if FPS drops below 30
				if (this._fps < 30 && this._rowsPerFrame > 8) {
					this._rowsPerFrame = Math.max(8, Math.floor(this._rowsPerFrame * 0.75));
				} else if (this._fps > 50 && this._rowsPerFrame < BASE_ROWS_PER_FRAME) {
					this._rowsPerFrame = Math.min(BASE_ROWS_PER_FRAME, this._rowsPerFrame + 4);
				}
			}
		} else {
			this._lastFrameTime = timestamp;
		}
	}

	/** Called every frame from Game.update() */
	tick(playerWorldY: number, playerVelocityY: number = 0, timestamp?: number) {
		if (timestamp) this._updateFPS(timestamp);

		const currentChunkY = Math.floor(playerWorldY / CHUNK_SIZE);

		// Reduced lookahead on mobile
		const lookaheadBase = this._isMobile ? 1 : 2;
		const velocityFactor = this._isMobile ? 30 : 60;
		const lookahead = Math.max(
			lookaheadBase,
			Math.ceil((Math.abs(playerVelocityY) / CHUNK_SIZE) * velocityFactor)
		);

		const loadMin = Math.max(0, currentChunkY - 1);
		const loadMax = currentChunkY + 2 + lookahead;

		// Create chunk objects for any missing slots and enqueue them
		for (let cy = loadMin; cy <= loadMax; cy++) {
			if (!this.chunks.has(cy)) {
				const chunk = new Chunk(cy, this.worldWidth, this._isMobile);
				chunk.startGeneration(this.seed);
				this.chunks.set(cy, chunk);

				const dist = Math.abs(cy - currentChunkY);
				let insertAt = this.generationQueue.length;
				for (let i = 0; i < this.generationQueue.length; i++) {
					if (Math.abs(this.generationQueue[i] - currentChunkY) > dist) {
						insertAt = i;
						break;
					}
				}
				this.generationQueue.splice(insertAt, 0, cy);
			}
		}

		// Evict chunks well outside the load range
		for (const [cy] of this.chunks) {
			if (cy < currentChunkY - 2 || cy > currentChunkY + 3 + lookahead) {
				this.chunks.delete(cy);
				const qi = this.generationQueue.indexOf(cy);
				if (qi !== -1) this.generationQueue.splice(qi, 1);
			}
		}

		// Process the generation queue with adaptive row budget
		this._processQueue(this._rowsPerFrame);
	}

	private _processQueue(rowBudget: number) {
		let remaining = rowBudget;

		while (remaining > 0 && this.generationQueue.length > 0) {
			const cy = this.generationQueue[0];
			const chunk = this.chunks.get(cy);

			if (!chunk || chunk.fullyGenerated) {
				this.generationQueue.shift();
				continue;
			}

			const diff = this.digHistory.get(cy);
			const done = chunk.continueGeneration(remaining, diff);
			remaining -= rowBudget;

			if (done) {
				this.generationQueue.shift();
			} else {
				break;
			}
		}
	}

	isSolid(worldX: number, worldY: number): boolean {
		if (worldY < 0) return false;
		const chunk = this.chunks.get(Math.floor(worldY / CHUNK_SIZE));
		if (!chunk) return true;
		return chunk.isSolid(worldX, worldY);
	}

	dig(worldX: number, worldY: number, radius: number) {
		const affected = new Set([
			Math.floor((worldY - radius) / CHUNK_SIZE),
			Math.floor(worldY / CHUNK_SIZE),
			Math.floor((worldY + radius) / CHUNK_SIZE)
		]);

		for (const cy of affected) {
			this.chunks.get(cy)?.dig(worldX, worldY, radius);
			this._recordDig(cy, worldX, worldY - cy * CHUNK_SIZE, radius);
		}
	}

	private _recordDig(chunkY: number, cx: number, localCY: number, radius: number) {
		if (!this.digHistory.has(chunkY)) {
			if (this.digHistoryOrder.length >= MAX_DIG_HISTORY) {
				const oldest = this.digHistoryOrder.shift()!;
				this.digHistory.delete(oldest);
			}
			this.digHistory.set(chunkY, new Uint8Array(this.worldWidth * CHUNK_SIZE));
			this.digHistoryOrder.push(chunkY);
		}

		const diff = this.digHistory.get(chunkY)!;
		const rSq = radius * radius;
		const minY = Math.max(0, Math.floor(localCY - radius));
		const maxY = Math.min(CHUNK_SIZE - 1, Math.ceil(localCY + radius));

		for (let y = minY; y <= maxY; y++) {
			const dy = y - localCY;
			const halfWidth = Math.sqrt(Math.max(0, rSq - dy * dy));
			const startX = Math.max(0, Math.floor(cx - halfWidth));
			const endX = Math.min(this.worldWidth, Math.ceil(cx + halfWidth));
			for (let x = startX; x < endX; x++) {
				diff[y * this.worldWidth + x] = 1;
			}
		}
	}

	draw(ctx: CanvasRenderingContext2D) {
		for (const chunk of this.chunks.values()) {
			chunk.draw(ctx);
		}
	}
}
