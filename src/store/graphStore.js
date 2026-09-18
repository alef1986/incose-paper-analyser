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

export const useGraphStore = defineStore('graph', {
  state: () => ({
    activeFilters: {
      years: [], 
      taxonomy: null 
    },

    graphModel: null,
    isLoaded: false,
    
    mainView: 'graph', 
    
    // ФИКС 1: Добавлено поле issnCounts в стартовые метрики
    metrics: { totalNodes: 0, totalEdges: 0, coreCount: 0, canonCount: 0, envCount: 0, irrelevantCount: 0, issnCounts: {} },
    topNodes: [],
    
    focusedNodeId: null,
    isVizActive: false,
    activeNodeIds: new Set(),
    citationFrequencyFilter: false,
    uniqueAuthorsFilter: false,
    activeYearsFilterActive: false,
    activeYearsCount: 1,
    lifespanFilterActive: false,
    lifespanCount: 1,

    vizSettings: {
      enableTooltip: true,
      depth: 1,
      direction: 'both', 
      showCore: true,
      showCanon: true,
      showEnv: true
    },
    
    isModalOpen: false,
    inspectedNodeIds: [], 

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
      
      // ФИКС 2: Инициализируем объект для подсчета ISSN
      const tempIssnCounts = {} 

      this.graphModel.nodes.forEach(n => {
        if (n.type === 'incose_source') {
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
      let originalEdgesCount = 0
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

          const tNode = this.graphModel.nodes.get(tId)
          if (tNode && tNode.type !== 'irrelevant') {
            originalEdgesCount++
          }
        }
      })

      // Сначала посчитаем исходные (original) метрики до применения Citation Frequency фильтра
      let originalCore = 0, originalCanon = 0, originalEnv = 0
      this.graphModel.nodes.forEach(n => {
        const inCount = dynamicInDegree.get(n.id) || 0
        if (n.type === 'incose_source') {
          if (activeCoreNodes.has(n.id)) originalCore++
        } else {
          if (inCount > 0) {
            if (n.type === 'assimilated_canon') originalCanon++
            else if (n.type !== 'irrelevant') originalEnv++
          }
        }
      })

      // Теперь формируем набор финально активных узлов
      const finalActiveNodes = new Set()
      this.graphModel.nodes.forEach(n => {
        if (n.type === 'irrelevant') return

        if (n.type === 'incose_source') {
          if (!activeCoreNodes.has(n.id)) return
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
          if (this.lifespanFilterActive && n.type !== 'assimilated_canon') {
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
        originalCoreCount: originalCore,
        originalCanonCount: originalCanon,
        originalEnvCount: originalEnv,
        originalTotalNodes: originalCore + originalCanon + originalEnv,
        originalTotalEdges: originalEdgesCount,
        isCitationFilterActive: this.citationFrequencyFilter || this.uniqueAuthorsFilter || this.activeYearsFilterActive || this.lifespanFilterActive
      }
      this.topNodes = activeNodesArr.sort((a, b) => b.inDegree - a.inDegree).slice(0, 300)
    },

    setFocusedNode(nodeId) {
      if (this.focusedNodeId === nodeId) {
        this.focusedNodeId = null
      } else {
        this.focusedNodeId = nodeId
      }
    },
    toggleViz() { this.isVizActive = !this.isVizActive },
    
    openModal(nodeIds) {
      this.inspectedNodeIds = Array.isArray(nodeIds) ? nodeIds : [nodeIds]
      this.isModalOpen = true
      this.analyticsResult = null
    },
    closeModal() {
      this.isModalOpen = false
      this.inspectedNodeIds = []
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
    }
  },
  
  getters: {
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
      if (state.citationFrequencyFilter) {
        allCore = allCore.filter(node => state.activeNodeIds.has(node.id));
      }
      
      // ОПТИМИЗАЦИЯ O(1): Собираем целевые узлы таксономии один раз
      let validTargetIds = null;
      if (state.activeFilters.taxonomy) {
        const { level, name } = state.activeFilters.taxonomy;
        validTargetIds = new Set();
        state.graphModel.nodes.forEach(n => {
          if (n[level] === name) validTargetIds.add(n.id);
        });
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
    }
  }
})