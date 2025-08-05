<script lang="ts">
	import '../app.css';
	import { page } from '$app/stores';
	
	let { children } = $props();
	let showModal = $state(false);
	
	// フッターを表示するページのパス
	let shouldShowFooter = $derived($page.route.id === '/' || $page.route.id === '/result');
	
	// デバッグ用
	$effect(() => {
		console.log('Current route:', $page.route.id, 'Show footer:', shouldShowFooter);
	});


	
	function toggleModal() {
		showModal = !showModal;
	}
	
	function closeModal(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			showModal = false;
		}
	}
</script>

<svelte:head>
	<title>Ascii-QR</title>
</svelte:head>

{@render children()}

<!-- Center Triangle Button - 特定ページでのみ表示 -->
{#if shouldShowFooter}
<div class="fixed left-1/2 transform -translate-x-1/2 z-40 transition-all duration-500 ease-in-out {showModal ? 'bottom-[30vh]' : 'bottom-8'}">
	<button 
		onclick={toggleModal}
		class="w-12 h-12 backdrop-blur-md bg-white/5 border border-white/50 rounded-full shadow-lg transition-all duration-300 flex items-center justify-center text-xl hover:bg-white/20 hover:shadow-xl hover:scale-105 {showModal ? 'text-white' : 'text-gray-200'}"
		style="backdrop-filter: blur(10px); box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);"
		aria-label="Who made this?"
	>
		{showModal ? '▽' : '^'}
	</button>
</div>

<!-- Sliding Modal from Bottom -->
<div class="fixed inset-x-0 bottom-0 z-50 transition-transform duration-500 ease-in-out {showModal ? 'translate-y-0' : 'translate-y-full'}">
	<div class="flex justify-center">
		<div 
			class="backdrop-blur-md bg-white/20 border-t border-white/100 rounded-t-3xl shadow-lg max-w-sm w-full mx-4 font-mono"
			style="backdrop-filter: blur(10px); box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.1); height: 30vh; min-height: 250px;"
		>

			
			<div class="px-6 pb-8 pt-4">
				<h2 id="modal-title" class="text-2xl font-bold text-white mb-6 text-center font-mono">Who made this?</h2>
				<div class="text-center  space-y-3">
					<p class="text-lg font-medium text-white font-mono">Created by:</p>
						<p class="font-bold text-xl text-white font-mono">Saka Hyuga</p>
						<p class="text-sm text-white mt-2 font-mono">Tokyo Metropolitan University, <br>Department of Industrial Art</p>

					<!-- other products link -->
					 <a href="https://lub.shiratsumu.jp" class="text-blue-500 hover:underline">lub.shiratsumu.jp(mada)</a>
				</div>
			</div>
		</div>
	</div>
</div>

<!-- Background overlay when modal is open -->
{#if showModal}
	<div 
		class="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 transition-opacity duration-300"
		onclick={toggleModal}
		onkeydown={(e) => e.key === 'Escape' && toggleModal()}
		role="button"
		tabindex="0"
		style="backdrop-filter: blur(2px);"
		aria-label="Close modal"
	></div>
{/if}
{/if}
