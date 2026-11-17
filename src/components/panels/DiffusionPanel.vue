<template>
  <div class="diffusion-panel">
    <h3 class="panel-title">
      Knowledge Diffusion Analysis
      <span class="help-icon" title="Measures 'Anschlussfähigkeit' (Recursive Connectability). Did importing this external knowledge trigger subsequent internal communications within the core system?">?</span>
    </h3>
    
    <div v-if="!isUnlocked" class="empty-state">
      Select at least one publication year (Left Panel) or a taxonomy sector (Sunburst) to analyze knowledge diffusion.
    </div>
    
    <div v-else>
      <div class="metrics-grid">
        <div class="metric-box">
          <span class="m-label">Selected Core</span>
          <span class="m-value">{{ store.filteredCoreNodes.length }}</span>
        </div>
        <div class="metric-box">
          <span class="m-label">Epistemic Lag</span>
          <span class="m-value lag-value">
            {{ epistemicLag !== null ? epistemicLag.toFixed(1) + ' yrs' : 'N/A' }}
          </span>
          <span class="m-sub" v-if="epistemicLag !== null">
            Avg. Citation Age: {{ epistemicLag.toFixed(1) }} yrs
          </span>
        </div>
      </div>

      <div class="taxonomy-banner" v-if="store.activeFilters.taxonomy">
        <span class="tb-label">Target Env:</span>
        <span class="tb-path" :title="store.activeFilters.taxonomy.pathString || store.activeFilters.taxonomy.name">
          {{ store.activeFilters.taxonomy.pathString || store.activeFilters.taxonomy.name }}
        </span>
      </div>
      
      <div v-if="store.diffusionStats && store.diffusionStats.length > 0" class="histogram-box">
        <div class="histogram-header">
          <span class="h-title">
            Concept Rooting
            <span class="help-icon" title="Tracks Meaning Condensation over time. Switch to Normalized (%) to adjust for the overall growth of the INCOSE publication volume.">?</span>
          </span>
          <div class="btn-toggle-group">
            <button 
              type="button"
              class="toggle-btn" 
              :class="{ active: !isNormalized }" 
              @click="isNormalized = false"
            ># Absolute</button>
            <button 
              type="button"
              class="toggle-btn" 
              :class="{ active: isNormalized }" 
              @click="isNormalized = true"
            >% Normalized</button>
          </div>
        </div>
        <div class="bars-container">
          <div v-for="item in store.diffusionStats" :key="item.year" class="bar-row">
            <span class="bar-year">{{ item.year }}</span>
            <div class="bar-track">
              <div class="bar-fill" :style="{ width: getBarWidth(item) + '%' }"></div>
            </div>
            <span class="bar-count" :class="{ 'is-normalized': isNormalized }">{{ getDisplayValue(item) }}</span>
          </div>
        </div>
      </div>
      
      <div v-else class="empty-state" style="margin-top: 10px;">
        No subsequent citations found in the core network for this selection.
      </div>

      <!-- Boundary Spanners (Top Translators) -->
      <div v-if="boundarySpanners && boundarySpanners.length > 0" class="spanners-box">
        <span class="h-title">
          Boundary Spanners (Top Translators)
          <span class="help-icon" title="Identifies mechanisms of 'Interpenetration'. Core papers that imported external knowledge and successfully translated it into the system's code (achieving high internal citation).">?</span>
        </span>
        <ul class="spanner-list">
          <li 
            v-for="item in boundarySpanners" 
            :key="item.node.id"
            class="spanner-item"
            :class="{ 'is-focused': store.focusedNodeId === item.node.id }"
            @click="handleSpannerClick(item.node.id)"
          >
            <div class="spanner-info">
              <span class="spanner-title" :title="item.node.title">{{ truncateTitle(item.node.title) }}</span>
              <span class="spanner-meta">
                {{ item.node.year || item.node.publicationYear || 'Unknown' }} · {{ formatAuthors(item.node.authors) }}
              </span>
            </div>
            <div class="spanner-badges">
              <span class="spanner-badge env-badge" title="Citations to selected environment">Env: {{ item.envCitations }}</span>
              <span class="spanner-badge in-badge" title="INCOSE in-degree citations">In: {{ item.inDegree }}</span>
            </div>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useGraphStore } from '../../store/graphStore.js'

const store = useGraphStore()
const isNormalized = ref(false)

// 1. Unlock Panel: display if either a year OR a taxonomy sector is selected
const isUnlocked = computed(() => {
  return store.activeFilters.years.length > 0 || !!store.activeFilters.taxonomy
})

const getItemNormalizedRatio = (item) => {
  const total = store.metrics?.coreNodesPerYear?.[item.year] || 0
  return total > 0 ? (item.count / total) : 0
}

const maxCount = computed(() => {
  if (!store.diffusionStats || store.diffusionStats.length === 0) return 0
  return Math.max(...store.diffusionStats.map(d => d.count))
})

const maxNormalizedRatio = computed(() => {
  if (!store.diffusionStats || store.diffusionStats.length === 0) return 0
  return Math.max(...store.diffusionStats.map(d => getItemNormalizedRatio(d)))
})

const getBarWidth = (item) => {
  if (!isNormalized.value) {
    if (maxCount.value === 0) return 0
    return (item.count / maxCount.value) * 100
  } else {
    if (maxNormalizedRatio.value === 0) return 0
    const ratio = getItemNormalizedRatio(item)
    return (ratio / maxNormalizedRatio.value) * 100
  }
}

const getDisplayValue = (item) => {
  if (!isNormalized.value) {
    return item.count
  }
  const total = store.metrics?.coreNodesPerYear?.[item.year] || 0
  if (!total) return '0.00%'
  return ((item.count / total) * 100).toFixed(2) + '%'
}

const truncateTitle = (title) => {
  if (!title) return 'Untitled'
  return title.length > 30 ? title.substring(0, 27) + '...' : title
}

const formatAuthors = (authorsStr) => {
  if (!authorsStr || authorsStr === 'Unknown') return 'Unknown'
  const parts = authorsStr.split(', ')
  return parts.length > 1 ? `${parts[0]} et al.` : parts[0]
}

// Target Environment Nodes for the current selection
const validEnvNodeIds = computed(() => {
  if (!store.graphModel) return new Set()
  const ids = new Set()
  const taxonomy = store.activeFilters.taxonomy

  if (taxonomy) {
    const { level, name, pathString } = taxonomy
    if (pathString) {
      const parts = pathString.split(' > ')
      store.graphModel.nodes.forEach(n => {
        if (n.type !== 'incose_source' && n.type !== 'irrelevant') {
          const matchDomain = !parts[0] || n.domain === parts[0]
          const matchField = !parts[1] || n.field === parts[1]
          const matchSubfield = !parts[2] || n.subfield === parts[2]
          if (matchDomain && matchField && matchSubfield) {
            ids.add(n.id)
          }
        }
      })
    } else if (level && name) {
      store.graphModel.nodes.forEach(n => {
        if (n.type !== 'incose_source' && n.type !== 'irrelevant') {
          if (n[level] === name) ids.add(n.id)
        }
      })
    }
  } else {
    // If no taxonomy specified, all non-core, non-irrelevant nodes represent the environment
    store.graphModel.nodes.forEach(n => {
      if (n.type !== 'incose_source' && n.type !== 'irrelevant') {
        ids.add(n.id)
      }
    })
  }
  return ids
})

// Epistemic Lag & Boundary Spanners Calculation
const diffusionMetrics = computed(() => {
  if (!store.graphModel || !isUnlocked.value) {
    return { epistemicLag: null, boundarySpanners: [] }
  }

  const envIds = validEnvNodeIds.value
  if (envIds.size === 0) {
    return { epistemicLag: null, boundarySpanners: [] }
  }

  const coreNodes = store.filteredCoreNodes
  if (!coreNodes || coreNodes.length === 0) {
    return { epistemicLag: null, boundarySpanners: [] }
  }

  const coreNodeMap = new Map(coreNodes.map(n => [n.id, n]))
  const envCitationCounts = new Map()

  let totalLag = 0
  let lagCount = 0

  store.graphModel.links.forEach(l => {
    const sId = typeof l.source === 'object' ? l.source.id : l.source
    const tId = typeof l.target === 'object' ? l.target.id : l.target

    if (coreNodeMap.has(sId) && envIds.has(tId)) {
      const sNode = coreNodeMap.get(sId)
      const tNode = store.graphModel.nodes.get(tId)

      // Count citations to environment for Translator ranking
      envCitationCounts.set(sId, (envCitationCounts.get(sId) || 0) + 1)

      // Calculate Epistemic Lag: Delta = Core_Year - Env_Year
      if (sNode && tNode) {
        const sYearRaw = sNode.year || sNode.publicationYear
        const tYearRaw = tNode.year || tNode.publicationYear
        const sYear = sYearRaw ? parseInt(sYearRaw, 10) : NaN
        const tYear = tYearRaw ? parseInt(tYearRaw, 10) : NaN

        if (!isNaN(sYear) && !isNaN(tYear)) {
          totalLag += (sYear - tYear)
          lagCount++
        }
      }
    }
  })

  const epistemicLag = lagCount > 0 ? (totalLag / lagCount) : null

  // Top 3 Translator core papers:
  // cite selected environment the most, AND possess highest inDegree
  const spanners = []
  envCitationCounts.forEach((envCitations, sId) => {
    const node = coreNodeMap.get(sId)
    if (node) {
      spanners.push({
        node,
        envCitations,
        inDegree: node.inDegree || 0
      })
    }
  })

  spanners.sort((a, b) => {
    if (b.envCitations !== a.envCitations) {
      return b.envCitations - a.envCitations
    }
    return b.inDegree - a.inDegree
  })

  return {
    epistemicLag,
    boundarySpanners: spanners.slice(0, 3)
  }
})

const epistemicLag = computed(() => diffusionMetrics.value.epistemicLag)
const boundarySpanners = computed(() => diffusionMetrics.value.boundarySpanners)

const handleSpannerClick = (nodeId) => {
  store.setFocusedNode(nodeId)
  if (boundarySpanners.value.length > 0) {
    store.modalContextList = boundarySpanners.value.map(s => s.node)
  }
}
</script>

<style scoped>
.diffusion-panel { background: rgba(15,15,25,0.9); border: 1px solid #00bfff; padding: 15px; border-radius: 6px; margin-bottom: 20px; box-shadow: 0 4px 15px rgba(0,191,255,0.1); }
.panel-title { color: #fff; font-size: 13px; margin: 0 0 10px 0; border-bottom: 1px dashed #444; padding-bottom: 5px; display: flex; align-items: center; }
.help-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #2a2a3a;
  color: #aaa;
  font-size: 10px;
  font-weight: normal;
  text-transform: none;
  cursor: help;
  margin-left: 6px;
  border: 1px solid #555;
  user-select: none;
  vertical-align: middle;
}
.help-icon:hover {
  background: #3a3a4a;
  color: #fff;
  border-color: #00bfff;
}
.empty-state { font-size: 11px; color: #888; font-style: italic; line-height: 1.4; }
.metrics-grid { display: flex; gap: 10px; margin-bottom: 12px; }
.metric-box { background: rgba(0, 191, 255, 0.05); border: 1px solid rgba(0, 191, 255, 0.2); padding: 8px; border-radius: 4px; flex: 1; text-align: center; }
.m-label { display: block; font-size: 10px; color: #aaa; text-transform: uppercase; }
.m-value { display: block; font-size: 18px; color: #00bfff; font-weight: bold; }
.lag-value { color: #ffaa00; }
.m-sub { display: block; font-size: 9px; color: #aaa; margin-top: 3px; }

.taxonomy-banner {
  background: rgba(92, 184, 92, 0.08);
  border: 1px solid rgba(92, 184, 92, 0.25);
  padding: 5px 8px;
  border-radius: 4px;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
}
.tb-label {
  color: #5cb85c;
  font-weight: bold;
  text-transform: uppercase;
  flex-shrink: 0;
}
.tb-path {
  color: #ddd;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Histogram Styles */
.histogram-box { border-top: 1px solid #333; padding-top: 10px; }
.histogram-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  gap: 6px;
}
.histogram-header .h-title {
  margin-bottom: 0;
}
.h-title { font-size: 11px; color: #ccc; margin-bottom: 8px; display: flex; align-items: center; text-transform: uppercase; letter-spacing: 0.3px; }
.btn-toggle-group {
  display: inline-flex;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid #444;
  border-radius: 4px;
  overflow: hidden;
}
.toggle-btn {
  background: transparent;
  border: none;
  color: #888;
  font-size: 9px;
  padding: 2px 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}
.toggle-btn:hover {
  color: #fff;
}
.toggle-btn.active {
  background: rgba(0, 191, 255, 0.25);
  color: #00bfff;
  font-weight: bold;
}
.bars-container { max-height: 160px; overflow-y: auto; padding-right: 5px; }
.bars-container::-webkit-scrollbar { width: 4px; }
.bars-container::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 2px; }
.bar-row { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.bar-year { font-size: 10px; color: #888; width: 30px; }
.bar-track { flex: 1; height: 8px; background: rgba(255,255,255,0.05); border-radius: 4px; overflow: hidden; }
.bar-fill { height: 100%; background: #00bfff; transition: width 0.3s ease; }
.bar-count { font-size: 10px; color: #ccc; width: 30px; text-align: right; flex-shrink: 0; }
.bar-count.is-normalized { width: 50px; }

/* Boundary Spanners Styles */
.spanners-box {
  border-top: 1px solid #333;
  padding-top: 10px;
  margin-top: 12px;
}
.spanner-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.spanner-item {
  padding: 6px 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  border-radius: 4px;
  transition: background 0.2s;
  gap: 8px;
}
.spanner-item:hover {
  background: rgba(0, 191, 255, 0.15);
}
.spanner-item.is-focused {
  background: rgba(255, 170, 0, 0.2);
  border-left: 3px solid #ffaa00;
  padding-left: 5px;
}
.spanner-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.spanner-title {
  font-size: 11px;
  color: #00bfff;
  font-weight: bold;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.spanner-meta {
  font-size: 9px;
  color: #888;
  margin-top: 2px;
}
.spanner-badges {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}
.spanner-badge {
  font-size: 9px;
  padding: 2px 5px;
  border-radius: 8px;
  font-weight: bold;
}
.env-badge {
  background: rgba(255, 170, 0, 0.15);
  color: #ffaa00;
  border: 1px solid rgba(255, 170, 0, 0.4);
}
.in-badge {
  background: rgba(0, 191, 255, 0.15);
  color: #00bfff;
  border: 1px solid rgba(0, 191, 255, 0.4);
}
</style>