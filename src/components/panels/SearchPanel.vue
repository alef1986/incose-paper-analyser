<template>
  <div class="search-section" :class="{ 'compact-mode': hideHeader }">
    <h3 v-if="!hideHeader" class="section-title collapsible-header" @click="isSearchOpen = !isSearchOpen">
      Search & Batch Edit
      <span class="toggle-icon">{{ isSearchOpen ? '▼' : '▶' }}</span>
    </h3>
    
    <div v-show="hideHeader || isSearchOpen" class="collapsible-content">
      <div class="search-bar" :style="!hideHeader ? 'margin-top: 10px;' : ''">
        <!-- Search Mode Selector -->
        <select v-model="searchType" class="search-select" @change="executeSearch">
          <option value="author">By Author</option>
          <option value="title">By Title</option>
          <option value="id">By OpenAlex ID</option>
          <option value="all">Show All (*)</option>
        </select>
        
        <input 
          v-if="searchType !== 'all'" 
          type="text" 
          v-model="searchQuery" 
          placeholder="Enter search term..." 
          @input="executeSearch" 
          class="search-input"
        >
      </div>

      <div v-if="searchResults.length > 0" class="search-controls">
        <button class="nav-btn" @click="selectAll" :disabled="isSelecting">
          {{ isSelecting ? 'Selecting...' : 'Select All' }}
        </button>
        <button class="nav-btn" @click="deselectAll">Clear</button>
        <button class="nav-btn edit-btn" @click="editSelected" :disabled="selectedIds.length === 0">
          Edit Selected ({{ selectedIds.length }})
        </button>
      </div>

      <!-- Limit DOM rendering to 100 items to prevent freezing -->
      <div class="search-results" v-if="searchResults.length > 0">
        <div class="meta-info" v-if="searchResults.length > 100">
          Showing top 100 of {{ searchResults.length }} results. Use "Select All" to capture all.
        </div>
        <label v-for="node in searchResults.slice(0, 100)" :key="node.id" class="result-item">
          <input type="checkbox" :value="node.id" v-model="selectedIds">
          <div class="result-info">
            <span class="res-title" :style="{ color: getTextColor(node.type) }">{{ truncate(node.title) }}</span>
            <span class="res-author">{{ truncate(node.authors, 40) }}</span>
          </div>
        </label>
      </div>
      <div v-else-if="searchType !== 'all' && searchQuery.length > 2" class="empty-search">
        No matches found in visible categories.
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useGraphStore } from '../../store/graphStore.js'

defineProps({
  hideHeader: {
    type: Boolean,
    default: true
  }
})

const store = useGraphStore()
const isSearchOpen = ref(false)
const searchType = ref('author')
const searchQuery = ref('')
const searchResults = ref([])
const selectedIds = ref([])
const isSelecting = ref(false)

const getTextColor = (type) => {
  if (type === 'incose_source') return '#00bfff'
  if (type === 'assimilated_canon') return '#5cb85c'
  if (type === 'irrelevant') return '#8b0000'
  return '#aaa'
}

const truncate = (text, len = 35) => text && text.length > len ? text.substring(0, len-3) + '...' : (text || 'Unknown')

const executeSearch = () => {
  if (!store.graphModel || (searchType.value !== 'all' && searchQuery.value.length < 3)) {
    searchResults.value = []
    return
  }

  const query = searchQuery.value.toLowerCase().trim()
  searchResults.value = Array.from(store.graphModel.nodes.values()).filter(n => {
    // Respect global filters from the right panel
    if (!store.displayFilters[n.type]) return false
    
    if (searchType.value === 'all') return true
    if (searchType.value === 'author') return n.authors && n.authors.toLowerCase().includes(query)
    if (searchType.value === 'title') return n.title && n.title.toLowerCase().includes(query)
    if (searchType.value === 'id') {
      if (!n.id) return false
      const cleanQuery = query.replace(/^https?:\/\/openalex\.org\//i, '').trim()
      if (!cleanQuery) return false
      const cleanId = String(n.id).toLowerCase().replace(/^https?:\/\/openalex\.org\//i, '').trim()
      return cleanId.includes(cleanQuery) || String(n.id).toLowerCase().includes(query)
    }
    return false
  })
}

// Decouple the mass selection from the main UI thread via setTimeout
const selectAll = () => {
  isSelecting.value = true
  setTimeout(() => {
    selectedIds.value = searchResults.value.map(n => n.id)
    isSelecting.value = false
  }, 10)
}

const deselectAll = () => { selectedIds.value = [] }
const editSelected = () => { store.openModal(selectedIds.value) }
</script>

<style scoped>
.search-section { margin-top: 25px; border-top: 1px dashed rgba(255, 255, 255, 0.2); padding-top: 15px; display: flex; flex-direction: column; flex-shrink: 0; min-height: 0; }
.search-section.compact-mode {
  margin-top: 0;
  margin-bottom: 8px;
  border: 1px dashed rgba(255, 170, 0, 0.4);
  padding: 8px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.25);
  max-height: 250px;
}
.search-section.compact-mode .collapsible-content {
  margin-top: 0;
}
.section-title { font-size: 13px; color: #fff; margin: 0; }
.collapsible-header { cursor: pointer; display: flex; justify-content: space-between; align-items: center; user-select: none; transition: color 0.2s; }
.collapsible-header:hover { color: #00bfff; }
.toggle-icon { font-size: 10px; color: #888; transition: transform 0.2s; }
.collapsible-content { margin-top: 12px; display: flex; flex-direction: column; min-height: 0; }
.search-bar { display: flex; gap: 5px; margin-bottom: 10px; }
.search-select { background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.3); color: #fff; border-radius: 4px; font-size: 11px; padding: 5px; }
.search-select option { background: #1a1a24; }
.search-input { width: 100%; box-sizing: border-box; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.3); color: #fff; padding: 8px; border-radius: 4px; font-size: 12px; }
.search-input:focus { outline: none; border-color: #00bfff; }
.search-controls { display: flex; gap: 5px; margin-bottom: 10px; }
.nav-btn { padding: 6px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.3); color: #fff; border-radius: 4px; cursor: pointer; font-size: 11px; flex: 1; }
.nav-btn:hover:not(:disabled) { background: rgba(255,255,255,0.2); }
.edit-btn { border-color: #f0ad4e; color: #f0ad4e; background: rgba(240, 173, 78, 0.1); font-weight: bold; }
.edit-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.search-results { overflow-y: auto; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 5px; flex: 1; }
.result-item { display: flex; align-items: flex-start; padding: 6px; border-bottom: 1px dashed rgba(255,255,255,0.1); cursor: pointer; }
.result-item:hover { background: rgba(255,255,255,0.05); }
.result-item input { margin-top: 3px; margin-right: 8px; cursor: pointer; }
.result-info { display: flex; flex-direction: column; }
.res-title { font-size: 11px; font-weight: bold; }
.res-author { font-size: 10px; color: #888; margin-top: 2px; }
.empty-search { font-size: 11px; color: #aaa; text-align: center; margin-top: 10px; }
.meta-info { font-size: 10px; color: #00bfff; margin-bottom: 8px; font-style: italic; }
</style>