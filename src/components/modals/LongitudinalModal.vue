<template>
  <div v-if="store.isLongitudinalOpen">
    <div id="modal-overlay" @click="close"></div>

    <div id="longitudinal-modal">
      <span class="modal-close" @click="close" title="Close">✖</span>

      <div class="modal-header">
        <div class="title-with-badge">
          <h2>Longitudinal Autopoiesis &amp; Eigenzeit (30-Year Trends)</h2>
          <span class="luhmann-badge">30Y Scientometrics</span>
        </div>
        <p class="modal-subtitle">
          Longitudinal trajectory of INCOSE (1990–2025+) tracking autopoietic operational closure, citation aging (Eigenzeit), and disciplinary breadth over time.<br />
          <strong class="term">Operational Closure:</strong> Ratio of Core &rarr; Core citations quantifying autopoietic system differentiation from the scientific environment.<br />
          <strong class="term">Price Index &amp; Median Lag:</strong> Measures temporal asynchrony (% refs &le; 5 yrs old vs median citation age).<br />
          <strong class="term">Shannon Diversity (H'):</strong> Entropy across external OpenAlex fields measuring genuine interdisciplinary breadth.
        </p>
      </div>

      <!-- Active Scope Banner -->
      <div class="scope-banner" v-if="store.longitudinalScopeSummary">
        <div class="scope-item">
          <span class="scope-label">Journals:</span>
          <span class="scope-val" :title="store.longitudinalScopeSummary.selectedJournalLabels.join(', ')">
            {{ store.longitudinalScopeSummary.selectedJournalLabels.join(', ') }}
          </span>
        </div>
        <div class="scope-divider"></div>
        <div class="scope-item">
          <span class="scope-label">Taxonomy:</span>
          <span class="scope-val" :title="store.longitudinalScopeSummary.taxonomyLabel">
            {{ store.longitudinalScopeSummary.taxonomyLabel }}
          </span>
        </div>
        <div class="scope-badge" v-if="store.translatorLensActive">
          ⚡ Translator Lens ON
        </div>
      </div>

      <!-- Quick Metrics Ribbon -->
      <div class="summary-ribbon" v-if="metricsData && metricsData.length > 0">
        <div class="ribbon-metric">
          <span class="r-label">Temporal Span</span>
          <span class="r-val">{{ temporalSpan }}</span>
        </div>
        <div class="ribbon-metric">
          <span class="r-label">
            Core Papers Audited
            <span class="help-icon" title="Only Core papers with at least 1 parsed outgoing reference in OpenAlex can be audited for citation ratios and lag.">?</span>
          </span>
          <span class="r-val">{{ totalAuditedPapers.toLocaleString() }}</span>
          <span class="r-sub" v-if="store.longitudinalScopeSummary">
            with refs (of {{ store.longitudinalScopeSummary.totalMatchingCore.toLocaleString() }} total)
          </span>
        </div>
        <div class="ribbon-metric">
          <span class="r-label">Avg Operational Closure</span>
          <span class="r-val" :class="{ 'val-accent': avgClosureRate >= 15 }">
            {{ avgClosureRate.toFixed(1) }}%
          </span>
        </div>
        <div class="ribbon-metric">
          <span class="r-label">Overall Median Lag</span>
          <span class="r-val" :class="{ 'val-warning': overallMedianLag > 15 }">
            {{ overallMedianLag !== null ? overallMedianLag.toFixed(1) + ' yrs' : 'N/A' }}
          </span>
        </div>
        <div class="ribbon-metric">
          <span class="r-label">Mean Shannon Diversity</span>
          <span class="r-val val-purple">
            {{ meanShannonDiversity.toFixed(2) }}
          </span>
        </div>
      </div>

      <!-- Tab View Selector -->
      <div class="view-tabs" v-if="metricsData && metricsData.length > 0">
        <button 
          type="button"
          class="tab-btn" 
          :class="{ active: activeTab === 'all' }" 
          @click="setTab('all')"
        >
          📊 All 3 Trends (Stacked)
        </button>
        <button 
          type="button"
          class="tab-btn" 
          :class="{ active: activeTab === 'closure' }" 
          @click="setTab('closure')"
        >
          🔒 1. Operational Closure
        </button>
        <button 
          type="button"
          class="tab-btn" 
          :class="{ active: activeTab === 'eigenzeit' }" 
          @click="setTab('eigenzeit')"
        >
          ⏳ 2. Price Index vs. Median Lag
        </button>
        <button 
          type="button"
          class="tab-btn" 
          :class="{ active: activeTab === 'diversity' }" 
          @click="setTab('diversity')"
        >
          🌐 3. Shannon Diversity
        </button>
      </div>

      <!-- Charts Body -->
      <div class="charts-body" v-if="metricsData && metricsData.length > 0">
        <!-- CHART 1: Operational Closure -->
        <div 
          class="chart-card" 
          v-show="activeTab === 'all' || activeTab === 'closure'"
          :class="{ 'expanded-chart': activeTab === 'closure' }"
        >
          <div class="chart-card-header">
            <div class="card-title">
              <span class="chart-indicator indicator-cyan"></span>
              <h3>Operational Closure Rate (%) over Time</h3>
              <span 
                class="help-icon" 
                title="Luhmannian Concept: Operative Geschlossenheit (Operational Closure). Measures (Core -> Core links) / (Total Core outgoing links). A rising trend indicates that the INCOSE system is increasingly referencing its own historical communications, establishing systemic autonomy and canon memory over relying solely on external fields."
              >?</span>
            </div>
            <div class="card-legend">
              <span class="legend-item"><span class="legend-color cyan"></span> Closure Rate (%)</span>
              <span class="legend-item"><span class="legend-color gray-bar"></span> Publication Volume</span>
            </div>
          </div>
          <div ref="chartClosureRef" class="chart-canvas"></div>
        </div>
        <!-- CHART 2: Price Index vs Median Epistemic Lag -->
        <div 
          class="chart-card" 
          v-show="activeTab === 'all' || activeTab === 'eigenzeit'"
          :class="{ 'expanded-chart': activeTab === 'eigenzeit' }"
        >
          <div class="chart-card-header">
            <div class="card-title">
              <span class="chart-indicator indicator-green"></span>
              <h3>Eigenzeit: Price Index (% refs &le; 5 yrs) vs. Median Epistemic Lag</h3>
              <span 
                class="help-icon" 
                title="Scientometric & Luhmannian Concept: Temporal Asynchrony (Eigenzeit). Derek de Solla Price Index measures the share of citations pointing to contemporary external literature (<= 5 years old). Epistemic Lag tracks the median age of cited knowledge. High Price Index & low Lag indicate vibrant structural coupling with contemporary frontiers; low Price Index & high Lag reveal reliance on historical classics."
              >?</span>
            </div>
            <div class="card-legend">
              <span class="legend-item"><span class="legend-color green"></span> Price Index (%)</span>
              <span class="legend-item"><span class="legend-color amber"></span> Median Lag (yrs)</span>
            </div>
          </div>
          <div ref="chartEigenzeitRef" class="chart-canvas"></div>
        </div>

        <!-- CHART 3: Shannon Diversity -->
        <div 
          class="chart-card" 
          v-show="activeTab === 'all' || activeTab === 'diversity'"
          :class="{ 'expanded-chart': activeTab === 'diversity' }"
        >
          <div class="chart-card-header">
            <div class="card-title">
              <span class="chart-indicator indicator-purple"></span>
              <h3>Interdisciplinary Breadth: Shannon Diversity (H') across External Fields</h3>
              <span 
                class="help-icon" 
                title="Information Theory & Luhmannian Irritation Diversity: H' = -∑ p_i ln(p_i) across external OpenAlex scientific fields. Measures whether INCOSE distributes its external attention evenly across diverse scientific domains (high entropy) or narrows down to a monolithic monoculture (low entropy)."
              >?</span>
            </div>
            <div class="card-legend">
              <span class="legend-item"><span class="legend-color purple"></span> Shannon Entropy H' (nats)</span>
            </div>
          </div>
          <div ref="chartDiversityRef" class="chart-canvas"></div>
        </div>
      </div>

      <div v-else class="empty-state">
        <p>No longitudinal citation data available for the active filters.</p>
        <span class="empty-hint">Ensure core INCOSE papers with valid publication years (1990–2025) are loaded in the dataset.</span>
      </div>

      <div class="modal-footer">
        <span class="footer-tip">💡 Tip: Hover over data points to inspect exact yearly metrics and sample volumes.</span>
        <button class="footer-close-btn" @click="close">Close Trends</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import * as echarts from 'echarts'
import { useGraphStore } from '../../store/graphStore.js'

const store = useGraphStore()
const activeTab = ref('all') // 'all' | 'closure' | 'eigenzeit' | 'diversity'

const chartClosureRef = ref(null)
const chartEigenzeitRef = ref(null)
const chartDiversityRef = ref(null)

let chartClosure = null
let chartEigenzeit = null
let chartDiversity = null

const metricsData = computed(() => store.longitudinalMetrics || [])

const temporalSpan = computed(() => {
  if (!metricsData.value || metricsData.value.length === 0) return '—'
  const first = metricsData.value[0].year
  const last = metricsData.value[metricsData.value.length - 1].year
  return first === last ? `${first}` : `${first}–${last}`
})

const totalAuditedPapers = computed(() => {
  return metricsData.value.reduce((acc, row) => acc + (row.paperCount || 0), 0)
})

const avgClosureRate = computed(() => {
  if (metricsData.value.length === 0) return 0
  const sum = metricsData.value.reduce((acc, row) => acc + (row.closureRate || 0), 0)
  return sum / metricsData.value.length
})

const overallMedianLag = computed(() => {
  const valid = metricsData.value.filter(r => r.medianLag !== null)
  if (valid.length === 0) return null
  const sum = valid.reduce((acc, r) => acc + r.medianLag, 0)
  return sum / valid.length
})

const meanShannonDiversity = computed(() => {
  if (metricsData.value.length === 0) return 0
  const sum = metricsData.value.reduce((acc, row) => acc + (row.shannonDiversity || 0), 0)
  return sum / metricsData.value.length
})

const setTab = (tab) => {
  activeTab.value = tab
  nextTick(() => {
    resizeCharts()
  })
}

const close = () => {
  store.isLongitudinalOpen = false
}
const initOrUpdateCharts = () => {
  const data = metricsData.value
  if (!data || data.length === 0) return

  const years = data.map(d => d.year)
  const closureRates = data.map(d => Number(d.closureRate.toFixed(2)))
  const paperCounts = data.map(d => d.paperCount)
  const priceIndexes = data.map(d => d.priceIndex !== null ? Number(d.priceIndex.toFixed(2)) : null)
  const medianLags = data.map(d => d.medianLag !== null ? Number(d.medianLag.toFixed(1)) : null)
  const shannonValues = data.map(d => Number(d.shannonDiversity.toFixed(3)))

  // Common dark theme options
  const commonXAxis = {
    type: 'category',
    data: years,
    boundaryGap: false,
    axisLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.2)' } },
    axisTick: { lineStyle: { color: 'rgba(255, 255, 255, 0.2)' } },
    axisLabel: { color: '#888', fontSize: 10 }
  }

  // 1. CLOSURE CHART
  if (chartClosureRef.value) {
    if (!chartClosure) {
      chartClosure = echarts.init(chartClosureRef.value)
    }
    const closureOption = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(15, 15, 25, 0.95)',
        borderColor: '#00bfff',
        borderWidth: 1,
        textStyle: { color: '#eee', fontSize: 11 },
        formatter: (params) => {
          let res = `<div style="font-weight:bold;margin-bottom:4px;color:#00bfff;">${params[0].axisValue}</div>`
          params.forEach(p => {
            if (p.seriesName === 'Operational Closure Rate') {
              res += `<div>🔒 Closure Rate: <strong>${p.value !== null ? p.value + '%' : 'N/A'}</strong></div>`
            } else if (p.seriesName === 'Core Papers') {
              res += `<div>📄 INCOSE Papers: <strong>${p.value}</strong></div>`
            }
          })
          return res
        }
      },
      grid: { left: 45, right: 55, top: 25, bottom: 25 },
      xAxis: { ...commonXAxis, boundaryGap: true },
      yAxis: [
        {
          type: 'value',
          name: '%',
          nameTextStyle: { color: '#00bfff', fontSize: 10 },
          axisLabel: { color: '#00bfff', fontSize: 10, formatter: '{value}%' },
          splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.05)' } }
        },
        {
          type: 'value',
          name: 'Papers',
          nameTextStyle: { color: '#777', fontSize: 10 },
          axisLabel: { color: '#777', fontSize: 10 },
          splitLine: { show: false }
        }
      ],
      series: [
        {
          name: 'Core Papers',
          type: 'bar',
          yAxisIndex: 1,
          data: paperCounts,
          barMaxWidth: 16,
          itemStyle: {
            color: 'rgba(255, 255, 255, 0.09)',
            borderRadius: [3, 3, 0, 0]
          }
        },
        {
          name: 'Operational Closure Rate',
          type: 'line',
          yAxisIndex: 0,
          data: closureRates,
          smooth: true,
          symbolSize: 6,
          itemStyle: { color: '#00bfff' },
          lineStyle: { width: 2.5, color: '#00bfff' },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(0, 191, 255, 0.3)' },
              { offset: 1, color: 'rgba(0, 191, 255, 0.0)' }
            ])
          }
        }
      ]
    }
    chartClosure.setOption(closureOption, true)
  }

  // 2. EIGENZEIT CHART (Price Index vs Median Lag)
  if (chartEigenzeitRef.value) {
    if (!chartEigenzeit) {
      chartEigenzeit = echarts.init(chartEigenzeitRef.value)
    }
    const eigenzeitOption = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(15, 15, 25, 0.95)',
        borderColor: '#5cb85c',
        borderWidth: 1,
        textStyle: { color: '#eee', fontSize: 11 },
        formatter: (params) => {
          let res = `<div style="font-weight:bold;margin-bottom:4px;color:#5cb85c;">${params[0].axisValue}</div>`
          params.forEach(p => {
            if (p.seriesName === 'Price Index') {
              res += `<div>⏳ Price Index (&le;5y): <strong>${p.value !== null ? p.value + '%' : 'N/A'}</strong></div>`
            } else if (p.seriesName === 'Median Epistemic Lag') {
              res += `<div>🕰 Median Lag: <strong>${p.value !== null ? p.value + ' yrs' : 'N/A'}</strong></div>`
            }
          })
          return res
        }
      },
      grid: { left: 45, right: 55, top: 25, bottom: 25 },
      xAxis: commonXAxis,
      yAxis: [
        {
          type: 'value',
          name: 'Price Index (%)',
          nameTextStyle: { color: '#5cb85c', fontSize: 10 },
          axisLabel: { color: '#5cb85c', fontSize: 10, formatter: '{value}%' },
          splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.05)' } }
        },
        {
          type: 'value',
          name: 'Median Lag (yrs)',
          nameTextStyle: { color: '#ffaa00', fontSize: 10 },
          axisLabel: { color: '#ffaa00', fontSize: 10, formatter: '{value} y' },
          splitLine: { show: false }
        }
      ],
      series: [
        {
          name: 'Price Index',
          type: 'line',
          yAxisIndex: 0,
          data: priceIndexes,
          smooth: true,
          symbolSize: 6,
          itemStyle: { color: '#5cb85c' },
          lineStyle: { width: 2, color: '#5cb85c' }
        },
        {
          name: 'Median Epistemic Lag',
          type: 'line',
          yAxisIndex: 1,
          data: medianLags,
          smooth: true,
          symbolSize: 6,
          itemStyle: { color: '#ffaa00' },
          lineStyle: { width: 2, color: '#ffaa00' }
        }
      ]
    }
    chartEigenzeit.setOption(eigenzeitOption, true)
  }

  // 3. SHANNON DIVERSITY CHART
  if (chartDiversityRef.value) {
    if (!chartDiversity) {
      chartDiversity = echarts.init(chartDiversityRef.value)
    }
    const diversityOption = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(15, 15, 25, 0.95)',
        borderColor: '#9b59b6',
        borderWidth: 1,
        textStyle: { color: '#eee', fontSize: 11 },
        formatter: (params) => {
          let res = `<div style="font-weight:bold;margin-bottom:4px;color:#9b59b6;">${params[0].axisValue}</div>`
          params.forEach(p => {
            res += `<div>🌐 Shannon Entropy (H'): <strong>${p.value !== null ? p.value : '0.000'}</strong></div>`
          })
          return res
        }
      },
      grid: { left: 45, right: 35, top: 25, bottom: 25 },
      xAxis: commonXAxis,
      yAxis: {
        type: 'value',
        name: "H' (nats)",
        nameTextStyle: { color: '#9b59b6', fontSize: 10 },
        axisLabel: { color: '#9b59b6', fontSize: 10 },
        splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.05)' } }
      },
      series: [
        {
          name: 'Shannon Diversity',
          type: 'line',
          data: shannonValues,
          smooth: true,
          symbolSize: 6,
          itemStyle: { color: '#9b59b6' },
          lineStyle: { width: 2.5, color: '#9b59b6' },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(155, 89, 182, 0.3)' },
              { offset: 1, color: 'rgba(155, 89, 182, 0.0)' }
            ])
          }
        }
      ]
    }
    chartDiversity.setOption(diversityOption, true)
  }
}

const resizeCharts = () => {
  if (chartClosure) chartClosure.resize()
  if (chartEigenzeit) chartEigenzeit.resize()
  if (chartDiversity) chartDiversity.resize()
}

const disposeCharts = () => {
  if (chartClosure) {
    chartClosure.dispose()
    chartClosure = null
  }
  if (chartEigenzeit) {
    chartEigenzeit.dispose()
    chartEigenzeit = null
  }
  if (chartDiversity) {
    chartDiversity.dispose()
    chartDiversity = null
  }
}

watch(
  () => store.isLongitudinalOpen,
  (isOpen) => {
    if (isOpen) {
      nextTick(() => {
        initOrUpdateCharts()
        setTimeout(resizeCharts, 80)
      })
    } else {
      disposeCharts()
    }
  }
)

watch(
  [() => store.longitudinalMetrics, () => store.selectedISSNs, () => store.activeFilters.taxonomy, () => store.metrics?.isCitationFilterActive],
  () => {
    if (store.isLongitudinalOpen) {
      nextTick(() => {
        initOrUpdateCharts()
        resizeCharts()
      })
    }
  },
  { deep: true }
)

const onWindowResize = () => {
  if (store.isLongitudinalOpen) {
    resizeCharts()
  }
}

onMounted(() => {
  window.addEventListener('resize', onWindowResize)
  if (store.isLongitudinalOpen) {
    nextTick(() => {
      initOrUpdateCharts()
    })
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onWindowResize)
  disposeCharts()
})
</script>
<style scoped>
#modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(4px);
  z-index: 999;
}

#longitudinal-modal {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(15, 15, 25, 0.97);
  border: 1px solid #00bfff;
  padding: 22px;
  border-radius: 8px;
  z-index: 1000;
  width: 1100px;
  max-width: 96vw;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 0 35px rgba(0, 191, 255, 0.25);
  backdrop-filter: blur(10px);
  color: #eee;
  box-sizing: border-box;
}

.modal-close {
  position: absolute;
  top: 14px;
  right: 18px;
  font-size: 16px;
  color: #888;
  cursor: pointer;
  transition: color 0.2s;
}

.modal-close:hover {
  color: #00bfff;
}

.modal-header {
  margin-bottom: 12px;
}

.title-with-badge {
  display: flex;
  align-items: center;
  gap: 10px;
}

.title-with-badge h2 {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  color: #fff;
  letter-spacing: 0.5px;
}

.luhmann-badge {
  background: rgba(0, 191, 255, 0.15);
  border: 1px solid rgba(0, 191, 255, 0.4);
  color: #00bfff;
  font-size: 10px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 4px;
  text-transform: uppercase;
}

.modal-subtitle {
  font-size: 11px;
  line-height: 1.45;
  color: #999;
  margin: 6px 0 0 0;
}

.term {
  color: #ccc;
  font-weight: 600;
}

.scope-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  background: rgba(0, 191, 255, 0.08);
  border: 1px solid rgba(0, 191, 255, 0.25);
  border-radius: 6px;
  padding: 6px 12px;
  margin-bottom: 10px;
  font-size: 11px;
  flex-wrap: wrap;
}

.scope-item {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
}

.scope-label {
  font-size: 9.5px;
  color: #7dd3fc;
  text-transform: uppercase;
  font-weight: 600;
  letter-spacing: 0.3px;
}

.scope-val {
  color: #fff;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 320px;
}

.scope-divider {
  width: 1px;
  height: 14px;
  background: rgba(255, 255, 255, 0.15);
}

.scope-badge {
  margin-left: auto;
  font-size: 9.5px;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(255, 170, 0, 0.18);
  border: 1px solid rgba(255, 170, 0, 0.4);
  color: #ffaa00;
  font-weight: 600;
  letter-spacing: 0.3px;
}

.r-sub {
  font-size: 9.5px;
  color: #888;
  font-family: monospace;
  margin-top: 2px;
}

.summary-ribbon {
  display: flex;
  gap: 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  padding: 8px 14px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}

.ribbon-metric {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 90px;
}

.r-label {
  font-size: 9px;
  text-transform: uppercase;
  color: #777;
  letter-spacing: 0.3px;
}

.r-val {
  font-size: 14px;
  font-weight: 700;
  color: #eee;
}

.val-accent {
  color: #00bfff !important;
}

.val-warning {
  color: #ffaa00 !important;
}

.val-purple {
  color: #c084fc !important;
}

.view-tabs {
  display: flex;
  gap: 6px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}

.tab-btn {
  padding: 4px 10px;
  font-size: 10.5px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 4px;
  color: #aaa;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: inherit;
}

.tab-btn:hover {
  background: rgba(0, 191, 255, 0.15);
  color: #fff;
}

.tab-btn.active {
  background: rgba(0, 191, 255, 0.25);
  border-color: #00bfff;
  color: #00bfff;
  font-weight: 600;
}

.charts-body {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-right: 4px;
  margin-bottom: 10px;
}

.charts-body::-webkit-scrollbar {
  width: 5px;
}

.charts-body::-webkit-scrollbar-thumb {
  background: rgba(0, 191, 255, 0.3);
  border-radius: 3px;
}

.chart-card {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
}

.chart-card.expanded-chart {
  min-height: 380px;
}

.chart-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
  flex-wrap: wrap;
  gap: 6px;
}

.card-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.card-title h3 {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  color: #ddd;
}

.chart-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}

.indicator-cyan { background: #00bfff; box-shadow: 0 0 6px #00bfff; }
.indicator-green { background: #5cb85c; box-shadow: 0 0 6px #5cb85c; }
.indicator-purple { background: #9b59b6; box-shadow: 0 0 6px #9b59b6; }

.help-icon {
  font-size: 10px;
  color: #888;
  border: 1px solid #555;
  border-radius: 50%;
  width: 14px;
  height: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: help;
  transition: all 0.2s ease;
}

.help-icon:hover {
  color: #00bfff;
  border-color: #00bfff;
}

.card-legend {
  display: flex;
  gap: 10px;
  align-items: center;
}

.legend-item {
  font-size: 10px;
  color: #888;
  display: flex;
  align-items: center;
  gap: 5px;
}

.legend-color {
  width: 10px;
  height: 3px;
  border-radius: 2px;
  display: inline-block;
}

.legend-color.cyan { background: #00bfff; }
.legend-color.gray-bar { background: rgba(255, 255, 255, 0.4); height: 6px; }
.legend-color.green { background: #5cb85c; }
.legend-color.amber { background: #ffaa00; }
.legend-color.purple { background: #9b59b6; }

.chart-canvas {
  width: 100%;
  height: 220px;
}

.expanded-chart .chart-canvas {
  height: 360px;
}

.empty-state {
  padding: 40px 10px;
  text-align: center;
  color: #888;
}

.empty-hint {
  display: block;
  font-size: 11px;
  color: #555;
  margin-top: 6px;
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.footer-tip {
  font-size: 10px;
  color: #777;
}

.footer-close-btn {
  padding: 6px 14px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 4px;
  color: #ddd;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.footer-close-btn:hover {
  background: rgba(255, 255, 255, 0.18);
  color: #fff;
}
</style>



