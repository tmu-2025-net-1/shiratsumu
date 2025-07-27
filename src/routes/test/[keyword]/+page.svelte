<script lang="ts">
	import { page } from '$app/stores';

	// サーバーサイドから取得したデータ
	export let data: {
		img: string;
		alt: string;
		keyword: string;
	};

	let imageUrl = data.img;
	let altText = data.alt;
	let keyword = data.keyword;
	let loading = false;
	let error = '';
</script>

<div class="container">
	<h1>Unsplash API Test for "{keyword}"</h1>
	
	{#if loading}
		<p>Loading image...</p>
	{:else if error}
		<p class="error">Error: {error}</p>
	{:else if imageUrl}
		<div class="image-container">
			<img src={imageUrl} alt={altText} />
			<p class="image-info">
				<strong>Alt text:</strong> {altText}
			</p>
			<p class="image-info">
				<strong>Image URL:</strong> <a href={imageUrl} target="_blank" rel="noopener noreferrer">{imageUrl}</a>
			</p>
		</div>
	{:else}
		<p>No image found</p>
	{/if}
</div>

<style>
	.container {
		max-width: 800px;
		margin: 0 auto;
		padding: 20px;
		font-family: Arial, sans-serif;
	}

	h1 {
		color: #333;
		text-align: center;
	}

	.image-container {
		text-align: center;
	}

	img {
		max-width: 100%;
		height: auto;
		border: 1px solid #ddd;
		border-radius: 8px;
		box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
	}

	.image-info {
		margin: 10px 0;
		font-size: 14px;
		color: #666;
	}

	.image-info a {
		color: #0066cc;
		word-break: break-all;
	}

	.error {
		color: #d32f2f;
		font-weight: bold;
		text-align: center;
	}

	p {
		text-align: center;
	}
</style>