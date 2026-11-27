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

    <!-- Back to Macro Map floating pill when focused on a node or cluster -->
    <button
      v-if="store.mainView === 'graph' && store.isLoaded && store.isVizActive && (store.focusedNodeId || store.focusedClique) && store.vizSettings.globalViewMode === 'macro'"
      type="button"
      class="back-to-macro-btn"
      @click="returnToMacroMap"
      title="Return to the 3D Macro Landscape Map (Disciplines × Top Translators)"
    >
      ← Back to Macro Map
    </button>

    <!-- 3D Viewport Quick Actions (Fit Optimal Angle & Export Labeled PNG) -->
    <div
      v-if="store.mainView === 'graph' && store.isLoaded && store.isVizActive"
      class="viewport-3d-tools"
    >
      <button
        type="button"
        class="tool-3d-btn"
        @click="fitOptimalView"
        title="Auto-align camera along optimal plane of spread and fit all nodes to screen"
      >
        ⌖ Fit View
      </button>
      <button
        type="button"
        class="tool-3d-btn export-3d-btn"
        @click="export3DPng"
        title="Export high-resolution 3D PNG with smart non-overlapping node labels and legend"
      >
        📷 PNG
      </button>
    </div>

    <!-- Контекстная легенда -->
    <div class="viewport-legend" v-if="store.mainView === 'graph' && store.graphModel">
      <h4 class="legend-title">
        {{ store.focusedClique
            ? 'Cluster Subgraph'
            : (isMacroMode ? 'Macro Landscape (Disciplines × Translators)' : 'Graph Taxonomy') }}
      </h4>
      <template v-if="store.focusedClique">
        <div class="legend-item">
          <span class="color-dot clique-member"></span> 
          {{ store.vizSettings.collapseCliqueSuperNode ? 'Cluster Super-Node' : 'Cluster Member' }}
        </div>
        <div class="legend-item"><span class="color-dot incose"></span> Other Core</div>
        <div class="legend-item"><span class="color-dot target"></span> Environment</div>
      </template>
      <template v-else-if="isMacroMode">
        <div class="legend-item"><span class="crystal-icon">◆</span> Domain Translator (INCOSE Core Crystal)</div>
        <div class="legend-item"><span class="color-dot dom-physical"></span> Physical Sciences (Sphere)</div>
        <div class="legend-item"><span class="color-dot dom-social"></span> Social Sciences (Sphere)</div>
        <div class="legend-item"><span class="color-dot dom-life"></span> Life Sciences (Sphere)</div>
        <div class="legend-item"><span class="color-dot dom-health"></span> Health Sciences (Sphere)</div>
        <div class="legend-flow-note">
          Click a Discipline sphere to filter • Click a Cyan crystal to inspect its 3-Tier Translation Flow
        </div>
      </template>
      <template v-else>
        <div class="legend-item"><span class="color-dot incose"></span> Core (INCOSE)</div>
        <div class="legend-item"><span class="color-dot canon"></span> Assimilated Canon</div>
        <div class="legend-item"><span class="color-dot target"></span> Environment (External)</div>
        <div class="legend-item"><span class="color-dot irrel"></span> Not Relevant</div>
        <div class="legend-item" v-if="store.focusedNodeId"><span class="color-dot ego"></span> Focal Node (Ego)</div>
      </template>
      <div v-if="store.focusedNodeId && store.vizSettings.layoutMode === 'translationFlow'" class="legend-flow-note">
        Left: Cited Sources (Input) ➔ Center: Translator ➔ Right: Citing INCOSE Papers (Diffusion)
      </div>
    </div>

    <div v-if="tooltip.node && store.vizSettings.enableTooltip" class="custom-tooltip" :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }" @mouseenter="isHoveringTooltip = true" @mouseleave="hideTooltip">
      <template v-if="tooltip.node.type === 'discipline_supernode'">
        <div class="tt-title">{{ tooltip.node.title }}</div>
        <div class="tt-meta"><b>Domain:</b> {{ tooltip.node.domain }}</div>
        <div class="tt-meta"><b>Imports:</b> {{ (tooltip.node.totalCitations || 0).toLocaleString() }} citations ({{ tooltip.node.uniqueWorks || 0 }} unique works)</div>
        <div class="tt-meta"><b>Translators:</b> {{ tooltip.node.translatorCount || 0 }} bridge papers</div>
        <a class="tt-link" @click.prevent="filterByDisciplineNode(tooltip.node)">Filter Dashboard by Discipline &rarr;</a>
      </template>
      <template v-else-if="tooltip.node.type === 'macro_translator'">
        <div class="tt-title">{{ tooltip.node.title }}</div>
        <div class="tt-meta"><b>Author:</b> {{ formatAuthors(tooltip.node.authors) }} ({{ tooltip.node.publicationYear || 'N/A' }})</div>
        <div class="tt-meta"><b>Bridge Metrics:</b> Env Out: {{ tooltip.node.eOut }} · Indep. Core In: {{ tooltip.node.cInIndep }}</div>
        <div class="tt-meta" v-if="tooltip.node.topField"><b>Primary Channel:</b> {{ tooltip.node.topField }}</div>
        <div class="tt-actions-row">
          <a class="tt-link" @click.prevent="inspectTranslatorFlow(tooltip.node.id)">3-Tier Flow &rarr;</a>
          <a class="tt-link tt-link-secondary" @click.prevent="openCard(tooltip.node.id)">Open Card</a>
        </div>
      </template>
      <template v-else>
        <div class="tt-title">{{ tooltip.node.title }}</div>
        <div class="tt-meta"><b>Author:</b> {{ formatAuthors(tooltip.node.authors) }}</div>
        <div class="tt-meta"><b>Source:</b> {{ getSourceName(tooltip.node.issns) }}</div>
        <a v-if="tooltip.node.type !== 'clique_supernode'" class="tt-link" @click.prevent="openCard(tooltip.node.id)">Open Card &rarr;</a>
      </template>
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
import { ref, reactive, computed, watch, onBeforeUnmount, onMounted, nextTick } from 'vue'
import ForceGraph3D from '3d-force-graph'
import * as THREE from 'three'
import { useGraphStore, issnMap } from '../../store/graphStore.js'
import { getCanonicalDomainColor } from '../../utils/domainColors.js'

const store = useGraphStore()
const graphContainer = ref(null)
let Graph = null 

// РЕАКТИВНЫЕ КООРДИНАТЫ ДЛЯ 3D-ГРАФА
const pipStyles = reactive({ top: '0px', left: '0px', width: '100%', height: '100%' })
let pipResizeObserver = null

const tooltip = ref({ node: null, x: 0, y: 0 })
const isHoveringTooltip = ref(false)
let hideTimeout = null
let mouseX = 0, mouseY = 0

// Large graph rendering alert states
const showWarningModal = ref(false)
const pendingNodeCount = ref(0)
let pendingGraphData = null
let physicsTimeout = null
let defaultChargeForce = null
let defaultLinkForce = null

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

let pendingAutoFit = false
let translatorCrystalGeo = null
let translatorCrystalMat = null

const getTranslatorCrystalMesh = (node) => {
  if (!translatorCrystalGeo) {
    translatorCrystalGeo = new THREE.OctahedronGeometry(1, 0)
  }
  if (!translatorCrystalMat) {
    translatorCrystalMat = new THREE.MeshLambertMaterial({
      color: '#00bfff',
      emissive: '#006699',
      emissiveIntensity: 0.45,
      transparent: true,
      opacity: 0.96
    })
  }
  const r = Math.cbrt(getNodeSize(node)) * 4.4
  const mesh = new THREE.Mesh(translatorCrystalGeo, translatorCrystalMat)
  mesh.scale.set(r, r * 1.28, r)
  return mesh
}

const isMacroMode = computed(() => {
  return !store.focusedNodeId && !store.focusedClique && store.vizSettings.globalViewMode === 'macro'
})

const returnToMacroMap = () => {
  store.focusedNodeId = null
  store.focusedClique = null
  hideTooltip()
}

const filterByDisciplineNode = (node) => {
  if (!node || !node.pathString) return
  store.setTaxonomyFilter(node.level || 'field', node.title, node.pathString)
  hideTooltip()
}

const inspectTranslatorFlow = (nodeId) => {
  store.vizSettings.layoutMode = 'translationFlow'
  store.setFocusedNode(nodeId)
  hideTooltip()
}

/**
 * Computes the unit eigenvector corresponding to the smallest eigenvalue of a 3x3
 * symmetric covariance matrix via Jacobi rotations. Looking along this normal
 * projects the 3D cloud onto its 2D plane of maximum spread (minimizing overlap).
 */
const findSmallestEigenvector3x3 = (m) => {
  const a = [
    [m[0][0], m[0][1], m[0][2]],
    [m[1][0], m[1][1], m[1][2]],
    [m[2][0], m[2][1], m[2][2]]
  ]
  const v = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1]
  ]

  for (let iter = 0; iter < 24; iter++) {
    let p = 0, q = 1
    let maxOff = Math.abs(a[0][1])
    if (Math.abs(a[0][2]) > maxOff) { maxOff = Math.abs(a[0][2]); p = 0; q = 2 }
    if (Math.abs(a[1][2]) > maxOff) { maxOff = Math.abs(a[1][2]); p = 1; q = 2 }
    if (maxOff < 1e-8) break

    const app = a[p][p], aqq = a[q][q], apq = a[p][q]
    const tau = (aqq - app) / (2 * apq)
    const t = tau >= 0 ? 1 / (tau + Math.sqrt(1 + tau * tau)) : -1 / (-tau + Math.sqrt(1 + tau * tau))
    const c = 1 / Math.sqrt(1 + t * t)
    const s = t * c

    a[p][p] = app - t * apq
    a[q][q] = aqq + t * apq
    a[p][q] = 0
    a[q][p] = 0

    for (let r = 0; r < 3; r++) {
      if (r !== p && r !== q) {
        const arp = a[r][p], arq = a[r][q]
        a[r][p] = a[p][r] = c * arp - s * arq
        a[r][q] = a[q][r] = s * arp + c * arq
      }
      const vrp = v[r][p], vrq = v[r][q]
      v[r][p] = c * vrp - s * vrq
      v[r][q] = s * vrp + c * vrq
    }
  }

  let minIdx = 0
  if (a[1][1] < a[minIdx][minIdx]) minIdx = 1
  if (a[2][2] < a[minIdx][minIdx]) minIdx = 2

  const nx = v[0][minIdx], ny = v[1][minIdx], nz = v[2][minIdx]
  const len = Math.hypot(nx, ny, nz) || 1
  return { x: nx / len, y: ny / len, z: nz / len }
}

const fitOptimalView = () => {
  if (!Graph) return
  const gData = Graph.graphData()
  const nodes = (gData?.nodes || []).filter(
    n => Number.isFinite(n.x) && Number.isFinite(n.y) && Number.isFinite(n.z)
  )
  if (nodes.length === 0) {
    Graph.zoomToFit(450, 60)
    return
  }

  // For 3-Tier Translation Flow, face the X-Y plane head-on so Left -> Center -> Right reads cleanly
  if (store.focusedNodeId && store.vizSettings.layoutMode === 'translationFlow') {
    Graph.cameraPosition({ x: 0, y: 0, z: 520 }, { x: 0, y: 0, z: 0 }, 500)
    setTimeout(() => {
      if (Graph) Graph.zoomToFit(400, 60)
    }, 520)
    return
  }

  // Compute centroid
  let cx = 0, cy = 0, cz = 0
  nodes.forEach(n => { cx += n.x; cy += n.y; cz += n.z })
  cx /= nodes.length
  cy /= nodes.length
  cz /= nodes.length

  // Compute 3x3 covariance matrix and bounding radius
  let cxx = 0, cxy = 0, cxz = 0, cyy = 0, cyz = 0, czz = 0
  let maxR = 0
  nodes.forEach(n => {
    const dx = n.x - cx, dy = n.y - cy, dz = n.z - cz
    cxx += dx * dx; cxy += dx * dy; cxz += dx * dz
    cyy += dy * dy; cyz += dy * dz; czz += dz * dz
    const r = Math.hypot(dx, dy, dz)
    if (r > maxR) maxR = r
  })

  const normal = findSmallestEigenvector3x3([
    [cxx, cxy, cxz],
    [cxy, cyy, cyz],
    [cxz, cyz, czz]
  ])

  // Prefer positive Z hemisphere for natural orientation
  const sign = normal.z < 0 ? -1 : 1
  const dist = Math.max(180, maxR * 2.5)
  Graph.cameraPosition(
    { x: cx + normal.x * sign * dist, y: cy + normal.y * sign * dist, z: cz + normal.z * sign * dist },
    { x: cx, y: cy, z: cz },
    500
  )

  setTimeout(() => {
    if (Graph) {
      Graph.zoomToFit(450, 65)
      const controls = Graph.controls()
      if (controls) {
        if (typeof controls.handleResize === 'function') controls.handleResize()
        if (typeof controls.update === 'function') controls.update()
      }
    }
  }, 540)
}

const formatShortLabel = (node) => {
  if (!node) return ''
  if (node.type === 'discipline_supernode') {
    const t = node.title || ''
    return t.length > 26 ? t.substring(0, 24) + '…' : t
  }
  const auth = formatAuthors(node.authors)
  const yr = node.publicationYear || node.year || ''
  if (auth && auth !== 'Unknown') {
    const firstPart = auth.split(',')[0].replace(/\s+et al\.$/, ' et al.')
    return yr ? `${firstPart} (${yr})` : firstPart
  }
  const t = node.title || ''
  return t.length > 24 ? t.substring(0, 22) + '…' : t
}

const export3DPng = () => {
  if (!Graph) return
  const renderer = Graph.renderer()
  const scene = Graph.scene()
  const camera = Graph.camera()
  if (!renderer || !scene || !camera) return

  // Force a fresh WebGL frame right before reading the drawing buffer
  renderer.render(scene, camera)
  const srcCanvas = renderer.domElement
  const logicalW = srcCanvas.clientWidth || srcCanvas.width || 1200
  const logicalH = srcCanvas.clientHeight || srcCanvas.height || 800
  const scale = 2

  const outCanvas = document.createElement('canvas')
  outCanvas.width = logicalW * scale
  outCanvas.height = logicalH * scale
  const ctx = outCanvas.getContext('2d')
  if (!ctx) return

  ctx.scale(scale, scale)

  // 1. Background & WebGL scene capture
  ctx.fillStyle = '#050508'
  ctx.fillRect(0, 0, logicalW, logicalH)
  ctx.drawImage(srcCanvas, 0, 0, logicalW, logicalH)

  // 2. Project key nodes to 2D screen space and draw non-overlapping labels
  const gData = Graph.graphData()
  const allNodes = (gData?.nodes || []).filter(
    n => Number.isFinite(n.x) && Number.isFinite(n.y) && Number.isFinite(n.z)
  )

  let labelCandidates = []
  if (isMacroMode.value) {
    const planets = allNodes
      .filter(n => n.type === 'discipline_supernode')
      .sort((a, b) => (b.totalCitations || 0) - (a.totalCitations || 0))
      .map(n => ({ node: n, priority: 1, color: getCanonicalDomainColor(n.domain), bold: true }))

    const translators = allNodes
      .filter(n => n.type === 'macro_translator')
      .sort((a, b) => (b.synergy || b.cInIndep || 0) - (a.synergy || a.cInIndep || 0))
      .slice(0, 12)
      .map(n => ({ node: n, priority: 2, color: '#7dd3fc', bold: false }))

    labelCandidates = [...planets, ...translators]
  } else if (store.focusedClique) {
    const superN = allNodes.filter(n => n.type === 'clique_supernode')
      .map(n => ({ node: n, priority: 1, color: '#d8b4fe', bold: true }))
    const rest = allNodes
      .filter(n => n.type !== 'clique_supernode')
      .sort((a, b) => (b.inDegree || 0) - (a.inDegree || 0))
      .slice(0, 16)
      .map(n => ({ node: n, priority: 2, color: '#e2e8f0', bold: false }))
    labelCandidates = [...superN, ...rest]
  } else {
    const focal = allNodes
      .filter(n => n.id === store.focusedNodeId)
      .map(n => ({ node: n, priority: 1, color: '#ffaa00', bold: true }))
    const neighbors = allNodes
      .filter(n => n.id !== store.focusedNodeId && !isExcludedByFilter(n))
      .sort((a, b) => (b.inDegree || 0) - (a.inDegree || 0))
      .slice(0, 18)
      .map(n => ({
        node: n,
        priority: 2,
        color: n.type === 'incose_source' ? '#7dd3fc' : (n.type === 'assimilated_canon' ? '#86efac' : '#cbd5e1'),
        bold: false
      }))
    labelCandidates = [...focal, ...neighbors]
  }

  const placedBoxes = []
  const overlaps = (box) =>
    placedBoxes.some(
      b => !(box.x + box.w < b.x || box.x > b.x + b.w || box.y + box.h < b.y || box.y > b.y + b.h)
    )

  const vec = new THREE.Vector3()
  labelCandidates.forEach(({ node, color, bold }) => {
    vec.set(node.x, node.y, node.z).project(camera)
    if (vec.z < -1 || vec.z > 1) return
    const sx = (vec.x * 0.5 + 0.5) * logicalW
    const sy = (-vec.y * 0.5 + 0.5) * logicalH
    if (sx < 24 || sx > logicalW - 24 || sy < 54 || sy > logicalH - 36) return

    const text = formatShortLabel(node)
    if (!text) return

    ctx.font = `${bold ? 'bold ' : ''}${bold ? 11.5 : 10}px "Segoe UI", Arial, sans-serif`
    const metrics = ctx.measureText(text)
    const padX = 5
    const boxW = metrics.width + padX * 2
    const boxH = bold ? 18 : 16
    const bx = sx - boxW / 2
    const by = sy - boxH - 8

    const box = { x: bx - 3, y: by - 3, w: boxW + 6, h: boxH + 6 }
    if (overlaps(box)) return
    placedBoxes.push(box)

    // Pill backdrop for legibility
    ctx.fillStyle = 'rgba(10, 12, 22, 0.78)'
    ctx.strokeStyle = bold ? color : 'rgba(255, 255, 255, 0.22)'
    ctx.lineWidth = bold ? 1 : 0.7
    ctx.beginPath()
    ctx.roundRect(bx, by, boxW, boxH, 3)
    ctx.fill()
    ctx.stroke()

    ctx.fillStyle = color
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, sx, by + boxH / 2)
  })

  // 3. Title & Scope Banner (top-left)
  const modeTitle = store.focusedClique
    ? `INCOSE Citation Cluster Subgraph (${store.focusedClique.size} papers)`
    : isMacroMode.value
      ? `INCOSE 3D Macro Landscape (Disciplines × Top Translators)`
      : store.focusedNodeId
        ? `INCOSE Ego / Translation Flow Network`
        : `INCOSE 3D Citation Network`

  const journals = store.longitudinalScopeSummary?.selectedJournalLabels?.join(', ') || 'All Journals'
  const tax = store.longitudinalScopeSummary?.taxonomyLabel || 'All External Domains'
  const subText = `Journals: ${journals}  |  Taxonomy: ${tax}${store.translatorLensActive ? '  |  Translator Lens ON' : ''}`

  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillStyle = 'rgba(10, 12, 22, 0.82)'
  ctx.fillRect(16, 14, Math.min(logicalW - 32, 620), 44)
  ctx.strokeStyle = 'rgba(0, 191, 255, 0.45)'
  ctx.lineWidth = 1
  ctx.strokeRect(16, 14, Math.min(logicalW - 32, 620), 44)

  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 13px "Segoe UI", Arial, sans-serif'
  ctx.fillText(modeTitle, 26, 21)
  ctx.fillStyle = '#94a3b8'
  ctx.font = '10px "Segoe UI", Arial, sans-serif'
  ctx.fillText(subText, 26, 39)

  // 4. Compact Legend (bottom-left)
  const legendItems = isMacroMode.value
    ? [
        { label: 'Domain Translator (INCOSE Crystal)', color: '#00bfff', shape: 'diamond' },
        { label: 'Physical Sciences', color: '#5b7cfa', shape: 'dot' },
        { label: 'Social Sciences', color: '#f59e0b', shape: 'dot' },
        { label: 'Life Sciences', color: '#14b8a6', shape: 'dot' },
        { label: 'Health Sciences', color: '#f43f5e', shape: 'dot' }
      ]
    : [
        { label: 'Core (INCOSE)', color: '#00bfff', shape: 'dot' },
        { label: 'Assimilated Canon', color: '#5cb85c', shape: 'dot' },
        { label: 'External Environment', color: '#64748b', shape: 'dot' },
        { label: 'Focal Node', color: '#ffaa00', shape: 'dot' }
      ]

  const legW = 225
  const legH = 18 + legendItems.length * 16
  const legX = 16
  const legY = logicalH - legH - 16
  ctx.fillStyle = 'rgba(10, 12, 22, 0.85)'
  ctx.fillRect(legX, legY, legW, legH)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)'
  ctx.strokeRect(legX, legY, legW, legH)

  legendItems.forEach((item, idx) => {
    const iy = legY + 12 + idx * 16
    ctx.fillStyle = item.color
    if (item.shape === 'diamond') {
      ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif'
      ctx.fillText('◆', legX + 10, iy - 1)
    } else {
      ctx.beginPath()
      ctx.arc(legX + 14, iy + 5, 4, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillStyle = '#cbd5e1'
    ctx.font = '10px "Segoe UI", Arial, sans-serif'
    ctx.fillText(item.label, legX + 26, iy)
  })

  // 5. Trigger download
  const suffix = store.focusedClique ? 'cluster' : (isMacroMode.value ? 'macro_landscape' : 'ego_network')
  const a = document.createElement('a')
  a.href = outCanvas.toDataURL('image/png')
  a.download = `incose_3d_${suffix}_hq.png`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

const getNodeSize = (node) => {
  if (node.type === 'discipline_supernode') {
    return Math.max(7, Math.min(28, Math.sqrt(node.totalCitations || 20) * 0.42 + 4))
  }
  if (node.type === 'macro_translator') {
    return Math.max(2.5, Math.min(9, Math.sqrt((node.cInIndep || 1) + 1) * 1.15))
  }
  if (node.type === 'clique_supernode') {
    return Math.max(8, Math.sqrt(node.memberCount || 10) * 3.5)
  }
  let size = Math.max(1, Math.sqrt(node.inDegree || 0) * 0.8)
  if ((node.type === 'incose_source' || node.type === 'assimilated_canon') && size < 2) size = 2
  if (node.type === 'irrelevant') size = 0.5
  return size
}

const layoutLeftTier = (nodes, fixedX) => {
  if (!nodes || nodes.length === 0) return
  nodes.sort((a, b) => {
    const tA = a.domain || a.type || ''
    const tB = b.domain || b.type || ''
    const cmp = tA.localeCompare(tB)
    if (cmp !== 0) return cmp
    return (a.title || '').localeCompare(b.title || '')
  })

  const count = nodes.length
  if (count === 1) {
    nodes[0].fx = fixedX
    nodes[0].fy = 0
    nodes[0].fz = 0
    return
  }

  const ringStep = 32
  let ringIndex = 1
  let assigned = 0
  while (assigned < count) {
    const ringRadius = ringIndex * ringStep
    const ringCapacity = Math.max(6, Math.round((2 * Math.PI * ringRadius) / 26))
    const currentRingCount = Math.min(ringCapacity, count - assigned)
    const angleOffset = (ringIndex * Math.PI) / 6

    for (let i = 0; i < currentRingCount; i++) {
      const node = nodes[assigned + i]
      const angle = (i / currentRingCount) * 2 * Math.PI + angleOffset
      node.fx = fixedX
      node.fy = Math.round(ringRadius * Math.sin(angle) * 10) / 10
      node.fz = Math.round(ringRadius * Math.cos(angle) * 10) / 10
    }
    assigned += currentRingCount
    ringIndex++
  }
}

const layoutRightTier = (nodes, fixedX) => {
  if (!nodes || nodes.length === 0) return
  nodes.sort((a, b) => {
    const yA = parseInt(a.publicationYear || a.year || 0, 10)
    const yB = parseInt(b.publicationYear || b.year || 0, 10)
    if (yA !== yB) return yA - yB
    return (a.title || '').localeCompare(b.title || '')
  })

  const count = nodes.length
  if (count === 1) {
    nodes[0].fx = fixedX
    nodes[0].fy = 0
    nodes[0].fz = 0
    return
  }

  if (count <= 20) {
    const totalHeight = Math.min(360, Math.max(120, (count - 1) * 24))
    const stepY = totalHeight / (count - 1)
    const startY = -totalHeight / 2
    nodes.forEach((node, i) => {
      node.fx = fixedX
      node.fy = Math.round((startY + i * stepY) * 10) / 10
      node.fz = Math.round(((i % 3 - 1) * 24) * 10) / 10
    })
  } else {
    const ringStep = 32
    let ringIndex = 1
    let assigned = 0
    while (assigned < count) {
      const ringRadius = ringIndex * ringStep
      const ringCapacity = Math.max(6, Math.round((2 * Math.PI * ringRadius) / 26))
      const currentRingCount = Math.min(ringCapacity, count - assigned)
      const angleOffset = (ringIndex * Math.PI) / 6

      for (let i = 0; i < currentRingCount; i++) {
        const node = nodes[assigned + i]
        const angle = (i / currentRingCount) * 2 * Math.PI + angleOffset
        node.fx = fixedX
        node.fy = Math.round(ringRadius * Math.sin(angle) * 10) / 10
        node.fz = Math.round(ringRadius * Math.cos(angle) * 10) / 10
      }
      assigned += currentRingCount
      ringIndex++
    }
  }
}

// O(1) Filtering: compute excluded node IDs once when filters or graph model change
const excludedNodeIds = computed(() => {
  const excluded = new Set()
  if (!store.graphModel) return excluded

  const years = store.activeFilters.years
  const taxonomy = store.activeFilters.taxonomy
  const hasYears = years && years.length > 0
  const isFilterActive = hasYears || !!taxonomy

  if (!isFilterActive) return excluded

  const yearsSet = hasYears ? new Set(years) : null

  // Pre-calculate matching taxonomy target IDs
  let taxonomyTargetIds = null
  if (taxonomy) {
    taxonomyTargetIds = new Set()
    const { level, name, pathString } = taxonomy
    if (pathString) {
      const parts = pathString.split(' > ')
      store.graphModel.nodes.forEach(n => {
        const matchDomain = !parts[0] || n.domain === parts[0]
        const matchField = !parts[1] || n.field === parts[1]
        const matchSubfield = !parts[2] || n.subfield === parts[2]
        if (matchDomain && matchField && matchSubfield) {
          taxonomyTargetIds.add(n.id)
        }
      })
    } else if (level && name) {
      store.graphModel.nodes.forEach(n => {
        if (n[level] === name) {
          taxonomyTargetIds.add(n.id)
        }
      })
    }
  }

  // Pre-calculate nodes that cite taxonomy targets (citing core)
  let citingNodeIds = null
  if (taxonomyTargetIds && taxonomyTargetIds.size > 0) {
    citingNodeIds = new Set()
    store.graphModel.links.forEach(l => {
      const s = typeof l.source === 'object' ? l.source.id : l.source
      const t = typeof l.target === 'object' ? l.target.id : l.target
      if (taxonomyTargetIds.has(t)) {
        citingNodeIds.add(s)
      }
    })
  }

  store.graphModel.nodes.forEach(node => {
    // Focused node is never excluded
    if (store.focusedNodeId && node.id === store.focusedNodeId) {
      return
    }

    // Apply year filter
    if (hasYears) {
      const yRaw = node.year || node.publicationYear
      const nodeYear = yRaw ? parseInt(yRaw, 10) : null
      if (nodeYear === null || !yearsSet.has(nodeYear)) {
        excluded.add(node.id)
        return
      }
    }

    // Apply taxonomy filter
    if (taxonomy) {
      const isTaxonomyNode = taxonomyTargetIds ? taxonomyTargetIds.has(node.id) : false
      const isCitingNode = citingNodeIds ? citingNodeIds.has(node.id) : false
      if (!isTaxonomyNode && !isCitingNode) {
        excluded.add(node.id)
      }
    }
  })

  return excluded
})

let rawExcludedSet = new Set()

watch(() => excludedNodeIds.value, (newSet) => {
  rawExcludedSet = newSet || new Set()
  if (Graph) {
    Graph.nodeColor(Graph.nodeColor())
    Graph.nodeVal(Graph.nodeVal())
    Graph.linkColor(Graph.linkColor())
    Graph.linkWidth(Graph.linkWidth())
    Graph.linkDirectionalParticles(link => getLinkParticles(link))
    Graph.linkDirectionalParticleWidth(link => link.isMacroLink ? 0.9 : (isLinkExcluded(link) ? 0.45 : 1.3))
    Graph.linkDirectionalParticleColor(link => link.isMacroLink ? '#e2e8f0' : (isLinkExcluded(link) ? convertToRGBA('#444455', 0.15) : '#ffaa00'))
  }
}, { immediate: true })

const isExcludedByFilter = (node) => {
  if (!node) return false
  return rawExcludedSet.has(node.id)
}

const isLinkExcluded = (link) => {
  if (!link) return false
  if (!store.focusedNodeId) return false
  const years = store.activeFilters.years
  const taxonomy = store.activeFilters.taxonomy
  const isFilterActive = (years && years.length > 0) || taxonomy
  if (!isFilterActive) return false

  const s = typeof link.source === 'object' ? link.source.id : link.source
  const t = typeof link.target === 'object' ? link.target.id : link.target
  const sourceNode = store.graphModel ? store.graphModel.nodes.get(s) : null
  const targetNode = store.graphModel ? store.graphModel.nodes.get(t) : null
  const isSourceExcluded = sourceNode ? isExcludedByFilter(sourceNode) : false
  const isTargetExcluded = targetNode ? isExcludedByFilter(targetNode) : false
  return isSourceExcluded || isTargetExcluded
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
  if (node.type === 'discipline_supernode') {
    const col = getCanonicalDomainColor(node.domain)
    return convertToRGBA(col, 0.94)
  }
  if (node.type === 'macro_translator') {
    return convertToRGBA('#00bfff', 0.96)
  }
  if (node.type === 'clique_supernode') {
    return convertToRGBA('#9b59b6', 0.95)
  }

  if (store.focusedClique && store.focusedClique.members && store.focusedClique.members.includes(node.id)) {
    return convertToRGBA('#9b59b6', 1.0)
  }

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

const getLinkParticles = (link) => {
  if (!store.vizSettings.enableParticles) return 0
  if (link.isMacroLink) return Math.min(3, Math.max(1, Math.round(Math.log2(1 + (link.weight || 1)))))
  if (store.focusedClique) return Math.min(4, link.weight || 2)
  if (store.focusedNodeId && store.vizSettings.layoutMode === 'translationFlow') {
    return isLinkExcluded(link) ? 1 : 3
  }
  return 0
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
    .nodeThreeObject(node => {
      if (node.type === 'macro_translator') {
        return getTranslatorCrystalMesh(node)
      }
      return false
    })
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
    .linkColor(link => {
      if (store.focusedNodeId) {
        const years = store.activeFilters.years
        const taxonomy = store.activeFilters.taxonomy
        const isFilterActive = (years && years.length > 0) || taxonomy
        if (isFilterActive) {
          return isLinkExcluded(link)
            ? convertToRGBA('#9999aa', 0.05)
            : convertToRGBA('#9999aa', 0.85)
        }
      }
      return convertToRGBA('#9999aa', 0.45)
    })
    .linkOpacity(0.6)
    .linkWidth(link => {
      if (link.isMacroLink) {
        return Math.min(1.6, 0.25 + Math.log2(1 + (link.weight || 1)) * 0.35)
      }
      if (store.focusedNodeId) {
        const years = store.activeFilters.years
        const taxonomy = store.activeFilters.taxonomy
        const isFilterActive = (years && years.length > 0) || taxonomy
        if (isFilterActive) {
          return isLinkExcluded(link) ? 0.02 : 0.2
        }
      }
      return 0.2
    })
    .linkDirectionalArrowLength(1.5)
    .linkDirectionalArrowRelPos(1)
    .linkDirectionalParticles(link => getLinkParticles(link))
    .linkDirectionalParticleWidth(link => isLinkExcluded(link) ? 0.45 : 1.3)
    .linkDirectionalParticleSpeed(link => isLinkExcluded(link) ? 0.004 : 0.007)
    .linkDirectionalParticleColor(link => isLinkExcluded(link) ? convertToRGBA('#444455', 0.15) : '#ffaa00')
    .linkDirectionalParticleResolution(8)
    .onNodeClick(node => {
      if (node.type === 'clique_supernode') return
      if (node.type === 'discipline_supernode') {
        filterByDisciplineNode(node)
        return
      }
      if (node.type === 'macro_translator') {
        inspectTranslatorFlow(node.id)
        return
      }
      store.setFocusedNode(node.id)
      hideTooltip()
    })
    .cooldownTicks(100)
    .onEngineStop(() => {
      if (pendingAutoFit && Graph) {
        pendingAutoFit = false
        Graph.zoomToFit(500, 60)
      }
    })
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
  defaultChargeForce = Graph.d3Force('charge')
  defaultLinkForce = Graph.d3Force('link')
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
  if (store.mainView === 'sunburst') {
    syncPipPosition()
  } else {
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
    if (Graph) {
      Graph.width(rect.width).height(rect.height)
      const controls = Graph.controls()
      if (controls) {
        if (typeof controls.handleResize === 'function') controls.handleResize()
        if (typeof controls.update === 'function') controls.update()
      }
    }
  }
}

const startPipObserver = () => {
  stopPipObserver()
  const target = document.getElementById('pip-target')
  if (target) {
    syncPipPosition()
    pipResizeObserver = new ResizeObserver(() => {
      syncPipPosition()
    })
    pipResizeObserver.observe(target)
  }
}

const stopPipObserver = () => {
  if (pipResizeObserver) {
    pipResizeObserver.disconnect()
    pipResizeObserver = null
  }
}

watch(() => store.mainView, async (newVal) => {
  await nextTick()
  if (newVal === 'sunburst') {
    startPipObserver()
    setTimeout(() => {
      if (!pipResizeObserver) startPipObserver()
    }, 50)
  } else {
    // Возвращаем полноэкранный режим 3D-графа
    stopPipObserver()
    
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
    }, 50)
  }
})

const proceedWithGraphData = (data) => {
  if (!Graph) initGraph()

  // Restore forces if previously disabled for large graphs
  if (defaultChargeForce && !Graph.d3Force('charge')) {
    Graph.d3Force('charge', defaultChargeForce)
  }
  if (defaultLinkForce && !Graph.d3Force('link')) {
    Graph.d3Force('link', defaultLinkForce)
  }

  const isMassive = data.nodes && data.nodes.length > 3000;
  
  // Disable arrows on massive graphs to cut geometries by 50%
  Graph.linkDirectionalArrowLength(isMassive ? 0 : 1.5);

  if (store.focusedNodeId && store.vizSettings.layoutMode === 'translationFlow') {
    const focalId = store.focusedNodeId
    const focalNode = data.nodes.find(n => n.id === focalId)
    if (focalNode) {
      focalNode.fx = 0
      focalNode.fy = 0
      focalNode.fz = 0
    }

    const directLeft = new Set()
    const directRight = new Set()

    data.links.forEach(l => {
      const s = typeof l.source === 'object' ? l.source.id : l.source
      const t = typeof l.target === 'object' ? l.target.id : l.target
      if (s === focalId && t !== focalId) directLeft.add(t)
      if (t === focalId && s !== focalId) directRight.add(s)
    })

    // Resolve overlaps
    directLeft.forEach(id => {
      if (directRight.has(id)) {
        const node = data.nodes.find(n => n.id === id)
        if (node && node.type === 'incose_source') {
          directLeft.delete(id)
        } else {
          directRight.delete(id)
        }
      }
    })

    const directLeftNodes = []
    const directRightNodes = []
    const remainingNodes = []

    data.nodes.forEach(n => {
      if (n.id === focalId) return
      if (directLeft.has(n.id)) {
        directLeftNodes.push(n)
      } else if (directRight.has(n.id)) {
        directRightNodes.push(n)
      } else {
        remainingNodes.push(n)
      }
    })

    const left2Nodes = []
    const right2Nodes = []

    remainingNodes.forEach(n => {
      const isLinkedToLeft = data.links.some(l => {
        const s = typeof l.source === 'object' ? l.source.id : l.source
        const t = typeof l.target === 'object' ? l.target.id : l.target
        return (s === n.id && directLeft.has(t)) || (t === n.id && directLeft.has(s))
      })
      if (isLinkedToLeft) {
        left2Nodes.push(n)
      } else {
        const isLinkedToRight = data.links.some(l => {
          const s = typeof l.source === 'object' ? l.source.id : l.source
          const t = typeof l.target === 'object' ? l.target.id : l.target
          return (s === n.id && directRight.has(t)) || (t === n.id && directRight.has(s))
        })
        if (isLinkedToRight) {
          right2Nodes.push(n)
        } else if (n.type === 'incose_source') {
          right2Nodes.push(n)
        } else {
          left2Nodes.push(n)
        }
      }
    })

    layoutLeftTier(directLeftNodes, -160)
    layoutRightTier(directRightNodes, 160)
    layoutLeftTier(left2Nodes, -260)
    layoutRightTier(right2Nodes, 260)

    // Reverse citation links (Citing -> Cited) so knowledge flows Left -> Center -> Right
    data.links = data.links.map(l => ({
      ...l,
      source: typeof l.target === 'object' ? l.target.id : l.target,
      target: typeof l.source === 'object' ? l.source.id : l.source
    }))
  } else {
    // If layoutMode === 'force', ensure fx, fy, fz are cleared (undefined)
    if (data.nodes) {
      data.nodes.forEach(n => {
        delete n.fx
        delete n.fy
        delete n.fz
        n.fx = undefined
        n.fy = undefined
        n.fz = undefined
      })
    }
  }

  Graph.graphData(data)

  if (store.focusedClique) {
    if (store.vizSettings.collapseCliqueSuperNode) {
      Graph.d3Force('charge').strength(node => node.type === 'clique_supernode' ? -200 : -60)
      Graph.d3Force('link').distance(150).strength(0.3)
    } else {
      const membersSet = new Set(store.focusedClique.members);
      Graph.d3Force('charge').strength(node => membersSet.has(node.id) ? -10 : -60);
      Graph.d3Force('link').distance(link => {
        const s = typeof link.source === 'object' ? link.source.id : link.source;
        const t = typeof link.target === 'object' ? link.target.id : link.target;
        if (membersSet.has(s) && membersSet.has(t)) return 1;
        return 150; 
      }).strength(link => {
        const s = typeof link.source === 'object' ? link.source.id : link.source;
        const t = typeof link.target === 'object' ? link.target.id : link.target;
        if (membersSet.has(s) && membersSet.has(t)) return 2.0;
        return 0.1;
      });
    }
  } else if (isMacroMode.value) {
    Graph.d3Force('charge').strength(node => node.type === 'discipline_supernode' ? -130 : -35)
    Graph.d3Force('link').distance(link => Math.max(32, 68 - Math.log2(1 + (link.weight || 1)) * 10)).strength(0.45)
  } else {
    // Reset to defaults
    if (defaultChargeForce) Graph.d3Force('charge', defaultChargeForce);
    if (defaultLinkForce) Graph.d3Force('link', defaultLinkForce);
  }

  Graph.linkDirectionalParticles(link => getLinkParticles(link))
  Graph.linkDirectionalParticleWidth(link => link.isMacroLink ? 0.9 : (isLinkExcluded(link) ? 0.45 : 1.3))
  Graph.linkDirectionalParticleColor(link => link.isMacroLink ? '#e2e8f0' : (isLinkExcluded(link) ? convertToRGBA('#444455', 0.15) : '#ffaa00'))
  if (store.isVizActive) {
    Graph.resumeAnimation()
  }

  Graph.nodeColor(Graph.nodeColor())
  Graph.nodeVal(Graph.nodeVal())
  Graph.nodeOpacity(Graph.nodeOpacity())
  Graph.linkColor(Graph.linkColor())
  Graph.linkWidth(Graph.linkWidth())

  // Центрируем камеру: быстрый первичный fit + финальный fit после стабилизации физики
  pendingAutoFit = true
  setTimeout(() => {
    if (Graph) {
      Graph.zoomToFit(400, 70)
      const controls = Graph.controls()
      if (controls) {
        if (typeof controls.handleResize === 'function') controls.handleResize()
        if (typeof controls.update === 'function') controls.update()
      }
    }
  }, 450)
}

const onContinueRendering = () => {
  showWarningModal.value = false
  if (pendingGraphData) {
    const data = pendingGraphData
    proceedWithGraphData(data)
    pendingGraphData = null

    if (physicsTimeout) {
      clearTimeout(physicsTimeout)
      physicsTimeout = null
    }

    const nodeCount = data.nodes ? data.nodes.length : 0;
    if (nodeCount > 3000) {
      // Immediate physics freeze to prevent CPU deadlock on giant graphs
      if (Graph) {
        Graph.d3Force('charge', null);
        Graph.d3Force('link', null);
      }
    } else if (nodeCount > 1000) {
      physicsTimeout = setTimeout(() => {
        if (Graph) {
          Graph.d3Force('charge', null);
          Graph.d3Force('link', null);
        }
      }, 1500);
    }
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

  if (store.focusedClique) {
    const membersSet = new Set(store.focusedClique.members)
    data = store.graphModel.getCliqueNetwork(
      membersSet, 
      store.vizSettings.collapseCliqueSuperNode, 
      store.focusedClique
    )
  } else if (store.focusedNodeId) {
    // 1. Если выбран узел в Top Hubs, то к окружению должен применяться фильтр года выхода и отраслей.
    data = store.graphModel.getEgoNetwork(store.focusedNodeId, store, store.vizSettings)
  } else if (store.vizSettings.globalViewMode === 'macro') {
    const macro = store.macroLandscapeGraph
    data = {
      nodes: macro.nodes.map(n => ({ ...n })),
      links: macro.links.map(l => ({ ...l }))
    }
  } else {
    // Raw global subgraph mode
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

  if (physicsTimeout) {
    clearTimeout(physicsTimeout)
    physicsTimeout = null
  }

  const nodeCount = data.nodes ? data.nodes.length : 0;
  if (nodeCount > 3000) {
    // Immediate physics freeze to prevent CPU deadlock on giant graphs
    if (Graph) {
      Graph.d3Force('charge', null);
      Graph.d3Force('link', null);
    }
  } else if (nodeCount > 1000) {
    physicsTimeout = setTimeout(() => {
      if (Graph) {
        Graph.d3Force('charge', null);
        Graph.d3Force('link', null);
      }
    }, 1500);
  }
}

// Watch everything that affects the rendered data structure
watch([
  () => store.focusedNodeId, 
  () => store.focusedClique,
  () => store.vizSettings,
  () => store.vizSettings.layoutMode,
  () => store.vizSettings.globalViewMode,
  () => store.vizSettings.macroGranularity,
  () => store.translatorScoringMode,
  () => store.vizSettings.collapseCliqueSuperNode,
  () => store.vizSettings.enableParticles,
  () => store.metrics,
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
      Graph.linkColor(Graph.linkColor())
      Graph.linkWidth(Graph.linkWidth())
      Graph.linkDirectionalParticles(link => getLinkParticles(link))
      Graph.linkDirectionalParticleWidth(link => isLinkExcluded(link) ? 0.45 : 1.3)
      Graph.linkDirectionalParticleColor(link => isLinkExcluded(link) ? convertToRGBA('#444455', 0.15) : '#ffaa00')
    }
  } else {
    updateGraphData()
  }
}, { deep: true })

watch(() => store.vizSettings.enableParticles, () => {
  if (Graph) {
    Graph.linkDirectionalParticles(link => getLinkParticles(link))
    Graph.linkDirectionalParticleWidth(link => isLinkExcluded(link) ? 0.45 : 1.3)
    Graph.linkDirectionalParticleColor(link => isLinkExcluded(link) ? convertToRGBA('#444455', 0.15) : '#ffaa00')
    if (store.isVizActive) {
      Graph.resumeAnimation()
    }
  }
})

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
    nextTick(() => startPipObserver())
  }
  updateGraphData()
})

onBeforeUnmount(() => {
  if (physicsTimeout) {
    clearTimeout(physicsTimeout)
    physicsTimeout = null
  }
  window.removeEventListener('resize', handleWindowResize)
  stopPipObserver()
  if (translatorCrystalGeo) {
    translatorCrystalGeo.dispose()
    translatorCrystalGeo = null
  }
  if (translatorCrystalMat) {
    translatorCrystalMat.dispose()
    translatorCrystalMat = null
  }
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
.color-dot.clique-member { background: #9b59b6; box-shadow: 0 0 5px #9b59b6; }
.color-dot.incose { background: #00bfff; }
.color-dot.canon { background: #5cb85c; }
.color-dot.target { background: #555566; }
.color-dot.irrel { background: #8b0000; }
.color-dot.ego { background: #ffaa00; box-shadow: 0 0 5px #ffaa00; }
.legend-flow-note {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed #444;
  font-size: 10px;
  color: #ffaa00;
  line-height: 1.4;
  max-width: 260px;
}

.back-to-macro-btn {
  position: fixed;
  top: 124px;
  left: 374px;
  z-index: 25;
  padding: 6px 12px;
  background: rgba(15, 17, 28, 0.9);
  border: 1px solid #00bfff;
  border-radius: 20px;
  color: #00bfff;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  pointer-events: auto;
  box-shadow: 0 4px 14px rgba(0, 191, 255, 0.2);
  backdrop-filter: blur(6px);
  transition: all 0.2s ease;
}

.back-to-macro-btn:hover {
  background: #00bfff;
  color: #050510;
}

.color-dot.dom-physical { background: #5b7cfa; }
.color-dot.dom-social { background: #f59e0b; }
.color-dot.dom-life { background: #14b8a6; }
.color-dot.dom-health { background: #f43f5e; }
.crystal-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 12px;
  height: 12px;
  margin-right: 9px;
  color: #00bfff;
  font-size: 13px;
  line-height: 1;
  text-shadow: 0 0 7px rgba(0, 191, 255, 0.8);
}

.tt-actions-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 6px;
}

.tt-link-secondary {
  color: #aaa !important;
}

.tt-link-secondary:hover {
  color: #fff !important;
}


.viewport-3d-tools {
  position: fixed;
  top: 124px;
  right: 374px;
  z-index: 25;
  display: flex;
  align-items: center;
  gap: 6px;
  pointer-events: auto;
}

.tool-3d-btn {
  padding: 5px 10px;
  background: rgba(15, 17, 28, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 18px;
  color: #ddd;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  backdrop-filter: blur(6px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.45);
  transition: all 0.2s ease;
  font-family: inherit;
}

.tool-3d-btn:hover {
  background: rgba(0, 191, 255, 0.22);
  border-color: #00bfff;
  color: #fff;
}

.tool-3d-btn.export-3d-btn {
  border-color: rgba(92, 184, 92, 0.5);
  color: #86efac;
}

.tool-3d-btn.export-3d-btn:hover {
  background: #5cb85c;
  border-color: #5cb85c;
  color: #050510;
}

</style>
