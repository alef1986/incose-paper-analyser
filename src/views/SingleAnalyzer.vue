<!-- src/views/SingleAnalyzer.vue -->
<template>
  <div class="analyzer-container">
    <!-- Filter Funnel Bar -->
    <div class="filter-funnel-bar" v-if="store.isLoaded">
      <div class="funnel-step">
        <span class="step-label">Base Network:</span>
        <span class="step-val">{{ store.metrics.originalCoreCount }} Core / {{ (store.metrics.originalEnvCount || 0) + (store.metrics.originalCanonCount || 0) }} Env</span>
      </div>

      <span class="funnel-arrow">➔</span>

      <div class="funnel-step" :class="{ 'highlight-structural': store.metrics.isCitationFilterActive }">
        <span class="step-label">Structural Filters:</span>
        <span class="step-val">{{ store.metrics.coreCount }} Core / {{ (store.metrics.envCount || 0) + (store.metrics.canonCount || 0) }} Env</span>
      </div>

      <span class="funnel-arrow">➔</span>

      <div class="funnel-step" :class="{ 'highlight-slice': hasActiveSlice }">
        <span class="step-label">Active Slice:</span>
        <span class="step-val">{{ store.filteredCoreNodes.length }} Core</span>
        <template v-if="hasActiveSlice">
          <span v-if="sliceTaxonomyText" class="slice-tag" :title="sliceTaxonomyText">{{ sliceTaxonomyText }}</span>
          <span v-if="sliceYearsText" class="slice-tag">{{ sliceYearsText }}</span>
          <button class="reset-slice-btn" @click="resetSlice" title="Clear slice filters and selection">
            [✖ Reset Slice]
          </button>
        </template>
      </div>
    </div>

    <ForceGraph3D />
    <EgoPanel />
    <MetricsPanel />
    <NodeInfoModal /> <!-- Внедряем меню поверх графа -->
    
    <div id="empty-state" v-if="!store.focusedNodeId && !store.isLoaded">
      Upload JSON and select a node from the right panel to build its cluster (Radius = 1).
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useGraphStore } from '../store/graphStore.js'
import ForceGraph3D from '../components/visualization/ForceGraph3D.vue'
import EgoPanel from '../components/panels/EgoPanel.vue'
import MetricsPanel from '../components/panels/MetricsPanel.vue'
import NodeInfoModal from '../components/modals/NodeInfoModal.vue'

const store = useGraphStore()

const hasActiveSlice = computed(() => {
  return !!store.activeFilters.taxonomy || (store.activeFilters.years && store.activeFilters.years.length > 0)
})

const sliceTaxonomyText = computed(() => {
  if (!store.activeFilters.taxonomy) return ''
  return store.activeFilters.taxonomy.pathString || store.activeFilters.taxonomy.name || ''
})

const sliceYearsText = computed(() => {
  const yrs = store.activeFilters.years
  if (!yrs || yrs.length === 0) return ''
  if (yrs.length === 1) return `${yrs[0]}`
  const min = Math.min(...yrs)
  const max = Math.max(...yrs)
  return `${min}–${max}`
})

const resetSlice = () => {
  store.activeFilters.years = []
  store.activeFilters.taxonomy = null
  store.focusedNodeId = null
  store.focusedClique = null
}
</script>

<style scoped>
.analyzer-container {
  width: 100vw;
  height: 100vh;
  position: relative;
}

#empty-state {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #555566;
  font-size: 18px;
  z-index: 0;
  text-align: center;
}

/* Filter Funnel Bar */
.filter-funnel-bar {
  position: fixed;
  top: 12px;
  left: 370px;
  right: 360px;
  z-index: 20;
  pointer-events: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: rgba(18, 20, 28, 0.82);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 6px;
  padding: 6px 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  font-size: 11px;
  color: #bbb;
  user-select: none;
  overflow-x: auto;
  white-space: nowrap;
}

.filter-funnel-bar::-webkit-scrollbar {
  display: none;
}

.funnel-step {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.step-label {
  font-size: 10px;
  color: #777;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.step-val {
  font-weight: 600;
  color: #eee;
}

.funnel-arrow {
  color: #666;
  font-size: 11px;
  flex-shrink: 0;
}

.highlight-structural .step-label {
  color: #00bfff;
}
.highlight-structural .step-val {
  color: #00bfff;
  text-shadow: 0 0 8px rgba(0, 191, 255, 0.4);
}

.highlight-slice .step-val {
  color: #a3e635;
}

.slice-tag {
  background: rgba(0, 191, 255, 0.15);
  border: 1px solid rgba(0, 191, 255, 0.4);
  color: #00bfff;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 10px;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reset-slice-btn {
  background: rgba(239, 68, 68, 0.18);
  border: 1px solid rgba(239, 68, 68, 0.5);
  color: #fca5a5;
  border-radius: 3px;
  padding: 1px 6px;
  font-size: 10px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-left: 2px;
}

.reset-slice-btn:hover {
  background: rgba(239, 68, 68, 0.35);
  color: #fff;
  border-color: #ef4444;
}
</style>