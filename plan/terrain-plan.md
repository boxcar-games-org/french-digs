# Infinite Terrain — Implementation Plan

## Goal

Replace the current single-canvas, fixed-height terrain system with a chunk-based, procedurally generated infinite terrain. The player can dig downward forever with constant RAM usage and no browser canvas size limits.

---

## Core Concepts

### What a Chunk Is

A **Chunk** is a 512×512 pixel square of terrain. It owns:

- One offscreen `HTMLCanvasElement` (512×512) for visuals
- One `Uint8Array` of length `512 * 512` for collision (`1` = solid, `0` = air)
- A `chunkY` index (integer) — chunk 0 is the surface, chunk 1 is 512px below, chunk 2 is 1024px below, etc.
- A `generated` boolean flag

World pixel Y = `chunkY * CHUNK_SIZE + localY`

### Loaded Window

At any time, only **4 chunks** are held in memory — the chunk the player is currently in, one above, and two below. As the player descends, new chunks are generated ahead of them and old ones above are evicted and garbage collected. Since generation is deterministic (seeded noise), chunks can be regenerated if the player ever moves back up.

### Procedural Generation

Each chunk is generated independently using a seeded noise function. No external library is needed — a simple `sin`/`cos` hash produces good-enough cave-like terrain. Generation rules vary by depth (chunkY index) to make the world feel layered.

---

## Files to Create / Modify

### New file: `french-digs/src/lib/game/Chunk.ts`

### Rewrite: `french-digs/src/lib/game/Terrain.ts`

### Edit: `french-digs/src/lib/game/Game.ts`

### Edit: `french-digs/src/lib/game/WordManager.ts`

### No changes needed: `french-digs/src/lib/game/Player.ts`

---

## Detailed Spec Per File

---

### New file: `french-digs/src/lib/game/Chunk.ts`

This is a self-contained class. `Terrain.ts` manages a collection of these.

```
Constants (at top of file, exported so Terrain can import them):
  CHUNK_SIZE = 512         // pixels, both width and height
  WORLD_WIDTH = 1024       // total world width in pixels (fixed, only depth is infinite)
```

**Constructor:** `constructor(chunkY: number, worldWidth: number)`

- Stores `chunkY` and `worldWidth`
- Creates `this.canvas` (offscreen, `worldWidth × CHUNK_SIZE`)
- Creates `this.ctx`
- Creates `this.grid = new Uint8Array(worldWidth * CHUNK_SIZE)`
- Does NOT generate yet — call `generate()` separately

**Method: `generate(seed: number)`**

This fills both the visual canvas and the collision grid. Use the following layered approach:

1. Fill entire grid with `1` (solid) to start
2. Call `carveAirPockets(seed)` to cut holes
3. Sync the canvas to match the grid (draw solid pixels, leave air transparent)
4. Set `this.generated = true`

**Noise function (private, inside Chunk):**

```
// Simple deterministic hash — no library needed
noise(x: number, y: number, seed: number): number {
  // Returns a float 0.0–1.0
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.3) * 43758.5453;
  return n - Math.floor(n);
}
```

**`carveAirPockets(seed: number)` logic:**

The world pixel Y of the top of this chunk = `this.chunkY * CHUNK_SIZE`.
Use `chunkY` to control how dense the terrain is:

```
solidThreshold:
  chunkY === 0  → 0.45   (surface layer, mostly solid with some tunnels)
  chunkY === 1  → 0.40
  chunkY 2–4   → 0.35   (mid depth, more open)
  chunkY 5+    → 0.30   (deep, most cavernous)
```

For each pixel `(x, y)` in the chunk's local coordinate space:

- Compute world coordinates: `wx = x`, `wy = chunkY * CHUNK_SIZE + y`
- Sample noise at multiple scales (octaves) for natural-looking caves:
  ```
  // Coarse scale (big cave shapes)
  n1 = noise(wx / 120, wy / 120, seed)
  // Fine scale (texture/roughness)
  n2 = noise(wx / 40, wy / 40, seed + 1)
  // Combine
  value = n1 * 0.7 + n2 * 0.3
  ```
- If `value < solidThreshold` → set grid to `0` (air)
- Otherwise → set grid to `1` (solid)

**Special rule for chunkY === 0 (surface chunk):**
Force the top `groundLevel` rows (e.g. top 200 pixels of this chunk) to be fully `0` (air/sky). The `groundLevel` value should be passed in from the caller or stored as a constant matching what `Game.ts` uses (200px).

**Canvas sync after grid generation:**

Draw the solid terrain color as a base, then use `destination-out` compositing to cut out air cells. For performance, do this in a single pass using `ImageData` rather than per-pixel canvas calls:

```
// Create ImageData for the full chunk
const imageData = ctx.createImageData(worldWidth, CHUNK_SIZE)
for each pixel (x, y):
  if grid[y * worldWidth + x] === 1:
    // Set to terrain color (e.g. earthy brown #5D4037 = rgb(93, 64, 55))
    // Vary color slightly by depth for visual layering:
    //   chunkY 0: green surface  #418b13 = rgb(65, 139, 19)
    //   chunkY 1: dark soil      #5D4037 = rgb(93, 64, 55)
    //   chunkY 2–3: clay/rock    #795548 = rgb(121, 85, 72)
    //   chunkY 4+: deep rock     #455A64 = rgb(69, 90, 100)
    set RGBA to terrain color, alpha 255
  else:
    set RGBA to (0, 0, 0, 0)  // transparent air
ctx.putImageData(imageData, 0, 0)
```

**Method: `dig(worldX: number, worldY: number, radius: number)`**

Converts world coordinates to local chunk coordinates, then performs the same circle-carve logic as the existing `Terrain.dig`:

- `localX = worldX`
- `localY = worldY - this.chunkY * CHUNK_SIZE`
- Carve circle in grid (scanline method, same as existing `Terrain.carveCircle`)
- Update canvas visuals using `destination-out` arc

**Method: `isSolid(worldX: number, worldY: number): boolean`**

- `localY = worldY - this.chunkY * CHUNK_SIZE`
- Bounds check: if `localY < 0` or `localY >= CHUNK_SIZE`, return `false`
- Return `this.grid[Math.floor(localY) * this.worldWidth + Math.floor(worldX)] === 1`

**Method: `draw(ctx: CanvasRenderingContext2D, cameraY: number, viewHeight: number, worldWidth: number)`**

- `chunkWorldY = this.chunkY * CHUNK_SIZE`
- `screenY = chunkWorldY - cameraY`
- Only draw if chunk is visible: `screenY < viewHeight && screenY + CHUNK_SIZE > 0`
- `ctx.drawImage(this.canvas, 0, screenY)`

---

### Rewrite: `french-digs/src/lib/game/Terrain.ts`

The new `Terrain` is a **manager** of `Chunk` objects. It holds a `Map<number, Chunk>` keyed by `chunkY`.

**Constructor:** `constructor(worldWidth: number, groundLevel: number)`

- Stores `worldWidth`, `groundLevel`
- `this.chunks = new Map<number, Chunk>()`
- `this.seed = Math.floor(Math.random() * 100000)` — one seed for the whole world
- Call `this.ensureChunksAround(0)` to pre-generate the starting area

**Method: `ensureChunksAround(playerWorldY: number)`**

This is the core chunk lifecycle method. Call it every frame from `Game.update()`.

```
currentChunkY = Math.floor(playerWorldY / CHUNK_SIZE)

// Keep chunks from (currentChunkY - 1) to (currentChunkY + 2) — 4 chunks
for chunkY from (currentChunkY - 1) to (currentChunkY + 2):
  if chunkY < 0: skip  // no terrain above the sky
  if !this.chunks.has(chunkY):
    create new Chunk(chunkY, this.worldWidth)
    chunk.generate(this.seed)
    this.chunks.set(chunkY, chunk)

// Evict chunks that are too far away (more than 3 chunks from player)
for each [chunkY, chunk] in this.chunks:
  if chunkY < currentChunkY - 2 or chunkY > currentChunkY + 3:
    this.chunks.delete(chunkY)
```

**Method: `isSolid(worldX: number, worldY: number): boolean`**

- If `worldY < 0`: return `false` (sky)
- `chunkY = Math.floor(worldY / CHUNK_SIZE)`
- `chunk = this.chunks.get(chunkY)`
- If chunk not loaded: return `true` (treat unloaded terrain as solid — safe default, prevents player falling into void)
- Return `chunk.isSolid(worldX, worldY)`

**Method: `dig(worldX: number, worldY: number, radius: number)`**

Digging can span two chunks if it crosses a chunk boundary. Handle this:

```
chunkY = Math.floor(worldY / CHUNK_SIZE)
// Check if circle bleeds into adjacent chunk
bottomWorldY = worldY + radius
topWorldY = worldY - radius
bottomChunkY = Math.floor(bottomWorldY / CHUNK_SIZE)
topChunkY = Math.floor(topWorldY / CHUNK_SIZE)

// Collect unique affected chunk indices
affected = Set of [topChunkY, chunkY, bottomChunkY]
for each affected chunkY:
  chunk = this.chunks.get(chunkY)
  if chunk exists: chunk.dig(worldX, worldY, radius)
```

**Method: `draw(ctx: CanvasRenderingContext2D, cameraY: number, viewHeight: number)`**

```
for each chunk in this.chunks.values():
  chunk.draw(ctx, cameraY, viewHeight, this.worldWidth)
```

**Property `width`:** Return `this.worldWidth` — kept for compatibility with `Player.ts` which uses `terrain.width` for horizontal bounds clamping.

**Remove:** The `resize()` method. World width is now fixed. Horizontal resizing of the world is not needed for infinite depth.

---

### Edit: `french-digs/src/lib/game/Game.ts`

**Remove:**

- `readonly worldHeight = 5000` — delete this line entirely
- The `worldHeight` argument passed to `wordManager.spawn()`

**Change `update()`:**
Add a call to chunk management after updating the player:

```typescript
// After this.player.update(...)
this.terrain.ensureChunksAround(this.player.y);
```

**Change `wordManager.spawn()` calls:**
The `spawn` method no longer takes `worldHeight`. Update both call sites:

```typescript
// Old:
this.wordManager.spawn(this.width, this.groundLevel, this.worldHeight);
// New:
this.wordManager.spawn(this.width, this.groundLevel, this.player.y);
```

The second argument `this.player.y` is the "player's current depth hint" — WordManager uses it to place the next word ahead of the player rather than at a fixed world bottom.

**No other changes needed in `Game.ts`.**

---

### Edit: `french-digs/src/lib/game/WordManager.ts`

**Change `spawn(worldWidth, groundLevel, playerY)` signature:**

Replace the `worldHeight` parameter with `playerY: number` (the player's current world Y position).

**New spawn position logic:**

```typescript
spawn(worldWidth: number, groundLevel: number, playerY: number) {
  this.currentWord = this.words[Math.floor(Math.random() * this.words.length)];

  const minX = 100;
  const maxX = worldWidth > 200 ? worldWidth - 100 : 100;

  // Place word 300–900px below the player's current position
  // This ensures the word is always ahead of the player, in unvisited terrain
  const minDepth = Math.max(groundLevel + 150, playerY + 300);
  const maxDepth = minDepth + 600;

  this.position = {
    x: minX + Math.random() * (maxX - minX),
    y: minDepth + Math.random() * (maxDepth - minDepth)
  };

  this.speak(this.currentWord);
}
```

**No other changes needed in `WordManager.ts`.**

---

## Checklist — Implementation Order

Implement in this order to avoid broken intermediate states:

1. **Create `Chunk.ts`** — fully standalone, can be tested in isolation
2. **Rewrite `Terrain.ts`** — depends on `Chunk.ts`
3. **Edit `WordManager.ts`** — change `spawn` signature only
4. **Edit `Game.ts`** — remove `worldHeight`, add `ensureChunksAround`, update `spawn` calls

---

## What Does NOT Change

- `Player.ts` — no changes. `terrain.isSolid()` and `terrain.width` still work identically.
- `Game.ts` camera logic — no changes. Camera still follows `player.y` smoothly.
- `Game.ts` HUD — no changes. Depth display (`player.y - groundLevel`) still works, now correctly shows unlimited depth.
- `display.html`, `server.js`, `index.tsx`, and everything in the `darts/` folder — completely unrelated.

---

## Key Numbers Summary

| Constant              | Value                                           | Reason                                                         |
| --------------------- | ----------------------------------------------- | -------------------------------------------------------------- |
| `CHUNK_SIZE`          | 512px                                           | Small enough to GC cheaply, large enough to reduce chunk count |
| `WORLD_WIDTH`         | 1024px (use `window.innerWidth` or fix at 1024) | Fixed horizontal, only depth is infinite                       |
| Loaded chunks         | 4 at a time                                     | ~1–2MB RAM total for grids                                     |
| `groundLevel`         | 200px                                           | Matches existing Game.ts value — sky height                    |
| Noise scale coarse    | `/120`                                          | Produces ~150px wide cave passages                             |
| Noise scale fine      | `/40`                                           | Adds roughness to cave walls                                   |
| Solid threshold range | 0.30–0.45                                       | Controls cave density by depth                                 |
| Word spawn offset     | 300–900px below player                          | Always ahead, never behind                                     |
