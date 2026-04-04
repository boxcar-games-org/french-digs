import { Chunk, CHUNK_SIZE } from './Chunk';

const MAX_DIG_HISTORY = 50;
const ROWS_PER_FRAME = 64;

export class Terrain {
	chunks: Map<number, Chunk> = new Map();
	worldWidth: number;
	groundLevel: number;
	seed: number;

	// Fix 2: sparse dig history — key = chunkY, value = flat diff mask
	private digHistory: Map<number, Uint8Array> = new Map();
	private digHistoryOrder: number[] = [];

	// Fix 1: async generation queue — sorted closest-first
	private generationQueue: number[] = [];

	get width(): number {
		return this.worldWidth;
	}

	constructor(worldWidth: number, groundLevel: number) {
		this.worldWidth = worldWidth;
		this.groundLevel = groundLevel;
		this.seed = Math.floor(Math.random() * 100000);

		// Pre-warm chunks 0 and 1 synchronously so there's no pop-in at startup
		this._generateSync(0);
		this._generateSync(1);
	}

	private _generateSync(chunkY: number) {
		if (this.chunks.has(chunkY)) return;
		const chunk = new Chunk(chunkY, this.worldWidth);
		chunk.generate(this.seed);
		this._applyDigHistory(chunk);
		this.chunks.set(chunkY, chunk);
	}

	private _applyDigHistory(chunk: Chunk) {
		const diff = this.digHistory.get(chunk.chunkY);
		if (!diff) return;
		// Re-carve every dug cell onto the freshly generated chunk
		const size = this.worldWidth * CHUNK_SIZE;
		for (let i = 0; i < size; i++) {
			if (diff[i] === 1) {
				const x = i % this.worldWidth;
				const localY = Math.floor(i / this.worldWidth);
				chunk.grid[i] = 0;
				// Punch a 1px hole in the canvas for this cell
				chunk['ctx'].clearRect(x, localY, 1, 1);
			}
		}
	}

	/** Called every frame from Game.update() — replaces ensureChunksAround */
	tick(playerWorldY: number, playerVelocityY: number = 0) {
		const currentChunkY = Math.floor(playerWorldY / CHUNK_SIZE);

		// Velocity-based look-ahead: fall faster → load further ahead
		const lookahead = Math.max(2, Math.ceil((Math.abs(playerVelocityY) / CHUNK_SIZE) * 60));
		const loadMin = Math.max(0, currentChunkY - 1);
		const loadMax = currentChunkY + 2 + lookahead;

		// Create chunk objects for any missing slots and enqueue them
		for (let cy = loadMin; cy <= loadMax; cy++) {
			if (!this.chunks.has(cy)) {
				const chunk = new Chunk(cy, this.worldWidth);
				chunk.startGeneration(this.seed);
				this.chunks.set(cy, chunk);

				// Insert into queue sorted by distance to player (closest first)
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
				// Remove from queue if pending
				const qi = this.generationQueue.indexOf(cy);
				if (qi !== -1) this.generationQueue.splice(qi, 1);
			}
		}

		// Process the generation queue with a row budget
		this._processQueue(ROWS_PER_FRAME);
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
			remaining -= ROWS_PER_FRAME; // conservative: treat one call as full budget use

			if (done) {
				this.generationQueue.shift();
			} else {
				break; // used up budget, resume next frame
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

	/** Fix 2: persist dig cells into the diff mask for this chunkY */
	private _recordDig(chunkY: number, cx: number, localCY: number, radius: number) {
		if (!this.digHistory.has(chunkY)) {
			// Cap history size
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
