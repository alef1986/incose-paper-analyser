<template>
  <div v-if="store.isModalOpen">
    <div id="modal-overlay" @click="attemptAction('close')"></div>
    
    <div id="info-modal">
      <span class="modal-close" @click="attemptAction('close')">✖</span>
      
      <!-- Restored Navigation -->
      <div class="nav-header">
        <template v-if="store.isBatchMode">
          <span class="nav-counter">Batch Editing {{ store.inspectedNodeIds.length }} Nodes</span>
        </template>
        <template v-else>
          <button class="nav-btn" :disabled="currentIndex <= 0" @click="attemptAction('prev')">&larr; Prev</button>
          <span class="nav-counter">Node {{ currentIndex + 1 }} of {{ store.topNodes.length }}</span>
          <button class="nav-btn" :disabled="currentIndex >= store.topNodes.length - 1" @click="attemptAction('next')">Next &rarr;</button>
        </template>
      </div>
      
      <div class="field-group">
        <label>Source Title</label>
        <input type="text" v-model="editForm.title" @input="isDirty = true" class="edit-input" :readonly="store.isBatchMode && editForm.title === 'Multiple different titles'">
        
        <!-- Single Node OpenAlex Fetch -->
        <div class="proposal-wrapper" v-if="!store.isBatchMode && singleNodeUrl.includes('openalex.org')">
          <button class="nav-btn fetch-btn" @click="fetchTitleFromOpenAlex" :disabled="isFetchingTitle">
             {{ isFetchingTitle ? 'Fetching...' : 'Fetch Missing Data from OpenAlex' }}
          </button>
          <div v-if="proposedData.title" class="proposal-box">
             <span class="proposed-text"><b>Proposal:</b> {{ proposedData.title }} ({{ proposedData.authors }})</span>
             
             <!-- Показываем таксономию, если она найдена -->
             <span class="proposed-text" v-if="proposedData.domain !== 'Unknown'" style="color: #5cb85c; margin-top: 4px;">
               <b>Taxonomy:</b> {{ proposedData.domain }} &rarr; {{ proposedData.field }}
             </span>
             
             <button class="nav-btn accept-btn" style="margin-top: 8px;" @click="acceptProposedTitle">Accept Proposal</button>
          </div>
        </div>
      </div>
      
      <div class="field-group" v-if="!store.isBatchMode">
        <p class="meta-info"><b>URL / DOI:</b> <a :href="singleNodeUrl" target="_blank">{{ singleNodeUrl }}</a></p>
        <p class="meta-info"><b>Authors:</b> {{ store.inspectedNodes[0]?.authors || 'Unknown' }}</p>
        <!-- NEW: Taxonomy Display -->
        <p class="meta-info" v-if="store.inspectedNodes[0]?.domain && store.inspectedNodes[0]?.domain !== 'Unknown'">
          <b>Taxonomy: </b> 
          <span style="color: #5cb85c;">
            {{ store.inspectedNodes[0].domain }} &rarr; {{ store.inspectedNodes[0].field }} 
            <span v-if="store.inspectedNodes[0].subfield && store.inspectedNodes[0].subfield !== 'Unknown'">
              &rarr; {{ store.inspectedNodes[0].subfield }}
            </span>
          </span>
        </p>
      </div>

      <!-- Batch Node OpenAlex Fetch -->
      <div class="field-group" v-if="store.isBatchMode">
        
        <button v-if="!isBatchFetching" class="nav-btn fetch-btn" style="width: 100%;" @click="runBatchFetch">
          Batch Fetch Missing Data from OpenAlex
        </button>

        <!-- Visual Progress Bar -->
        <div v-else class="progress-container">
          <div class="progress-bar" :style="{ width: batchProgress + '%' }"></div>
          <span class="progress-text">Processing {{ batchProgress }}%...</span>
        </div>

        <div v-if="batchReport" class="proposal-box">
          <span class="proposed-text" style="color:#5cb85c;"><b>Success:</b> {{ batchReport.success }} nodes updated.</span>
          <span class="proposed-text" style="color:#d9534f;" v-if="batchReport.failed > 0"><b>Failed:</b> {{ batchReport.failed }} nodes (non-OpenAlex IDs or missing).</span>
        </div>
      </div>

      <!-- NEW: Editable Taxonomy Fields -->
      <div class="field-group separator">
        <label>Taxonomy (Domain &rarr; Field &rarr; Subfield)</label>
        <div style="display: flex; gap: 5px; margin-bottom: 5px;">
          <input type="text" v-model="editForm.domain" @input="isDirty = true" class="edit-input" placeholder="Domain..." :readonly="store.isBatchMode && editForm.domain.startsWith('Multiple')">
          <input type="text" v-model="editForm.field" @input="isDirty = true" class="edit-input" placeholder="Field..." :readonly="store.isBatchMode && editForm.field.startsWith('Multiple')">
        </div>
        <input type="text" v-model="editForm.subfield" @input="isDirty = true" class="edit-input" placeholder="Subfield..." :readonly="store.isBatchMode && editForm.subfield.startsWith('Multiple')">
      </div>

      <!-- Batch Category Selector -->
      <div class="field-group separator">
        <label>Luhmann Category <span v-if="editForm.type === 'multiple'" style="color:#d9534f;">(Currently Mixed)</span></label>
        <div class="type-buttons">
          <div class="type-btn" :class="{ 'active-core': editForm.type === 'incose_source' }" @click="setType('incose_source')">Core<br>(INCOSE)</div>
          <div class="type-btn" :class="{ 'active-canon': editForm.type === 'assimilated_canon' }" @click="setType('assimilated_canon')">Canon<br>(Assimilated)</div>
          <div class="type-btn" :class="{ 'active-env': editForm.type === 'external_or_unknown' }" @click="setType('external_or_unknown')">Env<br>(External)</div>
          <div class="type-btn" :class="{ 'active-irr': editForm.type === 'irrelevant' }" @click="setType('irrelevant')">Not Rel<br>(Exclude)</div>
        </div>
      </div>
      
      <div class="field-group">
        <label>Classification Justification</label>
        <textarea v-model="editForm.justification" @input="isDirty = true" class="edit-input" rows="2" :readonly="store.isBatchMode && editForm.justification === 'Multiple different justifications'"></textarea>
      </div>
      
      <button class="btn-modal-save" @click="saveChanges">Save Changes</button>

      <!-- Auxiliary Functions (Blocked in Batch Mode) -->
      <template v-if="!store.isBatchMode">
        <div class="field-group separator">
          <label>Who cites this source?</label>
          <div class="citers-box">
            <ul>
              <li v-if="citingNodes.length === 0" class="empty-text">No known incoming citations</li>
              <li v-for="citer in citingNodes.slice(0, 15)" :key="citer.id" @click="attemptAction('jump', citer.id)">{{ truncate(citer.title) }}</li>
            </ul>
          </div>
        </div>

        <div class="field-group separator">
          <button class="nav-btn" style="width:100%; border-color:#00bfff; color:#00bfff; margin-bottom:10px;" @click="store.executeLuhmannAnalytics" :disabled="store.isAnalyticsLoading">
            {{ store.isAnalyticsLoading ? 'Running Algorithms & API Checks...' : 'Run Luhmann Analytics' }}
          </button>
          <div v-if="store.analyticsResult" class="analytics-box">
             <!-- ... analytics output elements (Gatekeepers, Penetration, Temporal) ... -->
             <!-- Note: Leave the analytics-item markup unchanged from your current file to save space here -->
             <div class="analytics-item">
              <span class="analytics-label">Gatekeepers (OpenAlex):</span>
              <span :class="{'highlight-success': store.analyticsResult.gatekeepers.hasGatekeeper}">{{ store.analyticsResult.gatekeepers.status }}</span>
              <ul v-if="store.analyticsResult.gatekeepers.authors.length" class="author-list">
                <li v-for="author in store.analyticsResult.gatekeepers.authors" :key="author.name">
                  {{ author.name }} 
                  <span v-if="author.isGatekeeper" class="badge-success">INCOSE: {{ author.incosePapers }}</span>
                  <span v-else class="badge-fail">No INCOSE</span>
                </li>
              </ul>
            </div>
            <!-- Core Penetration -->
            <div class="analytics-item">
              <span class="analytics-label">Core Penetration:</span>
              <span>
                {{ store.analyticsResult.penetration.citingCoreCount }} out of 
                {{ store.analyticsResult.penetration.totalCoreCount }} core nodes 
                (<span class="highlight">{{ store.analyticsResult.penetration.rate }}%</span>)
              </span>
              <!-- Verdict Restored -->
              <div class="analytics-verdict">Verdict: {{ store.analyticsResult.penetration.rawScore }}</div>
            </div>
            
            <!-- Temporal Stability & Timeline -->
            <div class="analytics-item">
              <span class="analytics-label">Temporal Stability:</span>
              <span v-if="store.analyticsResult.temporal.spanYears > 0">
                {{ store.analyticsResult.temporal.minYear }} &mdash; {{ store.analyticsResult.temporal.maxYear }} 
                ({{ store.analyticsResult.temporal.spanYears }} yrs)
              </span>
              <span v-else>No temporal span detected</span>
              <!-- Verdict Restored -->
              <div class="analytics-verdict">Verdict: {{ store.analyticsResult.temporal.status }}</div>

              <!-- NEW: Citation Distribution Histogram -->
              <div v-if="store.analyticsResult.temporal.distribution?.length" class="temporal-timeline">
                 <div v-for="item in store.analyticsResult.temporal.distribution" :key="item.year" class="timeline-row">
                    <span class="timeline-year">{{ item.year }}</span>
                    <div class="timeline-bar-wrapper">
                       <div 
                         class="timeline-bar" 
                         :style="{ width: (item.count / store.analyticsResult.temporal.maxCitationsInYear * 100) + '%' }"
                       ></div>
                    </div>
                    <span class="timeline-count">{{ item.count }}</span>
                 </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- Confirm Dialog -->
    <div id="confirm-dialog" v-if="showConfirm">
      <h3>Warning</h3><p>You have unsaved changes.</p>
      <button class="btn-c btn-c-save" @click="resolveConfirm('save')">Save & Continue</button>
      <button class="btn-c btn-c-discard" @click="resolveConfirm('discard')">Discard</button>
      <button class="btn-c btn-c-cancel" @click="showConfirm = false">Cancel</button>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, computed, watch } from 'vue'
import { useGraphStore } from '../../store/graphStore.js'

const POLITE_EMAIL = "alexander@efremov-systems.de"

const extractAuthors = (data) => {
  if (!data.authorships || !Array.isArray(data.authorships)) return 'Unknown'
  const names = data.authorships.map(a => a.author?.display_name || a.raw_author_name).filter(Boolean)
  return names.length > 0 ? names.join(', ') : 'Unknown'
}

const store = useGraphStore()
const editForm = reactive({ 
  title: '', type: '', justification: '',
  domain: '', field: '', subfield: ''
})
const isDirty = ref(false); const showConfirm = ref(false)
let pendingAction = null 

const isFetchingTitle = ref(false)
const proposedData = reactive({ 
  title: null, 
  authors: null,
  domain: null,
  field: null,
  subfield: null
})

const isBatchFetching = ref(false)
const batchProgress = ref(0)
const batchReport = ref(null)

// Navigation Index
const currentIndex = computed(() => {
  if (store.isBatchMode || store.inspectedNodes.length === 0) return -1
  return store.topNodes.findIndex(n => n.id === store.inspectedNodes[0].id)
})

const singleNodeUrl = computed(() => {
  if (store.isBatchMode || store.inspectedNodes.length === 0) return ''
  const id = store.inspectedNodes[0].id
  return id.startsWith('http') ? id : `https://openalex.org/${id}`
})

const citingNodes = computed(() => {
  if (store.isBatchMode || store.inspectedNodes.length === 0) return []
  const targetId = store.inspectedNodes[0].id
  const adj = store.graphModel.adjacencyList.get(targetId) || []
  return adj.filter(l => (typeof l.target === 'object' ? l.target.id : l.target) === targetId)
            .map(l => store.graphModel.nodes.get(typeof l.source === 'object' ? l.source.id : l.source)).filter(Boolean)
})

const truncate = (text) => text && text.length > 50 ? text.substring(0, 47) + '...' : (text || 'Untitled')

watch(() => store.inspectedNodeIds, (ids) => {
  proposedData.title = null; batchReport.value = null
  if (ids.length === 0) return
  
  const nodes = store.inspectedNodes
  const firstNode = nodes[0]
  
  const sameTitle = nodes.every(n => n.title === firstNode.title)
  const sameType = nodes.every(n => n.type === firstNode.type)
  const sameJust = nodes.every(n => n.justification === firstNode.justification)
  const sameDomain = nodes.every(n => n.domain === firstNode.domain)
  const sameField = nodes.every(n => n.field === firstNode.field)
  const sameSubfield = nodes.every(n => n.subfield === firstNode.subfield)

  editForm.title = sameTitle ? firstNode.title : 'Multiple different titles'
  editForm.type = sameType ? firstNode.type : 'multiple'
  editForm.justification = sameJust ? firstNode.justification : 'Multiple different justifications'
  
  // Если узел имеет 'Unknown', оставляем поле пустым для красоты
  editForm.domain = sameDomain ? (firstNode.domain !== 'Unknown' ? firstNode.domain : '') : 'Multiple domains'
  editForm.field = sameField ? (firstNode.field !== 'Unknown' ? firstNode.field : '') : 'Multiple fields'
  editForm.subfield = sameSubfield ? (firstNode.subfield !== 'Unknown' ? firstNode.subfield : '') : 'Multiple subfields'
  
  isDirty.value = false
})

const fetchTitleFromOpenAlex = async () => {
  if (store.isBatchMode || store.inspectedNodes.length === 0) return
  isFetchingTitle.value = true
  try {
    const url = `https://api.openalex.org/works/${encodeURIComponent(store.inspectedNodes[0].id)}?mailto=${POLITE_EMAIL}`
    const res = await fetch(url)
    if (res.ok) {
      const data = await res.json()
      if (data.title) {
        proposedData.title = data.title
        proposedData.authors = extractAuthors(data)
        
        // Извлекаем таксономию
        const topic = data.primary_topic || {}
        proposedData.domain = topic.domain?.display_name || 'Unknown'
        proposedData.field = topic.field?.display_name || 'Unknown'
        proposedData.subfield = topic.subfield?.display_name || 'Unknown'
      } else alert("No title found.")
    } else {
      alert(`API Error: ${res.status}`)
    }
  } catch { alert("Failed to fetch data.") } finally { isFetchingTitle.value = false }
}

const acceptProposedTitle = () => { 
  if (proposedData.title) { 
    editForm.title = proposedData.title; 
    
    if(store.inspectedNodes.length === 1) {
      const n = store.inspectedNodes[0];
      n.authors = proposedData.authors;
      // Сохраняем таксономию прямо в узел
      n.domain = proposedData.domain;
      n.field = proposedData.field;
      n.subfield = proposedData.subfield;
    }
    
    isDirty.value = true; 
    
    // Очищаем временные данные
    proposedData.title = null; 
    proposedData.authors = null;
    proposedData.domain = null;
    proposedData.field = null;
    proposedData.subfield = null;
    
    // Принудительно обновляем метрики, чтобы Sunburst перерисовался мгновенно
    store.recalculateMetrics();
  } 
}

const runBatchFetch = async () => {
  isBatchFetching.value = true;
  batchProgress.value = 0;
  let success = 0, failed = 0;
  
  const openAlexNodes = store.inspectedNodes.filter(n => n.id.includes('openalex.org'));
  failed += (store.inspectedNodes.length - openAlexNodes.length);

  const chunkSize = 50;
  const chunks = [];
  for (let i = 0; i < openAlexNodes.length; i += chunkSize) {
    chunks.push(openAlexNodes.slice(i, i + chunkSize));
  }

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    batchProgress.value = Math.floor((i / chunks.length) * 100);
    
    const idList = chunk.map(n => n.id.replace('https://openalex.org/', '')).join('|');
    const url = `https://api.openalex.org/works?filter=openalex_id:${idList}&per-page=50&mailto=${POLITE_EMAIL}`;
    
    try {
      let res = await fetch(url);
      if (res.status === 429) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        res = await fetch(url);
      }

      if (res.ok) {
        const data = await res.json();
        const worksMap = new Map();
        data.results.forEach(w => worksMap.set(w.id, w));
        
        chunk.forEach(n => {
          const work = worksMap.get(n.id);
          if (work && work.title) {
            n.title = work.title;
            n.authors = extractAuthors(work);
            
            // CRITICAL FIX: Save the taxonomy data so the Sunburst can use it
            const topic = work.primary_topic || {};
            n.domain = topic.domain?.display_name || 'Unknown';
            n.field = topic.field?.display_name || 'Unknown';
            n.subfield = topic.subfield?.display_name || 'Unknown';
            
            success++;
          } else {
            failed++;
          }
        });
      } else failed += chunk.length; 
    } catch { failed += chunk.length; }
    
    await new Promise(resolve => setTimeout(resolve, 200)); 
  }
  
  store.recalculateMetrics(); 
  batchProgress.value = 100;
  batchReport.value = { success, failed };
  isBatchFetching.value = false;
}

const setType = (newType) => { if (editForm.type !== newType) isDirty.value = true; editForm.type = newType }
const attemptAction = (actionType, payload = null) => { if (isDirty.value) { pendingAction = { type: actionType, payload }; showConfirm.value = true } else { executeAction(actionType, payload) } }
const resolveConfirm = (res) => { showConfirm.value = false; if (res === 'save') store.updateNodeAttributes(editForm); isDirty.value = false; executeAction(pendingAction.type, pendingAction.payload); pendingAction = null }

const executeAction = (actionType, payload) => { 
  if (actionType === 'close') store.closeModal(); 
  else if (actionType === 'jump') { store.setFocusedNode(payload); store.openModal(payload) }
  else if (actionType === 'next' || actionType === 'prev') {
    const offset = actionType === 'next' ? 1 : -1;
    const targetId = store.topNodes[currentIndex.value + offset]?.id;
    if (targetId) { store.setFocusedNode(targetId); store.openModal(targetId); }
  }
}
const saveChanges = () => { store.updateNodeAttributes(editForm); isDirty.value = false }
</script>

<style scoped>
#modal-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.5); z-index: 999; }
#info-modal { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(15, 15, 25, 0.95); border: 1px solid #00bfff; padding: 25px; border-radius: 8px; z-index: 1000; width: 500px; max-height: 90vh; overflow-y: auto; box-shadow: 0 0 30px rgba(0, 191, 255, 0.2); backdrop-filter: blur(5px); }
#info-modal::-webkit-scrollbar { width: 4px; } #info-modal::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 2px; }
.modal-close { position: absolute; top: 15px; right: 15px; cursor: pointer; color: #aaa; font-size: 18px; font-weight: bold; }
.nav-header { margin-bottom: 15px; border-bottom: 1px dashed rgba(255,255,255,0.2); padding-bottom: 10px; }
.nav-counter { font-size: 14px; color: #fff; font-weight: bold; }

.field-group { margin-bottom: 15px; }
.separator { margin-top: 15px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.1); }
label { font-size: 11px; color: #aaa; text-transform: uppercase; display: block; margin-bottom: 5px; }
.meta-info { font-size: 12px; color: #ccc; margin: 0 0 5px 0; }
a { color: #f0ad4e; text-decoration: none; word-wrap: break-word; }
.edit-input { width: 100%; box-sizing: border-box; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.3); color: #fff; padding: 8px; border-radius: 4px; font-family: inherit; font-size: 13px; resize: vertical; }
.edit-input[readonly] { color: #888; font-style: italic; background: rgba(255,255,255,0.05); cursor: not-allowed; }
.edit-input:focus:not([readonly]) { outline: none; border-color: #00bfff; }

.type-buttons { display: flex; gap: 5px; flex-wrap: wrap; }
.type-btn { padding: 8px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.3); color: #fff; border-radius: 4px; cursor: pointer; font-size: 11px; flex: 1; text-align: center; }
.type-btn:hover { background: rgba(255,255,255,0.2); }
.active-core { background: rgba(0, 191, 255, 0.2); border-color: #00bfff; color: #00bfff; }
.active-canon { background: rgba(92, 184, 92, 0.2); border-color: #5cb85c; color: #5cb85c; }
.active-env { background: rgba(170, 170, 170, 0.2); border-color: #aaa; color: #aaa; }
.active-irr { background: rgba(139, 0, 0, 0.2); border-color: #d9534f; color: #d9534f; }

.btn-modal-save { width: 100%; padding: 10px; margin-top: 15px; border-radius: 4px; background: rgba(0, 191, 255, 0.2); border: 1px solid #00bfff; color: #00bfff; cursor: pointer; font-size: 13px; font-weight: bold; }
.nav-btn { padding: 6px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.3); color: #fff; border-radius: 4px; cursor: pointer; font-size: 11px; }
.nav-btn:hover:not(:disabled) { background: rgba(255,255,255,0.2); }
.fetch-btn { border-color: #f0ad4e; color: #f0ad4e; width: 100%; margin-top: 8px; }
.proposal-box { margin-top: 8px; padding: 10px; background: rgba(240, 173, 78, 0.1); border: 1px dashed #f0ad4e; border-radius: 4px; display: flex; flex-direction: column; gap: 8px; }
.proposed-text { font-size: 11px; color: #fff; font-style: italic; }
.accept-btn { background: rgba(92, 184, 92, 0.2); border-color: #5cb85c; color: #5cb85c; align-self: flex-start; }

.citers-box { max-height: 80px; overflow-y: auto; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); padding: 8px; border-radius: 4px; font-size: 11px; }
.citers-box ul { list-style: none; padding: 0; margin: 0; }
.citers-box li { padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.05); color: #ccc; cursor: pointer; }
.citers-box li:hover { color: #fff; text-decoration: underline; }
.empty-text { color: #666 !important; cursor: default !important; }

.analytics-box { background: rgba(0, 191, 255, 0.05); border: 1px dashed #00bfff; padding: 12px; border-radius: 4px; font-size: 11px; margin-top: 10px; }
.analytics-item { margin-bottom: 12px; } .analytics-item:last-child { margin-bottom: 0; }
.analytics-label { color: #aaa; text-transform: uppercase; font-size: 10px; display: block; margin-bottom: 3px; }
.analytics-verdict { color: #ccc; font-style: italic; margin-top: 3px; }
.highlight { color: #00bfff; font-weight: bold; } .highlight-success { color: #5cb85c; font-weight: bold; }
.author-list { list-style: none; padding: 0; margin: 5px 0 0 0; }
.author-list li { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.05); padding: 2px 0; }
.badge-success { background: rgba(92, 184, 92, 0.2); color: #5cb85c; padding: 2px 6px; border-radius: 4px; font-size: 9px; }
.badge-fail { background: rgba(217, 83, 79, 0.2); color: #d9534f; padding: 2px 6px; border-radius: 4px; font-size: 9px; }

#confirm-dialog { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: #1a1a24; border: 1px solid #d9534f; padding: 25px; border-radius: 8px; z-index: 1005; text-align: center; width: 300px; }
#confirm-dialog h3 { margin-top: 0; color: #d9534f; font-size: 16px; }
.btn-c { padding: 8px 12px; border-radius: 4px; border: none; cursor: pointer; font-size: 12px; font-weight: bold; margin: 5px; width: 90%; }
.btn-c-save { background: #5cb85c; color: #fff; } .btn-c-discard { background: #d9534f; color: #fff; } .btn-c-cancel { background: #555; color: #fff; }

/* Progress Bar Styles */
.progress-container {
  width: 100%;
  height: 32px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid #f0ad4e;
  border-radius: 4px;
  position: relative;
  overflow: hidden;
  margin-top: 8px;
}
.progress-bar {
  height: 100%;
  background: rgba(240, 173, 78, 0.4);
  transition: width 0.3s ease;
}
.progress-text {
  position: absolute;
  top: 0; left: 0;
  width: 100%; height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  color: #fff;
  font-weight: bold;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
}

/* Temporal Timeline Histogram */
.temporal-timeline {
  margin-top: 8px;
  background: rgba(0, 0, 0, 0.2);
  padding: 6px;
  border-radius: 4px;
  max-height: 120px;
  overflow-y: auto;
  border: 1px solid rgba(255,255,255,0.05);
}
.temporal-timeline::-webkit-scrollbar { width: 4px; }
.temporal-timeline::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 2px; }

.timeline-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 3px;
}
.timeline-row:last-child { margin-bottom: 0; }
.timeline-year {
  font-size: 9px;
  color: #888;
  width: 28px;
}
.timeline-bar-wrapper {
  flex: 1;
  background: rgba(255,255,255,0.05);
  height: 6px;
  border-radius: 3px;
  overflow: hidden;
}
.timeline-bar {
  background: #00bfff;
  height: 100%;
  border-radius: 3px;
  min-width: 2px;
}
.timeline-count {
  font-size: 9px;
  color: #ccc;
  width: 20px;
  text-align: right;
}
</style>