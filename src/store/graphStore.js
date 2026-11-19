import { defineStore } from 'pinia'
import { markRaw } from 'vue'
import { parseIncoseJson } from '../../core/parsers/JsonAdapter.js'
import { runLuhmannAnalysis } from '../../core/algorithms/LuhmannAnalytics.js'

export const issnMap = {
  "1520-6858": "Systems Engineering (Online)",
  "1098-1241": "Systems Engineering (Print)",
  "2156-4868": "INSIGHT (Online)",
  "2156-485X": "INSIGHT (Print)",
  "2334-5837": "INCOSE Int. Symp."
}

function getAuthorSet(authorsStr) {
  if (!authorsStr || typeof authorsStr !== 'string') return new Set()
  return new Set(
    authorsStr
      .split(',')
      .map(s => s.trim().toLowerCase())
      .filter(s => s && s !== 'unknown' && s !== 'anonymous')
  )
}

export function computeLagStats(lags) {
  if (!lags || lags.length === 0) return { mean: null, median: null, q1: null, q3: null, iqr: null }
  const sorted = [...lags].sort((a, b) => a - b)
  const n = sorted.length
  const mean = sorted.reduce((acc, v) => acc + v, 0) / n
  const quantile = (q) => {
    const pos = (n - 1) * q
    const base = Math.floor(pos)
    const rest = pos - base
    return sorted[base + 1] !== undefined
      ? sorted[base] + rest * (sorted[base + 1] - sorted[base])
      : sorted[base]
  }
  const q1 = quantile(0.25)
  const median = quantile(0.5)
  const q3 = quantile(0.75)
  return { mean, median, q1, q3, iqr: q3 - q1 }
}
export function passesIssnFilter(node, trackedIssns, selectedISSNs) {
  if (!node) return false
  const nodeIssns = node.issns || []
  const hasTracked = nodeIssns.some(i => trackedIssns.includes(i))
  if (!hasTracked) return true
  return nodeIssns.some(i => selectedISSNs.includes(i))
}

export function matchesTaxonomy(node, taxonomy) {
  if (!node || !taxonomy) return true
  const { pathString, level, name } = taxonomy
  if (pathString) {
    const parts = pathString.split(' > ')
    const matchDomain = !parts[0] || node.domain === parts[0]
    const matchField = !parts[1] || node.field === parts[1]
    const matchSubfield = !parts[2] || node.subfield === parts[2]
    return matchDomain && matchField && matchSubfield
  }
  if (level && name) {
    return node[level] === name
  }
  return true
}


export const useGraphStore = defineStore('graph', {
  state: () => ({
    activeFilters: {
      years: [], 
      taxonomy: null 
    },
    translatorLensActive: false,
    isBlindSpotsOpen: false,
    isLongitudinalOpen: false,
    activePreset: null, // 'bridges' | 'classics' | 'frontier' | 'blindspots' | null

    graphModel: null,
    isLoaded: false,
    
    mainView: 'graph', 
    
    // ФИКС 1: Добавлено поле issnCounts в стартовые метрики
    metrics: { totalNodes: 0, totalEdges: 0, coreCount: 0, canonCount: 0, envCount: 0, irrelevantCount: 0, issnCounts: {}, coreNodesPerYear: {} },
    topNodes: [],
    
    focusedNodeId: null,
    focusedClique: null,
    echoMinSize: 4,
    echoMaxSize: 500,
    echoMinInsularity: 0.5,
    echoSeed: 42,
    echoRuns: 5,
    echoMetricMode: 'core',
    isVizActive: false,
    activeNodeIds: new Set(),
    citationFrequencyFilter: false,
    uniqueAuthorsFilter: false,
    activeYearsFilterActive: false,
    activeYearsCount: 1,
    lifespanFilterActive: false,
    lifespanCount: 1,
    lifespanApplyToCanon: false,

    vizSettings: {
      enableTooltip: true,
      depth: 1,
      direction: 'both', 
      showCore: true,
      showCanon: true,
      showEnv: true,
      hideLeaves: false,
      layoutMode: 'force',
      collapseCliqueSuperNode: true,
      enableParticles: true
    },
    
    isModalOpen: false,
    inspectedNodeIds: [], 
    modalContextList: [], 

    displayFilters: {
      incose_source: true,
      assimilated_canon: true,
      external_or_unknown: true,
      irrelevant: false 
    },
    
    trackedIssns: Object.keys(issnMap),
    selectedISSNs: Object.keys(issnMap),

    analyticsResult: null,
    isAnalyticsLoading: false
  }),

  actions: {
    setYearFilter(years) {
      this.activeFilters.years = years;
    },
    setTaxonomyFilter(level, name, pathString) {
      if (!level) this.activeFilters.taxonomy = null;
      // Сохраняем полный путь (Domain > Field > Subfield)
      else this.activeFilters.taxonomy = { level, name, pathString };
    },
    toggleMainView() {
      this.mainView = this.mainView === 'graph' ? 'sunburst' : 'graph';
    },
    applyUseCasePreset(presetName) {
      if (presetName === 'blindspots') {
        this.isBlindSpotsOpen = true;
        this.activePreset = 'blindspots';
        return;
      }

      // 'reset': Reset all advanced filters & active slice
      this.citationFrequencyFilter = false;
      this.uniqueAuthorsFilter = false;
      this.activeYearsFilterActive = false;
      this.lifespanFilterActive = false;
      this.translatorLensActive = false;
      this.activeFilters.years = [];
      this.activeFilters.taxonomy = null;
      this.focusedNodeId = null;
      this.focusedClique = null;
      this.vizSettings.layoutMode = 'force';
      this.activePreset = null;

      if (presetName === 'reset') {
        this.recalculateMetrics();
        return;
      }

      if (presetName === 'bridges') {
        this.translatorLensActive = true;
        this.vizSettings.layoutMode = 'translationFlow';
        this.activePreset = 'bridges';
      } else if (presetName === 'classics') {
        this.citationFrequencyFilter = true;
        this.uniqueAuthorsFilter = true;
        this.lifespanFilterActive = true;
        const dur = this.observationDuration || 8;
        this.lifespanCount = Math.min(8, dur);
        this.activePreset = 'classics';
      } else if (presetName === 'frontier') {
        const sortedYears = [...(this.availableYears || [])]
          .map(y => parseInt(y, 10))
          .filter(y => !isNaN(y))
          .sort((a, b) => b - a);
        const recent5 = sortedYears.slice(0, 5);
        this.setYearFilter(recent5);
        this.activePreset = 'frontier';
      }

      this.recalculateMetrics();
    },
    loadGraphData(rawJsonData) {
      try {
        this.graphModel = markRaw(parseIncoseJson(rawJsonData))
        this.isLoaded = true
        this.isVizActive = false
        this.recalculateMetrics()
      } catch (err) {
        console.error("Parse error:", err)
        throw err 
      }
    },

    recalculateMetrics() {
      if (!this.graphModel) return
      const dynamicInDegree = new Map()
      const activeCoreNodes = new Set()
      const coreOutDegree = new Map()
      
      // ФИКС 2: Инициализируем объект для подсчета ISSN и глобального подсчета публикаций ядра по годам
      const tempIssnCounts = {} 
      const coreNodesPerYear = {}

      this.graphModel.nodes.forEach(n => {
        if (n.type === 'incose_source') {
          const yRaw = n.year || n.publicationYear
          const y = yRaw ? parseInt(yRaw, 10) : null
          if (y && !isNaN(y)) {
            coreNodesPerYear[y] = (coreNodesPerYear[y] || 0) + 1
          }

          const nodeIssns = n.issns || []
          
          // ФИКС 3: Считаем ISSN для каждого узла ядра
          nodeIssns.forEach(i => {
            tempIssnCounts[i] = (tempIssnCounts[i] || 0) + 1
          })

          const hasTracked = nodeIssns.some(i => this.trackedIssns.includes(i))
          const hasSelected = nodeIssns.some(i => this.selectedISSNs.includes(i))
          if (hasTracked && !hasSelected) return 
          activeCoreNodes.add(n.id)
          coreOutDegree.set(n.id, 0)
        }
      })

      const targetCitingCoreNodes = new Map()
      this.graphModel.links.forEach(l => {
        const sId = typeof l.source === 'object' ? l.source.id : l.source
        const tId = typeof l.target === 'object' ? l.target.id : l.target
        if (activeCoreNodes.has(sId)) {
          dynamicInDegree.set(tId, (dynamicInDegree.get(tId) || 0) + 1)
          coreOutDegree.set(sId, (coreOutDegree.get(sId) || 0) + 1)
          
          const sNode = this.graphModel.nodes.get(sId)
          if (sNode) {
            if (!targetCitingCoreNodes.has(tId)) {
              targetCitingCoreNodes.set(tId, [])
            }
            targetCitingCoreNodes.get(tId).push(sNode)
          }
        }
      })

      // Fix baseline metrics (Original counts)
      const baselineNodes = new Set();
      let originalCore = 0, originalCanon = 0, originalEnv = 0;
      
      this.graphModel.nodes.forEach(n => {
        const inCount = dynamicInDegree.get(n.id) || 0;
        if (n.type === 'incose_source') {
          if (activeCoreNodes.has(n.id)) {
            baselineNodes.add(n.id);
            originalCore++;
          }
        } else if (n.type !== 'irrelevant' && inCount > 0) {
          baselineNodes.add(n.id);
          if (n.type === 'assimilated_canon') originalCanon++;
          else originalEnv++;
        }
      });

      let originalEdgesCount = 0;
      this.graphModel.links.forEach(l => {
        const sId = typeof l.source === 'object' ? l.source.id : l.source;
        const tId = typeof l.target === 'object' ? l.target.id : l.target;
        if (baselineNodes.has(sId) && baselineNodes.has(tId)) {
          originalEdgesCount++;
        }
      });

      // Теперь формируем набор финально активных узлов
      const roles = this.translatorLensActive ? this.nodeRoles : null;
      const finalActiveNodes = new Set()
      this.graphModel.nodes.forEach(n => {
        if (n.type === 'irrelevant') return

        if (n.type === 'incose_source') {
          if (!activeCoreNodes.has(n.id)) return
          if (this.translatorLensActive && roles.get(n.id)?.role !== 'True Translator') return;
          if (this.citationFrequencyFilter) {
            const outCount = coreOutDegree.get(n.id) || 0
            if (outCount <= 1) return
          }
          finalActiveNodes.add(n.id)
        } else {
          const inCount = dynamicInDegree.get(n.id) || 0
          if (inCount === 0) return
          if (this.citationFrequencyFilter) {
            if (inCount <= 1) return
          }
          if (this.uniqueAuthorsFilter) {
            const citingCoreNodes = targetCitingCoreNodes.get(n.id) || []
            if (citingCoreNodes.length <= 1) return

            const seenAuthors = new Set()
            let hasRepeatingAuthor = false
            for (const coreNode of citingCoreNodes) {
              const authorsSet = getAuthorSet(coreNode.authors)
              for (const author of authorsSet) {
                if (seenAuthors.has(author)) {
                  hasRepeatingAuthor = true
                  break
                }
              }
              if (hasRepeatingAuthor) break
              for (const author of authorsSet) {
                seenAuthors.add(author)
              }
            }
            if (hasRepeatingAuthor) return
          }
          if (this.activeYearsFilterActive) {
            const citingCoreNodes = targetCitingCoreNodes.get(n.id) || []
            const citingYears = new Set()
            for (const coreNode of citingCoreNodes) {
              const yRaw = coreNode.year || coreNode.publicationYear
              if (yRaw) {
                const y = parseInt(yRaw, 10)
                if (!isNaN(y)) {
                  citingYears.add(y)
                }
              }
            }
            if (citingYears.size < this.activeYearsCount) return
          }
          if (this.lifespanFilterActive && (n.type !== 'assimilated_canon' || this.lifespanApplyToCanon)) {
            const citingCoreNodes = targetCitingCoreNodes.get(n.id) || []
            let minYear = Infinity
            let maxYear = -Infinity
            for (const coreNode of citingCoreNodes) {
              const yRaw = coreNode.year || coreNode.publicationYear
              if (yRaw) {
                const y = parseInt(yRaw, 10)
                if (!isNaN(y)) {
                  if (y < minYear) minYear = y
                  if (y > maxYear) maxYear = y
                }
              }
            }
            if (minYear === Infinity || maxYear === -Infinity) return
            const lifespan = maxYear - minYear
            if (lifespan < this.lifespanCount) return
          }
          if (this.translatorLensActive) {
            const citingCore = targetCitingCoreNodes.get(n.id) || [];
            const hasTranslator = citingCore.some(coreNode => {
              const roleObj = roles.get(coreNode.id);
              return roleObj && roleObj.role === 'True Translator';
            });
            if (!hasTranslator) return;
          }
          finalActiveNodes.add(n.id)
        }
      })

      this.activeNodeIds = finalActiveNodes

      // Пересчитаем inDegree и связи на основе отфильтрованных активных узлов
      let activeEdgesCount = 0
      const finalInDegree = new Map()

      this.graphModel.links.forEach(l => {
        const sId = typeof l.source === 'object' ? l.source.id : l.source
        const tId = typeof l.target === 'object' ? l.target.id : l.target
        if (finalActiveNodes.has(sId) && finalActiveNodes.has(tId)) {
          activeEdgesCount++
          if (this.graphModel.nodes.get(sId)?.type === 'incose_source') {
            finalInDegree.set(tId, (finalInDegree.get(tId) || 0) + 1)
          }
        }
      })

      let core = 0, canon = 0, env = 0, irrelevant = 0
      const activeNodesArr = []

      this.graphModel.nodes.forEach(n => {
        if (finalActiveNodes.has(n.id)) {
          n.inDegree = finalInDegree.get(n.id) || 0
          if (n.type === 'incose_source') core++
          else if (n.type === 'assimilated_canon') canon++
          else env++
          activeNodesArr.push(n)
        } else {
          n.inDegree = 0
          if (n.type === 'irrelevant') irrelevant++
        }
      })

      this.metrics = { 
        totalNodes: activeNodesArr.length, 
        totalEdges: activeEdgesCount, 
        coreCount: core, 
        canonCount: canon, 
        envCount: env, 
        irrelevantCount: irrelevant,
        issnCounts: tempIssnCounts,
        coreNodesPerYear,
        originalCoreCount: originalCore,
        originalCanonCount: originalCanon,
        originalEnvCount: originalEnv,
        originalTotalNodes: originalCore + originalCanon + originalEnv,
        originalTotalEdges: originalEdgesCount,
        isCitationFilterActive: this.citationFrequencyFilter || this.uniqueAuthorsFilter || this.activeYearsFilterActive || this.lifespanFilterActive || this.translatorLensActive
      }
      this.topNodes = activeNodesArr.sort((a, b) => b.inDegree - a.inDegree)
    },

    setFocusedClique(cliqueObj) {
      if (this.focusedClique && cliqueObj && this.focusedClique.id === cliqueObj.id) {
        this.focusedClique = null
      } else {
        this.focusedClique = cliqueObj
        this.focusedNodeId = null
      }
    },

    resampleEchoChambers(runs = 10) {
      this.echoRuns = runs
      this.echoSeed = Math.floor(Math.random() * 100000) + 1
    },

    setFocusedNode(nodeId) {
      this.focusedClique = null
      if (this.focusedNodeId === nodeId) {
        this.focusedNodeId = null
      } else {
        this.focusedNodeId = nodeId
      }
    },
    toggleViz() { this.isVizActive = !this.isVizActive },
    
    openModal(nodeIds, contextList = null) {
      this.inspectedNodeIds = Array.isArray(nodeIds) ? nodeIds : [nodeIds]
      if (contextList && Array.isArray(contextList) && contextList.length > 0) {
        this.modalContextList = contextList
      } else {
        this.modalContextList = []
      }
      this.isModalOpen = true
      this.analyticsResult = null
    },
    closeModal() {
      this.isModalOpen = false
      this.inspectedNodeIds = []
      this.modalContextList = []
    },
    
    updateNodeAttributes(newAttributes) {
      if (!this.graphModel || this.inspectedNodeIds.length === 0) return
      this.inspectedNodeIds.forEach(id => {
        const node = this.graphModel.nodes.get(id)
        if (node) {
          if (newAttributes.title !== undefined && !newAttributes.title.startsWith('Multiple')) node.title = newAttributes.title
          if (newAttributes.justification !== undefined && !newAttributes.justification.startsWith('Multiple')) node.justification = newAttributes.justification
          if (newAttributes.type !== undefined && newAttributes.type !== 'multiple') node.type = newAttributes.type
          
          if (newAttributes.domain !== undefined && !newAttributes.domain.startsWith('Multiple')) node.domain = newAttributes.domain || 'Unknown'
          if (newAttributes.field !== undefined && !newAttributes.field.startsWith('Multiple')) node.field = newAttributes.field || 'Unknown'
          if (newAttributes.subfield !== undefined && !newAttributes.subfield.startsWith('Multiple')) node.subfield = newAttributes.subfield || 'Unknown'
        }
      })
      this.recalculateMetrics()
    },
    applyGhostHunterResult(oldNodeId, targetNodeData) {
      if (!this.graphModel || !oldNodeId || !targetNodeData) return false
      const node = this.graphModel.nodes.get(oldNodeId)
      if (!node) return false

      const newId = targetNodeData.id

      // Strictly map target node schema
      node.id = newId
      node.title = targetNodeData.title
      node.year = targetNodeData.year
      node.publicationYear = targetNodeData.year
      node.issns = Array.isArray(targetNodeData.issns) ? targetNodeData.issns : []
      node.type = targetNodeData.type || node.type || 'external_or_unknown'
      node.authors = Array.isArray(targetNodeData.authors) ? targetNodeData.authors : [String(targetNodeData.authors || 'Unknown')]
      node.domain = targetNodeData.domain || 'Unknown'
      node.field = targetNodeData.field || 'Unknown'
      node.subfield = targetNodeData.subfield || 'Unknown'
      node.references = Array.isArray(targetNodeData.references) ? targetNodeData.references : []

      // If ID changed, safely update graphModel collections (retaining markRaw wrapper)
      if (oldNodeId !== newId) {
        this.graphModel.nodes.delete(oldNodeId)
        this.graphModel.nodes.set(newId, node)

        // Transfer adjacency list
        const oldAdj = this.graphModel.adjacencyList.get(oldNodeId) || []
        this.graphModel.adjacencyList.delete(oldNodeId)
        const existingNewAdj = this.graphModel.adjacencyList.get(newId) || []
        this.graphModel.adjacencyList.set(newId, [...existingNewAdj, ...oldAdj])

        // Update links in graph
        this.graphModel.links.forEach(l => {
          if ((typeof l.source === 'object' ? l.source.id : l.source) === oldNodeId) {
            if (typeof l.source === 'object') l.source = node; else l.source = newId
          }
          if ((typeof l.target === 'object' ? l.target.id : l.target) === oldNodeId) {
            if (typeof l.target === 'object') l.target = node; else l.target = newId
          }
        })

        // Update all adjacency list references
        this.graphModel.adjacencyList.forEach(list => {
          list.forEach(l => {
            if ((typeof l.source === 'object' ? l.source.id : l.source) === oldNodeId) {
              if (typeof l.source === 'object') l.source = node; else l.source = newId
            }
            if ((typeof l.target === 'object' ? l.target.id : l.target) === oldNodeId) {
              if (typeof l.target === 'object') l.target = node; else l.target = newId
            }
          })
        })

        // Update store references
        this.inspectedNodeIds = this.inspectedNodeIds.map(id => (id === oldNodeId ? newId : id))
        if (this.focusedNodeId === oldNodeId) this.focusedNodeId = newId
        if (this.activeNodeIds.has(oldNodeId)) {
          this.activeNodeIds.delete(oldNodeId)
          this.activeNodeIds.add(newId)
        }
      }

      this.recalculateMetrics()
      return true
    },

    
    async executeLuhmannAnalytics() {
      if (!this.graphModel || this.inspectedNodeIds.length !== 1) return
      this.isAnalyticsLoading = true
      this.analyticsResult = null
      try {
        this.analyticsResult = await runLuhmannAnalysis(this.inspectedNodeIds[0], this.graphModel)
      } catch (e) {
        console.error("Analytics failed:", e)
      } finally {
        this.isAnalyticsLoading = false
      }
    },

    promoteToCanon(nodeIds) {
      nodeIds.forEach(id => {
        const node = this.graphModel.nodes.get(id);
        if (node) {
          node.type = 'assimilated_canon';
          node.justification = 'Auto-promoted via Canon Recommender (High structural resonance)';
        }
      });
      this.recalculateMetrics();
    }
  },
  
  getters: {
    canonCandidates(state) {
      if (!state.graphModel) return [];
      const candidates = [];
      state.graphModel.nodes.forEach(n => {
        // Must be environment and heavily cited by core
        if (n.type === 'external_or_unknown' && n.inDegree >= 4) {
          candidates.push(n);
        }
      });
      return candidates.sort((a, b) => b.inDegree - a.inDegree);
    },
    nodeRoles(state) {
      if (!state.graphModel) return new Map();
      const roles = new Map();
      const envOutMap = new Map();
      const domainMap = new Map();
      const indepCoreInMap = new Map();

      // Pre-calculate author sets for core nodes for O(1) intersection checks
      const authorSets = new Map();
      state.graphModel.nodes.forEach(n => {
        if (n.type === 'incose_source') {
          authorSets.set(n.id, getAuthorSet(n.authors));
        }
      });

      const shareAuthors = (idA, idB) => {
        const setA = authorSets.get(idA);
        const setB = authorSets.get(idB);
        if (!setA || !setB) return false;
        for (const a of setA) {
          if (setB.has(a)) return true;
        }
        return false;
      };

      // 1. Calculate Env Out-degree and Independent Core In-degree
      state.graphModel.links.forEach(l => {
        const sId = typeof l.source === 'object' ? l.source.id : l.source;
        const tId = typeof l.target === 'object' ? l.target.id : l.target;
        const sNode = state.graphModel.nodes.get(sId);
        const tNode = state.graphModel.nodes.get(tId);
        
        if (!sNode || !tNode) return;

        if (sNode.type === 'incose_source') {
          if (tNode.type !== 'incose_source' && tNode.type !== 'irrelevant') {
            // Outgoing to environment
            envOutMap.set(sId, (envOutMap.get(sId) || 0) + 1);
            if (!domainMap.has(sId)) domainMap.set(sId, new Map());
            const d = (tNode.domain && tNode.domain !== 'Unknown') ? tNode.domain : null;
            if (d) {
              domainMap.get(sId).set(d, (domainMap.get(sId).get(d) || 0) + 1);
            }
          } else if (tNode.type === 'incose_source') {
            // Core to Core citation -> Check for self-citation!
            if (!shareAuthors(sId, tId)) {
              indepCoreInMap.set(tId, (indepCoreInMap.get(tId) || 0) + 1);
            }
          }
        }
      });

      // 2. Assign Luhmann Roles based on STRICT independent connection
      state.graphModel.nodes.forEach(n => {
        if (n.type === 'incose_source') {
          const cInIndep = indepCoreInMap.get(n.id) || 0;
          const eOut = envOutMap.get(n.id) || 0;
          let role = 'Peripheral / Normal';
          
          // Strict criteria: Must be cited by at least 2 completely independent core papers
          if (eOut >= 2 && cInIndep >= 2) role = 'True Translator';
          else if (eOut >= 5 && cInIndep < 2) role = 'Unresonated Scout';
          else if (eOut === 0 && cInIndep >= 5) role = 'Orthodox Core';

          let topDomain = 'None';
          if (domainMap.has(n.id)) {
            const counts = Array.from(domainMap.get(n.id).entries()).sort((a, b) => b[1] - a[1]);
            if (counts.length > 0) topDomain = counts[0][0];
          }

          roles.set(n.id, { role, cInIndep, eOut, topDomain });
        }
      });
      return roles;
    },
    inspectedNodes(state) {
      if (!state.graphModel) return []
      return state.inspectedNodeIds.map(id => state.graphModel.nodes.get(id)).filter(Boolean)
    },
    isBatchMode(state) {
      return state.inspectedNodeIds.length > 1
    },
    observationDuration(state) {
      if (!state.graphModel) return 0;
      let minYear = Infinity;
      let maxYear = -Infinity;
      state.graphModel.nodes.forEach(n => {
        if (n.type === 'incose_source') {
          const yRaw = n.year || n.publicationYear;
          if (yRaw) {
            const y = parseInt(yRaw, 10);
            if (!isNaN(y) && y > 1900 && y <= new Date().getFullYear()) {
              if (y < minYear) minYear = y;
              if (y > maxYear) maxYear = y;
            }
          }
        }
      });
      if (minYear === Infinity || maxYear === -Infinity) return 0;
      return maxYear - minYear;
    },

    // ФИКС 5: Геттер availableYears добавлен и обрабатывает поле "year"
    availableYears(state) {
      if (!state.graphModel) return [];
      const years = new Set();
      state.graphModel.nodes.forEach(n => {
        if (n.type === 'incose_source') {
          const yRaw = n.year || n.publicationYear;
          if (yRaw) {
            const y = parseInt(yRaw, 10);
            if (!isNaN(y) && y > 1900 && y <= new Date().getFullYear()) {
              years.add(y);
            }
          }
        }
      });
      return Array.from(years).sort((a, b) => b - a); // По убыванию
    },

    filteredCoreNodes(state) {
      if (!state.graphModel) return [];
      let allCore = Array.from(state.graphModel.nodes.values()).filter(n => n.type === 'incose_source');
      if (state.metrics.isCitationFilterActive) {
        allCore = allCore.filter(node => state.activeNodeIds.has(node.id));
      }
      
      // ОПТИМИЗАЦИЯ O(1): Собираем целевые узлы таксономии один раз
      let validTargetIds = null;
      if (state.activeFilters.taxonomy) {
        validTargetIds = new Set();
        const pathString = state.activeFilters.taxonomy.pathString;
        if (pathString) {
          const parts = pathString.split(' > ');
          state.graphModel.nodes.forEach(n => {
            const matchDomain = !parts[0] || n.domain === parts[0];
            const matchField = !parts[1] || n.field === parts[1];
            const matchSubfield = !parts[2] || n.subfield === parts[2];
            if (matchDomain && matchField && matchSubfield) {
              validTargetIds.add(n.id);
            }
          });
        } else {
          const { level, name } = state.activeFilters.taxonomy;
          state.graphModel.nodes.forEach(n => {
            if (n[level] === name) validTargetIds.add(n.id);
          });
        }
      }

      // ОПТИМИЗАЦИЯ O(1): Один раз проходим по связям и запоминаем, кто ссылается на таксономию
      let nodesLinkingToTaxonomy = null;
      if (validTargetIds) {
        nodesLinkingToTaxonomy = new Set();
        state.graphModel.links.forEach(l => {
          const sId = typeof l.source === 'object' ? l.source.id : l.source;
          const tId = typeof l.target === 'object' ? l.target.id : l.target;
          if (validTargetIds.has(tId)) {
            nodesLinkingToTaxonomy.add(sId);
          }
        });
      }

      return allCore.filter(node => {
        const yRaw = node.year || node.publicationYear;
        const nodeYear = yRaw ? parseInt(yRaw, 10) : null;
        const passYear = state.activeFilters.years.length === 0 || 
                         (nodeYear !== null && state.activeFilters.years.includes(nodeYear));
        
        // Моментальная проверка через Set
        const passTax = nodesLinkingToTaxonomy ? nodesLinkingToTaxonomy.has(node.id) : true;
        
        return passYear && passTax;
      });
    },

    diffusionStats(state) {
      if (!state.graphModel || (state.activeFilters.years.length === 0 && !state.activeFilters.taxonomy)) {
        return null;
      }

      const targetNodes = new Set(this.filteredCoreNodes.map(n => n.id));
      if (targetNodes.size === 0) return null;

      const diffusionTimeline = {};

      state.graphModel.links.forEach(l => {
        const sId = typeof l.source === 'object' ? l.source.id : l.source;
        const tId = typeof l.target === 'object' ? l.target.id : l.target;
        
        const sNode = state.graphModel.nodes.get(sId);
        
        if (sNode && sNode.type === 'incose_source' && !targetNodes.has(sId) && targetNodes.has(tId)) {
          // ФИКС 7: Проверка года для цитирующих статей тоже понимает оба формата
          const citingYearRaw = sNode.year || sNode.publicationYear;
          const citingYear = citingYearRaw ? parseInt(citingYearRaw, 10) : NaN;
          
          if (!isNaN(citingYear)) {
            diffusionTimeline[citingYear] = (diffusionTimeline[citingYear] || 0) + 1;
          }
        }
      });

      return Object.keys(diffusionTimeline)
        .map(y => ({ year: parseInt(y), count: diffusionTimeline[y] }))
        .sort((a, b) => a.year - b.year);
    },

    filteredEnvNodesBySelection(state) {
      if (!state.graphModel) return [];

      if (state.focusedClique) {
        const members = new Set(state.focusedClique.members || []);
        const targetMap = new Map();
        state.graphModel.links.forEach(l => {
          const s = typeof l.source === 'object' ? l.source.id : l.source;
          const t = typeof l.target === 'object' ? l.target.id : l.target;
          if (members.has(s)) {
            const tNode = state.graphModel.nodes.get(t);
            if (tNode && tNode.type !== 'incose_source' && tNode.type !== 'irrelevant') {
              targetMap.set(t, (targetMap.get(t) || 0) + 1);
            }
          }
        });
        return Array.from(targetMap.entries())
          .map(([id, count]) => ({ node: state.graphModel.nodes.get(id), localInDegree: count }))
          .sort((a,b) => b.localInDegree - a.localInDegree);
      }

      if (!state.activeFilters.taxonomy) return [];

      const { level, name, pathString } = state.activeFilters.taxonomy;
      const validTargetIds = new Set();

      if (pathString) {
        const parts = pathString.split(' > ');
        state.graphModel.nodes.forEach(n => {
          if (n.type !== 'incose_source' && n.type !== 'irrelevant') {
            const matchDomain = !parts[0] || n.domain === parts[0];
            const matchField = !parts[1] || n.field === parts[1];
            const matchSubfield = !parts[2] || n.subfield === parts[2];
            if (matchDomain && matchField && matchSubfield) {
              validTargetIds.add(n.id);
            }
          }
        });
      } else if (level && name) {
        state.graphModel.nodes.forEach(n => {
          if (n.type !== 'incose_source' && n.type !== 'irrelevant') {
            if (n[level] === name) validTargetIds.add(n.id);
          }
        });
      }

      if (validTargetIds.size === 0) return [];

      const counts = new Map();
      const selectedYears = state.activeFilters.years;

      state.graphModel.links.forEach(l => {
        const sId = typeof l.source === 'object' ? l.source.id : l.source;
        const tId = typeof l.target === 'object' ? l.target.id : l.target;

        if (validTargetIds.has(tId)) {
          const sNode = state.graphModel.nodes.get(sId);
          if (sNode && sNode.type === 'incose_source') {
            if (state.translatorLensActive) {
              const roleObj = (this.nodeRoles || state.nodeRoles)?.get(sId);
              if (!roleObj || roleObj.role !== 'True Translator') return;
            }
            if (!state.activeNodeIds || state.activeNodeIds.size === 0 || state.activeNodeIds.has(sId)) {
              const yRaw = sNode.year || sNode.publicationYear;
              const y = yRaw ? parseInt(yRaw, 10) : null;
              const passYear = selectedYears.length === 0 || (y !== null && selectedYears.includes(y));
              if (passYear) {
                counts.set(tId, (counts.get(tId) || 0) + 1);
              }
            }
          }
        }
      });

      const result = [];
      counts.forEach((localInDegree, id) => {
        if (localInDegree > 0) {
          if (!state.activeNodeIds || state.activeNodeIds.size === 0 || state.activeNodeIds.has(id)) {
            result.push({
              node: state.graphModel.nodes.get(id),
              localInDegree
            });
          }
        }
      });

      result.sort((a, b) => b.localInDegree - a.localInDegree);
      return result;
    },

    citingCoreNodesForSelection(state) {
      if (!state.graphModel) return [];

      if (state.focusedClique) {
        const members = state.focusedClique.members || [];
        const list = members.map(id => {
          const node = state.graphModel.nodes.get(id);
          const inDeg = node?.inDegree || 0;
          return {
            node,
            sectorOutDegree: inDeg,
            globalInDegree: inDeg
          };
        }).filter(i => i.node);
        return list; // Ignore search filter here for simplicity, or apply it if you prefer
      }

      if (!state.activeFilters.taxonomy) return [];

      const envNodes = this.filteredEnvNodesBySelection;
      if (!envNodes || envNodes.length === 0) return [];

      const validEnvIds = new Set(envNodes.map(item => item.node.id));
      const sectorOutDegreeMap = new Map();
      const selectedYears = state.activeFilters.years;

      state.graphModel.links.forEach(l => {
        const sId = typeof l.source === 'object' ? l.source.id : l.source;
        const tId = typeof l.target === 'object' ? l.target.id : l.target;

        if (validEnvIds.has(tId)) {
          const sNode = state.graphModel.nodes.get(sId);
          if (sNode && sNode.type === 'incose_source') {
            if (state.translatorLensActive) {
              const roleObj = (this.nodeRoles || state.nodeRoles)?.get(sId);
              if (!roleObj || roleObj.role !== 'True Translator') return;
            }
            if (!state.activeNodeIds || state.activeNodeIds.size === 0 || state.activeNodeIds.has(sId)) {
              const yRaw = sNode.year || sNode.publicationYear;
              const y = yRaw ? parseInt(yRaw, 10) : null;
              const passYear = selectedYears.length === 0 || (y !== null && selectedYears.includes(y));
              if (passYear) {
                sectorOutDegreeMap.set(sId, (sectorOutDegreeMap.get(sId) || 0) + 1);
              }
            }
          }
        }
      });

      const result = [];
      sectorOutDegreeMap.forEach((sectorOutDegree, sId) => {
        const node = state.graphModel.nodes.get(sId);
        if (node) {
          result.push({
            node,
            sectorOutDegree,
            globalInDegree: node.inDegree || 0
          });
        }
      });

      result.sort((a, b) => {
        if (b.sectorOutDegree !== a.sectorOutDegree) {
          return b.sectorOutDegree - a.sectorOutDegree;
        }
        return b.globalInDegree - a.globalInDegree;
      });

      return result;
    },

    rawEchoCommunities(state) {
      if (!state.graphModel) return [];

      // 1. Collect active core nodes
      const coreNodes = [];
      const adj = new Map();
      state.graphModel.nodes.forEach(n => {
        if (n.type === 'incose_source' && state.activeNodeIds.has(n.id)) {
          coreNodes.push(n.id);
          adj.set(n.id, []);
        }
      });

      if (coreNodes.length === 0) return [];
      const coreNodeSet = new Set(coreNodes);

      state.graphModel.links.forEach(l => {
        const s = typeof l.source === 'object' ? l.source.id : l.source;
        const t = typeof l.target === 'object' ? l.target.id : l.target;
        if (s !== t && coreNodeSet.has(s) && coreNodeSet.has(t)) {
          adj.get(s).push(t);
          adj.get(t).push(s);
        }
      });

      // 2. Mulberry32 PRNG seeded with state.echoSeed
      let a = (state.echoSeed || 42) >>> 0;
      const rand = () => {
        let t = a += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
      };

      // 3. Multi-run LPA
      const runs = Math.max(1, state.echoRuns || 1);
      let bestPartition = null;
      let bestScore = -1;

      for (let r = 0; r < runs; r++) {
        const labels = new Map();
        coreNodes.forEach(id => labels.set(id, id));

        for (let iter = 0; iter < 20; iter++) {
          let changed = false;
          const nodes = coreNodes.slice();
          for (let i = nodes.length - 1; i > 0; i--) {
            const j = Math.floor(rand() * (i + 1));
            const temp = nodes[i];
            nodes[i] = nodes[j];
            nodes[j] = temp;
          }

          for (const node of nodes) {
            const neighbors = adj.get(node);
            if (!neighbors || neighbors.length === 0) continue;

            const labelCounts = new Map();
            for (const neighbor of neighbors) {
              const l = labels.get(neighbor);
              labelCounts.set(l, (labelCounts.get(l) || 0) + 1);
            }

            let maxCount = 0;
            let candidates = [];
            for (const [l, count] of labelCounts.entries()) {
              if (count > maxCount) {
                maxCount = count;
                candidates = [l];
              } else if (count === maxCount) {
                candidates.push(l);
              }
            }

            const currentLabel = labels.get(node);
            let chosenLabel = currentLabel;
            if (candidates.length === 1) {
              chosenLabel = candidates[0];
            } else if (candidates.length > 1) {
              if (candidates.includes(currentLabel)) {
                chosenLabel = currentLabel;
              } else {
                chosenLabel = candidates[Math.floor(rand() * candidates.length)];
              }
            }

            if (labels.get(node) !== chosenLabel) {
              labels.set(node, chosenLabel);
              changed = true;
            }
          }
          if (!changed) break;
        }

        const communities = new Map();
        for (const [node, label] of labels.entries()) {
          if (!communities.has(label)) communities.set(label, []);
          communities.get(label).push(node);
        }

        let score = 0;
        state.graphModel.links.forEach(l => {
          const s = typeof l.source === 'object' ? l.source.id : l.source;
          const t = typeof l.target === 'object' ? l.target.id : l.target;
          if (coreNodeSet.has(s) && coreNodeSet.has(t)) {
            const labelS = labels.get(s);
            const labelT = labels.get(t);
            if (labelS === labelT) {
              const comm = communities.get(labelS);
              if (comm && comm.length <= 500) {
                score++;
              }
            }
          }
        });

        if (score > bestScore || bestPartition === null) {
          bestScore = score;
          bestPartition = communities;
        }
      }

      if (!bestPartition) return [];

      // 4. Compute metrics for each community with members.length >= 3
      const results = [];
      for (const [label, members] of bestPartition.entries()) {
        if (members.length < 3) continue;

        let internalLinks = 0;
        let coreOutgoing = 0;
        let totalOutgoing = 0;
        let totalEnvOut = 0;
        const memberSet = new Set(members);
        const envFieldCounts = new Map();
        let totalValidFieldRefs = 0;

        members.forEach(m => {
          const outLinks = state.graphModel.adjacencyList.get(m) || [];
          outLinks.forEach(l => {
            const s = typeof l.source === 'object' ? l.source.id : l.source;
            const t = typeof l.target === 'object' ? l.target.id : l.target;
            if (s === m) {
              const tNode = state.graphModel.nodes.get(t);
              if (!tNode || tNode.type === 'irrelevant') return;

              totalOutgoing++;

              if (tNode.type === 'incose_source') {
                coreOutgoing++;
                if (memberSet.has(t)) {
                  internalLinks++;
                }
              } else if (tNode.type === 'assimilated_canon' || tNode.type === 'external_or_unknown') {
                totalEnvOut++;
                const field = tNode.field ? tNode.field.trim() : null;
                if (field && field !== 'Unknown') {
                  envFieldCounts.set(field, (envFieldCounts.get(field) || 0) + 1);
                  totalValidFieldRefs++;
                }
              }
            }
          });
        });

        const coreInsularity = coreOutgoing > 0 ? (internalLinks / coreOutgoing) : 0;
        const totalClosure = totalOutgoing > 0 ? (internalLinks / totalOutgoing) : 0;

        const topExternalFields = totalValidFieldRefs > 0
          ? Array.from(envFieldCounts.entries())
              .sort((a, b) => b[1] - a[1])
              .slice(0, 2)
              .map(([name, count]) => ({
                name,
                count,
                pct: Math.round((count / totalValidFieldRefs) * 100)
              }))
          : [];

        const authorsMap = new Map();
        let topPaper = null;
        let maxIn = -1;

        members.forEach(m => {
          const node = state.graphModel.nodes.get(m);
          if (node) {
            if (node.inDegree > maxIn) {
              maxIn = node.inDegree;
              topPaper = node;
            }
            const auths = (node.authors || 'Unknown').split(', ');
            auths.forEach(a => {
              const auth = a.trim();
              if (auth && auth !== 'Unknown') {
                authorsMap.set(auth, (authorsMap.get(auth) || 0) + 1);
              }
            });
          }
        });

        const topAuthors = Array.from(authorsMap.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 2)
          .map(x => x[0])
          .join(', ');

        results.push({
          id: label,
          size: members.length,
          internalLinks,
          coreOutgoing,
          totalOutgoing,
          totalEnvOut,
          coreInsularity,
          totalClosure,
          topPaperTitle: topPaper ? topPaper.title : 'Unknown',
          topPaperId: topPaper ? topPaper.id : null,
          topAuthors: topAuthors || 'Unknown',
          topExternalFields,
          members
        });
      }

      return results;
    },


    echoChambers(state) {
      const raw = this.rawEchoCommunities;
      if (!raw || raw.length === 0) return [];

      const minSize = state.echoMinSize ?? 4;
      const maxSize = state.echoMaxSize ?? 500;
      const minInsularity = state.echoMinInsularity ?? 0.5;
      const isCore = (state.echoMetricMode || 'core') === 'core';

      return raw
        .map(c => {
          const score = isCore ? c.coreInsularity : c.totalClosure;
          return {
            ...c,
            insularity: score
          };
        })
        .filter(c => c.size >= minSize && c.size <= maxSize && c.insularity >= minInsularity)
        .sort((a, b) => {
          if (b.insularity !== a.insularity) {
            return b.insularity - a.insularity;
          }
          return b.size - a.size;
        });
    },

    disciplinaryBlindSpots(state) {
      if (!state.graphModel || !state.graphModel.links) return [];

      const roles = this.nodeRoles;
      const coreCitationsPerNode = new Map();
      const domainMap = new Map();

      const createBucket = () => ({
        totalCitations: 0,
        nodeIds: new Set(),
        translatorBackedCitations: 0,
        lags: []
      });

      state.graphModel.links.forEach(l => {
        const sId = typeof l.source === 'object' ? l.source.id : l.source;
        const tId = typeof l.target === 'object' ? l.target.id : l.target;
        const sNode = state.graphModel.nodes.get(sId);
        const tNode = state.graphModel.nodes.get(tId);

        if (!sNode || !tNode) return;
        if (sNode.type !== 'incose_source') return;
        if (!passesIssnFilter(sNode, state.trackedIssns, state.selectedISSNs)) return;
        if (state.metrics?.isCitationFilterActive && state.activeNodeIds && (!state.activeNodeIds.has(sId) || !state.activeNodeIds.has(tId))) return;
        if (tNode.type === 'incose_source' || tNode.type === 'irrelevant') return;

        const domain = tNode.domain ? tNode.domain.trim() : null;
        if (!domain || domain === 'Unknown') return;

        const field = (tNode.field && tNode.field.trim() && tNode.field.trim() !== 'Unknown') ? tNode.field.trim() : 'Other';
        const subfield = (tNode.subfield && tNode.subfield.trim() && tNode.subfield.trim() !== 'Unknown') ? tNode.subfield.trim() : 'Other';

        // Record core citation count for external node
        coreCitationsPerNode.set(tId, (coreCitationsPerNode.get(tId) || 0) + 1);

        const isTranslator = roles?.get(sId)?.role === 'True Translator';

        const sYearRaw = sNode.year || sNode.publicationYear;
        const tYearRaw = tNode.year || tNode.publicationYear;
        const sYear = sYearRaw ? parseInt(sYearRaw, 10) : null;
        const tYear = tYearRaw ? parseInt(tYearRaw, 10) : null;
        const isValidLag = sYear !== null && tYear !== null && !isNaN(sYear) && !isNaN(tYear) && sYear >= tYear && (sYear - tYear) <= 150;
        const lag = isValidLag ? (sYear - tYear) : null;

        if (!domainMap.has(domain)) {
          domainMap.set(domain, {
            bucket: createBucket(),
            fields: new Map()
          });
        }
        const domEntry = domainMap.get(domain);

        if (!domEntry.fields.has(field)) {
          domEntry.fields.set(field, {
            bucket: createBucket(),
            subfields: new Map()
          });
        }
        const fldEntry = domEntry.fields.get(field);

        if (!fldEntry.subfields.has(subfield)) {
          fldEntry.subfields.set(subfield, createBucket());
        }
        const subBucket = fldEntry.subfields.get(subfield);

        const applyLink = (b) => {
          b.totalCitations++;
          b.nodeIds.add(tId);
          if (isTranslator) b.translatorBackedCitations++;
          if (lag !== null) {
            b.lags.push(lag);
          }
        };

        applyLink(domEntry.bucket);
        applyLink(fldEntry.bucket);
        applyLink(subBucket);
      });

      const computeMetrics = (bucket, level, name, pathString) => {
        const uniqueWorks = bucket.nodeIds.size;
        let oneOffWorks = 0;
        for (const nId of bucket.nodeIds) {
          if ((coreCitationsPerNode.get(nId) || 0) === 1) {
            oneOffWorks++;
          }
        }
        const rejectionRate = uniqueWorks > 0 ? (oneOffWorks / uniqueWorks) * 100 : 0;
        const realizedShare = bucket.totalCitations > 0 ? (bucket.translatorBackedCitations / bucket.totalCitations) * 100 : 0;
        const stats = computeLagStats(bucket.lags);

        return {
          level,
          name,
          pathString,
          totalCitations: bucket.totalCitations,
          uniqueWorks,
          oneOffWorks,
          rejectionRate,
          translatorBackedCitations: bucket.translatorBackedCitations,
          realizedShare,
          avgLag: stats.mean,
          medianLag: stats.median,
          lagQ1: stats.q1,
          lagQ3: stats.q3,
          lagIqr: stats.iqr,
          lags: bucket.lags
        };
      };

      const result = [];
      for (const [domName, domEntry] of domainMap.entries()) {
        const domObj = computeMetrics(domEntry.bucket, 'domain', domName, domName);
        domObj.fields = [];

        for (const [fldName, fldEntry] of domEntry.fields.entries()) {
          const fldPath = `${domName} > ${fldName}`;
          const fldObj = computeMetrics(fldEntry.bucket, 'field', fldName, fldPath);
          fldObj.subfields = [];

          for (const [subName, subBucket] of fldEntry.subfields.entries()) {
            const subPath = `${domName} > ${fldName} > ${subName}`;
            const subObj = computeMetrics(subBucket, 'subfield', subName, subPath);
            fldObj.subfields.push(subObj);
          }

          fldObj.subfields.sort((a, b) => b.totalCitations - a.totalCitations);
          domObj.fields.push(fldObj);
        }

        domObj.fields.sort((a, b) => b.totalCitations - a.totalCitations);
        result.push(domObj);
      }

      result.sort((a, b) => b.totalCitations - a.totalCitations);
      return result;
    }
,
    longitudinalMetrics(state) {
      if (!state.graphModel || !state.graphModel.links) return [];

      const isFilterActive = state.metrics?.isCitationFilterActive && state.activeNodeIds && state.activeNodeIds.size > 0;
      const activeIds = state.activeNodeIds;
      const taxonomy = state.activeFilters.taxonomy;

      // When taxonomy filter is active, restrict to Core papers engaging with that discipline
      let relevantCoreIds = null;
      if (taxonomy) {
        relevantCoreIds = new Set();
        state.graphModel.links.forEach(l => {
          const sId = typeof l.source === 'object' ? l.source.id : l.source;
          const tId = typeof l.target === 'object' ? l.target.id : l.target;
          const sNode = state.graphModel.nodes.get(sId);
          const tNode = state.graphModel.nodes.get(tId);
          if (!sNode || !tNode) return;
          if (sNode.type !== 'incose_source') return;
          if (!passesIssnFilter(sNode, state.trackedIssns, state.selectedISSNs)) return;
          if (isFilterActive && (!activeIds.has(sId) || !activeIds.has(tId))) return;
          if (tNode.type !== 'incose_source' && tNode.type !== 'irrelevant') {
            if (matchesTaxonomy(tNode, taxonomy)) {
              relevantCoreIds.add(sId);
            }
          }
        });
      }

      const isSubfieldGranularity = taxonomy && (taxonomy.level === 'field' || taxonomy.level === 'subfield' || (taxonomy.pathString && taxonomy.pathString.includes(' > ')));
      const yearlyBuckets = new Map();

      state.graphModel.links.forEach(l => {
        const sId = typeof l.source === 'object' ? l.source.id : l.source;
        const tId = typeof l.target === 'object' ? l.target.id : l.target;
        const sNode = state.graphModel.nodes.get(sId);
        const tNode = state.graphModel.nodes.get(tId);

        if (!sNode || !tNode) return;
        if (sNode.type !== 'incose_source') return;
        if (!passesIssnFilter(sNode, state.trackedIssns, state.selectedISSNs)) return;
        if (isFilterActive && (!activeIds.has(sId) || !activeIds.has(tId))) return;
        if (relevantCoreIds !== null && !relevantCoreIds.has(sId)) return;

        const sYearRaw = sNode.year || sNode.publicationYear;
        const sYear = sYearRaw ? parseInt(sYearRaw, 10) : null;
        if (!sYear || isNaN(sYear) || sYear < 1990 || sYear > 2030) return;

        if (!yearlyBuckets.has(sYear)) {
          yearlyBuckets.set(sYear, {
            corePapers: new Set(),
            coreToCoreLinks: 0,
            coreToEnvLinks: 0,
            envLags: [],
            recentEnvLinks: 0,
            fieldCounts: new Map()
          });
        }

        const bucket = yearlyBuckets.get(sYear);
        bucket.corePapers.add(sId);

        if (tNode.type === 'incose_source') {
          bucket.coreToCoreLinks++;
        } else if (tNode.type !== 'irrelevant') {
          if (taxonomy && !matchesTaxonomy(tNode, taxonomy)) return;

          bucket.coreToEnvLinks++;
          const tYearRaw = tNode.year || tNode.publicationYear;
          const tYear = tYearRaw ? parseInt(tYearRaw, 10) : null;
          if (tYear && !isNaN(tYear)) {
            const lag = sYear - tYear;
            if (lag >= 0 && lag <= 150) {
              bucket.envLags.push(lag);
              if (lag <= 5) {
                bucket.recentEnvLinks++;
              }
            }
          }

          let catKey = null;
          if (isSubfieldGranularity) {
            const sf = tNode.subfield ? tNode.subfield.trim() : null;
            if (sf && sf !== 'Unknown') catKey = sf;
          } else {
            const f = tNode.field ? tNode.field.trim() : null;
            if (f && f !== 'Unknown') catKey = f;
          }
          if (catKey) {
            bucket.fieldCounts.set(catKey, (bucket.fieldCounts.get(catKey) || 0) + 1);
          }
        }
      });

      const sortedYears = Array.from(yearlyBuckets.keys()).sort((a, b) => a - b);
      const results = [];

      for (const year of sortedYears) {
        const b = yearlyBuckets.get(year);
        const totalOut = b.coreToCoreLinks + b.coreToEnvLinks;
        if (totalOut === 0) continue;

        const lagStats = computeLagStats(b.envLags);
        const closureRate = (b.coreToCoreLinks / totalOut) * 100;
        const priceIndex = b.envLags.length > 0 ? (b.recentEnvLinks / b.envLags.length) * 100 : null;

        let totalFields = 0;
        for (const cnt of b.fieldCounts.values()) {
          totalFields += cnt;
        }
        let shannonDiversity = 0;
        if (totalFields > 0) {
          for (const cnt of b.fieldCounts.values()) {
            const p = cnt / totalFields;
            if (p > 0) {
              shannonDiversity -= p * Math.log(p);
            }
          }
        }

        results.push({
          year,
          paperCount: b.corePapers.size,
          closureRate,
          priceIndex,
          medianLag: lagStats.median,
          meanLag: lagStats.mean,
          shannonDiversity,
          totalOut,
          coreToCoreLinks: b.coreToCoreLinks,
          coreToEnvLinks: b.coreToEnvLinks
        });
      }

      return results;
    }
,
    longitudinalScopeSummary(state) {
      if (!state.graphModel) {
        return {
          totalMatchingCore: 0,
          selectedJournalLabels: ['All Journals'],
          taxonomyLabel: 'All External Domains'
        };
      }
      const isFilterActive = state.metrics?.isCitationFilterActive && state.activeNodeIds && state.activeNodeIds.size > 0;
      let totalMatchingCore = 0;
      state.graphModel.nodes.forEach(n => {
        if (n.type !== 'incose_source') return;
        if (!passesIssnFilter(n, state.trackedIssns, state.selectedISSNs)) return;
        if (isFilterActive && !state.activeNodeIds.has(n.id)) return;
        totalMatchingCore++;
      });

      const isAllSelected = state.trackedIssns.length > 0 && 
        state.trackedIssns.every(i => state.selectedISSNs.includes(i));
      const selectedJournalLabels = isAllSelected 
        ? ['All Journals'] 
        : Array.from(new Set(state.selectedISSNs.map(i => issnMap[i] || i)));

      const taxonomyLabel = state.activeFilters.taxonomy 
        ? (state.activeFilters.taxonomy.pathString || state.activeFilters.taxonomy.name) 
        : 'All External Domains';

      return {
        totalMatchingCore,
        selectedJournalLabels: selectedJournalLabels.length > 0 ? selectedJournalLabels : ['No Journals Selected'],
        taxonomyLabel
      };
    }
  }
})