<script lang="ts">
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	let { size = '1rem' }: { size?: string } = $props();
</script>

<LoaderCircle class="animate-spin" size={size} />
