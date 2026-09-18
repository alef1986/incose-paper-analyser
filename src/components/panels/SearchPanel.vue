<template>
  <div class="search-section">
    <h3>Search & Batch Edit</h3>
    
    <div class="search-bar">
      <!-- Search Mode Selector -->
      <select v-model="searchType" class="search-select" @change="executeSearch">
        <option value="author">By Author</option>
        <option value="title">By Title</option>
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
</template>

<script setup>
import { ref } from 'vue'
import { useGraphStore } from '../../store/graphStore.js'

const store = useGraphStore()
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

  const query = searchQuery.value.toLowerCase()
  searchResults.value = Array.from(store.graphModel.nodes.values()).filter(n => {
    // Respect global filters from the right panel
    if (!store.displayFilters[n.type]) return false
    
    if (searchType.value === 'all') return true
    if (searchType.value === 'author') return n.authors && n.authors.toLowerCase().includes(query)
    if (searchType.value === 'title') return n.title && n.title.toLowerCase().includes(query)
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
.search-section { margin-top: 25px; border-top: 1px dashed rgba(255, 255, 255, 0.2); padding-top: 15px; display: flex; flex-direction: column; flex: 1; min-height: 0; }
h3 { margin-top: 0; color: #fff; font-size: 14px; margin-bottom: 10px; }
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