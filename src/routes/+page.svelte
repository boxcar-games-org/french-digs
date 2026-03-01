<script lang="ts">
	import { goto } from '$app/navigation';

	function startGame() {
		goto('/french-digs/game');
	}
</script>

<div class="container">
	<h1>Dig Deep</h1>
	<p>Use your blaster to dig into the earth!</p>
	<button on:click={startGame}>Start Game</button>
</div>

<style>
	.container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		background: linear-gradient(to bottom, #87ceeb 0%, #6b8e23 100%);
		font-family: Arial, sans-serif;
	}

	h1 {
		color: white;
		font-size: 4rem;
		margin: 0;
		text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
	}

	p {
		color: white;
		font-size: 1.5rem;
		margin: 1rem 0 2rem 0;
	}

	button {
		padding: 1rem 3rem;
		font-size: 1.5rem;
		background-color: #ff6b35;
		color: white;
		border: none;
		border-radius: 8px;
		cursor: pointer;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
		transition: all 0.3s ease;
	}

	button:hover {
		background-color: #ff8555;
		transform: translateY(-2px);
		box-shadow: 0 6px 8px rgba(0, 0, 0, 0.4);
	}

	button:active {
		transform: translateY(0);
	}
</style>
