<template>
  <div v-if="store.isBlindSpotsOpen">
    <div id="modal-overlay" @click="close"></div>

    <div id="blind-spots-modal">
      <span class="modal-close" @click="close" title="Close">✖</span>

      <div class="modal-header">
        <div class="title-with-badge">
          <h2>Epistemic Blind Spots &amp; Disciplinary Asymmetry Audit</h2>
          <span class="luhmann-badge">Disciplinary Audit</span>
          <span class="journal-scope-badge" v-if="store.longitudinalScopeSummary" :title="store.longitudinalScopeSummary.selectedJournalLabels.join(', ')">
            📖 {{ store.longitudinalScopeSummary.selectedJournalLabels.join(', ') }}
          </span>
        </div>
        <p class="modal-subtitle">
          Macroscopic audit quantifying which external disciplines INCOSE ignores, rejects, or assimilates with epistemic lag.<br />
          <strong class="term">Irritation Rejection Rate:</strong> One-off perturbations (<span class="code-pill">inDegree = 1</span>) that failed to condense meaning into systemic memory.<br />
          <strong class="term">Epistemic Lag:</strong> Mean temporal distance (<span class="code-pill">Year<sub>Core</sub> − Year<sub>Env</sub></span>) revealing reliance on outdated classics vs contemporary science.
        </p>
      </div>

      <!-- Quick Metrics Ribbon -->
      <div class="summary-ribbon" v-if="store.disciplinaryBlindSpots.length > 0">
        <div class="ribbon-metric">
          <span class="r-label">Audited Domains</span>
          <span class="r-val">{{ store.disciplinaryBlindSpots.length }}</span>
        </div>
        <div class="ribbon-metric">
          <span class="r-label">Total External Imports</span>
          <span class="r-val">{{ totalAuditedCitations.toLocaleString() }}</span>
        </div>
        <div class="ribbon-metric">
          <span class="r-label">Systemic Rejection Rate</span>
          <span class="r-val" :class="{ 'val-danger': overallRejectionRate > 85 }">
            {{ overallRejectionRate.toFixed(1) }}%
          </span>
        </div>
        <div class="ribbon-metric">
          <span class="r-label">Median Epistemic Lag</span>
          <span class="r-val" :class="{ 'val-warning': overallLagStats.median !== null && overallLagStats.median > 15 }">
            {{ overallLagStats.median !== null ? overallLagStats.median.toFixed(1) + ' yrs' : 'N/A' }}
          </span>
          <span class="r-sub" v-if="overallLagStats.median !== null && overallLagStats.q1 !== null && overallLagStats.q3 !== null && overallLagStats.mean !== null">
            IQR: {{ overallLagStats.q1.toFixed(0) }}–{{ overallLagStats.q3.toFixed(0) }} | μ: {{ overallLagStats.mean.toFixed(1) }} yrs
          </span>
        </div>
      </div>

      <!-- Interactive Table -->
      <div class="table-wrapper" v-if="store.disciplinaryBlindSpots.length > 0">
        <table class="blind-spots-table">
          <thead>
            <tr>
              <th class="th-category" @click="setSort('name')">
                Category (Domain / Field / Subfield)
                <span class="sort-icon" v-if="sortKey === 'name'">{{ sortOrder === 'asc' ? '▲' : '▼' }}</span>
                <span class="help-icon" @click.stop title="3-tier OpenAlex disciplinary hierarchy (Domain ➔ Field ➔ Subfield). Click ▶ to drill down into sub-disciplines, or click Filter to slice the dashboard.">?</span>
              </th>
              <th class="th-num" @click="setSort('totalCitations')">
                Total Citations
                <span class="sort-icon" v-if="sortKey === 'totalCitations'">{{ sortOrder === 'asc' ? '▲' : '▼' }}</span>
                <span class="help-icon" @click.stop title="Total volume of outgoing citation links from INCOSE Core papers pointing to works in this discipline.">?</span>
              </th>
              <th class="th-num" @click="setSort('uniqueWorks')">
                Unique Works
                <span class="sort-icon" v-if="sortKey === 'uniqueWorks'">{{ sortOrder === 'asc' ? '▲' : '▼' }}</span>
                <span class="help-icon" @click.stop title="Number of distinct external publications (articles, books, standards) cited at least once by INCOSE Core papers.">?</span>
              </th>
              <th class="th-num" @click="setSort('rejectionRate')">
                Rejection Rate (1-off Noise)
                <span class="sort-icon" v-if="sortKey === 'rejectionRate'">{{ sortOrder === 'asc' ? '▲' : '▼' }}</span>
                <span class="help-icon" @click.stop title="Luhmann's Irritation Rejection Rate: Percentage of unique external works cited ONLY ONCE in the entire INCOSE corpus (inDegree = 1). High values (>80%) indicate one-off perturbations that failed to condense into shared community memory.">?</span>
              </th>
              <th class="th-num" @click="setSort('realizedShare')">
                Translator-Backed (%)
                <span class="sort-icon" v-if="sortKey === 'realizedShare'">{{ sortOrder === 'asc' ? '▲' : '▼' }}</span>
                <span class="help-icon" @click.stop title="Share of citations to this discipline made by verified 'True Translators' (INCOSE papers with both external references AND independent internal citations from other INCOSE authors). Measures realized structural coupling vs. unresonated scout noise.">?</span>
              </th>
              <th class="th-num" @click="setSort('medianLag')">
                Epistemic Lag (Median / IQR)
                <span class="sort-icon" v-if="sortKey === 'medianLag' || sortKey === 'avgLag'">{{ sortOrder === 'asc' ? '▲' : '▼' }}</span>
                <span class="help-icon" @click.stop title="Luhmann's Temporal Asynchrony (Eigenzeit): Median and Interquartile Range (IQR: Q1–Q3) of citation age (Core_Year − External_Year), reported alongside mean (μ). Statistically robust against right-skewed citation distributions.">?</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <template v-for="dom in sortedDomains" :key="dom.pathString">
              <!-- DOMAIN ROW (LEVEL 1) -->
              <tr class="audit-row row-domain" :class="{ 'is-expanded': expandedDomains.has(dom.pathString) }">
                <td class="td-category">
                  <div class="category-cell">
                    <button 
                      class="expand-btn" 
                      @click.stop="toggleDomain(dom.pathString)" 
                      :title="expandedDomains.has(dom.pathString) ? 'Collapse domain' : 'Expand fields'"
                    >
                      {{ expandedDomains.has(dom.pathString) ? '▼' : '▶' }}
                    </button>
                    <span class="level-tag tag-domain">Domain</span>
                    <span class="category-name font-bold">{{ dom.name }}</span>
                    <button class="row-filter-btn" @click.stop="applyFilter(dom)" title="Filter 3D view by this domain">Filter</button>
                  </div>
                </td>
                <td class="td-num font-mono">{{ dom.totalCitations }}</td>
                <td class="td-num font-mono">{{ dom.uniqueWorks }}</td>
                <td class="td-num">
                  <span class="badge" :class="dom.rejectionRate > 85 ? 'badge-danger' : 'badge-neutral'">
                    {{ dom.rejectionRate.toFixed(1) }}%
                  </span>
                </td>
                <td class="td-num">
                  <span class="badge" :class="dom.realizedShare > 30 ? 'badge-success' : 'badge-neutral'">
                    {{ dom.realizedShare.toFixed(1) }}%
                  </span>
                </td>
                <td class="td-num">
                  <div class="lag-cell">
                    <span class="badge" :class="dom.medianLag !== null && dom.medianLag > 15 ? 'badge-warning' : 'badge-neutral'">
                      {{ dom.medianLag !== null ? dom.medianLag.toFixed(1) + ' yrs' : '—' }}
                    </span>
                    <span class="lag-sub-meta" v-if="dom.medianLag !== null && dom.lagQ1 !== null && dom.lagQ3 !== null && dom.avgLag !== null">
                      IQR: {{ dom.lagQ1.toFixed(0) }}–{{ dom.lagQ3.toFixed(0) }} | μ: {{ dom.avgLag.toFixed(1) }}
                    </span>
                  </div>
                </td>
              </tr>

              <!-- FIELDS (LEVEL 2) -->
              <template v-if="expandedDomains.has(dom.pathString)">
                <template v-for="fld in dom.fields" :key="fld.pathString">
                  <tr class="audit-row row-field" :class="{ 'is-expanded': expandedFields.has(fld.pathString) }">
                    <td class="td-category">
                      <div class="category-cell indent-field">
                        <button 
                          class="expand-btn" 
                          @click.stop="toggleField(fld.pathString)" 
                          :title="expandedFields.has(fld.pathString) ? 'Collapse field' : 'Expand subfields'"
                        >
                          {{ expandedFields.has(fld.pathString) ? '▼' : '▶' }}
                        </button>
                        <span class="level-tag tag-field">Field</span>
                        <span class="category-name">{{ fld.name }}</span>
                        <button class="row-filter-btn" @click.stop="applyFilter(fld)" title="Filter 3D view by this field">Filter</button>
                      </div>
                    </td>
                    <td class="td-num font-mono">{{ fld.totalCitations }}</td>
                    <td class="td-num font-mono">{{ fld.uniqueWorks }}</td>
                    <td class="td-num">
                      <span class="badge" :class="fld.rejectionRate > 85 ? 'badge-danger' : 'badge-neutral'">
                        {{ fld.rejectionRate.toFixed(1) }}%
                      </span>
                    </td>
                    <td class="td-num">
                      <span class="badge" :class="fld.realizedShare > 30 ? 'badge-success' : 'badge-neutral'">
                        {{ fld.realizedShare.toFixed(1) }}%
                      </span>
                    </td>
                    <td class="td-num">
                      <div class="lag-cell">
                        <span class="badge" :class="fld.medianLag !== null && fld.medianLag > 15 ? 'badge-warning' : 'badge-neutral'">
                          {{ fld.medianLag !== null ? fld.medianLag.toFixed(1) + ' yrs' : '—' }}
                        </span>
                        <span class="lag-sub-meta" v-if="fld.medianLag !== null && fld.lagQ1 !== null && fld.lagQ3 !== null && fld.avgLag !== null">
                          IQR: {{ fld.lagQ1.toFixed(0) }}–{{ fld.lagQ3.toFixed(0) }} | μ: {{ fld.avgLag.toFixed(1) }}
                        </span>
                      </div>
                    </td>
                  </tr>
                  <!-- SUBFIELDS (LEVEL 3) -->
                  <template v-if="expandedFields.has(fld.pathString)">
                    <tr v-for="sub in fld.subfields" :key="sub.pathString" class="audit-row row-subfield">
                      <td class="td-category">
                        <div class="category-cell indent-subfield">
                          <span class="subfield-bullet">•</span>
                          <span class="level-tag tag-subfield">Subfield</span>
                          <span class="category-name text-muted">{{ sub.name }}</span>
                          <button class="row-filter-btn" @click.stop="applyFilter(sub)" title="Filter 3D view by this subfield">Filter</button>
                        </div>
                      </td>
                      <td class="td-num font-mono">{{ sub.totalCitations }}</td>
                      <td class="td-num font-mono">{{ sub.uniqueWorks }}</td>
                      <td class="td-num">
                        <span class="badge" :class="sub.rejectionRate > 85 ? 'badge-danger' : 'badge-neutral'">
                          {{ sub.rejectionRate.toFixed(1) }}%
                        </span>
                      </td>
                      <td class="td-num">
                        <span class="badge" :class="sub.realizedShare > 30 ? 'badge-success' : 'badge-neutral'">
                          {{ sub.realizedShare.toFixed(1) }}%
                        </span>
                      </td>
                      <td class="td-num">
                        <div class="lag-cell">
                          <span class="badge" :class="sub.medianLag !== null && sub.medianLag > 15 ? 'badge-warning' : 'badge-neutral'">
                            {{ sub.medianLag !== null ? sub.medianLag.toFixed(1) + ' yrs' : '—' }}
                          </span>
                          <span class="lag-sub-meta" v-if="sub.medianLag !== null && sub.lagQ1 !== null && sub.lagQ3 !== null && sub.avgLag !== null">
                            IQR: {{ sub.lagQ1.toFixed(0) }}–{{ sub.lagQ3.toFixed(0) }} | μ: {{ sub.avgLag.toFixed(1) }}
                          </span>
                        </div>
                      </td>
                    </tr>
                  </template>
                </template>
              </template>
            </template>
          </tbody>
        </table>
      </div>

      <div v-else class="empty-state">
        <p>No external domain classifications found in the current dataset.</p>
        <span class="empty-hint">Load an OpenAlex-enriched JSON or run batch metadata enrichment to unlock epistemic blind spots analysis.</span>
      </div>

      <div class="modal-footer">
        <span class="footer-tip">💡 Click any domain to set a 3D network slice and close this modal.</span>
        <button class="footer-close-btn" @click="close">Close Audit</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useGraphStore, computeLagStats } from '../../store/graphStore.js'

const store = useGraphStore()

const expandedDomains = ref(new Set())
const expandedFields = ref(new Set())

const toggleDomain = (pathString) => {
  const next = new Set(expandedDomains.value)
  if (next.has(pathString)) next.delete(pathString)
  else next.add(pathString)
  expandedDomains.value = next
}

const toggleField = (pathString) => {
  const next = new Set(expandedFields.value)
  if (next.has(pathString)) next.delete(pathString)
  else next.add(pathString)
  expandedFields.value = next
}

const applyFilter = (row) => {
  store.setTaxonomyFilter(row.level, row.name, row.pathString)
  close()
}

const sortKey = ref('totalCitations')
const sortOrder = ref('desc')

const setSort = (key) => {
  if (sortKey.value === key) {
    sortOrder.value = sortOrder.value === 'desc' ? 'asc' : 'desc'
  } else {
    sortKey.value = key
    sortOrder.value = 'desc'
  }
}

const close = () => {
  store.isBlindSpotsOpen = false
  if (store.activePreset === 'blindspots') {
    store.activePreset = null
  }
}

const sortList = (items, key, order) => {
  return [...items].sort((a, b) => {
    let valA = a[key]
    let valB = b[key]
    if (typeof valA === 'string') {
      return valA.localeCompare(valB) * order
    }
    if (valA === null || valA === undefined) valA = -Infinity
    if (valB === null || valB === undefined) valB = -Infinity
    return (valA - valB) * order
  })
}

const sortedDomains = computed(() => {
  const key = sortKey.value
  const order = sortOrder.value === 'asc' ? 1 : -1

  return sortList(store.disciplinaryBlindSpots, key, order).map(dom => {
    const sortedFields = dom.fields ? sortList(dom.fields, key, order).map(fld => {
      const sortedSubfields = fld.subfields ? sortList(fld.subfields, key, order) : []
      return { ...fld, subfields: sortedSubfields }
    }) : []
    return { ...dom, fields: sortedFields }
  })
})

const totalAuditedCitations = computed(() => {
  return store.disciplinaryBlindSpots.reduce((acc, row) => acc + row.totalCitations, 0)
})

const overallRejectionRate = computed(() => {
  const totalUnique = store.disciplinaryBlindSpots.reduce((acc, row) => acc + row.uniqueWorks, 0)
  const totalOneOff = store.disciplinaryBlindSpots.reduce((acc, row) => acc + row.oneOffWorks, 0)
  return totalUnique > 0 ? (totalOneOff / totalUnique) * 100 : 0
})

const overallLagStats = computed(() => {
  const allLags = []
  store.disciplinaryBlindSpots.forEach(dom => {
    if (dom.lags && dom.lags.length > 0) {
      allLags.push(...dom.lags)
    }
  })
  return computeLagStats(allLags)
})
</script>


<style scoped>
#modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  z-index: 999;
}

#blind-spots-modal {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(15, 15, 25, 0.96);
  border: 1px solid #00bfff;
  padding: 24px;
  border-radius: 8px;
  z-index: 1000;
  width: 1160px;
  max-width: 96vw;
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 0 35px rgba(0, 191, 255, 0.25);
  backdrop-filter: blur(10px);
  color: #eee;
  box-sizing: border-box;
}

.modal-close {
  position: absolute;
  top: 15px;
  right: 15px;
  cursor: pointer;
  color: #aaa;
  font-size: 18px;
  font-weight: bold;
}
.modal-close:hover {
  color: #fff;
}

.modal-header {
  margin-bottom: 14px;
  border-bottom: 1px dashed rgba(255, 255, 255, 0.15);
  padding-bottom: 12px;
}

.title-with-badge {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}

.title-with-badge h2 {
  margin: 0;
  font-size: 17px;
  color: #00bfff;
  font-weight: 700;
}

.luhmann-badge {
  font-size: 10px;
  padding: 2px 7px;
  border-radius: 4px;
  background: rgba(0, 191, 255, 0.15);
  border: 1px solid rgba(0, 191, 255, 0.4);
  color: #00bfff;
  text-transform: uppercase;
}
.journal-scope-badge {
  font-size: 10px;
  padding: 2px 7px;
  border-radius: 4px;
  background: rgba(92, 184, 92, 0.15);
  border: 1px solid rgba(92, 184, 92, 0.4);
  color: #5cb85c;
  max-width: 340px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}


.modal-subtitle {
  font-size: 11px;
  line-height: 1.5;
  color: #aaa;
  margin: 0;
}

.term {
  color: #ddd;
}

.code-pill {
  font-family: monospace;
  font-size: 10px;
  background: rgba(255, 255, 255, 0.08);
  padding: 1px 4px;
  border-radius: 3px;
  color: #00bfff;
}

.summary-ribbon {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-bottom: 14px;
}

.ribbon-metric {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.r-label {
  font-size: 9px;
  text-transform: uppercase;
  color: #777;
}

.r-val {
  font-size: 14px;
  font-weight: 700;
  color: #eee;
}

.r-sub {
  font-size: 9.5px;
  color: #888;
  font-family: monospace;
  margin-top: 2px;
}

.val-danger {
  color: #ff5555 !important;
}

.val-warning {
  color: #ffaa00 !important;
}

.table-wrapper {
  flex: 1;
  overflow-y: auto;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.25);
  margin-bottom: 12px;
}

.table-wrapper::-webkit-scrollbar {
  width: 5px;
}
.table-wrapper::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

.blind-spots-table {
  width: 100%;
  min-width: 860px;
  border-collapse: collapse;
  font-size: 11px;
}

.blind-spots-table thead {
  position: sticky;
  top: 0;
  background: #151722;
  z-index: 2;
  border-bottom: 1px solid rgba(255, 255, 255, 0.15);
}

.blind-spots-table th {
  padding: 9px 12px;
  text-align: left;
  font-size: 10px;
  color: #888;
  text-transform: uppercase;
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
}

.blind-spots-table th:hover {
  color: #00bfff;
}

.th-category,
.td-category {
  min-width: 320px;
  padding: 8px 12px;
}

.th-num {
  text-align: right !important;
  white-space: nowrap;
}

.sort-icon {
  margin-left: 3px;
  color: #00bfff;
  font-size: 9px;
}

.help-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 13px;
  height: 13px;
  border-radius: 50%;
  background: #2a2a3a;
  color: #aaa;
  font-size: 9.5px;
  font-weight: normal;
  text-transform: none;
  cursor: help;
  margin-left: 5px;
  border: 1px solid #555;
  user-select: none;
  vertical-align: middle;
}

.help-icon:hover {
  background: #3a3a4a;
  color: #fff;
  border-color: #00bfff;
}

.audit-row {
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  transition: background 0.15s ease;
}

.audit-row:hover {
  background: rgba(0, 191, 255, 0.09);
}

.row-domain {
  background: rgba(255, 255, 255, 0.02);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.row-domain.is-expanded {
  background: rgba(0, 191, 255, 0.05);
}

.row-field {
  background: rgba(0, 191, 255, 0.02);
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  border-left: 2px solid rgba(0, 191, 255, 0.4);
}
.row-field.is-expanded {
  background: rgba(0, 191, 255, 0.06);
}

.row-subfield {
  background: rgba(240, 173, 78, 0.02);
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
  border-left: 2px solid rgba(240, 173, 78, 0.4);
}

.category-cell {
  display: flex;
  align-items: center;
  gap: 6px;
}

.indent-field {
  padding-left: 26px;
}

.indent-subfield {
  padding-left: 50px;
}

.subfield-bullet {
  color: #f0ad4e;
  font-size: 13px;
  line-height: 1;
  width: 14px;
  text-align: center;
}

.expand-btn {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 3px;
  color: #00bfff;
  font-size: 9px;
  cursor: pointer;
  width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  flex-shrink: 0;
  transition: all 0.15s ease;
}

.expand-btn:hover {
  background: rgba(0, 191, 255, 0.25);
  border-color: #00bfff;
  color: #fff;
}

.level-tag {
  font-size: 8.5px;
  padding: 1px 4px;
  border-radius: 2px;
  text-transform: uppercase;
  font-weight: 600;
  letter-spacing: 0.3px;
  flex-shrink: 0;
}

.tag-domain {
  background: rgba(0, 191, 255, 0.15);
  color: #00bfff;
  border: 1px solid rgba(0, 191, 255, 0.3);
}

.tag-field {
  background: rgba(92, 184, 92, 0.15);
  color: #5cb85c;
  border: 1px solid rgba(92, 184, 92, 0.3);
}

.tag-subfield {
  background: rgba(240, 173, 78, 0.15);
  color: #f0ad4e;
  border: 1px solid rgba(240, 173, 78, 0.3);
}

.category-name {
  color: #eee;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.font-bold {
  font-weight: 700;
  color: #fff;
}

.text-muted {
  color: #bbb;
}

.row-filter-btn {
  margin-left: auto;
  font-size: 9px;
  padding: 1px 6px;
  border-radius: 3px;
  background: rgba(0, 191, 255, 0.12);
  border: 1px solid rgba(0, 191, 255, 0.4);
  color: #00bfff;
  cursor: pointer;
  text-transform: uppercase;
  flex-shrink: 0;
  opacity: 0.65;
  transition: all 0.15s ease;
}

.audit-row:hover .row-filter-btn {
  opacity: 1;
}

.row-filter-btn:hover {
  background: #00bfff !important;
  color: #050510 !important;
}

.td-num {
  padding: 8px 12px;
  text-align: right;
  white-space: nowrap;
}

.lag-cell {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.lag-sub-meta {
  font-size: 8.5px;
  color: #888;
  font-family: monospace;
  white-space: nowrap;
}

.font-mono {
  font-family: monospace;
  color: #ccc;
}

.badge {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
}

.badge-danger {
  background: rgba(255, 85, 85, 0.18);
  border: 1px solid rgba(255, 85, 85, 0.5);
  color: #ff6b6b;
}

.badge-success {
  background: rgba(92, 184, 92, 0.18);
  border: 1px solid rgba(92, 184, 92, 0.5);
  color: #5cb85c;
}

.badge-warning {
  background: rgba(255, 170, 0, 0.18);
  border: 1px solid rgba(255, 170, 0, 0.5);
  color: #ffaa00;
}

.badge-neutral {
  background: rgba(255, 255, 255, 0.05);
  color: #aaa;
}

.empty-state {
  padding: 30px 10px;
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
