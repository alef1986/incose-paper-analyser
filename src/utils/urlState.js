const SESSION_KEY = 'incose_access_key'

function shortenNodeId(id) {
  if (!id || typeof id !== 'string') return ''
  return id.replace(/^https?:\/\/openalex\.org\//i, '')
}

function expandNodeId(rawId, graphModel) {
  if (!rawId) return null
  if (graphModel?.nodes?.has(rawId)) return rawId
  const oaUrl = `https://openalex.org/${rawId}`
  if (graphModel?.nodes?.has(oaUrl)) return oaUrl
  return null
}

function compressYears(years) {
  if (!Array.isArray(years) || years.length === 0) return ''
  const sorted = [...new Set(years.map(y => parseInt(y, 10)).filter(y => !isNaN(y)))].sort((a, b) => a - b)
  if (sorted.length === 0) return ''
  const ranges = []
  let start = sorted[0]
  let prev = sorted[0]
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === prev + 1) {
      prev = sorted[i]
    } else {
      ranges.push(start === prev ? `${start}` : `${start}-${prev}`)
      start = sorted[i]
      prev = sorted[i]
    }
  }
  ranges.push(start === prev ? `${start}` : `${start}-${prev}`)
  return ranges.join(',')
}

function parseYearsParam(str) {
  if (!str) return []
  const out = new Set()
  str.split(',').forEach(part => {
    const trimmed = part.trim()
    if (!trimmed) return
    if (trimmed.includes('-')) {
      const [a, b] = trimmed.split('-').map(v => parseInt(v, 10))
      if (!isNaN(a) && !isNaN(b) && a <= b && (b - a) <= 100) {
        for (let y = a; y <= b; y++) out.add(y)
      }
    } else {
      const y = parseInt(trimmed, 10)
      if (!isNaN(y)) out.add(y)
    }
  })
  return Array.from(out).sort((a, b) => b - a)
}

/**
 * Serializes active workbench filters, 3D view state, and optional modal/chart
 * settings into a clean shareable URL.
 *
 * @param {Object} store - Pinia graphStore instance
 * @param {Object} [modalOverrides={}] - Optional modal-specific state ({ modal, tab, gran, y, outliers, paper })
 * @param {Object} [options={}] - { includeKey: boolean }
 */
export function buildShareUrl(store, modalOverrides = {}, { includeKey = false } = {}) {
  const params = new URLSearchParams()

  // 1. Modal & chart-specific settings
  const modal = modalOverrides.modal || (
    store.isBlindSpotsOpen ? 'blindspots' : (store.isLongitudinalOpen ? 'trends' : (store.isGuideOpen ? 'guide' : null))
  )
  if (modal) params.set('modal', modal)
  if (modalOverrides.tab) params.set('tab', modalOverrides.tab)
  if (modalOverrides.gran) params.set('gran', modalOverrides.gran)
  if (modalOverrides.y) params.set('y', modalOverrides.y)
  if (modalOverrides.outliers === false) params.set('outliers', '0')
  if (modalOverrides.paper === true) params.set('paper', '1')

  // 2. Journals (ISSNs) — only include when subset is selected
  if (store.trackedIssns && store.selectedISSNs) {
    const allSelected = store.trackedIssns.every(i => store.selectedISSNs.includes(i))
    if (!allSelected && store.selectedISSNs.length > 0) {
      params.set('journals', store.selectedISSNs.join(','))
    }
  }

  // 3. Structural filters & Translator scoring
  if (store.activePreset && store.activePreset !== 'blindspots') {
    params.set('preset', store.activePreset)
  }
  if (store.translatorLensActive) params.set('tl', '1')
  if (store.translatorScoringMode && store.translatorScoringMode !== 'impact') {
    params.set('score', store.translatorScoringMode)
  }
  if (store.citationFrequencyFilter) params.set('cf', '1')
  if (store.uniqueAuthorsFilter) params.set('ua', '1')
  if (store.activeYearsFilterActive && store.activeYearsCount > 1) {
    params.set('ay', String(store.activeYearsCount))
  }
  if (store.lifespanFilterActive && store.lifespanCount > 1) {
    params.set('ls', String(store.lifespanCount))
    if (store.lifespanApplyToCanon) params.set('lsc', '1')
  }

  // 4. Active Slice (Taxonomy & Years)
  if (store.activeFilters?.taxonomy) {
    const taxPath = store.activeFilters.taxonomy.pathString || store.activeFilters.taxonomy.name
    if (taxPath) params.set('tax', taxPath)
  }
  if (store.activeFilters?.years?.length > 0) {
    const yrs = compressYears(store.activeFilters.years)
    if (yrs) params.set('years', yrs)
  }

  // 5. 3D / Main View state (only when not exporting a specific modal)
  if (!modal) {
    if (store.mainView && store.mainView !== 'graph') {
      params.set('view', store.mainView)
    }
    if (store.vizSettings?.globalViewMode && store.vizSettings.globalViewMode !== 'macro') {
      params.set('gmode', store.vizSettings.globalViewMode)
    }
    if (store.vizSettings?.macroGranularity && store.vizSettings.macroGranularity !== 'fields') {
      params.set('mgran', store.vizSettings.macroGranularity)
    }
    if (store.focusedNodeId) {
      params.set('node', shortenNodeId(store.focusedNodeId))
      if (store.vizSettings?.layoutMode && store.vizSettings.layoutMode !== 'force') {
        params.set('layout', store.vizSettings.layoutMode)
      }
    }
  }

  const baseUrl = `${window.location.origin}${window.location.pathname}`
  const qs = params.toString()
  let url = qs ? `${baseUrl}?${qs}` : baseUrl

  if (includeKey) {
    const savedKey = sessionStorage.getItem(SESSION_KEY)
    if (savedKey) {
      url += `#key=${encodeURIComponent(savedKey)}`
    }
  }

  return url
}

/**
 * Restores workbench filters, 3D view, and modal state from URL query parameters.
 * Should be called right after `store.isLoaded` becomes true.
 */
export function applyUrlStateToStore(store, searchString = window.location.search) {
  if (!store || !store.isLoaded || !searchString || searchString.length <= 1) return false
  const params = new URLSearchParams(searchString)
  if ([...params.keys()].length === 0) return false

  // 1. Journals (ISSNs)
  const journalsParam = params.get('journals')
  if (journalsParam) {
    const requested = journalsParam.split(',').map(s => s.trim()).filter(Boolean)
    const valid = requested.filter(i => store.trackedIssns.includes(i))
    if (valid.length > 0) {
      store.selectedISSNs = valid
    }
  }

  // 2. Preset (if specified, apply first as baseline)
  const preset = params.get('preset')
  if (preset && ['bridges', 'classics', 'frontier'].includes(preset)) {
    store.applyUseCasePreset(preset)
  }

  // 3. Explicit structural filter overrides
  if (params.has('tl')) store.translatorLensActive = params.get('tl') === '1'
  const score = params.get('score')
  if (score === 'impact' || score === 'harmonic') {
    store.translatorScoringMode = score
  }
  if (params.has('cf')) store.citationFrequencyFilter = params.get('cf') === '1'
  if (params.has('ua')) store.uniqueAuthorsFilter = params.get('ua') === '1'

  const ay = parseInt(params.get('ay') || '', 10)
  if (!isNaN(ay) && ay >= 1) {
    store.activeYearsFilterActive = true
    store.activeYearsCount = ay
  }

  const ls = parseInt(params.get('ls') || '', 10)
  if (!isNaN(ls) && ls >= 1) {
    store.lifespanFilterActive = true
    store.lifespanCount = ls
    if (params.get('lsc') === '1') store.lifespanApplyToCanon = true
  }

  // 4. Taxonomy & Years slice
  const taxParam = params.get('tax')
  if (taxParam) {
    const parts = taxParam.split(' > ').map(s => s.trim()).filter(Boolean)
    const level = parts.length >= 3 ? 'subfield' : (parts.length === 2 ? 'field' : 'domain')
    const name = parts[parts.length - 1]
    store.setTaxonomyFilter(level, name, parts.join(' > '))
  }

  const yearsParam = params.get('years')
  if (yearsParam) {
    const parsedYears = parseYearsParam(yearsParam)
    if (parsedYears.length > 0) {
      store.setYearFilter(parsedYears)
    }
  }

  // 5. 3D / View settings
  const view = params.get('view')
  if (view === 'sunburst' || view === 'graph') {
    store.mainView = view
  }
  const gmode = params.get('gmode')
  if (gmode === 'macro' || gmode === 'raw') {
    store.vizSettings.globalViewMode = gmode
  }
  const mgran = params.get('mgran')
  if (mgran === 'fields' || mgran === 'subfields') {
    store.vizSettings.macroGranularity = mgran
  }

  // Recalculate metrics with all restored filters
  store.recalculateMetrics()

  // 6. Focal Node & Layout Mode (after metrics recalculated)
  const nodeParam = params.get('node')
  if (nodeParam) {
    const resolvedId = expandNodeId(nodeParam, store.graphModel)
    if (resolvedId) {
      const layout = params.get('layout')
      if (layout === 'translationFlow' || layout === 'force') {
        store.vizSettings.layoutMode = layout
      }
      store.focusedNodeId = resolvedId
    }
  }

  // 7. Modal & Chart Tabs
  const modal = params.get('modal')
  if (modal === 'blindspots') {
    store.modalUrlIntent = {
      modal: 'blindspots',
      tab: params.get('tab') || null,
      gran: params.get('gran') || null,
      y: params.get('y') || null,
      outliers: params.has('outliers') ? params.get('outliers') !== '0' : null,
      paper: params.get('paper') === '1'
    }
    store.isBlindSpotsOpen = true
  } else if (modal === 'trends') {
    store.modalUrlIntent = {
      modal: 'trends',
      tab: params.get('tab') || null,
      paper: params.get('paper') === '1'
    }
    store.isLongitudinalOpen = true
  } else if (modal === 'guide') {
    store.isGuideOpen = true
  }

  return true
}

/**
 * Copies text to clipboard with graceful fallback.
 */
export async function copyTextToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Fallback below
    }
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.left = '-9999px'
    document.body.appendChild(ta)
    ta.focus()
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}
