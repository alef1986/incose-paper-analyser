<template>
  <div v-if="!store.isLoaded" class="access-gate-overlay">
    <div class="access-gate-card">
      <div class="gate-header">
        <span class="gate-badge">Encrypted Research Preview</span>
        <h1 class="gate-title">INCOSE Bibliometric Workbench — Protected Research Preview</h1>
        <p class="gate-subtitle">
          Enter your access key to decrypt and load the bundled dataset (<code>data.enc</code>) locally in your browser, or load a local unencrypted JSON file.
        </p>
      </div>

      <!-- Access Key Unlock Form -->
      <div class="gate-form">
        <label class="gate-label" for="access-key-input">Access Key</label>
        <div class="input-row">
          <div class="password-wrap">
            <input
              id="access-key-input"
              :type="showPassword ? 'text' : 'password'"
              v-model="accessKey"
              @keyup.enter="unlock()"
              :disabled="isUnlocking"
              placeholder="Enter research access key..."
              class="gate-input"
              autocomplete="off"
              spellcheck="false"
            />
            <button
              type="button"
              class="toggle-eye-btn"
              @click="showPassword = !showPassword"
              :disabled="isUnlocking"
              :title="showPassword ? 'Hide key' : 'Show key'"
            >
              {{ showPassword ? '🙈' : '👁' }}
            </button>
          </div>
          <button
            type="button"
            class="unlock-btn"
            @click="unlock()"
            :disabled="isUnlocking || !accessKey.trim()"
          >
            {{ isUnlocking ? 'Unlocking...' : '🔓 Unlock Dataset' }}
          </button>
        </div>

        <div v-if="isUnlocking && statusMessage" class="status-box">
          <span class="spinner"></span>
          <span>{{ statusMessage }}</span>
        </div>

        <div v-if="errorMessage" class="error-box">
          <span>⚠️ {{ errorMessage }}</span>
        </div>
      </div>

      <!-- Divider -->
      <div class="gate-divider">
        <span>— or —</span>
      </div>

      <!-- Fallback Local JSON Loader -->
      <div class="local-loader">
        <input
          ref="localFileInput"
          type="file"
          accept="application/json"
          class="hidden-file-input"
          @change="onLocalFileSelected"
        />
        <button
          type="button"
          class="local-btn"
          @click="triggerLocalFile"
          :disabled="isUnlocking"
        >
          📂 Load Local Unencrypted JSON
        </button>
        <p class="local-hint">
          Work offline with any local OpenAlex/Crossref JSON graph without requiring <code>data.enc</code>.
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useGraphStore } from '../../store/graphStore.js'
import { fetchAndDecryptDataset } from '../../utils/cryptoLoader.js'

const SESSION_KEY = 'incose_access_key'

const store = useGraphStore()
const accessKey = ref('')
const showPassword = ref(false)
const isUnlocking = ref(false)
const statusMessage = ref('')
const errorMessage = ref('')
const localFileInput = ref(null)

const unlock = async (overrideKey = null) => {
  const keyToUse = (overrideKey !== null ? overrideKey : accessKey.value).trim()
  if (!keyToUse || isUnlocking.value) return

  isUnlocking.value = true
  errorMessage.value = ''
  statusMessage.value = 'Initializing...'

  try {
    const json = await fetchAndDecryptDataset(keyToUse, './data.enc', (msg) => {
      statusMessage.value = msg
    })
    sessionStorage.setItem(SESSION_KEY, keyToUse)
    statusMessage.value = 'Building citation graph...'
    store.loadGraphData(json)
  } catch (err) {
    sessionStorage.removeItem(SESSION_KEY)
    errorMessage.value = err?.message || 'Failed to unlock dataset.'
  } finally {
    isUnlocking.value = false
    statusMessage.value = ''
  }
}

const triggerLocalFile = () => {
  if (localFileInput.value) {
    localFileInput.value.value = ''
    localFileInput.value.click()
  }
}

const onLocalFileSelected = (e) => {
  const file = e.target.files?.[0]
  if (!file) return

  isUnlocking.value = true
  errorMessage.value = ''
  statusMessage.value = `Reading ${file.name}...`

  const reader = new FileReader()
  reader.onload = (evt) => {
    try {
      const json = JSON.parse(evt.target.result)
      store.loadGraphData(json)
    } catch (err) {
      errorMessage.value = 'Failed to parse local JSON file.'
      console.error(err)
    } finally {
      isUnlocking.value = false
      statusMessage.value = ''
    }
  }
  reader.onerror = () => {
    errorMessage.value = 'Failed to read the selected file.'
    isUnlocking.value = false
    statusMessage.value = ''
  }
  reader.readAsText(file)
}

onMounted(() => {
  // 1. Check URL hash for #key=...
  const rawHash = window.location.hash ? window.location.hash.slice(1) : ''
  if (rawHash) {
    const params = new URLSearchParams(rawHash)
    const hashKey = params.get('key')
    if (hashKey) {
      // Immediately strip key from the visible address bar
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
      sessionStorage.setItem(SESSION_KEY, hashKey)
      accessKey.value = hashKey
      unlock(hashKey)
      return
    }
  }

  // 2. Fallback to sessionStorage for same-tab reloads
  const savedKey = sessionStorage.getItem(SESSION_KEY)
  if (savedKey) {
    accessKey.value = savedKey
    unlock(savedKey)
  }
})
</script>

<style scoped>
.access-gate-overlay {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle at center, rgba(16, 20, 36, 0.94) 0%, rgba(5, 5, 16, 0.98) 100%);
  backdrop-filter: blur(8px);
  padding: 20px;
}

.access-gate-card {
  width: 520px;
  max-width: 94vw;
  background: rgba(15, 17, 28, 0.96);
  border: 1px solid rgba(0, 191, 255, 0.55);
  border-radius: 10px;
  padding: 28px 30px;
  box-shadow: 0 0 40px rgba(0, 191, 255, 0.18), 0 12px 32px rgba(0, 0, 0, 0.65);
  color: #eee;
  box-sizing: border-box;
}

.gate-header {
  text-align: center;
  margin-bottom: 22px;
}

.gate-badge {
  display: inline-block;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.8px;
  text-transform: uppercase;
  padding: 3px 9px;
  border-radius: 12px;
  background: rgba(0, 191, 255, 0.14);
  border: 1px solid rgba(0, 191, 255, 0.4);
  color: #00bfff;
  margin-bottom: 10px;
}

.gate-title {
  margin: 0 0 8px 0;
  font-size: 18px;
  font-weight: 700;
  color: #fff;
  line-height: 1.3;
}

.gate-subtitle {
  margin: 0;
  font-size: 12px;
  color: #9ca3af;
  line-height: 1.5;
}

.gate-subtitle code,
.local-hint code {
  font-family: monospace;
  font-size: 11px;
  color: #7dd3fc;
  background: rgba(255, 255, 255, 0.06);
  padding: 1px 5px;
  border-radius: 3px;
}

.gate-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.gate-label {
  font-size: 10.5px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #9ca3af;
  font-weight: 600;
}

.input-row {
  display: flex;
  gap: 8px;
}

.password-wrap {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
}

.gate-input {
  width: 100%;
  box-sizing: border-box;
  background: rgba(0, 0, 0, 0.45);
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 5px;
  color: #fff;
  padding: 10px 34px 10px 12px;
  font-size: 13px;
  font-family: inherit;
  transition: border-color 0.2s ease;
}

.gate-input:focus {
  outline: none;
  border-color: #00bfff;
  box-shadow: 0 0 0 2px rgba(0, 191, 255, 0.15);
}

.gate-input:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.toggle-eye-btn {
  position: absolute;
  right: 8px;
  background: transparent;
  border: none;
  color: #888;
  cursor: pointer;
  font-size: 13px;
  padding: 2px 4px;
}

.toggle-eye-btn:hover:not(:disabled) {
  color: #fff;
}

.unlock-btn {
  padding: 10px 16px;
  background: rgba(0, 191, 255, 0.2);
  border: 1px solid #00bfff;
  border-radius: 5px;
  color: #00bfff;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s ease;
  font-family: inherit;
}

.unlock-btn:hover:not(:disabled) {
  background: #00bfff;
  color: #050510;
  box-shadow: 0 0 12px rgba(0, 191, 255, 0.35);
}

.unlock-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.status-box {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 5px;
  background: rgba(0, 191, 255, 0.08);
  border: 1px dashed rgba(0, 191, 255, 0.4);
  color: #7dd3fc;
  font-size: 11.5px;
  margin-top: 4px;
}

.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(0, 191, 255, 0.25);
  border-top-color: #00bfff;
  border-radius: 50%;
  animation: spin 0.75s linear infinite;
  flex-shrink: 0;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.error-box {
  padding: 9px 12px;
  border-radius: 5px;
  background: rgba(217, 83, 79, 0.16);
  border: 1px solid rgba(217, 83, 79, 0.6);
  color: #fca5a5;
  font-size: 11.5px;
  margin-top: 4px;
}

.gate-divider {
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 20px 0 16px 0;
  color: #6b7280;
  font-size: 11px;
  letter-spacing: 0.5px;
}

.local-loader {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.hidden-file-input {
  display: none;
}

.local-btn {
  width: 100%;
  padding: 9px 14px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 5px;
  color: #d1d5db;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: inherit;
}

.local-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(255, 255, 255, 0.4);
  color: #fff;
}

.local-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.local-hint {
  margin: 0;
  font-size: 10.5px;
  color: #6b7280;
  text-align: center;
}
</style>
