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
    isVizActive: true,

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
        } else {
          activeCoreNodes.add(n.id) 
        }
      })

      let activeEdgesCount = 0
      this.graphModel.links.forEach(l => {
        const sId = typeof l.source === 'object' ? l.source.id : l.source
        const tId = typeof l.target === 'object' ? l.target.id : l.target
        if (activeCoreNodes.has(sId)) {
          dynamicInDegree.set(tId, (dynamicInDegree.get(tId) || 0) + 1)
          activeEdgesCount++
        }
      })

      let core = 0, canon = 0, env = 0, irrelevant = 0
      const activeNodesArr = []

      this.graphModel.nodes.forEach(n => {
        n.inDegree = dynamicInDegree.get(n.id) || 0
        if (n.type === 'incose_source' && !activeCoreNodes.has(n.id)) return
        if (n.type !== 'incose_source' && n.inDegree === 0) return 

        if (n.type === 'incose_source') core++
        else if (n.type === 'assimilated_canon') canon++
        else if (n.type === 'irrelevant') irrelevant++
        else env++

        if (n.type !== 'irrelevant') activeNodesArr.push(n)
      })

      this.metrics = { 
        totalNodes: activeNodesArr.length, totalEdges: activeEdgesCount, 
        coreCount: core, canonCount: canon, envCount: env, irrelevantCount: irrelevant,
        issnCounts: tempIssnCounts // ФИКС 4: Сохраняем подсчитанные ISSN в метрики
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
      const allCore = Array.from(state.graphModel.nodes.values()).filter(n => n.type === 'incose_source');
      
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