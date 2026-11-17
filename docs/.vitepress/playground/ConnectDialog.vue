<script setup lang="ts">
import { onMounted, ref } from "vue";

import { checkConnection } from "./connect.ts";
import type { Connection } from "./protocol.ts";

const emit = defineEmits<{ connect: [connection: Connection, remember: boolean]; close: [] }>();

const dialog = ref<HTMLDialogElement>();
const method = ref<"bearer" | "basic">("bearer");
const remember = ref(false);
const checking = ref(false);
const error = ref("");

onMounted(() => dialog.value?.showModal());

async function connect(event: SubmitEvent) {
  // Password managers can fill fields without dispatching input events.
  const fields = new FormData(event.currentTarget as HTMLFormElement);
  const connection: Connection = {
    sessionUrl: String(fields.get("session-url")).trim(),
    auth:
      method.value === "bearer"
        ? String(fields.get("credential"))
        : { username: String(fields.get("username")), password: String(fields.get("password")) },
  };
  checking.value = true;
  error.value = "";
  try {
    const result = await checkConnection(connection);
    if (result.ok) emit("connect", connection, remember.value);
    else error.value = result.message;
  } finally {
    checking.value = false;
  }
}
</script>

<template>
  <dialog ref="dialog" class="dialog" aria-labelledby="connect-title" @close="emit('close')">
    <form id="jmap-connect-form" class="body" method="post" @submit.prevent="connect">
      <header>
        <h2 id="connect-title">Connect a server</h2>
        <p class="lede">
          Responses come from a real JMAP server, so your code runs past each <code>await</code>.
          The playground itself never answers method calls.
        </p>
      </header>

      <div class="fields">
        <label class="field" for="jmap-session-url">
          Session URL
          <input
            id="jmap-session-url"
            name="session-url"
            type="url"
            required
            placeholder="https://mail.example.org/.well-known/jmap"
            autocomplete="on"
            autocapitalize="none"
            autocorrect="off"
            spellcheck="false"
          />
        </label>
        <div class="methods" role="radiogroup" aria-label="Credentials">
          <label for="jmap-auth-bearer">
            <input
              id="jmap-auth-bearer"
              v-model="method"
              name="auth-method"
              type="radio"
              value="bearer"
            />
            Bearer token
          </label>
          <label for="jmap-auth-basic">
            <input
              id="jmap-auth-basic"
              v-model="method"
              name="auth-method"
              type="radio"
              value="basic"
            />
            Username and password
          </label>
        </div>
        <label v-show="method === 'bearer'" class="field" for="jmap-api-token">
          Bearer token
          <input
            id="jmap-api-token"
            name="credential"
            type="password"
            :disabled="method !== 'bearer'"
            required
            autocomplete="on"
          />
        </label>
        <div v-show="method === 'basic'" class="fields">
          <label class="field" for="jmap-username">
            Username
            <input
              id="jmap-username"
              name="username"
              type="text"
              :disabled="method !== 'basic'"
              required
              autocomplete="username"
              autocapitalize="none"
              autocorrect="off"
              spellcheck="false"
            />
          </label>
          <label class="field" for="jmap-password">
            Password
            <input
              id="jmap-password"
              name="password"
              type="password"
              :disabled="method !== 'basic'"
              required
              autocomplete="current-password"
            />
          </label>
        </div>
      </div>

      <p class="placeholders">
        Connecting fills in the placeholders of your code: a <code>sessionUrl</code> with
        <code>&lt;server&gt;</code> becomes this Session URL, and <code>auth: "&lt;token&gt;"</code>
        these credentials. Other values are used as written.
      </p>

      <label class="remember" for="jmap-remember-connection">
        <input
          id="jmap-remember-connection"
          v-model="remember"
          name="remember-connection"
          type="checkbox"
        />
        Remember on this device
      </label>
      <p v-if="remember" class="privacy warning">
        Your credentials are saved in plain text in this browser's local storage, so you stay
        connected after reloading. Anything that can read this site's storage in this browser can
        read them. Disconnecting forgets them. Prefer a token you can revoke.
      </p>
      <p v-else class="privacy">
        The playground keeps your credentials in this tab's memory, out of the URL and browser
        storage. Closing the tab or disconnecting forgets them.
      </p>
      <p v-if="error" class="error" role="alert">{{ error }}</p>

      <footer class="footer">
        <button type="button" class="button cancel" @click="dialog?.close()">Cancel</button>
        <button type="submit" class="button primary" :disabled="checking">
          {{ checking ? "Connecting…" : "Connect" }}
        </button>
      </footer>
    </form>
  </dialog>
</template>

<style scoped src="./dialog.css"></style>

<style scoped>
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
  border: 1px solid var(--site-c-control-border);
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

.remember {
  display: flex;
  align-items: center;
  gap: 6px;
}

.privacy.warning {
  color: var(--vp-c-warning-1);
}

.placeholders,
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
</style>
