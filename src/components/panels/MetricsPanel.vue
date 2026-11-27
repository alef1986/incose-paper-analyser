<template>
  <div id="right-panel" class="panel" v-if="store.isLoaded">
    
    <!-- ИНТЕГРАЦИЯ: Анализ диффузии знаний -->
    <DiffusionPanel />

    <!-- Filter Categories -->
    <div class="analytics-section">
      <h3 class="section-title collapsible-header" @click="isFilterCategoriesOpen = !isFilterCategoriesOpen">
        Filter Categories
        <span class="toggle-icon">{{ isFilterCategoriesOpen ? '▼' : '▶' }}</span>
      </h3>
      
      <div v-show="isFilterCategoriesOpen" class="collapsible-content">
        <div class="metric-card filter-container" style="margin-top: 10px; margin-bottom: 0;">
          <div class="filter-toggles">
            <label class="f-toggle core-text"><input type="checkbox" v-model="store.displayFilters.incose_source"> Core</label>
            <label class="f-toggle canon-text"><input type="checkbox" v-model="store.displayFilters.assimilated_canon"> Canon</label>
            <label class="f-toggle env-text"><input type="checkbox" v-model="store.displayFilters.external_or_unknown"> Env</label>
            <label class="f-toggle irr-text"><input type="checkbox" v-model="store.displayFilters.irrelevant"> Not Rel</label>
          </div>
        </div>
      </div>
    </div>

    <!-- Echo Chambers / Insularity -->
    <div class="analytics-section">
      <h3 class="section-title collapsible-header" @click="isEchoChambersOpen = !isEchoChambersOpen">
        Citation Clusters (Insularity)
        <HelpTip term="citationClusters" />
        <span class="toggle-icon">{{ isEchoChambersOpen ? '▼' : '▶' }}</span>
      </h3>
      
      <div v-show="isEchoChambersOpen" class="collapsible-content">
        <div class="echo-settings">
          <div class="echo-mode-row">
            <span class="echo-field-label">Metric:</span>
            <div class="echo-mode-toggle">
              <button 
                type="button" 
                class="echo-mode-btn" 
                :class="{ active: store.echoMetricMode === 'core' }"
                @click="store.echoMetricMode = 'core'"
              >
                Core Insularity (vs INCOSE)
              </button>
              <button 
                type="button" 
                class="echo-mode-btn" 
                :class="{ active: store.echoMetricMode === 'total' }"
                @click="store.echoMetricMode = 'total'"
              >
                Total Closure (vs All)
              </button>
            </div>
          </div>

          <div class="echo-inputs-grid">
            <div class="echo-num-group">
              <label class="echo-num-label">Min Papers:</label>
              <input 
                type="number" 
                v-model.number="store.echoMinSize" 
                min="3" 
                max="200" 
                class="echo-number-input" 
              />
            </div>
            <div class="echo-num-group">
              <label class="echo-num-label">Max Papers:</label>
              <input 
                type="number" 
                v-model.number="store.echoMaxSize" 
                min="5" 
                max="5000" 
                step="10" 
                class="echo-number-input" 
              />
            </div>
            <div class="echo-num-group">
              <label class="echo-num-label">Min %:</label>
              <input 
                type="number" 
                v-model.number="echoMinInsularityPercent" 
                min="0" 
                max="100" 
                step="5" 
                class="echo-number-input" 
              />
            </div>
          </div>

          <div class="echo-resample-row">
            <button class="nav-btn echo-resample-btn" @click="store.resampleEchoChambers(10)">
              🎲 Deep Statistical Resample (10x Runs)
            </button>
            <div class="echo-cluster-counter">
              Found: {{ store.echoChambers.length }} of {{ store.rawEchoCommunities.length }} clusters
            </div>
          </div>
        </div>

        <div v-if="store.echoChambers.length === 0" class="empty-list-notice">
          No citation clusters match the current thresholds.
        </div>
        <ul v-else class="top-list echo-list" style="max-height: 200px; overflow-y: auto;">
          <li 
            v-for="(chamber, idx) in store.echoChambers" 
            :key="chamber.id"
            :class="{ 'is-focused': store.focusedClique && store.focusedClique.id === chamber.id }"
            @click="store.setFocusedClique(chamber)"
          >
            <div style="display: flex; flex-direction: column; width: 100%;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <span style="color: #00bfff; font-weight: bold; font-size: 11px;">Clique #{{ idx + 1 }} ({{ chamber.size }} papers)</span>
                <span class="badge" style="background: rgba(217, 83, 79, 0.2); color: #d9534f; border-color: #d9534f;">
                  Core Insul: {{ (chamber.coreInsularity * 100).toFixed(0) }}%
                </span>
              </div>
              <span style="font-size: 10px; color: #aaa; margin-bottom: 2px;"><b>Top Authors:</b> {{ chamber.topAuthors }}</span>
              <span style="font-size: 10px; color: #888;"><b>Anchor Paper:</b> <i style="color:#ccc;">{{ chamber.topPaperTitle.length > 40 ? chamber.topPaperTitle.substring(0,37)+'...' : chamber.topPaperTitle }}</i></span>
              
              <!-- Epistemic Diet (Top 2 external OpenAlex Fields) -->
              <div class="diet-row" v-if="chamber.topExternalFields && chamber.topExternalFields.length > 0">
                <span class="diet-label">Profile:</span>
                <span class="diet-tag" v-for="f in chamber.topExternalFields" :key="f.name">{{ f.name }} {{ f.pct }}%</span>
              </div>
              <div class="diet-row" v-else-if="chamber.totalEnvOut === 0">
                <span class="diet-tag diet-closed">Pure Self-Reference (0% External)</span>
              </div>

              <span style="font-size: 9px; color: #888; margin-top: 4px;">
                Total Closure: {{ (chamber.totalClosure * 100).toFixed(0) }}% | {{ chamber.internalLinks }} internal / {{ chamber.totalEnvOut }} external refs
              </span>
            </div>
          </li>
        </ul>
      </div>
    </div>

    <!-- Top Hubs Collapsible Panel -->
    <div class="analytics-section" style="flex: 1; display: flex; flex-direction: column; min-height: 0;">
      <h3 class="section-title collapsible-header" @click="isTopHubsOpen = !isTopHubsOpen">
        {{ (hasActiveFilters || store.focusedClique) ? (store.focusedClique ? 'Clique Subgraph Hubs' : 'Context Subgraph Hubs') : 'Top Hubs (Filtered)' }}
        <span class="toggle-icon">{{ isTopHubsOpen ? '▼' : '▶' }}</span>
      </h3>
      
      <div v-show="isTopHubsOpen" class="collapsible-content" style="flex: 1; display: flex; flex-direction: column; min-height: 0; margin-bottom: 10px;">
        
        <div class="list-search">
          <div class="list-search-input-wrap">
            <input type="text" v-model="listSearchQuery" placeholder="Filter lists by title or author..." class="edit-input" />
            <button v-if="listSearchQuery" @click="listSearchQuery = ''" class="clear-btn" title="Clear filter">✖</button>
          </div>
          <button class="adv-search-btn" :class="{ active: isAdvSearchOpen }" @click="isAdvSearchOpen = !isAdvSearchOpen" title="Toggle Advanced Search & Batch Edit">⚙ Batch</button>
        </div>

        <SearchPanel v-show="isAdvSearchOpen" />

        <!-- Two distinct scrollable lists when filters are active -->
        <template v-if="hasActiveFilters || store.focusedClique">
          <!-- Target Environment -->
          <div class="split-list-section">
            <div class="split-list-header">
              <span class="split-title env-text">{{ store.focusedClique ? 'Clique Environment' : 'Target Environment' }}</span>
              <span class="split-count">({{ filteredEnvNodesBySelection.length }})</span>
            </div>
            <div class="metric-card top-list-container">
              <ul class="top-list" @scroll="handleScroll">
                <li 
                  v-for="item in visibleTargetEnvNodes" 
                  :key="item.node.id" 
                  :id="'list-node-' + item.node.id"
                  :class="{ 'is-focused': store.focusedNodeId === item.node.id }"
                  @click="handleNodeClick(item.node.id, filteredEnvNodesBySelection.map(i => i.node))"
                >
                  <span :style="{ color: getTextColor(item.node.type) }">{{ truncateTitle(item.node.title) }}</span>
                  <span class="badge">{{ item.localInDegree }}</span>
                </li>
                <li v-if="filteredEnvNodesBySelection.length === 0" class="empty-list-notice">
                  No target environment nodes
                </li>
              </ul>
            </div>
          </div>

          <!-- Citing Core -->
          <div class="split-list-section">
            <div class="split-list-header">
              <span class="split-title core-text">{{ store.focusedClique ? 'Clique Members' : 'Citing Core' }}</span>
              <span class="split-count">({{ citingCoreNodesForSelection.length }})</span>
            </div>
            <div class="metric-card top-list-container">
              <ul class="top-list" @scroll="handleScroll">
                <li 
                  v-for="item in visibleCitingCoreNodes" 
                  :key="item.node.id" 
                  :id="'list-node-' + item.node.id"
                  :class="{ 'is-focused': store.focusedNodeId === item.node.id }"
                  @click="handleNodeClick(item.node.id, citingCoreNodesForSelection.map(i => i.node))"
                >
                  <span :style="{ color: getTextColor(item.node.type) }">{{ truncateTitle(item.node.title) }}</span>
                  <span class="badge">{{ store.focusedClique ? item.globalInDegree : item.sectorOutDegree }}</span>
                </li>
                <li v-if="citingCoreNodesForSelection.length === 0" class="empty-list-notice">
                  No citing core nodes
                </li>
              </ul>
            </div>
          </div>
        </template>

        <!-- Fallback: Global top nodes when no filters are active -->
        <div v-else class="metric-card top-list-container" style="flex: 1; display: flex; flex-direction: column; min-height: 0; margin-bottom: 0; margin-top: 5px;">
          <ul class="top-list" style="flex: 1; overflow-y: auto;" @scroll="handleScroll">
            <li 
              v-for="node in visibleGlobalNodes" 
              :key="node.id" 
              :id="'list-node-' + node.id"
              :class="{ 'is-focused': store.focusedNodeId === node.id }"
              @click="handleNodeClick(node.id, unifiedDisplayList)"
            >
              <span :style="{ color: getTextColor(node.type) }">{{ truncateTitle(node.title) }}</span>
              <span class="badge">{{ node.inDegree }}</span>
            </li>
            <li v-if="unifiedDisplayList.length === 0" class="empty-list-notice">
              No matching nodes
            </li>
          </ul>
        </div>

      </div>
    </div>

    <!-- КНОПКА РЕДАКТИРОВАНИЯ -->
    <div class="edit-node-section">
      <button 
        class="btn edit-node-btn" 
        :disabled="!store.focusedNodeId"
        @click="openEditModal"
      >
        <span v-if="store.focusedNodeId">✎ Edit Selected Node</span>
        <span v-else>Select a node to edit</span>
      </button>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useGraphStore } from '../../store/graphStore.js'
import SearchPanel from './SearchPanel.vue'
import DiffusionPanel from './DiffusionPanel.vue'
import HelpTip from '../common/HelpTip.vue'

const store = useGraphStore()
const isFilterCategoriesOpen = ref(false)
const isEchoChambersOpen = ref(false)
const isTopHubsOpen = ref(true)
const isAdvSearchOpen = ref(false)

// Infinite scroll visible count
const visibleCount = ref(100)
const listSearchQuery = ref('')

const hasActiveFilters = computed(() => {
  return !!store.activeFilters.taxonomy || store.activeFilters.years.length > 0
})

const echoMinInsularityPercent = computed({
  get: () => Math.round((store.echoMinInsularity ?? 0.5) * 100),
  set: (val) => {
    store.echoMinInsularity = Math.max(0, Math.min(100, Number(val) || 0)) / 100
  }
})

const handleScroll = (event) => {
  const { scrollTop, clientHeight, scrollHeight } = event.target
  if (scrollTop + clientHeight >= scrollHeight - 50) {
    visibleCount.value += 50
  }
}

const getTextColor = (type) => {
  if (type === 'incose_source') return '#00bfff'
  if (type === 'assimilated_canon') return '#5cb85c'
  if (type === 'irrelevant') return '#d9534f'
  return '#aaa'
}

const truncateTitle = (title) => title && title.length > 35 ? title.substring(0, 32) + '...' : (title || 'Untitled')

const filterBySearch = (list, getNode = item => item.node || item) => {
  if (!listSearchQuery.value.trim()) return list
  const q = listSearchQuery.value.trim().toLowerCase()
  return list.filter(item => {
    const node = getNode(item)
    if (!node) return false
    const title = (node.title || '').toLowerCase()
    const authors = (node.authors || '').toLowerCase()
    return title.includes(q) || authors.includes(q)
  })
}

const filteredEnvNodesBySelection = computed(() => {
  return filterBySearch(store.filteredEnvNodesBySelection || [])
})

const citingCoreNodesForSelection = computed(() => {
  return filterBySearch(store.citingCoreNodesForSelection || [])
})

// Вычисляем список узлов с учетом глобальных фильтров, ISSN И текущих фильтров графа (Годы + Таксономия)
const filteredTopNodes = computed(() => {
  const validCoreIds = new Set(store.filteredCoreNodes.map(n => n.id));
  const hasFilters = store.activeFilters.years.length > 0 || store.activeFilters.taxonomy !== null;

  const base = store.topNodes.filter(n => {
    // 1. Проверка галочек отображения типов
    if (!store.displayFilters[n.type]) return false;
    
    // 2. Проверка ISSN
    const nodeIssns = n.issns || [];
    const hasTracked = nodeIssns.some(i => store.trackedIssns.includes(i));
    const hasSelected = nodeIssns.some(i => store.selectedISSNs.includes(i));
    if (hasTracked && !hasSelected) return false;
    
    // 3. ФИКС: Проверка принадлежности к отфильтрованному подграфу
    // Оставляем узел ядра ТОЛЬКО если он прошел фильтр годов и диаграммы
    if (hasFilters && n.type === 'incose_source') {
       if (!validCoreIds.has(n.id)) return false;
    }
    
    return true;
  })

  return filterBySearch(base, n => n)
})

const unifiedDisplayList = computed(() => {
  const list = [...filteredTopNodes.value]
  if (store.focusedNodeId) {
    const isPresent = list.some(n => n.id === store.focusedNodeId)
    if (!isPresent) {
      const activeNode = store.graphModel?.nodes.get(store.focusedNodeId)
      if (activeNode) {
        if (!listSearchQuery.value.trim()) {
          list.unshift(activeNode)
        } else {
          const q = listSearchQuery.value.trim().toLowerCase()
          const title = (activeNode.title || '').toLowerCase()
          const authors = (activeNode.authors || '').toLowerCase()
          if (title.includes(q) || authors.includes(q)) {
            list.unshift(activeNode)
          }
        }
      }
    }
  }
  return list
})

// Sliced lists for infinite scrolling
const visibleTargetEnvNodes = computed(() => {
  return filteredEnvNodesBySelection.value.slice(0, visibleCount.value)
})

const visibleCitingCoreNodes = computed(() => {
  return citingCoreNodesForSelection.value.slice(0, visibleCount.value)
})

const visibleGlobalNodes = computed(() => {
  return unifiedDisplayList.value.slice(0, visibleCount.value)
})

// Reset visibleCount whenever filters or focused node change
watch(
  [
    () => store.activeFilters.taxonomy,
    () => store.activeFilters.years,
    () => store.displayFilters,
    () => store.selectedISSNs,
    () => store.focusedNodeId,
    () => store.focusedClique,
    listSearchQuery
  ],
  () => {
    visibleCount.value = 100
  },
  { deep: true }
)

watch(() => store.focusedNodeId, async (newId) => {
  if (!newId) return
  await nextTick() 
  const el = document.getElementById('list-node-' + newId)
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
})

const currentContextList = ref(null)

const handleNodeClick = (nodeId, contextList = null) => {
  store.setFocusedNode(nodeId)
  if (contextList) {
    currentContextList.value = contextList
    store.modalContextList = contextList
  }
}

const openEditModal = () => {
  if (!store.focusedNodeId) return
  let context = currentContextList.value
  if (!context || context.length === 0) {
    if (hasActiveFilters.value || store.focusedClique) {
      if (store.filteredEnvNodesBySelection.some(i => i.node.id === store.focusedNodeId)) {
        context = store.filteredEnvNodesBySelection.map(i => i.node)
      } else if (store.citingCoreNodesForSelection.some(i => i.node.id === store.focusedNodeId)) {
        context = store.citingCoreNodesForSelection.map(i => i.node)
      }
    }
    if (!context) {
      context = unifiedDisplayList.value
    }
  }
  store.openModal(store.focusedNodeId, context)
}
</script>

<style scoped>
.panel { background: rgba(15, 15, 25, 0.85); padding: 20px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.1); box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5); backdrop-filter: blur(4px); z-index: 10; position: absolute; }
#right-panel { top: 20px; right: 20px; width: 340px; height: calc(100vh - 40px); display: flex; flex-direction: column; border-right: 4px solid #00bfff; box-sizing: border-box; overflow: hidden; }
h2 { margin-top: 0; font-size: 16px; color: #fff; border-bottom: 1px solid rgba(255, 255, 255, 0.2); padding-bottom: 10px; margin-bottom: 15px; flex-shrink: 0; }

.analytics-section { border-top: 1px dashed rgba(255, 255, 255, 0.2); padding-top: 15px; margin-top: 15px; }
.section-title { font-size: 13px; color: #fff; margin: 0; }
.collapsible-header { cursor: pointer; display: flex; justify-content: space-between; align-items: center; user-select: none; transition: color 0.2s; }
.collapsible-header:hover { color: #00bfff; }
.toggle-icon { font-size: 10px; color: #888; transition: transform 0.2s; }
.collapsible-content { margin-top: 12px; }
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
  cursor: help;
  margin-left: 6px;
  border: 1px solid #555;
  user-select: none;
}
.help-icon:hover {
  background: #3a3a4a;
  color: #fff;
  border-color: #00bfff;
}
.metric-card { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); padding: 12px; border-radius: 6px; margin-bottom: 12px; text-align: center; flex-shrink: 0; }
.metric-title { font-size: 10px; color: #aaa; text-transform: uppercase; margin-bottom: 5px; }
.metric-value { font-size: 20px; font-weight: bold; color: #00bfff; }
.flex-row { display: flex; gap: 8px; flex-shrink: 0; }
.flex-row .metric-card { flex: 1; padding: 10px 5px; }

.core-border { border-bottom: 2px solid #00bfff; } .canon-border { border-bottom: 2px solid #5cb85c; } .env-border { border-bottom: 2px solid #555566; }
.core-text { color: #00bfff; } .canon-text { color: #5cb85c; } .env-text { color: #aaa; } .irr-text { color: #d9534f; }

.filter-container { padding: 8px; }
.filter-toggles { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-top: 5px; }
.f-toggle { font-size: 11px; cursor: pointer; display: flex; align-items: center; gap: 4px; }
.f-toggle input { cursor: pointer; }

.split-list-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  margin-top: 6px;
}
.list-search {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
  flex-shrink: 0;
}
.list-search-input-wrap {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
}
.list-search-input-wrap .edit-input {
  width: 100%;
  box-sizing: border-box;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #fff;
  padding: 6px 26px 6px 8px;
  border-radius: 4px;
  font-size: 11px;
}
.list-search-input-wrap .edit-input:focus {
  outline: none;
  border-color: #00bfff;
}
.adv-search-btn {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #aaa;
  padding: 6px 8px;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: all 0.2s ease;
  flex-shrink: 0;
}
.adv-search-btn:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.15);
}
.adv-search-btn.active {
  background: rgba(255, 170, 0, 0.2);
  border-color: #ffaa00;
  color: #ffaa00;
  font-weight: bold;
}
.clear-btn {
  position: absolute;
  right: 6px;
  background: transparent;
  border: none;
  color: #888;
  cursor: pointer;
  font-size: 11px;
  padding: 2px 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.clear-btn:hover {
  color: #fff;
}
.split-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 2px;
  margin-bottom: 4px;
}
.split-title {
  font-size: 11px;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.split-count {
  font-size: 10px;
  color: #888;
}
.empty-list-notice {
  padding: 10px 5px;
  color: #777;
  font-style: italic;
  text-align: center;
  font-size: 11px;
}

.top-list-container { text-align: left; margin-top: 2px; flex: 1; display: flex; flex-direction: column; min-height: 0; }
.top-list { list-style: none; padding: 0; margin: 0; font-size: 12px; overflow-y: auto; flex: 1; }
.top-list::-webkit-scrollbar { width: 4px; } .top-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 2px; }
.top-list li { padding: 8px 5px; border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: background 0.2s; border-radius: 4px; }
.top-list li:hover { background: rgba(0, 191, 255, 0.15); }
.badge { background: rgba(0, 191, 255, 0.2); color: #00bfff; padding: 2px 6px; border-radius: 10px; font-size: 10px; font-weight: bold; min-width: 20px; text-align: center; border: 1px solid rgba(0, 191, 255, 0.5); }

.top-list li.is-focused {
  background: rgba(255, 170, 0, 0.2);
  border-left: 3px solid #ffaa00;
  padding-left: 2px;
}
.echo-list li.is-focused {
  background: rgba(155, 89, 182, 0.2);
  border-left: 3px solid #9b59b6;
  padding-left: 5px;
}

/* Стили кнопки */
.edit-node-section {
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px dashed rgba(255, 255, 255, 0.2);
  flex-shrink: 0;
}
.edit-node-btn {
  width: 100%;
  padding: 10px;
  background: rgba(255, 170, 0, 0.1);
  color: #ffaa00;
  border: 1px solid #ffaa00;
  border-radius: 4px;
  font-weight: bold;
  cursor: pointer;
  text-transform: uppercase;
  font-size: 11px;
  transition: all 0.2s ease;
}
.edit-node-btn:hover:not(:disabled) {
  background: rgba(255, 170, 0, 0.3);
  box-shadow: 0 0 10px rgba(255, 170, 0, 0.2);
}
.edit-node-btn:disabled {
  background: rgba(255, 255, 255, 0.05);
  color: #666;
  border-color: #333;
  cursor: not-allowed;
}

/* Echo Chambers Controls */
.echo-settings {
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 8px;
  border-radius: 4px;
  margin-bottom: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.echo-mode-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.echo-field-label {
  font-size: 10px;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  flex-shrink: 0;
}
.echo-mode-toggle {
  display: flex;
  gap: 4px;
  flex: 1;
}
.echo-mode-btn {
  flex: 1;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #aaa;
  padding: 4px 6px;
  border-radius: 3px;
  font-size: 9.5px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s ease;
  text-align: center;
}
.echo-mode-btn:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.12);
}
.echo-mode-btn.active {
  background: rgba(0, 191, 255, 0.2);
  border-color: #00bfff;
  color: #00bfff;
  font-weight: bold;
}
.echo-inputs-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}
.echo-num-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.echo-num-label {
  font-size: 9.5px;
  color: #aaa;
  white-space: nowrap;
}
.echo-number-input {
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #fff;
  padding: 4px 6px;
  border-radius: 3px;
  font-size: 11px;
  width: 100%;
  box-sizing: border-box;
  text-align: center;
}
.echo-number-input:focus {
  outline: none;
  border-color: #00bfff;
}
.echo-resample-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 2px;
}
.echo-resample-btn {
  width: 100%;
  padding: 6px 8px;
  background: rgba(155, 89, 182, 0.18);
  border: 1px solid rgba(155, 89, 182, 0.5);
  color: #d2a8e8;
  font-weight: 600;
  border-radius: 4px;
  cursor: pointer;
  font-size: 10.5px;
  transition: all 0.2s ease;
}
.echo-resample-btn:hover {
  background: rgba(155, 89, 182, 0.35);
  border-color: #9b59b6;
  color: #fff;
}
.echo-cluster-counter {
  font-size: 9.5px;
  color: #888;
  text-align: center;
}
.echo-cluster-counter b {
  color: #00bfff;
}

/* Epistemic Diet mini-badges */
.diet-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  margin-top: 3px;
  margin-bottom: 1px;
}
.diet-label {
  font-size: 9px;
  color: #888;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}
.diet-tag {
  font-size: 8.5px;
  padding: 1px 5px;
  border-radius: 3px;
  background: rgba(0, 191, 255, 0.12);
  border: 1px solid rgba(0, 191, 255, 0.35);
  color: #00bfff;
  white-space: nowrap;
}
.diet-tag.diet-closed {
  background: rgba(217, 83, 79, 0.15);
  border-color: rgba(217, 83, 79, 0.45);
  color: #ff6b6b;
  font-weight: 600;
}
</style>
