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
    
    <SearchPanel />

    <!-- Top Hubs Collapsible Panel -->
    <div class="analytics-section" style="flex: 1; display: flex; flex-direction: column; min-height: 0;">
      <h3 class="section-title collapsible-header" @click="isTopHubsOpen = !isTopHubsOpen">
        {{ hasActiveFilters ? 'Context Subgraph Hubs' : 'Top Hubs (Filtered)' }}
        <span class="toggle-icon">{{ isTopHubsOpen ? '▼' : '▶' }}</span>
      </h3>
      
      <div v-show="isTopHubsOpen" class="collapsible-content" style="flex: 1; display: flex; flex-direction: column; min-height: 0; margin-bottom: 10px;">
        
        <!-- Two distinct scrollable lists when filters are active -->
        <template v-if="hasActiveFilters">
          <!-- Target Environment -->
          <div class="split-list-section">
            <div class="split-list-header">
              <span class="split-title env-text">Target Environment</span>
              <span class="split-count">({{ store.filteredEnvNodesBySelection.length }})</span>
            </div>
            <div class="metric-card top-list-container">
              <ul class="top-list" @scroll="handleScroll">
                <li 
                  v-for="item in visibleTargetEnvNodes" 
                  :key="item.node.id" 
                  :id="'list-node-' + item.node.id"
                  :class="{ 'is-focused': store.focusedNodeId === item.node.id }"
                  @click="handleNodeClick(item.node.id)"
                >
                  <span :style="{ color: getTextColor(item.node.type) }">{{ truncateTitle(item.node.title) }}</span>
                  <span class="badge">{{ item.localInDegree }}</span>
                </li>
                <li v-if="store.filteredEnvNodesBySelection.length === 0" class="empty-list-notice">
                  No target environment nodes
                </li>
              </ul>
            </div>
          </div>

          <!-- Citing Core -->
          <div class="split-list-section">
            <div class="split-list-header">
              <span class="split-title core-text">Citing Core</span>
              <span class="split-count">({{ store.citingCoreNodesForSelection.length }})</span>
            </div>
            <div class="metric-card top-list-container">
              <ul class="top-list" @scroll="handleScroll">
                <li 
                  v-for="item in visibleCitingCoreNodes" 
                  :key="item.node.id" 
                  :id="'list-node-' + item.node.id"
                  :class="{ 'is-focused': store.focusedNodeId === item.node.id }"
                  @click="handleNodeClick(item.node.id)"
                >
                  <span :style="{ color: getTextColor(item.node.type) }">{{ truncateTitle(item.node.title) }}</span>
                  <span class="badge">{{ item.sectorOutDegree }}</span>
                </li>
                <li v-if="store.citingCoreNodesForSelection.length === 0" class="empty-list-notice">
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
              @click="handleNodeClick(node.id)"
            >
              <span :style="{ color: getTextColor(node.type) }">{{ truncateTitle(node.title) }}</span>
              <span class="badge">{{ node.inDegree }}</span>
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
        @click="store.openModal(store.focusedNodeId)"
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

const store = useGraphStore()
const isFilterCategoriesOpen = ref(false)
const isTopHubsOpen = ref(true)

// Infinite scroll visible count
const visibleCount = ref(100)

const hasActiveFilters = computed(() => {
  return !!store.activeFilters.taxonomy || store.activeFilters.years.length > 0
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

// Вычисляем список узлов с учетом глобальных фильтров, ISSN И текущих фильтров графа (Годы + Таксономия)
const filteredTopNodes = computed(() => {
  const validCoreIds = new Set(store.filteredCoreNodes.map(n => n.id));
  const hasFilters = store.activeFilters.years.length > 0 || store.activeFilters.taxonomy !== null;

  return store.topNodes.filter(n => {
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
})

const unifiedDisplayList = computed(() => {
  const list = [...filteredTopNodes.value]
  if (store.focusedNodeId) {
    const isPresent = list.some(n => n.id === store.focusedNodeId)
    if (!isPresent) {
      const activeNode = store.graphModel?.nodes.get(store.focusedNodeId)
      if (activeNode) list.unshift(activeNode)
    }
  }
  return list
})

// Sliced lists for infinite scrolling
const visibleTargetEnvNodes = computed(() => {
  return store.filteredEnvNodesBySelection.slice(0, visibleCount.value)
})

const visibleCitingCoreNodes = computed(() => {
  return store.citingCoreNodesForSelection.slice(0, visibleCount.value)
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
    () => store.focusedNodeId
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

const handleNodeClick = (nodeId) => {
  // ФИКС: Только фокусируем узел, больше никакого автоматического вызова окна
  store.setFocusedNode(nodeId)
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
</style>