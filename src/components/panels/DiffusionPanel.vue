<template>
  <div class="diffusion-panel">
    <h3 class="panel-title">Knowledge Diffusion Analysis</h3>
    
    <div v-if="!hasYearFilter" class="empty-state">
      Select at least one publication year in the Temporal Filter (Left Panel) to analyze diffusion over time.
    </div>
    
    <div v-else>
      <div class="metrics-grid">
        <div class="metric-box">
          <span class="m-label">Selected Core Nodes</span>
          <span class="m-value">{{ store.filteredCoreNodes.length }}</span>
        </div>
        <div class="metric-box">
          <span class="m-label">Taxonomy Filter</span>
          <!-- Выводим собранный путь (хлебные крошки) -->
          <span class="m-value" style="font-size: 11px; margin-top: 4px; color: #5cb85c; line-height: 1.2;">
            {{ store.activeFilters.taxonomy ? store.activeFilters.taxonomy.pathString : 'All Domains' }}
          </span>
        </div>
      </div>
      
      <div v-if="store.diffusionStats && store.diffusionStats.length > 0" class="histogram-box">
        <span class="h-title">Concept Rooting (Citations by other core nodes over time)</span>
        <div class="bars-container">
          <div v-for="item in store.diffusionStats" :key="item.year" class="bar-row">
            <span class="bar-year">{{ item.year }}</span>
            <div class="bar-track">
              <div class="bar-fill" :style="{ width: getBarWidth(item.count) + '%' }"></div>
            </div>
            <span class="bar-count">{{ item.count }}</span>
          </div>
        </div>
      </div>
      
      <div v-else class="empty-state" style="margin-top: 10px;">
        No subsequent citations found in the core network for this selection.
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useGraphStore } from '../../store/graphStore.js'

const store = useGraphStore()

const hasYearFilter = computed(() => store.activeFilters.years.length > 0)

const maxCount = computed(() => {
  if (!store.diffusionStats || store.diffusionStats.length === 0) return 0
  return Math.max(...store.diffusionStats.map(d => d.count))
})

const getBarWidth = (count) => {
  if (maxCount.value === 0) return 0
  return (count / maxCount.value) * 100
}
</script>

<style scoped>
.diffusion-panel { background: rgba(15,15,25,0.9); border: 1px solid #00bfff; padding: 15px; border-radius: 6px; margin-bottom: 20px; box-shadow: 0 4px 15px rgba(0,191,255,0.1); }
.panel-title { color: #fff; font-size: 13px; margin: 0 0 10px 0; border-bottom: 1px dashed #444; padding-bottom: 5px; }
.empty-state { font-size: 11px; color: #888; font-style: italic; line-height: 1.4; }
.metrics-grid { display: flex; gap: 10px; margin-bottom: 15px; }
.metric-box { background: rgba(0, 191, 255, 0.05); border: 1px solid rgba(0, 191, 255, 0.2); padding: 8px; border-radius: 4px; flex: 1; text-align: center; }
.m-label { display: block; font-size: 10px; color: #aaa; text-transform: uppercase; }
.m-value { display: block; font-size: 18px; color: #00bfff; font-weight: bold; }

/* Histogram Styles */
.histogram-box { border-top: 1px solid #333; padding-top: 10px; }
.h-title { font-size: 11px; color: #ccc; margin-bottom: 8px; display: block; }
.bars-container { max-height: 180px; overflow-y: auto; padding-right: 5px; }
.bars-container::-webkit-scrollbar { width: 4px; }
.bars-container::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 2px; }
.bar-row { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.bar-year { font-size: 10px; color: #888; width: 30px; }
.bar-track { flex: 1; height: 8px; background: rgba(255,255,255,0.05); border-radius: 4px; overflow: hidden; }
.bar-fill { height: 100%; background: #00bfff; transition: width 0.3s ease; }
.bar-count { font-size: 10px; color: #ccc; width: 25px; text-align: right; }
</style>