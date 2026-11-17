<script setup lang="ts">
import { onMounted, ref } from "vue";

defineProps<{
  /** The connected server's host */
  server: string | undefined;
  /** Whether this browser remembers the connection */
  remembered: boolean;
}>();

const emit = defineEmits<{ disconnect: []; close: [] }>();

const dialog = ref<HTMLDialogElement>();

// Cancel has focus first, so Enter alone keeps the connection
onMounted(() => dialog.value?.showModal());
</script>

<template>
  <dialog
    ref="dialog"
    class="dialog"
    aria-labelledby="disconnect-title"
    aria-describedby="disconnect-details"
    @close="emit('close')"
  >
    <div class="body">
      <header>
        <h2 id="disconnect-title">
          Disconnect from <code v-if="server">{{ server }}</code
          ><template v-else>this server</template>?
        </h2>
        <p id="disconnect-details" class="lede">
          The playground forgets your credentials<template v-if="remembered"
            >, including those remembered on this device</template
          >. Runs go back to mocked responses until you connect again. Your code stays as it is.
        </p>
      </header>

      <footer class="footer">
        <button type="button" class="button cancel" autofocus @click="dialog?.close()">
          Cancel
        </button>
        <button type="button" class="button danger" @click="emit('disconnect')">Disconnect</button>
      </footer>
    </div>
  </dialog>
</template>

<style scoped src="./dialog.css"></style>

<style scoped>
.button.danger {
  background: var(--vp-c-danger-1);
  color: var(--vp-c-bg);
}

.button.danger:hover {
  background: var(--vp-c-danger-2);
}
</style>
