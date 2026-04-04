French Digs — Terrain Improvement Plan
Project Context
This is a SvelteKit game ("french-digs") where a player digs through procedurally generated terrain to find hidden French vocabulary words. The game runs on an HTML5 canvas using a hand-rolled game loop (no game engine).

Current Architecture (as implemented)
File structure
french-digs/src/lib/game/
Chunk.ts — individual 512×512 terrain chunk
Terrain.ts — chunk lifecycle manager
Player.ts — physics, input, blaster (unchanged throughout)
WordManager.ts — word spawning and collection
Game.ts — game loop, camera, HUD, input routing
Chunk.ts

CHUNK_SIZE = 512, GROUND_LEVEL = 200 exported as constants
Each Chunk owns:

canvas: HTMLCanvasElement (worldWidth × CHUNK_SIZE) — visual offscreen buffer
grid: Uint8Array (worldWidth × CHUNK_SIZE) — collision: 1 = solid, 0 = air
chunkY: number — chunk index (world Y = chunkY × CHUNK_SIZE)
worldWidth: number
generated: boolean

Generation (generate(seed)):

Fills grid with 1, calls carveAirPockets(seed), then syncCanvas()
carveAirPockets: bilinear-interpolated value noise (smoothNoise) at two octaves (scale 120 coarse, scale 40 fine, weighted 0.7/0.3). Solid threshold varies by depth: 0.62 / 0.58 / 0.54 / 0.50 for chunks 0/1/2-4/5+. Values above threshold become air. Chunk 0 forces rows 0–199 to air (sky).
syncCanvas: writes ImageData directly — solid pixels get terrain colour (green/brown/clay/rock by chunkY), air pixels are transparent RGBA(0,0,0,0)

Dig (dig(worldX, worldY, radius)): converts to localY = worldY − chunkY×CHUNK_SIZE, carves circle in grid via scanline, updates canvas with destination-out arc
Draw (draw(ctx)): ctx.drawImage(this.canvas, 0, chunkY \* CHUNK_SIZE) — no camera math here; caller has already applied ctx.translate(0, -cameraY)
isSolid(worldX, worldY): converts to localY, bounds-checks, returns grid value

Terrain.ts

Holds Map<number, Chunk> keyed by chunkY
worldWidth fixed at Math.max(window.innerWidth, 1024) (set in Game.ts)
seed randomised once at construction
ensureChunksAround(playerWorldY): called every frame from Game.update(). Computes currentChunkY = Math.floor(playerY / CHUNK_SIZE). Generates chunks in range [currentChunkY-1, currentChunkY+2]. Evicts chunks outside [currentChunkY-2, currentChunkY+3]. Generation is synchronous and blocking — this is problem 1.
Constructor pre-warms chunks 0 and 1 by calling ensureChunksAround(0) and ensureChunksAround(CHUNK_SIZE)
isSolid: looks up chunk, returns true (solid) for unloaded chunks
dig: identifies up to 3 affected chunks by top/mid/bottom Y, calls chunk.dig() on each
draw(ctx): iterates all loaded chunks, calls chunk.draw(ctx) — no camera args

Game.ts

WORLD_WIDTH = Math.max(window.innerWidth, 1024)
GROUND_LEVEL imported from Chunk.ts (= 200)
Player spawned by scanning downward from GROUND_LEVEL until terrain.isSolid() returns true, then placed 32px above
Camera: camera.y lerps toward player.y - height/3 at factor 0.1; clamped to min -100
draw(): clears to sky blue, then ctx.save() → ctx.translate(-camera.x, -camera.y) → draws terrain, words, player, arrow → ctx.restore() → draws HUD. All world objects use the same translate — this is why terrain and player are in sync.
No worldHeight constant — depth is unlimited

WordManager.ts

spawn(worldWidth, groundLevel, playerY): places word 300–900px below playerY, not based on a fixed world height
Words rendered in world space (inside the translate block)

The Three Problems to Fix

Problem 1: Chunk generation causes frame hitches
Root cause: chunk.generate(seed) is called synchronously inside ensureChunksAround, which runs every frame in Game.update(). Generating a chunk involves a double nested loop over worldWidth × CHUNK_SIZE pixels (~500K iterations for a 1024-wide world), all on the main thread. When the player crosses a chunk boundary, a new chunk generates in that same frame, dropping it below 60fps visibly.
Fix: Async incremental generation using a generation queue
Replace the synchronous generate-on-demand model with a queue-based background generator that spreads work across frames using requestIdleCallback (or a time-budgeted loop inside requestAnimationFrame).
Implementation steps:

Add a generation queue in Terrain.ts. Instead of calling chunk.generate(seed) directly, push chunk indices that need generation onto a pendingQueue: number[] array.
Generate row-by-row across frames. Split Chunk.generate() into an incremental form. Add a generateRows(seed, startRow, endRow) method to Chunk that processes only a slice of rows and updates both grid and canvas ImageData for that slice. Store partial ImageData on the chunk between calls. A reasonable budget is ~64 rows per frame (benchmarks to ~1ms on a mid-range device).
Process the queue in Terrain.tick(playerWorldY) (rename from ensureChunksAround). Each frame, tick:

Identifies which chunks should exist (range currentChunkY-1 to currentChunkY+2)
Creates Chunk objects immediately for any missing ones (cheap — just allocates arrays)
Pushes newly created chunk indices to the front of the queue sorted by distance to player (closest first)
Calls processQueue(rowBudget = 64) which pulls from the front and calls generateRows until budget is exhausted

Unloaded/partial chunks render as solid colour (no transparent holes). Add a fullyGenerated: boolean flag. Until set, draw() fills a solid rect in the chunk's terrain colour so there's no visual pop.
Predictive loading based on velocity. Track player.velocityY in the existing Player class (already exists). In Terrain.tick, extend the look-ahead range when the player is falling fast: lookahead = Math.max(2, Math.ceil(Math.abs(player.velocityY) / CHUNK_SIZE \* 60)). Pre-enqueue chunks up to currentChunkY + 2 + lookahead — they may not be fully generated when reached but will be partially generated, spreading the cost over more frames.

Problem 2: Dig data is lost when chunks are evicted
Root cause: Chunks are created fresh from noise each time they're loaded. When a chunk is evicted (player moves 3+ chunks away) and later reloaded (player moves back up), chunk.generate(seed) re-runs from scratch — all dig holes are gone. Currently eviction happens at currentChunkY - 2, meaning even modest upward movement discards dug terrain.
Fix: Persistent dig storage in Terrain using a sparse diff map
Do not save the entire grid — that's 512KB per chunk and would accumulate forever. Instead, save only the differences from the procedurally generated state.
Implementation:

Add digHistory: Map<number, Uint32Array> to Terrain.ts. Key is chunkY. Value is a Uint32Array of packed (x, localY) pairs representing every cell that was dug. Use bit-packing: (localY << 11) | x fits in a 32-bit int for worldWidth ≤ 2048 and CHUNK_SIZE ≤ 512. Actually simpler: store a Uint8Array of length worldWidth _ CHUNK_SIZE — a sparse diff mask where 1 means "this cell was dug after generation". At ~128KB per chunk this is acceptable for up to ~20 chunks of history (2.5MB).
On dig(): After carving in the live chunk, also write the affected cells into digHistory.get(chunkY) (create the array if absent). Iterate the same scanline circle and set diff[y _ worldWidth + x] = 1.
On chunk load: After chunk.generate(seed), check digHistory.get(chunkY). If it exists, iterate its set cells and call the internal carveCircle + canvas clear for each cell — or more efficiently, bulk-apply using a single ImageData pass that zeroes out diff pixels and clears grid entries.
Cap history size. Keep at most 50 chunks of dig history (50 × 128KB = 6.4MB). Use a historyOrder: number[] array as an insertion-order queue; when it exceeds 50, delete the oldest entry from digHistory.
No changes needed to Player.ts or WordManager.ts. The terrain.dig() interface stays identical.

Problem 3: Faint seam line between chunks
Root cause: Each chunk canvas is exactly CHUNK_SIZE pixels tall. When drawn at ctx.drawImage(canvas, 0, chunkY \* CHUNK_SIZE), sub-pixel camera positions cause the browser to anti-alias the boundary between two chunk images, producing a 1px blending artefact. This is a canvas compositing issue — even with imageSmoothingEnabled = false, the drawImage destination coordinates can be fractional after the ctx.translate(0, -cameraY) where cameraY is a floating-point lerp value.
Fix: Floor the camera translate and overdraw chunk edges by 1px
Two complementary changes:

In Game.draw(), floor the camera offset before applying the translate:

typescript ctx.translate(-Math.floor(this.camera.x), -Math.floor(this.camera.y));
This ensures all draw calls land on integer pixel boundaries, eliminating sub-pixel compositing gaps.

In Chunk.draw(), draw the canvas 1px taller than the chunk to overdraw the seam:

typescript ctx.drawImage(this.canvas, 0, chunkY \* CHUNK_SIZE, worldWidth, CHUNK_SIZE + 1);
The +1 stretches the bottom row of pixels down by 1px, covering any gap. Since the row at the chunk boundary is either all solid or all air (never a content edge), stretching it by 1px is visually identical to the correct image.
Both fixes together make seams invisible at all camera speeds.

Implementation Order

Problem 3 (seam) — 2-line fix, do this first, completely isolated
Problem 2 (dig persistence) — add digHistory to Terrain.ts, modify dig() and chunk loading; no interface changes
Problem 1 (async generation) — most complex; refactor ensureChunksAround into tick() with queue, split generate() into incremental form, add velocity-based lookahead

Files Changed Per Problem
ProblemFilesSeam fixGame.ts (1 line), Chunk.ts (1 line)Dig persistenceTerrain.ts (digHistory map, modified dig + load)Async generationChunk.ts (incremental generate), Terrain.ts (queue + tick), Game.ts (call tick instead of ensureChunksAround)
What Must Not Change

Player.ts — no changes needed for any of these fixes
WordManager.ts — no changes needed
The camera translate pattern in Game.draw() (except flooring it) — this is what keeps terrain/player in sync and must be preserved
The isSolid / dig / draw public interfaces on Terrain — Player and Game depend on these signatures
