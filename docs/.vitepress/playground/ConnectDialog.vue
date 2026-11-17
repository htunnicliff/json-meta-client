<script setup lang="ts">
import { onMounted, ref } from "vue";

import { checkConnection } from "./connect.ts";
import type { Connection } from "./protocol.ts";

const emit = defineEmits<{ connect: [connection: Connection]; close: [] }>();

const dialog = ref<HTMLDialogElement>();
const sessionUrl = ref("");
const method = ref<"bearer" | "basic">("bearer");
const token = ref("");
const username = ref("");
const password = ref("");
const substitute = ref(true);
const checking = ref(false);
const error = ref("");

onMounted(() => dialog.value?.showModal());

async function connect() {
  const connection: Connection = {
    sessionUrl: sessionUrl.value.trim(),
    auth:
      method.value === "bearer"
        ? token.value
        : { username: username.value, password: password.value },
    substitute: substitute.value,
  };
  checking.value = true;
  error.value = "";
  try {
    const result = await checkConnection(connection);
    if (result.ok) emit("connect", connection);
    else error.value = result.message;
  } finally {
    checking.value = false;
  }
}
</script>

<template>
  <dialog ref="dialog" class="dialog" aria-labelledby="connect-title" @close="emit('close')">
    <form class="body" @submit.prevent="connect">
      <header>
        <h2 id="connect-title">Connect a server</h2>
        <p class="lede">
          Responses come from a real JMAP server, so your code runs past its <code>await</code>s.
          The playground itself never answers method calls.
        </p>
      </header>

      <div class="fields">
        <label class="field">
          Session URL
          <input
            v-model="sessionUrl"
            type="url"
            required
            placeholder="https://mail.example.org/.well-known/jmap"
            autocomplete="off"
          />
        </label>
        <div class="methods" role="radiogroup" aria-label="Credentials">
          <label><input v-model="method" type="radio" value="bearer" /> Bearer token</label>
          <label><input v-model="method" type="radio" value="basic" /> Username and password</label>
        </div>
        <label v-if="method === 'bearer'" class="field">
          Bearer token
          <input v-model="token" type="password" required autocomplete="off" />
        </label>
        <template v-else>
          <label class="field">
            Username
            <input v-model="username" type="text" required autocomplete="off" />
          </label>
          <label class="field">
            Password
            <input v-model="password" type="password" required autocomplete="off" />
          </label>
        </template>
      </div>

      <p class="privacy">
        Your credentials stay in this tab's memory. They never go in the URL or in browser storage,
        and closing the tab or disconnecting forgets them.
      </p>
      <p v-if="error" class="error" role="alert">{{ error }}</p>

      <footer class="footer">
        <label class="substitute">
          <input v-model="substitute" type="checkbox" />
          Use for <code>sessionUrl</code> and <code>auth</code> in my code
        </label>
        <button type="button" class="button" @click="dialog?.close()">Cancel</button>
        <button type="submit" class="button primary" :disabled="checking">
          {{ checking ? "Connecting…" : "Connect" }}
        </button>
      </footer>
    </form>
  </dialog>
</template>

<style scoped>
.dialog {
  margin: auto;
  width: min(560px, calc(100vw - 32px));
  max-height: calc(100vh - 32px);
  padding: 0;
  border: 1px solid var(--vp-c-divider);
  border-radius: 14px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
}

.dialog::backdrop {
  background: rgba(0, 0, 0, 0.4);
}

.body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px 20px 0;
  font-size: 14px;
}

h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}

.lede {
  margin: 6px 0 0;
  color: var(--vp-c-text-2);
}

.fields {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-weight: 500;
}

.field input {
  padding: 6px 10px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg);
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
}

.methods {
  display: flex;
  gap: 16px;
}

.methods label {
  display: flex;
  align-items: center;
  gap: 6px;
}

.privacy {
  margin: 0;
  color: var(--vp-c-text-2);
}

.error {
  margin: 0;
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--vp-c-danger-soft);
  color: var(--vp-c-danger-1);
}

.footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin: 4px -20px 0;
  padding: 12px 20px;
  border-top: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
}

.substitute {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-right: auto;
}

.button {
  padding: 6px 14px;
  border-radius: 8px;
  background: var(--vp-button-alt-bg);
  font-weight: 500;
}

.button.primary {
  background: var(--vp-c-tip-1);
  color: var(--vp-c-bg);
}

.button:disabled {
  opacity: 0.6;
}
</style>
