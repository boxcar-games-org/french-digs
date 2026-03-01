<script lang="ts">
	import { Game } from '$lib/game/Game';
	import { onMount } from 'svelte';

	let canvas: HTMLCanvasElement;
	let game: Game;

	onMount(() => {
		document.body.style.overflow = 'hidden';
		document.body.style.margin = '0';

		// Start the game logic
		if (canvas) {
			game = new Game(canvas);
		}

		return () => {
			if (game) game.destroy();
			document.body.style.overflow = '';
			document.body.style.margin = '';
		};
	});
</script>

<div class="game-container">
	<canvas bind:this={canvas}></canvas>
</div>

<style>
	:global(body),
	:global(html) {
		margin: 0;
		padding: 0;
		width: 100%;
		height: 100%;
		overflow: hidden;
		background-color: #87ceeb;
	}

	.game-container {
		position: fixed;
		top: 0;
		left: 0;
		width: 100vw;
		height: 100vh;
		background-color: #87ceeb;
		overflow: hidden;
		z-index: 999;
	}

	canvas {
		display: block;
		cursor: crosshair;
	}
</style>
