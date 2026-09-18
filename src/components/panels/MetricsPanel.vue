<template>
  <div id="right-panel" class="panel" v-if="store.isLoaded">
    
    <!-- ИНТЕГРАЦИЯ: Анализ диффузии знаний -->
    <DiffusionPanel />

    <h2>System Metrics</h2>
    
    <div class="flex-row" style="margin-bottom: 10px;">
      <div class="metric-card"><div class="metric-title">Total Nodes</div><div class="metric-value">{{ store.metrics.totalNodes }}</div></div>
      <div class="metric-card"><div class="metric-title">Total Edges</div><div class="metric-value">{{ store.metrics.totalEdges }}</div></div>
    </div>
    
    <div class="flex-row">
      <div class="metric-card core-border"><div class="metric-title">Core</div><div class="metric-value">{{ store.metrics.coreCount }}</div></div>
      <div class="metric-card canon-border"><div class="metric-title">Canon</div><div class="metric-value canon-text">{{ store.metrics.canonCount }}</div></div>
      <div class="metric-card env-border"><div class="metric-title">Env</div><div class="metric-value env-text">{{ store.metrics.envCount }}</div></div>
    </div>

    <div class="metric-card filter-container">
      <div class="metric-title">Filter Display List</div>
      <div class="filter-toggles">
        <label class="f-toggle core-text"><input type="checkbox" v-model="store.displayFilters.incose_source"> Core</label>
        <label class="f-toggle canon-text"><input type="checkbox" v-model="store.displayFilters.assimilated_canon"> Canon</label>
        <label class="f-toggle env-text"><input type="checkbox" v-model="store.displayFilters.external_or_unknown"> Env</label>
        <label class="f-toggle irr-text"><input type="checkbox" v-model="store.displayFilters.irrelevant"> Not Rel</label>
      </div>
    </div>
    
    <SearchPanel />

    <div class="metric-card top-list-container">
      <div class="metric-title">Top Hubs (Filtered)</div>
      <ul class="top-list">
        <li 
          v-for="node in unifiedDisplayList" 
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
import { computed, watch, nextTick } from 'vue'
import { useGraphStore } from '../../store/graphStore.js'
import SearchPanel from './SearchPanel.vue'
import DiffusionPanel from './DiffusionPanel.vue'

const store = useGraphStore()

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
    if (store.trackedIssns.includes(n.issn) && !store.selectedISSNs.includes(n.issn)) return false;
    
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

// ЭКШЕН ДЛЯ КНОПКИ
const openEditModal = () => {
  if (store.focusedNodeId) {
    store.openModal(store.focusedNodeId)
  }
}
</script>

<style scoped>
.panel { background: rgba(15, 15, 25, 0.85); padding: 20px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.1); box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5); backdrop-filter: blur(4px); z-index: 10; position: absolute; }
#right-panel { top: 20px; right: 20px; width: 340px; height: calc(100vh - 40px); display: flex; flex-direction: column; border-right: 4px solid #00bfff; box-sizing: border-box; overflow: hidden; }
h2 { margin-top: 0; font-size: 16px; color: #fff; border-bottom: 1px solid rgba(255, 255, 255, 0.2); padding-bottom: 10px; margin-bottom: 15px; flex-shrink: 0; }
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

.top-list-container { text-align: left; margin-top: 5px; flex: 1; display: flex; flex-direction: column; min-height: 0; }
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