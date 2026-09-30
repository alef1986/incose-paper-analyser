<template>
  <div class="graph-wrapper" :class="{ 'pip-mode': store.mainView === 'sunburst' }">
    <div 
      ref="graphContainer" 
      class="graph-container"
      :class="{ 'is-minimised': store.mainView === 'sunburst' }"
      :style="{ 
        opacity: store.isVizActive ? 1 : 0, 
        visibility: store.isVizActive ? 'visible' : 'hidden',
        top: pipStyles.top,
        left: pipStyles.left,
        width: pipStyles.width,
        height: pipStyles.height
      }"
    ></div>

    <!-- НОВАЯ ЛЕГЕНДА: Показывается только в развернутом виде -->
    <div class="viewport-legend" v-if="store.mainView === 'graph' && store.graphModel">
      <h4 class="legend-title">Graph Taxonomy</h4>
      <div class="legend-item"><span class="color-dot incose"></span> Core (INCOSE)</div>
      <div class="legend-item"><span class="color-dot canon"></span> Assimilated Canon</div>
      <div class="legend-item"><span class="color-dot target"></span> Environment (External)</div>
      <div class="legend-item"><span class="color-dot irrel"></span> Not Relevant</div>
      <div class="legend-item" v-if="store.focusedNodeId"><span class="color-dot ego"></span> Focal Node (Ego)</div>
    </div>

    <div v-if="tooltip.node && store.vizSettings.enableTooltip" class="custom-tooltip" :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }" @mouseenter="isHoveringTooltip = true" @mouseleave="hideTooltip">
      <div class="tt-title">{{ tooltip.node.title }}</div>
      <div class="tt-meta"><b>Author:</b> {{ formatAuthors(tooltip.node.authors) }}</div>
      <div class="tt-meta"><b>Source:</b> {{ getSourceName(tooltip.node.issns) }}</div>
      <a class="tt-link" @click.prevent="openCard(tooltip.node.id)">Open Card &rarr;</a>
    </div>

    <!-- WARNING OVERLAY FOR TOO MANY NODES -->
    <div v-if="showWarningModal" class="warning-overlay">
      <div class="warning-content">
        <h3 class="warning-title">⚠️ Large Graph Rendering Alert</h3>
        <p class="warning-text">
          The selected filters result in a graph with <b class="warning-highlight">{{ pendingNodeCount }}</b> nodes. 
          Rendering this in 3D might cause significant browser lag or slow down your computer.
        </p>
        <div class="warning-actions">
          <button class="warning-btn continue" @click="onContinueRendering">Continue Rendering</button>
          <button class="warning-btn disable" @click="onDisableRendering">Disable Rendering</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, watch, onBeforeUnmount, onMounted, nextTick } from 'vue'
import ForceGraph3D from '3d-force-graph'
import { useGraphStore, issnMap } from '../../store/graphStore.js'

const store = useGraphStore()
const graphContainer = ref(null)
let Graph = null 

// РЕАКТИВНЫЕ КООРДИНАТЫ ДЛЯ 3D-ГРАФА
const pipStyles = reactive({ top: '0px', left: '0px', width: '100%', height: '100%' })
let pipSyncInterval = null

const tooltip = ref({ node: null, x: 0, y: 0 })
const isHoveringTooltip = ref(false)
let hideTimeout = null
let mouseX = 0, mouseY = 0

// Large graph rendering alert states
const showWarningModal = ref(false)
const pendingNodeCount = ref(0)
let pendingGraphData = null

const formatAuthors = (authorsStr) => {
  if (!authorsStr || authorsStr === 'Unknown') return 'Unknown'
  const parts = authorsStr.split(', ')
  return parts.length > 1 ? `${parts[0]} et al.` : parts[0]
}

const getSourceName = (issns) => {
  if (!issns || issns.length === 0) return 'Unknown'
  const matched = issns.find(i => issnMap[i])
  return matched ? issnMap[matched] : issns[0]
}

const openCard = (id) => { store.openModal(id); hideTooltip() }
const hideTooltip = () => { isHoveringTooltip.value = false; tooltip.value.node = null }

const getNodeSize = (node) => {
  let size = Math.max(1, Math.sqrt(node.inDegree || 0) * 0.8)
  if ((node.type === 'incose_source' || node.type === 'assimilated_canon') && size < 2) size = 2
  if (node.type === 'irrelevant') size = 0.5
  return size
}

const isExcludedByFilter = (node) => {
  if (!store.focusedNodeId) return false
  const years = store.activeFilters.years
  const taxonomy = store.activeFilters.taxonomy
  const isFilterActive = (years && years.length > 0) || taxonomy
  if (!isFilterActive) return false

  if (node.id === store.focusedNodeId) return false

  // Apply year filter
  if (years && years.length > 0) {
    const yRaw = node.year || node.publicationYear
    const nodeYear = yRaw ? parseInt(yRaw, 10) : null
    if (nodeYear === null || !years.includes(nodeYear)) {
      return true
    }
  }

  // Apply taxonomy filter
  if (taxonomy) {
    const { level, name } = taxonomy
    if (node[level] !== name) {
      if (store.graphModel) {
        const adj = store.graphModel.adjacencyList.get(node.id) || []
        const hasTaxonomyCitation = adj.some(l => {
          const s = typeof l.source === 'object' ? l.source.id : l.source
          const t = typeof l.target === 'object' ? l.target.id : l.target
          if (s === node.id) {
            const targetNode = store.graphModel.nodes.get(t)
            return targetNode && targetNode[level] === name
          }
          return false
        })
        if (!hasTaxonomyCitation) {
          return true
        }
      }
    }
  }

  return false
}

const convertToRGBA = (hex, alpha) => {
  let c = hex.substring(1)
  if (c.length === 3) {
    c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2]
  }
  const r = parseInt(c.substring(0, 2), 16)
  const g = parseInt(c.substring(2, 4), 16)
  const b = parseInt(c.substring(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

const getNodeColor = (node) => {
  let baseColor = '#555566'
  if (node.id === store.focusedNodeId) baseColor = '#ffaa00'
  else if (node.type === 'incose_source') baseColor = '#00bfff'
  else if (node.type === 'assimilated_canon') baseColor = '#5cb85c'
  else if (node.type === 'irrelevant') baseColor = '#8b0000'

  if (store.focusedNodeId) {
    const years = store.activeFilters.years
    const taxonomy = store.activeFilters.taxonomy
    const isFilterActive = (years && years.length > 0) || taxonomy
    if (isFilterActive) {
      if (isExcludedByFilter(node)) {
        return convertToRGBA(baseColor, 0.15)
      } else {
        return convertToRGBA(baseColor, 1.0)
      }
    }
  }
  return convertToRGBA(baseColor, 0.9)
}

const initGraph = () => {
  if (!graphContainer.value) return
  const parent = graphContainer.value.parentElement
  const width = parent ? parent.clientWidth : window.innerWidth - 710
  const height = parent ? parent.clientHeight : window.innerHeight

  Graph = ForceGraph3D()(graphContainer.value)
    .width(width)
    .height(height)
    .nodeColor(getNodeColor)
    .nodeVal(node => {
      const nodeSize = getNodeSize(node)
      const size = node.id === store.focusedNodeId ? nodeSize * 1.5 : nodeSize
      if (store.focusedNodeId) {
        const years = store.activeFilters.years
        const taxonomy = store.activeFilters.taxonomy
        const isFilterActive = (years && years.length > 0) || taxonomy
        if (isFilterActive) {
          if (isExcludedByFilter(node)) {
            return size * 0.4
          } else {
            return size * 1.5
          }
        }
      }
      return size
    })
    .nodeOpacity(1.0)
    .linkColor(() => '#9999aa')    
    .linkOpacity(link => {
      if (store.focusedNodeId) {
        const years = store.activeFilters.years
        const taxonomy = store.activeFilters.taxonomy
        const isFilterActive = (years && years.length > 0) || taxonomy
        if (isFilterActive) {
          const s = typeof link.source === 'object' ? link.source.id : link.source
          const t = typeof link.target === 'object' ? link.target.id : link.target
          const sourceNode = store.graphModel ? store.graphModel.nodes.get(s) : null
          const targetNode = store.graphModel ? store.graphModel.nodes.get(t) : null
          const isSourceExcluded = sourceNode ? isExcludedByFilter(sourceNode) : false
          const isTargetExcluded = targetNode ? isExcludedByFilter(targetNode) : false
          if (isSourceExcluded || isTargetExcluded) {
            return 0.03
          } else {
            return 0.8
          }
        }
      }
      return 0.4
    })            
    .linkWidth(link => {
      if (store.focusedNodeId) {
        const years = store.activeFilters.years
        const taxonomy = store.activeFilters.taxonomy
        const isFilterActive = (years && years.length > 0) || taxonomy
        if (isFilterActive) {
          const s = typeof link.source === 'object' ? link.source.id : link.source
          const t = typeof link.target === 'object' ? link.target.id : link.target
          const sourceNode = store.graphModel ? store.graphModel.nodes.get(s) : null
          const targetNode = store.graphModel ? store.graphModel.nodes.get(t) : null
          const isSourceExcluded = sourceNode ? isExcludedByFilter(sourceNode) : false
          const isTargetExcluded = targetNode ? isExcludedByFilter(targetNode) : false
          if (isSourceExcluded || isTargetExcluded) {
            return 0.1
          } else {
            return 0.6
          }
        }
      }
      return 0.4
    })                
    .linkDirectionalArrowLength(3.5)
    .linkDirectionalArrowRelPos(1)
    .onNodeClick(node => { store.setFocusedNode(node.id); hideTooltip() })
    .onNodeHover(node => {
      if (!store.vizSettings.enableTooltip) return
      if (node) {
        if (isExcludedByFilter(node)) {
          hideTimeout = setTimeout(() => { if (!isHoveringTooltip.value) tooltip.value.node = null }, 300)
          return
        }
        clearTimeout(hideTimeout)
        if (!tooltip.value.node || tooltip.value.node.id !== node.id) {
          tooltip.value = { node, x: mouseX + 15, y: mouseY + 15 }
        }
      } else {
        hideTimeout = setTimeout(() => { if (!isHoveringTooltip.value) tooltip.value.node = null }, 300) 
      }
    })

  Graph.d3Force('charge').strength(-30)
  window.addEventListener('resize', handleWindowResize)
  window.addEventListener('mousemove', e => { mouseX = e.clientX; mouseY = e.clientY })

  setTimeout(() => {
    if (Graph) {
      Graph.zoomToFit(400, 150)
      const controls = Graph.controls()
      if (controls) {
        if (typeof controls.handleResize === 'function') controls.handleResize()
        if (typeof controls.update === 'function') controls.update()
      }
    }
  }, 150)
}

const handleWindowResize = () => {
  if (!Graph || !graphContainer.value) return
  if (store.mainView !== 'sunburst') {
    // Читаем реальные физические размеры новой панели
    const parent = graphContainer.value.parentElement
    if (parent) {
      Graph.width(parent.clientWidth).height(parent.clientHeight)
      const controls = Graph.controls()
      if (controls) {
        if (typeof controls.handleResize === 'function') controls.handleResize()
        if (typeof controls.update === 'function') controls.update()
      }
    }
  }
}

// СИНХРОНИЗАЦИЯ КООРДИНАТ С РАМКОЙ
const syncPipPosition = () => {
  const target = document.getElementById('pip-target')
  if (target) {
    const rect = target.getBoundingClientRect()
    pipStyles.top = rect.top + 'px'
    pipStyles.left = rect.left + 'px'
    pipStyles.width = rect.width + 'px'
    pipStyles.height = rect.height + 'px'
  }
}

watch(() => store.mainView, async (newVal) => {
  await nextTick()
  if (newVal === 'sunburst') {
    syncPipPosition() 
    pipSyncInterval = setInterval(syncPipPosition, 16) 
    setTimeout(() => {
      const target = document.getElementById('pip-target')
      if (target && Graph) {
        Graph.width(target.clientWidth).height(target.clientHeight)
        const controls = Graph.controls()
        if (controls) {
          if (typeof controls.handleResize === 'function') controls.handleResize()
          if (typeof controls.update === 'function') controls.update()
        }
      }
    }, 100)
  } else {
    // Возвращаем полноэкранный режим 3D-графа
    if (pipSyncInterval) clearInterval(pipSyncInterval)
    
    // Сбрасываем координаты контейнера до 100%
    pipStyles.top = '0px'
    pipStyles.left = '0px'
    pipStyles.width = '100%'
    pipStyles.height = '100%'
    
    setTimeout(() => {
      if (Graph && graphContainer.value) {
        // Читаем размеры из новой центральной панели
        const parent = graphContainer.value.parentElement
        if (parent) {
          Graph.width(parent.clientWidth).height(parent.clientHeight)
          const controls = Graph.controls()
          if (controls) {
            if (typeof controls.handleResize === 'function') controls.handleResize()
            if (typeof controls.update === 'function') controls.update()
          }
          // Восстанавливаем позиционирование и центрирование графа
          Graph.zoomToFit(400, 150)
        }
      }
    }, 100)
  }
})

const proceedWithGraphData = (data) => {
  if (!Graph) initGraph()
  Graph.graphData(data)
  Graph.nodeColor(Graph.nodeColor())
  Graph.nodeVal(Graph.nodeVal())
  Graph.nodeOpacity(Graph.nodeOpacity())
  Graph.linkOpacity(Graph.linkOpacity())
  Graph.linkWidth(Graph.linkWidth())

  // Центрируем камеру при изменении фокусного узла или настроек графа
  setTimeout(() => {
    if (Graph) {
      Graph.zoomToFit(400, 150)
      const controls = Graph.controls()
      if (controls) {
        if (typeof controls.handleResize === 'function') controls.handleResize()
        if (typeof controls.update === 'function') controls.update()
      }
    }
  }, 150)
}

const onContinueRendering = () => {
  showWarningModal.value = false
  if (pendingGraphData) {
    proceedWithGraphData(pendingGraphData)
    pendingGraphData = null
  }
}

const onDisableRendering = () => {
  showWarningModal.value = false
  pendingGraphData = null
  store.isVizActive = false
  if (Graph) {
    Graph.graphData({ nodes: [], links: [] })
  }
}

const updateGraphData = () => {
  if (!store.isVizActive) {
    if (Graph) {
      Graph.graphData({ nodes: [], links: [] })
    }
    return
  }
  if (!store.graphModel) return

  let data

  if (store.focusedNodeId) {
    // 1. Если выбран узел в Top Hubs, то к окружению должен применяться фильтр года выхода и отраслей.
    data = store.graphModel.getEgoNetwork(store.focusedNodeId, store, store.vizSettings)
  } else {
    // 2. Если узел не выбран, то нужно рисовать новый 3d граф.
    data = store.graphModel.getFilteredGlobalNetwork(store.filteredCoreNodes, store, store.vizSettings)
  }

  // 3. Если в графе для отображения слишком много узлов (например, > 1000)
  if (data.nodes.length > 1000) {
    pendingNodeCount.value = data.nodes.length
    pendingGraphData = data
    showWarningModal.value = true
    return
  }

  showWarningModal.value = false
  proceedWithGraphData(data)
}

// Watch everything that affects the rendered data structure
watch([
  () => store.focusedNodeId, 
  () => store.vizSettings,
  () => store.selectedISSNs,
  () => store.displayFilters,
  () => store.isVizActive,
  () => store.isLoaded
], () => {
  updateGraphData()
}, { deep: true, immediate: true })

// Watch activeFilters separately so we don't reconstruct the layout in ego mode
watch(() => store.activeFilters, () => {
  if (store.focusedNodeId) {
    if (Graph) {
      Graph.nodeColor(Graph.nodeColor())
      Graph.nodeVal(Graph.nodeVal())
      Graph.nodeOpacity(Graph.nodeOpacity())
      Graph.linkOpacity(Graph.linkOpacity())
      Graph.linkWidth(Graph.linkWidth())
    }
  } else {
    updateGraphData()
  }
}, { deep: true })

watch(() => store.isVizActive, (isActive) => {
  if (!Graph) return
  if (isActive) {
    Graph.resumeAnimation()
  } else {
    Graph.pauseAnimation()
  }
})

onMounted(() => {
  // Если граф стартует в свернутом режиме, сразу подстраиваем координаты
  if (store.mainView === 'sunburst') {
    syncPipPosition()
    pipSyncInterval = setInterval(syncPipPosition, 16)
  }
  updateGraphData()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleWindowResize)
  if (pipSyncInterval) clearInterval(pipSyncInterval)
  if (Graph) Graph._destructor()
})
</script>

<style scoped>
.warning-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(5, 5, 8, 0.85);
  backdrop-filter: blur(8px);
  z-index: 10000;
  display: flex;
  justify-content: center;
  align-items: center;
  pointer-events: auto;
}
.warning-content {
  background: rgba(15, 15, 25, 0.95);
  border: 1px solid #ffaa00;
  padding: 30px;
  border-radius: 8px;
  max-width: 450px;
  text-align: center;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.8), 0 0 15px rgba(255, 170, 0, 0.2);
}
.warning-title {
  color: #ffaa00;
  margin-top: 0;
  margin-bottom: 15px;
  font-size: 18px;
  font-weight: bold;
}
.warning-text {
  color: #ccc;
  font-size: 13px;
  line-height: 1.5;
  margin-bottom: 25px;
}
.warning-highlight {
  color: #ffaa00;
  font-size: 15px;
}
.warning-actions {
  display: flex;
  gap: 15px;
  justify-content: center;
}
.warning-btn {
  padding: 10px 20px;
  border-radius: 4px;
  font-size: 13px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s ease;
}
.warning-btn.continue {
  background: #ffaa00;
  border: 1px solid #ffaa00;
  color: #050508;
}
.warning-btn.continue:hover {
  background: #fff;
  border-color: #fff;
}
.warning-btn.disable {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid #444;
  color: #aaa;
}
.warning-btn.disable:hover {
  background: rgba(255, 0, 0, 0.2);
  border-color: #ff3333;
  color: #fff;
}
.graph-wrapper { 
  position: fixed; 
  top: 0; 
  left: 350px; /* Отступаем на ширину левой панели */
  width: calc(100vw - 700px); /* Занимаем строго место между панелями */
  height: 100vh; 
  overflow: hidden; /* МАГИЯ ЗДЕСЬ: Физически отсекаем 3D-пространство, уходящее под панели */
  pointer-events: none; 
  z-index: 0; 
}
/* Когда граф свернут, мы временно снимаем границы, чтобы окошко могло плавать над левой панелью */
.graph-wrapper.pip-mode { 
  left: 0;
  width: 100vw;
  overflow: visible; 
  z-index: 9999; 
}
.graph-container { 
  position: absolute; /* ФИКС: Без этого браузер игнорирует скрипт */
  top: 0; left: 0;
  width: 100%; 
  height: 100%; 
  pointer-events: auto; 
  background: #050508; 
  transition: border-radius 0.3s ease; 
}

.graph-container.is-minimised {
  border-radius: 6px !important;
  border: 2px solid #00bfff !important; 
  box-shadow: 0 8px 25px rgba(0,0,0,0.9);
}

/* Тултипы остаются без изменений */
.custom-tooltip { position: fixed; background: rgba(15,15,25,0.95); border: 1px solid #ffaa00; padding: 12px; border-radius: 6px; z-index: 10000; pointer-events: auto; max-width: 300px; box-shadow: 0 4px 15px rgba(0,0,0,0.6); backdrop-filter: blur(4px); }
.tt-title { color: #fff; font-size: 13px; font-weight: bold; margin-bottom: 6px; line-height: 1.2; }
.tt-meta { color: #aaa; font-size: 11px; margin-bottom: 3px; }
.tt-meta b { color: #ccc; }
.tt-link { display: inline-block; margin-top: 8px; color: #ffaa00; font-size: 11px; font-weight: bold; text-decoration: underline; cursor: pointer; }
.tt-link:hover { color: #fff; }

/* Floating Legend */
.viewport-legend {
  position: absolute;
  bottom: 30px;
  left: 30px;
  background: rgba(15, 15, 25, 0.85);
  border: 1px solid #333;
  padding: 15px;
  border-radius: 8px;
  pointer-events: auto;
  z-index: 100;
  box-shadow: 0 4px 15px rgba(0,0,0,0.5);
  backdrop-filter: blur(4px);
}
.legend-title { color: #fff; font-size: 11px; margin: 0 0 10px 0; border-bottom: 1px dashed #444; padding-bottom: 5px; text-transform: uppercase; font-weight: bold; }
.legend-item { display: flex; align-items: center; font-size: 11px; color: #ccc; margin-bottom: 6px; }
.legend-item:last-child { margin-bottom: 0; }
.color-dot { width: 10px; height: 10px; border-radius: 50%; margin-right: 10px; display: inline-block; }
.color-dot.incose { background: #00bfff; }
.color-dot.canon { background: #5cb85c; }
.color-dot.target { background: #555566; }
.color-dot.irrel { background: #8b0000; }
.color-dot.ego { background: #ffaa00; box-shadow: 0 0 5px #ffaa00; }
</style>