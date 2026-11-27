<template>
  <span class="helptip-anchor" @click.stop>
    <button
      ref="triggerRef"
      type="button"
      class="helptip-btn"
      :class="{ active: isOpen }"
      @click.stop="toggle"
      :aria-label="entry ? `Explain ${entry.title}` : 'Help'"
      :title="entry ? `${entry.title} (click for details & references)` : 'Help'"
    >
      ?
    </button>

    <Teleport to="body">
      <div
        v-if="isOpen && entry"
        ref="popoverRef"
        class="helptip-popover"
        :style="popoverStyle"
        @click.stop
      >
        <div class="ht-header">
          <div class="ht-title-wrap">
            <span class="ht-title">{{ entry.title }}</span>
            <span v-if="entry.tag" class="ht-tag">{{ entry.tag }}</span>
          </div>
          <button type="button" class="ht-close" @click="close" aria-label="Close">✖</button>
        </div>

        <p class="ht-summary">{{ entry.summary }}</p>

        <div v-if="entry.formula" class="ht-block ht-formula-block">
          <span class="ht-block-label">Operationalization</span>
          <code class="ht-formula">{{ entry.formula }}</code>
        </div>

        <div v-if="entry.interpretation" class="ht-block">
          <span class="ht-block-label">How to read</span>
          <p class="ht-interp">{{ entry.interpretation }}</p>
        </div>

        <div v-if="entry.links && entry.links.length > 0" class="ht-links">
          <span class="ht-block-label">Further reading</span>
          <div class="ht-link-list">
            <a
              v-for="lnk in entry.links"
              :key="lnk.url"
              :href="lnk.url"
              target="_blank"
              rel="noopener noreferrer"
              class="ht-link"
            >
              ↗ {{ lnk.label }}
            </a>
          </div>
        </div>
      </div>
    </Teleport>
  </span>
</template>

<script setup>
import { ref, computed, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { GLOSSARY } from '../../utils/glossary.js'

const props = defineProps({
  term: {
    type: String,
    required: true
  }
})

const triggerRef = ref(null)
const popoverRef = ref(null)
const isOpen = ref(false)
const popoverStyle = ref({ top: '0px', left: '0px' })

const entry = computed(() => GLOSSARY[props.term] || null)

const positionPopover = () => {
  if (!triggerRef.value) return
  const rect = triggerRef.value.getBoundingClientRect()
  const popWidth = 330
  const popHeight = popoverRef.value ? popoverRef.value.offsetHeight : 230
  const margin = 12

  let left = rect.left + rect.width / 2 - popWidth / 2
  if (left < margin) left = margin
  if (left + popWidth > window.innerWidth - margin) {
    left = window.innerWidth - popWidth - margin
  }

  let top = rect.bottom + 8
  if (top + popHeight > window.innerHeight - margin) {
    top = rect.top - popHeight - 8
  }
  if (top < margin) top = margin

  popoverStyle.value = {
    top: `${Math.round(top)}px`,
    left: `${Math.round(left)}px`,
    width: `${popWidth}px`
  }
}

const close = () => {
  isOpen.value = false
}

const toggle = () => {
  if (isOpen.value) {
    close()
    return
  }
  // Close any other open HelpTip popovers cleanly
  window.dispatchEvent(new CustomEvent('helptip:close-all'))
  isOpen.value = true
  nextTick(() => {
    positionPopover()
  })
}

const onDocumentClick = (e) => {
  if (!isOpen.value) return
  if (triggerRef.value?.contains(e.target)) return
  if (popoverRef.value?.contains(e.target)) return
  close()
}

const onKeyDown = (e) => {
  if (e.key === 'Escape' && isOpen.value) close()
}

const onCloseAll = () => {
  if (isOpen.value) close()
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('keydown', onKeyDown)
  window.addEventListener('helptip:close-all', onCloseAll)
  window.addEventListener('resize', close)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('helptip:close-all', onCloseAll)
  window.removeEventListener('resize', close)
})
</script>

<style scoped>
.helptip-anchor {
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
  margin-left: 5px;
}

.helptip-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 15px;
  height: 15px;
  padding: 0;
  border-radius: 50%;
  background: #25283a;
  color: #a5b4fc;
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
  border: 1px solid #4c5270;
  cursor: pointer;
  user-select: none;
  transition: all 0.15s ease;
  font-family: inherit;
}

.helptip-btn:hover,
.helptip-btn.active {
  background: rgba(0, 191, 255, 0.22);
  border-color: #00bfff;
  color: #fff;
}
</style>

<style>
.helptip-popover {
  position: fixed;
  z-index: 9999;
  background: rgba(14, 17, 29, 0.98);
  border: 1px solid #00bfff;
  border-radius: 8px;
  padding: 12px 14px;
  color: #e5e7eb;
  font-size: 11.5px;
  line-height: 1.48;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.72), 0 0 16px rgba(0, 191, 255, 0.18);
  backdrop-filter: blur(8px);
  text-align: left;
  text-transform: none;
  font-weight: normal;
  box-sizing: border-box;
}

.helptip-popover .ht-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
  padding-bottom: 6px;
  border-bottom: 1px dashed rgba(255, 255, 255, 0.14);
}

.helptip-popover .ht-title-wrap {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.helptip-popover .ht-title {
  font-size: 12.5px;
  font-weight: 700;
  color: #00bfff;
}

.helptip-popover .ht-tag {
  display: inline-block;
  align-self: flex-start;
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  padding: 1px 6px;
  border-radius: 3px;
  background: rgba(0, 191, 255, 0.12);
  border: 1px solid rgba(0, 191, 255, 0.3);
  color: #7dd3fc;
}

.helptip-popover .ht-close {
  background: transparent;
  border: none;
  color: #888;
  cursor: pointer;
  font-size: 12px;
  padding: 0 2px;
  line-height: 1;
}

.helptip-popover .ht-close:hover {
  color: #fff;
}

.helptip-popover .ht-summary {
  margin: 0 0 8px 0;
  color: #d1d5db;
  font-size: 11.5px;
}

.helptip-popover .ht-block {
  margin-bottom: 8px;
}

.helptip-popover .ht-block-label {
  display: block;
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #9ca3af;
  font-weight: 700;
  margin-bottom: 3px;
}

.helptip-popover .ht-formula {
  display: block;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10.5px;
  background: rgba(0, 191, 255, 0.08);
  border: 1px solid rgba(0, 191, 255, 0.25);
  color: #7dd3fc;
  padding: 5px 7px;
  border-radius: 4px;
  word-break: break-word;
}

.helptip-popover .ht-interp {
  margin: 0;
  font-size: 11px;
  color: #cbd5e1;
}

.helptip-popover .ht-links {
  padding-top: 6px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.helptip-popover .ht-link-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.helptip-popover .ht-link {
  display: inline-block;
  font-size: 10.5px;
  color: #f0ad4e;
  background: rgba(240, 173, 78, 0.1);
  border: 1px solid rgba(240, 173, 78, 0.35);
  padding: 2px 7px;
  border-radius: 4px;
  text-decoration: none;
  transition: all 0.15s ease;
}

.helptip-popover .ht-link:hover {
  background: rgba(240, 173, 78, 0.25);
  color: #fff;
}
</style>
