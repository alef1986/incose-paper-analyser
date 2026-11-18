<template>
  <div class="sunburst-wrapper">
    <h3 class="chart-title">
      External Domains
      <button class="nav-btn swap-btn" @click="store.toggleMainView" v-if="hasData">
        <span v-if="store.mainView === 'graph'">&#8644; Maximize</span>
        <span v-else>&#8644; Minimize to Panel</span>
      </button>
    </h3>
    
    <div id="pip-target" class="chart-placeholder">
      <div v-if="store.mainView === 'sunburst'" class="placeholder-text">3D Graph is minimised</div>
      
      <Teleport to="#app" :disabled="store.mainView === 'graph'">
        <div 
          v-show="hasData" 
          ref="chartDom" 
          class="chart-canvas"
          :class="{ 'is-fullscreen-canvas': store.mainView === 'sunburst' }"
        ></div>

        <div class="viewport-legend sunburst-legend" v-if="store.mainView === 'sunburst' && hasData">
          <h4 class="legend-title">Domain Taxonomy</h4>
          <div class="legend-item" v-for="item in domainLegend" :key="item.name">
            <span class="color-dot" :style="{ background: item.color }"></span> {{ item.name }}
          </div>
        </div>
      </Teleport>
    </div>
    
    <div v-if="!hasData" class="empty-state">
      No domain metadata available for external sources.<br><br>
      Use <b>Search & Batch Edit</b> to select Environment nodes, then click <b>Batch Fetch</b>.
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import * as echarts from 'echarts'
import { useGraphStore } from '../../store/graphStore.js'

const store = useGraphStore()
const chartDom = ref(null)
let chartInstance = null
const hasData = ref(false)
const domainLegend = ref([])

const baseColors = ['#00bfff', '#5cb85c', '#f0ad4e', '#d9534f', '#9b59b6', '#3498db', '#1abc9c', '#e67e22', '#e74c3c'];
const getDomainColor = (index) => baseColors[index % baseColors.length];

const buildSunburstData = () => {
  if (!store.graphModel) return []
  const tree = {}; 
  hasData.value = false;

  store.graphModel.links.forEach(l => {
    const sId = typeof l.source === 'object' ? l.source.id : l.source
    const tId = typeof l.target === 'object' ? l.target.id : l.target
    const sNode = store.graphModel.nodes.get(sId)
    const tNode = store.graphModel.nodes.get(tId)
    
    if (sNode && sNode.type === 'incose_source' && tNode && tNode.type !== 'incose_source' && tNode.type !== 'irrelevant') {
      if (store.translatorLensActive) { const roleObj = store.nodeRoles.get(sId); if (!roleObj || roleObj.role !== 'True Translator') return; }
      const d = (tNode.domain && tNode.domain !== 'Unknown') ? tNode.domain : null;
      const f = (tNode.field && tNode.field !== 'Unknown') ? tNode.field : 'Other';
      const sf = (tNode.subfield && tNode.subfield !== 'Unknown') ? tNode.subfield : 'Other';
      
      if (d) {
        hasData.value = true;
        if (!tree[d]) tree[d] = {}; 
        if (!tree[d][f]) tree[d][f] = {};
        if (!tree[d][f][sf]) tree[d][f][sf] = { count: 0 }; 
      }
    }
  });

  store.graphModel.links.forEach(l => {
    const sId = typeof l.source === 'object' ? l.source.id : l.source
    const tId = typeof l.target === 'object' ? l.target.id : l.target
    const sNode = store.graphModel.nodes.get(sId)
    const tNode = store.graphModel.nodes.get(tId)
    
    if (sNode && sNode.type === 'incose_source' && tNode && tNode.type !== 'incose_source' && tNode.type !== 'irrelevant') {
      if (store.translatorLensActive) { const roleObj = store.nodeRoles.get(sId); if (!roleObj || roleObj.role !== 'True Translator') return; }
      if (store.citationFrequencyFilter || store.uniqueAuthorsFilter || store.activeYearsFilterActive || store.lifespanFilterActive) {
        if (store.activeNodeIds && (!store.activeNodeIds.has(sId) || !store.activeNodeIds.has(tId))) return;
      }
      const activeYears = store.activeFilters.years;
      if (activeYears && activeYears.length > 0) {
        const sYearRaw = sNode.year || sNode.publicationYear;
        const sYear = sYearRaw ? parseInt(sYearRaw, 10) : NaN;
        if (!activeYears.includes(sYear)) return; 
      }

      const d = (tNode.domain && tNode.domain !== 'Unknown') ? tNode.domain : null;
      const f = (tNode.field && tNode.field !== 'Unknown') ? tNode.field : 'Other';
      const sf = (tNode.subfield && tNode.subfield !== 'Unknown') ? tNode.subfield : 'Other';
      
      if (d && tree[d] && tree[d][f] && tree[d][f][sf]) {
        tree[d][f][sf].count++; 
      }
    }
  });

  const data = [];
  const domainNames = Object.keys(tree).sort();
  const domainValue = 100 / (domainNames.length || 1);
  
  let globalMaxDomainCount = 0;
  let globalMaxFieldCount = 0;
  let globalMaxSubfieldCount = 0;

  domainNames.forEach(dName => {
    let dTotal = 0;
    for (const f in tree[dName]) {
      let fTotal = 0;
      for (const sf in tree[dName][f]) {
        const c = tree[dName][f][sf].count;
        fTotal += c;
        if (c > globalMaxSubfieldCount) globalMaxSubfieldCount = c;
      }
      dTotal += fTotal;
      if (fTotal > globalMaxFieldCount) globalMaxFieldCount = fTotal;
    }
    if (dTotal > globalMaxDomainCount) globalMaxDomainCount = dTotal;
  });

  const activeTax = store.activeFilters.taxonomy;
  const activeDomain = activeTax && activeTax.pathString ? activeTax.pathString.split(' > ')[0] : null;

  const newLegend = [];

  domainNames.forEach((dName, dIndex) => {
    const fObj = tree[dName];
    const fieldNames = Object.keys(fObj).sort(); 
    const fieldValue = domainValue / (fieldNames.length || 1);
    
    const dColor = getDomainColor(dIndex); 
    newLegend.push({ name: dName, color: dColor }); 

    let localMaxFieldCount = 0;
    fieldNames.forEach(fName => {
      let fTotal = 0;
      for (const sf in fObj[fName]) fTotal += fObj[fName][sf].count;
      if (fTotal > localMaxFieldCount) localMaxFieldCount = fTotal;
    });
    
    const refMaxF = (activeDomain === dName) ? localMaxFieldCount : globalMaxFieldCount;
    
    let dTotal = 0;
    // ФИКС 1: Добавляем уникальный ID каждому узлу (совпадает с pathString)
    const dId = dName;
    const dNode = { id: dId, name: dName, value: domainValue, children: [] };
    
    fieldNames.forEach(fName => {
      const sfObj = fObj[fName];
      const subfieldNames = Object.keys(sfObj).sort(); 
      const subfieldValue = fieldValue / (subfieldNames.length || 1);
      
      let localMaxSubfieldCount = 0;
      subfieldNames.forEach(sfName => {
        if (sfObj[sfName].count > localMaxSubfieldCount) localMaxSubfieldCount = sfObj[sfName].count;
      });
      
      const refMaxSf = (activeDomain === dName) ? localMaxSubfieldCount : globalMaxSubfieldCount;

      let fTotal = 0;
      const fId = `${dId} > ${fName}`;
      const fNode = { id: fId, name: fName, value: fieldValue, children: [] };
      
      subfieldNames.forEach(sfName => {
        const count = sfObj[sfName].count;
        fTotal += count;
        
        const sfOpacity = count === 0 ? 0 : 0.2 + 0.8 * (count / (refMaxSf || 1));
        const sfBorder = count === 0 ? 'transparent' : '#0f0f19';
        
        const sfId = `${fId} > ${sfName}`;
        fNode.children.push({ 
          id: sfId,
          name: sfName, value: subfieldValue, count: count, 
          itemStyle: { color: dColor, opacity: sfOpacity, borderColor: sfBorder }
        });
      });
      
      dTotal += fTotal;
      const fOpacity = fTotal === 0 ? 0 : 0.2 + 0.8 * (fTotal / (refMaxF || 1));
      const fBorder = fTotal === 0 ? 'transparent' : '#0f0f19';
      
      fNode.count = fTotal;
      fNode.itemStyle = { color: dColor, opacity: fOpacity, borderColor: fBorder };
      dNode.children.push(fNode);
    });
    
    const dOpacity = dTotal === 0 ? 0 : 0.2 + 0.8 * (dTotal / (globalMaxDomainCount || 1));
    const dBorder = dTotal === 0 ? 'transparent' : '#0f0f19';
    
    dNode.count = dTotal;
    dNode.itemStyle = { color: dColor, opacity: dOpacity, borderColor: dBorder };
    data.push(dNode);
  });
  
  domainLegend.value = newLegend;
  return data;
}

const updateChart = async () => {
  if (!chartInstance) return;
  if (store.focusedNodeId && (store.activeFilters.years.length > 0 || store.activeFilters.taxonomy)) {
    return;
  }
  const data = buildSunburstData();
  await nextTick();
  if (!hasData.value) return;
  
  setTimeout(() => {
    chartInstance.resize(); 
    const option = {
      tooltip: {
        trigger: 'item', confine: true, appendToBody: true,
        formatter: (params) => `${params.name}: ${params.data.count || 0} citations`,
        backgroundColor: 'rgba(15, 15, 25, 0.9)', borderColor: '#00bfff', textStyle: { color: '#fff', fontSize: 11 },
        position: function (pos, params, el, elRect, size) {
          let obj = { top: pos[1] + 10 };
          if (pos[0] < size.viewSize[0] / 2) obj.left = pos[0] + 15;
          else obj.right = size.viewSize[0] - pos[0] + 15;
          return obj;
        }
      },
      series: {
        type: 'sunburst', data: data, radius: store.mainView === 'sunburst' ? [0, '90%'] : [0, '95%'],
        nodeClick: 'rootToNode',
        itemStyle: { borderRadius: 3, borderWidth: 2 }, 
        label: { show: false }, 
        emphasis: { focus: 'ancestor', itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0, 191, 255, 0.5)' } },
        levels: [ 
          {}, 
          { r0: '10%', r: '45%', label: { show: false } }, 
          { r0: '45%', r: '85%', label: { show: false } }, 
          { r0: '85%', r: '95%', label: { show: false } } 
        ]
      }
    }
    
    // Передаем новые данные диаграмме
    chartInstance.setOption(option)
    
    // ФИКС 2: Программно возвращаем зум на отфильтрованный узел
    const activeTax = store.activeFilters.taxonomy;
    if (activeTax && activeTax.pathString) {
      chartInstance.dispatchAction({
        type: 'sunburstRootToNode',
        targetNode: activeTax.pathString // targetNode работает благодаря тому, что мы задали ID секторам!
      });
    }
    
    chartInstance.off('click');
    chartInstance.on('click', (params) => {
      const pathInfo = params.treePathInfo;
      if (!pathInfo || pathInfo.length === 1) {
        store.setTaxonomyFilter(null, null, null);
      } else {
        const levelMap = { 2: 'domain', 3: 'field', 4: 'subfield' };
        const level = levelMap[pathInfo.length];
        const name = params.name;
        const pathString = pathInfo.slice(1).map(p => p.name).join(' > ');
        if (level && name) store.setTaxonomyFilter(level, name, pathString);
      }
    });
  }, 50);
}

watch([
  () => store.metrics, 
  () => store.activeFilters.years, 
  () => store.activeFilters.taxonomy,
  () => store.citationFrequencyFilter,
  () => store.uniqueAuthorsFilter,
  () => store.activeYearsFilterActive,
  () => store.activeYearsCount,
  () => store.lifespanFilterActive,
  () => store.lifespanCount,
  () => store.translatorLensActive
], () => { updateChart() }, { deep: true })

watch(() => store.translatorLensActive, () => {
  updateChart()
})

watch(() => store.mainView, async () => {
  await nextTick();
  setTimeout(() => {
    updateChart();
    if (chartInstance) chartInstance.resize();
  }, 50);
})

onMounted(() => {
  chartInstance = echarts.init(chartDom.value)
  window.addEventListener('resize', () => { if (chartInstance) chartInstance.resize() })
  setTimeout(updateChart, 100)
})

onBeforeUnmount(() => { if (chartInstance) chartInstance.dispose() })
</script>

<style scoped>
.sunburst-wrapper { margin-top: 25px; border-top: 1px dashed rgba(255, 255, 255, 0.2); padding-top: 15px; }
.chart-title { font-size: 13px; color: #fff; margin: 0 0 10px 0; display: flex; justify-content: space-between; align-items: center; }
.swap-btn { background: rgba(0, 191, 255, 0.2); border-color: #00bfff; color: #00bfff; font-weight: bold; padding: 3px 8px; font-size: 10px; }
.swap-btn:hover { background: rgba(0, 191, 255, 0.4); }

.chart-canvas { width: 100%; height: 260px; }
.chart-placeholder { width: 100%; height: 260px; border: 2px dashed rgba(0, 191, 255, 0.3); border-radius: 6px; display: flex; align-items: center; justify-content: center; position: relative; }
.placeholder-text { color: rgba(0, 191, 255, 0.5); font-size: 11px; font-weight: bold; text-transform: uppercase; }
.empty-state { font-size: 11px; color: #aaa; background: rgba(0,0,0,0.3); padding: 10px; border-radius: 4px; border: 1px dashed #555; }

.is-fullscreen-canvas {
  position: fixed !important;
  top: 120px !important;
  left: 350px !important;
  width: calc(100vw - 700px) !important; 
  height: calc(100vh - 120px) !important;
  overflow: hidden !important; 
  z-index: 5 !important; 
  background: #050510;
}

.viewport-legend {
  position: fixed;
  bottom: 30px;
  left: 380px; 
  background: rgba(15, 15, 25, 0.85);
  border: 1px solid #333;
  padding: 15px;
  border-radius: 8px;
  pointer-events: auto;
  z-index: 10; 
  box-shadow: 0 4px 15px rgba(0,0,0,0.5);
  backdrop-filter: blur(4px);
  max-height: 80vh;
  overflow-y: auto;
}
.legend-title { color: #fff; font-size: 11px; margin: 0 0 10px 0; border-bottom: 1px dashed #444; padding-bottom: 5px; text-transform: uppercase; font-weight: bold; }
.legend-item { display: flex; align-items: center; font-size: 11px; color: #ccc; margin-bottom: 6px; }
.legend-item:last-child { margin-bottom: 0; }
.color-dot { width: 10px; height: 10px; border-radius: 50%; margin-right: 10px; display: inline-block; border: 1px solid rgba(255,255,255,0.2); }
</style>