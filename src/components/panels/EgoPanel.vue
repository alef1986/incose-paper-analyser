<template>
  <div class="ego-panel" id="left-panel">
    <h2 class="panel-heading">Ego-Network Visualiser</h2>

    <!-- Загрузка и сохранение -->
    <div class="control-group">
      <input type="file" @change="onFileSelected" accept="application/json" class="file-input" />
      <button v-if="store.isLoaded && store.isVizActive" class="btn danger-btn" @click="toggleViz">Disable graph rendering</button>
      <button v-if="store.isLoaded && !store.isVizActive" class="btn success-btn" @click="toggleViz">Enable graph rendering</button>
      <button v-if="store.isLoaded" class="btn success-btn" @click="exportJSON">Save edited JSON</button>
    </div>

    <!-- System Metrics -->
    <div v-if="store.isLoaded" class="analytics-section">
      <h3 class="section-title collapsible-header" @click="isSystemMetricsOpen = !isSystemMetricsOpen">
        System Metrics
        <span class="toggle-icon">{{ isSystemMetricsOpen ? '▼' : '▶' }}</span>
      </h3>
      
      <div v-show="isSystemMetricsOpen" class="collapsible-content">
        <div class="flex-row" style="margin-bottom: 10px;">
          <div class="metric-card"><div class="metric-title">Total Nodes</div><div class="metric-value">{{ store.metrics.totalNodes }}</div></div>
          <div class="metric-card"><div class="metric-title">Total Edges</div><div class="metric-value">{{ store.metrics.totalEdges }}</div></div>
        </div>
        
        <div class="flex-row">
          <div class="metric-card core-border"><div class="metric-title">Core</div><div class="metric-value">{{ store.metrics.coreCount }}</div></div>
          <div class="metric-card canon-border"><div class="metric-title">Canon</div><div class="metric-value canon-text">{{ store.metrics.canonCount }}</div></div>
          <div class="metric-card env-border"><div class="metric-title">Env</div><div class="metric-value env-text">{{ store.metrics.envCount }}</div></div>
        </div>
      </div>
    </div>

    <!-- Настройки Визуализатора -->
    <div v-if="store.isLoaded" class="analytics-section">
      <h3 class="section-title collapsible-header" @click="isVizSettingsOpen = !isVizSettingsOpen">
        Visualiser Settings
        <span class="toggle-icon">{{ isVizSettingsOpen ? '▼' : '▶' }}</span>
      </h3>
      
      <div v-show="isVizSettingsOpen" class="collapsible-content">
        <label class="setting-item checkbox-label">
          <input type="checkbox" v-model="store.vizSettings.enableTooltip" /> Show Node Tooltips
        </label>

        <label class="setting-item">
          <span class="s-label">Link Direction:</span>
          <select v-model="store.vizSettings.direction" class="s-select">
            <option value="both">Both (In & Out)</option>
            <option value="in">Inbound (Cites Focal)</option>
            <option value="out">Outbound (Focal Cites)</option>
          </select>
        </label>

        <label class="setting-item">
          <span class="s-label">Depth (Levels):</span>
          <select v-model="store.vizSettings.depth" class="s-select">
            <option :value="1">1 (Direct Neighbors)</option>
            <option :value="2">2 (Neighbors of Neighbors)</option>
            <option :value="3">3 (Extended Network)</option>
          </select>
        </label>

        <div class="setting-item">
          <span class="s-label">Show Neighbor Types:</span>
          <div class="checkbox-group">
            <label><input type="checkbox" v-model="store.vizSettings.showCore" /> Core</label>
            <label><input type="checkbox" v-model="store.vizSettings.showCanon" /> Canon</label>
            <label><input type="checkbox" v-model="store.vizSettings.showEnv" /> Env</label>
          </div>
        </div>
      </div>
    </div>

    <!-- Временной фильтр -->
    <div v-if="store.isLoaded" class="analytics-section">
      <h3 class="section-title collapsible-header" @click="isTemporalFilterOpen = !isTemporalFilterOpen">
        Temporal Filter (Core)
        <span class="toggle-icon">{{ isTemporalFilterOpen ? '▼' : '▶' }}</span>
      </h3>
      
      <div v-show="isTemporalFilterOpen" class="collapsible-content">
        <!-- ФИКС: Кнопка сброса -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <span class="filter-hint" v-if="selectedYears.length > 0">Filtering by {{ selectedYears.length }} year(s)</span>
          <span v-else class="filter-hint" style="color: #888">No years selected</span>
          
          <button v-if="selectedYears.length > 0" class="btn warning-btn" style="padding: 2px 8px;" @click="resetYears">Clear</button>
        </div>

        <div v-if="store.availableYears && store.availableYears.length > 0" class="year-filter-container">
          <label v-for="y in store.availableYears" :key="y" class="year-checkbox">
            <input type="checkbox" :value="y" v-model="selectedYears" @change="applyYearFilter" />
            {{ y }}
          </label>
        </div>
      </div>
    </div>

    <!-- Дедупликация -->
    <div v-if="store.isLoaded" class="analytics-section">
      <h3 class="section-title collapsible-header" @click="isDedupOpen = !isDedupOpen">
        Deduplication Analytics
        <span class="toggle-icon">{{ isDedupOpen ? '▼' : '▶' }}</span>
      </h3>
      
      <div v-show="isDedupOpen" class="collapsible-content">
        <div class="dedup-controls">
          <span class="s-label">Filter ISSNs:</span>
          <div class="custom-dropdown w-100">
            <div class="dropdown-trigger s-select" @click="isIssnDropdownOpen = !isIssnDropdownOpen">
              Select ISSNs ({{ store.selectedISSNs.length }} selected) <span class="arrow">{{ isIssnDropdownOpen ? '▲' : '▼' }}</span>
            </div>
            <div v-show="isIssnDropdownOpen" class="dropdown-menu">
              <label v-for="i in sortedIssns" :key="i" class="dropdown-item">
                <input type="checkbox" :value="i" v-model="store.selectedISSNs" @change="store.recalculateMetrics" />
                <span class="issn-label-text">{{ getIssnLabel(i) }} ({{ getIssnCount(i) }})</span>
              </label>
            </div>
          </div>
          <div class="dedup-actions">
            <button class="btn info-btn" @click="runDeduplication('exact')" :disabled="store.selectedISSNs.length === 0">1:1 Exact Match</button>
            <button class="btn warning-btn" @click="runDeduplication('smart')" :disabled="store.selectedISSNs.length === 0">Smart Match (>80%)</button>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Компонент диаграммы -->
    <SunburstChart v-if="store.isLoaded" />

  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useGraphStore, issnMap } from '../../store/graphStore.js'
import SunburstChart from './SunburstChart.vue'

const store = useGraphStore()
const selectedYears = ref([])

// Состояния раскрывающихся панелей (по умолчанию свернуты)
const isSystemMetricsOpen = ref(true)
const isVizSettingsOpen = ref(false)
const isTemporalFilterOpen = ref(false)
const isDedupOpen = ref(false)
const isIssnDropdownOpen = ref(false)

const onFileSelected = (e) => {
  const file = e.target.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (evt) => {
    try {
      const json = JSON.parse(evt.target.result)
      store.loadGraphData(json)
    } catch (err) {
      alert("Error parsing JSON file")
      console.error(err)
    }
  }
  reader.readAsText(file)
}

const resetYears = () => {
  selectedYears.value = [];
  store.setYearFilter([]);
}

const toggleViz = () => { store.isVizActive = !store.isVizActive }

const applyYearFilter = () => {
  store.setYearFilter(selectedYears.value)
}

watch(() => store.isLoaded, (loaded) => {
  if (loaded) {
    selectedYears.value = []
    store.setYearFilter([])
  }
})

const exportJSON = () => {
  if (!store.graphModel) return
  
  const outNodes = Array.from(store.graphModel.nodes.values()).map(n => {
    const cleanNode = {
      id: n.id,
      title: n.title,
      type: n.type,
      justification: n.justification,
      year: n.publicationYear,
      authors: n.authors,
      domain: n.domain,
      field: n.field,
      subfield: n.subfield
    }
    if (n.issns && n.issns.length > 0) cleanNode.issns = n.issns
    if (n.pubType) cleanNode.type_crossref = n.pubType
    return cleanNode
  })

  const outLinks = store.graphModel.links.map(l => ({
    source: typeof l.source === 'object' ? l.source.id : l.source,
    target: typeof l.target === 'object' ? l.target.id : l.target
  }))

  const dataStr = JSON.stringify({ nodes: outNodes, links: outLinks }, null, 2)
  const blob = new Blob([dataStr], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'incose_graph_edited.json'
  a.click()
  URL.revokeObjectURL(url)
}

const getIssnLabel = (issn) => issnMap[issn] || issn
const getIssnCount = (issn) => {
  if (!store.metrics || !store.metrics.issnCounts) return 0;
  return store.metrics.issnCounts[issn] || 0
}

const sortedIssns = computed(() => {
  if (!store.metrics || !store.metrics.issnCounts) return [];
  return Object.keys(store.metrics.issnCounts).sort((a,b) => store.metrics.issnCounts[b] - store.metrics.issnCounts[a])
})

const runDeduplication = (type) => {
  alert(`Deduplication [${type}] is not fully implemented in this demo.`)
}
</script>

<style scoped>
.ego-panel { background: rgba(15,15,25,0.95); border-right: 1px solid #333; padding: 20px; width: 350px; overflow-y: auto; height: 100vh; pointer-events: auto; }
.panel-heading { color: #fff; font-size: 16px; margin: 0 0 20px 0; border-bottom: 1px solid #444; padding-bottom: 10px; font-weight: normal; }
.control-group { margin-bottom: 20px; display: flex; flex-direction: column; gap: 10px; }
.file-input { font-size: 11px; color: #aaa; background: #000; padding: 5px; border-radius: 4px; border: 1px solid #333; }
.btn { border: none; padding: 8px; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 11px; text-transform: uppercase; transition: opacity 0.2s; }
.btn:hover { opacity: 0.8; }
.btn:disabled { opacity: 0.3; cursor: not-allowed; }
.success-btn { background: #1a4a2a; color: #5cb85c; border: 1px solid #5cb85c; }
.danger-btn { background: #4a1a1a; color: #d9534f; border: 1px solid #d9534f; }
.info-btn { background: #1a3a4a; color: #5bc0de; border: 1px solid #5bc0de; }
.warning-btn { background: #4a3a1a; color: #f0ad4e; border: 1px solid #f0ad4e; }


.analytics-section { border-top: 1px dashed #333; padding-top: 15px; margin-top: 15px; }
.section-title { font-size: 13px; color: #fff; margin: 0; }

/* Стили аккордеона */
.collapsible-header { cursor: pointer; display: flex; justify-content: space-between; align-items: center; user-select: none; transition: color 0.2s; }
.collapsible-header:hover { color: #00bfff; }
.toggle-icon { font-size: 10px; color: #888; transition: transform 0.2s; }
.collapsible-content { margin-top: 12px; }

.setting-item { display: flex; flex-direction: column; margin-bottom: 10px; }
.checkbox-label { flex-direction: row; align-items: center; gap: 8px; font-size: 11px; color: #ccc; }
.s-label { font-size: 10px; color: #aaa; text-transform: uppercase; margin-bottom: 4px; }
.s-select { background: #000; color: #fff; border: 1px solid #444; padding: 4px; font-size: 11px; border-radius: 3px; }
.w-100 { width: 100%; }
.checkbox-group { display: flex; gap: 10px; font-size: 11px; color: #ccc; }

.dedup-controls { display: flex; flex-direction: column; gap: 10px; }
.dedup-actions { display: flex; gap: 10px; }
.dedup-actions .btn { flex: 1; }

.year-filter-container {
  max-height: 100px; overflow-y: auto; background: rgba(0,0,0,0.2); 
  border: 1px solid #333; padding: 5px; border-radius: 4px; display: flex; flex-wrap: wrap; gap: 8px;
}
.year-checkbox { font-size: 11px; color: #ccc; display: flex; align-items: center; gap: 4px; cursor: pointer; }
.filter-hint { font-size: 10px; color: #00bfff; margin-top: 4px; font-style: italic; }
.empty-state { font-size: 11px; color: #888; font-style: italic; }

/* Custom Dropdown Styles */
.custom-dropdown { position: relative; display: inline-block; }
.dropdown-trigger { display: flex; justify-content: space-between; align-items: center; cursor: pointer; user-select: none; }
.dropdown-menu { position: absolute; top: 100%; left: 0; width: 100%; max-height: 180px; overflow-y: auto; background: #0a0a14; border: 1px solid #444; border-radius: 4px; z-index: 100; margin-top: 4px; box-shadow: 0 4px 15px rgba(0,0,0,0.5); padding: 5px; box-sizing: border-box; }
.dropdown-menu::-webkit-scrollbar { width: 4px; }
.dropdown-menu::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 2px; }
.dropdown-item { display: flex; align-items: center; gap: 8px; padding: 6px 8px; font-size: 11px; color: #ccc; cursor: pointer; border-radius: 3px; }
.dropdown-item:hover { background: rgba(0, 191, 255, 0.15); color: #fff; }
.dropdown-item input { cursor: pointer; }
.issn-label-text { font-size: 11px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; }

/* System Metrics styles added */
.flex-row { display: flex; gap: 8px; flex-shrink: 0; }
.flex-row .metric-card { flex: 1; padding: 10px 5px; }
.metric-card { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); padding: 12px; border-radius: 6px; margin-bottom: 12px; text-align: center; flex-shrink: 0; }
.metric-title { font-size: 10px; color: #aaa; text-transform: uppercase; margin-bottom: 5px; }
.metric-value { font-size: 20px; font-weight: bold; color: #00bfff; }
.core-border { border-bottom: 2px solid #00bfff; } .canon-border { border-bottom: 2px solid #5cb85c; } .env-border { border-bottom: 2px solid #555566; }
.core-text { color: #00bfff; } .canon-text { color: #5cb85c; } .env-text { color: #aaa; } .irr-text { color: #d9534f; }
</style>
