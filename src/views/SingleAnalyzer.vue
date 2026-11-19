<!-- src/views/SingleAnalyzer.vue -->
<template>
  <div class="analyzer-container">
    <!-- Filter Funnel Bar -->
    <div class="filter-funnel-bar" v-if="store.isLoaded">
      <div class="funnel-row">
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

      <div class="funnel-divider"></div>

      <!-- Quick Use-Case Presets Row -->
      <div class="preset-row">
        <span class="preset-label">Guided Discovery:</span>
        <button 
          class="preset-btn" 
          :class="{ active: store.activePreset === 'bridges' }"
          @click="store.applyUseCasePreset('bridges')"
          title="Shows only external domains and papers backed by verified INCOSE Translators, switching 3D view to Translation Flow."
        >
          🌉 Domain Translators
        </button>
        <button 
          class="preset-btn" 
          :class="{ active: store.activePreset === 'classics' }"
          @click="store.applyUseCasePreset('classics')"
          title="Finds foundational external sources cited across 8+ years by independent author teams."
        >
          🏛 Time-Tested Classics
        </button>
        <button 
          class="preset-btn" 
          :class="{ active: store.activePreset === 'frontier' }"
          @click="store.applyUseCasePreset('frontier')"
          title="Focuses on knowledge imported during the most recent 5 years."
        >
          🔥 Recent 5Y Frontier
        </button>
        <button 
          class="preset-btn blindspots-btn" 
          :class="{ active: store.activePreset === 'blindspots' }"
          @click="store.applyUseCasePreset('blindspots')"
          title="Opens macroscopic table comparing Rejection Rate and Epistemic Lag across all external sciences."
        >
          👁 Blind Spots Matrix
        </button>
        <button 
          class="preset-btn longitudinal-btn" 
          :class="{ active: store.isLongitudinalOpen }"
          @click="store.isLongitudinalOpen = true"
          title="Opens 30-Year Longitudinal Trends: Operational Closure, Price Index, Epistemic Lag, and Shannon Diversity."
        >
          📈 30Y Trends
        </button>
        <button 
          class="preset-btn reset-btn" 
          @click="store.applyUseCasePreset('reset')"
          title="Reset all advanced filters, slices, and presets"
        >
          ↺ Reset All
        </button>
      </div>

      <!-- Preset Contextual Guidance Banner -->
      <div v-if="presetHintText" class="preset-hint-banner">
        <span class="preset-hint-text" :title="presetHintText">{{ presetHintText }}</span>
      </div>
    </div>

    <ForceGraph3D />
    <EgoPanel />
    <MetricsPanel />
    <NodeInfoModal /> <!-- Внедряем меню поверх графа -->
    <BlindSpotsModal />
    <LongitudinalModal />
    
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
import BlindSpotsModal from '../components/modals/BlindSpotsModal.vue'
import LongitudinalModal from '../components/modals/LongitudinalModal.vue'

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

const presetHintText = computed(() => {
  switch (store.activePreset) {
    case 'bridges':
      return '🌉 Domain Translators active: Showing only realized imports backed by True Translators. Click any Sunburst sector to find top guide papers.'
    case 'classics':
      return '🏛 Time-Tested Classics active: Network pruned to sources cited across 8+ yrs by independent teams. Click any Sunburst sector to inspect classics by discipline.'
    case 'frontier':
      return '🔥 Recent 5Y Frontier active: Focused on the 5 most recent publication years. Browse Context Subgraph Hubs or click Sunburst to inspect emerging topics.'
    default:
      return null
  }
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
  top: 10px;
  left: 370px;
  right: 360px;
  z-index: 20;
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  background: rgba(18, 20, 28, 0.9);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 6px;
  padding: 5px 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  font-size: 11px;
  color: #bbb;
  user-select: none;
  max-height: 108px;
}

.funnel-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  overflow-x: auto;
  white-space: nowrap;
}

.funnel-row::-webkit-scrollbar {
  display: none;
}

.funnel-divider {
  width: 100%;
  height: 1px;
  background: rgba(255, 255, 255, 0.08);
}

.preset-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  flex-wrap: wrap;
}

.preset-label {
  font-size: 10px;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 600;
  margin-right: 2px;
}

.preset-btn {
  padding: 3px 8px;
  font-size: 11px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 4px;
  color: #ddd;
  cursor: pointer;
  transition: all 0.2s ease;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-family: inherit;
  white-space: nowrap;
}

.preset-btn:hover {
  background: rgba(0, 191, 255, 0.15);
  border-color: rgba(0, 191, 255, 0.4);
  color: #fff;
}

.preset-btn.active {
  background: rgba(0, 191, 255, 0.25);
  border-color: #00bfff;
  color: #00bfff;
  box-shadow: 0 0 8px rgba(0, 191, 255, 0.3);
  font-weight: 600;
}

.preset-btn.blindspots-btn:hover,
.preset-btn.blindspots-btn.active {
  background: rgba(255, 170, 0, 0.2);
  border-color: #ffaa00;
  color: #ffaa00;
  box-shadow: 0 0 8px rgba(255, 170, 0, 0.3);
}

.preset-btn.longitudinal-btn:hover,
.preset-btn.longitudinal-btn.active {
  background: rgba(192, 132, 252, 0.2);
  border-color: #c084fc;
  color: #c084fc;
  box-shadow: 0 0 8px rgba(192, 132, 252, 0.3);
}

.preset-btn.reset-btn:hover {
  background: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.6);
  color: #fca5a5;
}

.preset-hint-banner {
  width: 100%;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px 8px;
  background: rgba(0, 191, 255, 0.08);
  border: 1px dashed rgba(0, 191, 255, 0.35);
  border-radius: 4px;
}

.preset-hint-text {
  font-size: 10px;
  color: #7dd3fc;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: center;
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