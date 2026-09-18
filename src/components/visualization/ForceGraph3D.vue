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
      <div class="legend-item"><span class="color-dot ego"></span> Focal Node (Ego)</div>
    </div>

    <div v-if="tooltip.node && store.vizSettings.enableTooltip" class="custom-tooltip" :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }" @mouseenter="isHoveringTooltip = true" @mouseleave="hideTooltip">
      <div class="tt-title">{{ tooltip.node.title }}</div>
      <div class="tt-meta"><b>Author:</b> {{ formatAuthors(tooltip.node.authors) }}</div>
      <div class="tt-meta"><b>Source:</b> {{ getSourceName(tooltip.node.issns) }}</div>
      <a class="tt-link" @click.prevent="openCard(tooltip.node.id)">Open Card &rarr;</a>
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

const getNodeColor = (node) => {
  if (node.id === store.focusedNodeId) return '#ffaa00'
  if (node.type === 'incose_source') return '#00bfff'
  if (node.type === 'assimilated_canon') return '#5cb85c'
  if (node.type === 'irrelevant') return '#8b0000'
  return '#555566'
}

const initGraph = () => {
  if (!graphContainer.value) return
  Graph = ForceGraph3D()(graphContainer.value)
    .nodeColor(getNodeColor)
    .nodeVal(node => node.id === store.focusedNodeId ? node.nodeSize * 1.5 : node.nodeSize)
    .nodeOpacity(0.9)
    .linkColor(() => '#9999aa')    
    .linkOpacity(0.7)            
    .linkWidth(1.2)                
    .linkDirectionalArrowLength(3.5)
    .linkDirectionalArrowRelPos(1)
    .onNodeClick(node => { store.setFocusedNode(node.id); hideTooltip() })
    .onNodeHover(node => {
      if (!store.vizSettings.enableTooltip) return
      if (node) {
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
}

const handleWindowResize = () => {
  if (!Graph || !graphContainer.value) return
  if (store.mainView !== 'sunburst') {
    // Читаем реальные физические размеры новой панели
    const parent = graphContainer.value.parentElement
    Graph.width(parent.clientWidth).height(parent.clientHeight)
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
      if (target && Graph) Graph.width(target.clientWidth).height(target.clientHeight)
    }, 50)
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
        if (parent) Graph.width(parent.clientWidth).height(parent.clientHeight)
      }
    }, 50)
  }
})

watch([() => store.focusedNodeId, () => store.vizSettings], ([newId]) => {
  if (!newId || !store.graphModel) return
  if (!Graph) initGraph()
  const egoData = store.graphModel.getEgoNetwork(newId, store, store.vizSettings)
  Graph.graphData(egoData)
  Graph.nodeColor(Graph.nodeColor())
}, { deep: true })

watch(() => store.isVizActive, (isActive) => {
  if (!Graph) return
  isActive ? Graph.resumeAnimation() : Graph.pauseAnimation()
})

onMounted(() => {
  // Если граф стартует в свернутом режиме, сразу подстраиваем координаты
  if (store.mainView === 'sunburst') {
    syncPipPosition()
    pipSyncInterval = setInterval(syncPipPosition, 16)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleWindowResize)
  if (pipSyncInterval) clearInterval(pipSyncInterval)
  if (Graph) Graph._destructor()
})
</script>

<style scoped>
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