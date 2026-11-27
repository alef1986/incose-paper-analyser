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

        <!-- Clean Tab Bar -->
        <div class="view-tabs">
          <button 
            type="button" 
            class="tab-btn" 
            :class="{ active: activeTab === 'table' }" 
            @click="setTab('table')"
          >
            📋 Audit Table (3-Tier)
          </button>
          <button 
            type="button" 
            class="tab-btn" 
            :class="{ active: activeTab === 'quadrants' }" 
            @click="setTab('quadrants')"
          >
            🎯 2×2 Irritation Quadrants
          </button>
          <button 
            type="button" 
            class="tab-btn" 
            :class="{ active: activeTab === 'absent' }" 
            @click="setTab('absent')"
          >
            🕳 Absolute Blind Spots
          </button>

          <div class="tabs-right-tools" v-if="activeTab === 'quadrants' || activeTab === 'absent'">
            <button
              type="button"
              class="icon-tool-btn"
              :class="{ active: isPaperMode }"
              @click="togglePaperMode"
              :title="isPaperMode ? 'Switch to Dark UI Mode' : 'Preview Paper Mode (Light Print Theme)'"
            >
              {{ isPaperMode ? '🌙' : '☀️' }}
            </button>
            <button
              type="button"
              class="icon-tool-btn print-btn"
              @click="activeTab === 'quadrants' ? exportQuadrantsForPrint() : exportHorizonForPrint()"
              title="Save 300 DPI PNG for Print (Paper Mode, White Background)"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <polyline points="6 9 6 2 18 2 18 9"></polyline>
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                <rect x="6" y="14" width="12" height="8"></rect>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Quick Metrics Ribbon (Audited Corpus) -->
      <div class="summary-ribbon" v-if="store.disciplinaryBlindSpots.length > 0 && activeTab !== 'absent'">
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
      <div class="table-wrapper" v-show="activeTab === 'table'" v-if="store.disciplinaryBlindSpots.length > 0">
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

      <!-- 🎯 2x2 Irritation Typology (Quadrants) Tab -->
      <div class="quadrants-wrapper" v-show="activeTab === 'quadrants'" v-if="store.disciplinaryBlindSpots.length > 0">
        <!-- Controls above canvas -->
        <div class="quadrant-controls">
          <div class="control-group">
            <span class="control-label">Granularity:</span>
            <div class="control-toggle">
              <button 
                type="button" 
                class="ctrl-btn" 
                :class="{ active: granularity === 'fields' }" 
                @click="setGranularity('fields')"
              >
                Fields (Level 2)
              </button>
              <button 
                type="button" 
                class="ctrl-btn" 
                :class="{ active: granularity === 'subfields' }" 
                @click="setGranularity('subfields')"
              >
                Subfields (Level 3)
              </button>
            </div>
          </div>

          <div class="control-group">
            <span class="control-label">Y-Axis Metric:</span>
            <div class="control-toggle">
              <button 
                type="button" 
                class="ctrl-btn" 
                :class="{ active: yMetric === 'translator' }" 
                @click="setYMetric('translator')"
              >
                Translator-Backed (%)
              </button>
              <button 
                type="button" 
                class="ctrl-btn" 
                :class="{ active: yMetric === 'assimilation' }" 
                @click="setYMetric('assimilation')"
              >
                Assimilation Rate (100% − Rejection %)
              </button>
            </div>
          </div>

          <div class="control-group">
            <label class="control-checkbox">
              <input type="checkbox" v-model="hideOutliers" @change="onToggleOutliers" />
              <span>Hide tiny outliers (&lt; 20 refs)</span>
            </label>
          </div>

          <div class="quadrant-stat-pill" v-if="flattenedData.length > 0">
            Plotting <b>{{ flattenedData.length }}</b> {{ granularity === 'fields' ? 'Fields' : 'Subfields' }}
          </div>
        </div>

        <!-- Interactive ECharts Scatter Canvas -->
        <div ref="chartCanvasRef" class="quadrant-chart-canvas" :class="{ 'is-paper-mode': isPaperMode }"></div>
      </div>

      <!-- 🕳 Tab 3: Absolute Blind Spots (0 & <20 Refs) -->
      <div class="absent-wrapper" v-show="activeTab === 'absent'">
        <!-- Loading State -->
        <div v-if="isTaxonomyLoading && !canonicalTaxonomy" class="absent-loading-state">
          <div class="loading-spinner"></div>
          <span>Fetching canonical OpenAlex taxonomy catalog (26 Fields / 252 Subfields)...</span>
        </div>

        <!-- Error State -->
        <div v-else-if="taxonomyError && !canonicalTaxonomy" class="absent-error-state">
          <span class="err-icon">⚠️</span>
          <span>{{ taxonomyError }}</span>
          <button class="retry-btn" @click="fetchCanonicalTaxonomy">Retry OpenAlex Sync</button>
        </div>

        <template v-else-if="canonicalTaxonomy">
          <!-- 1. Compact Summary Strip (4 KPI boxes) -->
          <div class="absent-kpi-ribbon">
            <div class="kpi-box">
              <span class="kpi-label">Canonical {{ absentGranularity === 'fields' ? 'Fields' : 'Subfields' }}</span>
              <span class="kpi-val">{{ absentAnalysis.totalCanonical }}</span>
            </div>
            <div class="kpi-box kpi-danger">
              <span class="kpi-label">Absolute Blind Spots (0 refs)</span>
              <span class="kpi-val val-danger">
                {{ absentAnalysis.zeroCount }}
                <small class="kpi-pct">({{ absentAnalysis.zeroPct }}%)</small>
              </span>
            </div>
            <div class="kpi-box kpi-warning">
              <span class="kpi-label">Marginal (&lt;20 refs)</span>
              <span class="kpi-val val-warning">
                {{ absentAnalysis.marginalCount }}
                <small class="kpi-pct">({{ absentAnalysis.marginalPct }}%)</small>
              </span>
            </div>
            <div class="kpi-box kpi-success">
              <span class="kpi-label">Active Horizon (≥20 refs)</span>
              <span class="kpi-val val-success">
                {{ absentAnalysis.activeCount }}
                <small class="kpi-pct">({{ absentAnalysis.activePct }}%)</small>
              </span>
            </div>
          </div>

          <!-- Controls: Granularity switch -->
          <div class="absent-controls">
            <div class="control-group">
              <span class="control-label">Taxonomy Depth:</span>
              <div class="control-toggle">
                <button 
                  type="button" 
                  class="ctrl-btn" 
                  :class="{ active: absentGranularity === 'subfields' }" 
                  @click="setAbsentGranularity('subfields')"
                >
                  Subfields (252)
                </button>
                <button 
                  type="button" 
                  class="ctrl-btn" 
                  :class="{ active: absentGranularity === 'fields' }" 
                  @click="setAbsentGranularity('fields')"
                >
                  Fields (26)
                </button>
              </div>
            </div>
            <div class="absent-meta-note">
              Benchmarking against complete canonical OpenAlex science catalog (respects active journal/ISSN filters)
            </div>
          </div>

          <!-- 2. ECharts 100% Horizontal Stacked Bar Chart -->
          <div class="horizon-chart-card" :class="{ 'is-paper-mode': isPaperMode }">
            <div class="chart-header-sub">
              <span>Epistemic Horizon Coverage by Domain (100% Stacked)</span>
            </div>
            <div ref="horizonChartRef" class="horizon-chart-canvas"></div>
          </div>

          <!-- 3. Grouped Tag Lists below the chart -->
          <div class="absent-tags-container">
            <!-- Absolute Blind Spots (0 Citations) -->
            <div class="absent-section section-zero">
              <div class="absent-section-header">
                <h4 class="absent-section-title title-danger">
                  🕳 Absolute Blind Spots (0 Citations)
                </h4>
                <span class="section-count-badge badge-danger">{{ absentAnalysis.zeroCount }} {{ absentGranularity }} ignored</span>
              </div>
              <p class="section-desc">External disciplines completely absent from INCOSE systemic resonance (0 references across corpus).</p>
              
              <div class="domain-groups-list">
                <template v-for="dGroup in absentAnalysis.domainGroups" :key="'zero-' + dGroup.domainName">
                  <div class="domain-tag-group" v-if="dGroup.zeroItems.length > 0">
                    <span class="domain-group-header" :style="{ color: getDomainColor(dGroup.domainName) }">
                      {{ dGroup.domainName }} ({{ dGroup.zeroItems.length }}):
                    </span>
                    <div class="tag-cloud">
                      <span 
                        class="absent-tag tag-zero" 
                        v-for="item in dGroup.zeroItems" 
                        :key="item.name"
                        title="0 references in INCOSE corpus"
                      >
                        {{ item.name }}
                      </span>
                    </div>
                  </div>
                </template>
              </div>
            </div>

            <!-- Marginal / Trace Imports (1–19 Citations) -->
            <div class="absent-section section-marginal">
              <div class="absent-section-header">
                <h4 class="absent-section-title title-warning">
                  ⚡ Marginal / Trace Imports (1–19 Citations)
                </h4>
                <span class="section-count-badge badge-warning">{{ absentAnalysis.marginalCount }} {{ absentGranularity }} with trace citations</span>
              </div>
              <p class="section-desc">Weak one-off perturbations. Click any tag to slice the 3D dashboard to that discipline.</p>

              <div class="domain-groups-list">
                <template v-for="dGroup in absentAnalysis.domainGroups" :key="'marginal-' + dGroup.domainName">
                  <div class="domain-tag-group" v-if="dGroup.marginalItems.length > 0">
                    <span class="domain-group-header" :style="{ color: getDomainColor(dGroup.domainName) }">
                      {{ dGroup.domainName }} ({{ dGroup.marginalItems.length }}):
                    </span>
                    <div class="tag-cloud">
                      <span 
                        class="absent-tag tag-marginal tag-clickable" 
                        v-for="item in dGroup.marginalItems" 
                        :key="item.name"
                        @click="applyAbsentFilter(item)"
                        :title="`Click to filter 3D view to ${item.name} (${item.totalCitations} citations)`"
                      >
                        {{ item.name }} <b class="tag-cnt">({{ item.totalCitations }})</b>
                      </span>
                    </div>
                  </div>
                </template>
              </div>
            </div>
          </div>
        </template>
      </div>

      <div v-if="store.disciplinaryBlindSpots.length === 0 && activeTab !== 'absent'" class="empty-state">
        <p>No external domain classifications found in the current dataset.</p>
        <span class="empty-hint">Load an OpenAlex-enriched JSON or run batch metadata enrichment to unlock epistemic blind spots analysis.</span>
      </div>

      <div class="modal-footer">
        <span class="footer-tip">
          {{ activeTab === 'table' 
              ? '💡 Click any domain to set a 3D network slice and close this modal.' 
              : (activeTab === 'quadrants'
                  ? '💡 Click any bubble to slice the 3D network to that Field/Subfield and close this modal.'
                  : '💡 Click any Marginal tag (1–19 citations) to filter the 3D network to that discipline and close this modal.') }}
        </span>
        <button class="footer-close-btn" @click="close">Close Audit</button>
      </div>
    </div>
  </div>
</template>

<script>
// Module-level cache for canonical OpenAlex taxonomy catalog (persists across modal toggles)
let canonicalTaxonomyCache = null
let canonicalTaxonomyLoadingPromise = null
</script>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import * as echarts from 'echarts'
import { useGraphStore, computeLagStats } from '../../store/graphStore.js'
import {
  PRINT_DOMAIN_COLORS,
  PRINT_DEFAULT_PALETTE,
  exportEChartForPrint
} from '../../utils/chartPrintExport.js'

const store = useGraphStore()

const activeTab = ref('table') // 'table' | 'quadrants' | 'absent'
const granularity = ref('fields') // 'fields' | 'subfields'
const yMetric = ref('translator') // 'translator' | 'assimilation'
const hideOutliers = ref(true) // Hide tiny outliers (< 20 citations)
const isPaperMode = ref(false)
const chartCanvasRef = ref(null)
let chartInstance = null

// --- Tab 3: Canonical OpenAlex Catalog & Absent Blind Spots State ---
const absentGranularity = ref('subfields') // 'subfields' | 'fields'
const horizonChartRef = ref(null)
let horizonChartInstance = null

const canonicalTaxonomy = ref(canonicalTaxonomyCache)
const isTaxonomyLoading = ref(false)
const taxonomyError = ref(null)

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

const togglePaperMode = () => {
  isPaperMode.value = !isPaperMode.value
  nextTick(() => {
    if (activeTab.value === 'quadrants') updateChart()
    else if (activeTab.value === 'absent') updateHorizonChart()
  })
}

const getActiveScopeSubtitle = () => {
  const journals = store.longitudinalScopeSummary?.selectedJournalLabels?.join(', ') || 'All Journals'
  const lens = store.translatorLensActive ? ' | Translator Lens ON' : ''
  return `Scope: ${journals}${lens}`
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

// --- 🎯 2x2 Irritation Typology (Quadrants) Logic ---
const DOMAIN_COLOR_MAP = {
  'Physical Sciences': '#00bfff',
  'Formal Sciences': '#9b59b6',
  'Social Sciences': '#f0ad4e',
  'Life Sciences': '#5cb85c',
  'Health Sciences': '#d9534f'
}
const DEFAULT_PALETTE = ['#00bfff', '#5cb85c', '#f0ad4e', '#d9534f', '#9b59b6', '#3498db', '#1abc9c', '#e67e22', '#e74c3c']

const getDomainColor = (domainName, idx = 0, paperMode = false) => {
  if (paperMode) {
    if (PRINT_DOMAIN_COLORS[domainName]) return PRINT_DOMAIN_COLORS[domainName]
    return PRINT_DEFAULT_PALETTE[idx % PRINT_DEFAULT_PALETTE.length]
  }
  if (DOMAIN_COLOR_MAP[domainName]) return DOMAIN_COLOR_MAP[domainName]
  return DEFAULT_PALETTE[idx % DEFAULT_PALETTE.length]
}

const flattenedData = computed(() => {
  const result = []
  if (!store.disciplinaryBlindSpots) return result
  const minThreshold = hideOutliers.value ? 20 : 1

  store.disciplinaryBlindSpots.forEach(dom => {
    const parentDomain = dom.name || 'Unknown'
    if (granularity.value === 'fields') {
      if (dom.fields) {
        dom.fields.forEach(fld => {
          if (fld.totalCitations >= minThreshold && fld.medianLag !== null && !isNaN(fld.medianLag)) {
            result.push({
              ...fld,
              parentDomain
            })
          }
        })
      }
    } else {
      if (dom.fields) {
        dom.fields.forEach(fld => {
          if (fld.subfields) {
            fld.subfields.forEach(sub => {
              if (sub.totalCitations >= minThreshold && sub.medianLag !== null && !isNaN(sub.medianLag)) {
                result.push({
                  ...sub,
                  parentDomain,
                  parentField: fld.name
                })
              }
            })
          }
        })
      }
    }
  })
  return result
})

const onToggleOutliers = () => {
  nextTick(updateChart)
}

const getYVal = (item) => {
  if (yMetric.value === 'translator') {
    return Number(item.realizedShare.toFixed(1))
  } else {
    return Number((100 - item.rejectionRate).toFixed(1))
  }
}

const setTab = (tab) => {
  activeTab.value = tab
  if (tab === 'quadrants') {
    nextTick(() => {
      updateChart()
      setTimeout(resizeCharts, 80)
    })
  } else if (tab === 'absent') {
    fetchCanonicalTaxonomy()
    nextTick(() => {
      updateHorizonChart()
      setTimeout(resizeCharts, 80)
    })
  }
}

const setGranularity = (g) => {
  granularity.value = g
  nextTick(updateChart)
}

const setYMetric = (m) => {
  yMetric.value = m
  nextTick(updateChart)
}

const setAbsentGranularity = (g) => {
  absentGranularity.value = g
  nextTick(() => {
    updateHorizonChart()
  })
}

const applyAbsentFilter = (item) => {
  store.setTaxonomyFilter(item.level, item.name, item.pathString)
  close()
}

// --- Fetcher: Canonical OpenAlex Taxonomy (Cached) ---
const fetchCanonicalTaxonomy = async () => {
  if (canonicalTaxonomyCache) {
    canonicalTaxonomy.value = canonicalTaxonomyCache
    return
  }
  if (canonicalTaxonomyLoadingPromise) {
    isTaxonomyLoading.value = true
    try {
      await canonicalTaxonomyLoadingPromise
      canonicalTaxonomy.value = canonicalTaxonomyCache
    } catch (e) {
      taxonomyError.value = e.message || 'Failed to fetch OpenAlex catalog'
    } finally {
      isTaxonomyLoading.value = false
    }
    return
  }

  isTaxonomyLoading.value = true
  taxonomyError.value = null

  canonicalTaxonomyLoadingPromise = (async () => {
    const headers = {
      Accept: 'application/json',
      ...(import.meta.env?.VITE_OPENALEX_API_KEY ? { Authorization: `Bearer ${import.meta.env.VITE_OPENALEX_API_KEY}` } : {})
    }

    const [fieldsRes, subfieldsRes1, subfieldsRes2] = await Promise.all([
      fetch('https://api.openalex.org/fields?per-page=50&select=id,display_name,domain&mailto=alexander@efremov-systems.de', { headers }),
      fetch('https://api.openalex.org/subfields?per-page=200&page=1&select=id,display_name,field,domain&mailto=alexander@efremov-systems.de', { headers }),
      fetch('https://api.openalex.org/subfields?per-page=200&page=2&select=id,display_name,field,domain&mailto=alexander@efremov-systems.de', { headers })
    ])

    if (!fieldsRes.ok || !subfieldsRes1.ok || !subfieldsRes2.ok) {
      const errStatus = !fieldsRes.ok ? fieldsRes.status : (!subfieldsRes1.ok ? subfieldsRes1.status : subfieldsRes2.status)
      throw new Error(`OpenAlex API HTTP ${errStatus}`)
    }

    const [fieldsData, sub1Data, sub2Data] = await Promise.all([
      fieldsRes.json(),
      subfieldsRes1.json(),
      subfieldsRes2.json()
    ])

    const fields = (fieldsData.results || []).map(f => ({
      id: f.id,
      name: f.display_name,
      domain: f.domain?.display_name || 'Unknown'
    }))

    const subfields = [
      ...(sub1Data.results || []),
      ...(sub2Data.results || [])
    ].map(sf => ({
      id: sf.id,
      name: sf.display_name,
      field: sf.field?.display_name || 'Other',
      domain: sf.domain?.display_name || 'Unknown'
    }))

    canonicalTaxonomyCache = { fields, subfields }
    return canonicalTaxonomyCache
  })()

  try {
    await canonicalTaxonomyLoadingPromise
    canonicalTaxonomy.value = canonicalTaxonomyCache
  } catch (err) {
    console.error('Failed to load canonical OpenAlex catalog:', err)
    taxonomyError.value = err.message || 'Failed to fetch OpenAlex catalog'
    canonicalTaxonomyLoadingPromise = null
  } finally {
    isTaxonomyLoading.value = false
  }
}

// --- Benchmark: INCOSE Corpus vs Canonical Taxonomy ---
const auditedDisciplinesLookup = computed(() => {
  const fieldMap = new Map()
  const subfieldMap = new Map()

  if (!store.disciplinaryBlindSpots) return { fieldMap, subfieldMap }

  store.disciplinaryBlindSpots.forEach(dom => {
    const domName = dom.name || 'Unknown'
    if (dom.fields) {
      dom.fields.forEach(fld => {
        const fldKey = (fld.name || '').trim().toLowerCase()
        if (fldKey) {
          fieldMap.set(fldKey, {
            name: fld.name,
            totalCitations: fld.totalCitations || 0,
            pathString: fld.pathString || `${domName} > ${fld.name}`,
            level: 'field',
            domain: domName
          })
        }
        if (fld.subfields) {
          fld.subfields.forEach(sub => {
            const subKey = (sub.name || '').trim().toLowerCase()
            if (subKey) {
              subfieldMap.set(subKey, {
                name: sub.name,
                totalCitations: sub.totalCitations || 0,
                pathString: sub.pathString || `${domName} > ${fld.name} > ${sub.name}`,
                level: 'subfield',
                domain: domName,
                field: fld.name
              })
            }
          })
        }
      })
    }
  })

  return { fieldMap, subfieldMap }
})

const DOMAIN_CANONICAL_ORDER = ['Physical Sciences', 'Social Sciences', 'Life Sciences', 'Health Sciences']

const absentAnalysis = computed(() => {
  if (!canonicalTaxonomy.value) {
    return {
      totalCanonical: 0,
      zeroCount: 0,
      zeroPct: '0.0',
      marginalCount: 0,
      marginalPct: '0.0',
      activeCount: 0,
      activePct: '0.0',
      domainGroups: []
    }
  }

  const isSubfields = absentGranularity.value === 'subfields'
  const rawCatalog = isSubfields 
    ? canonicalTaxonomy.value.subfields 
    : canonicalTaxonomy.value.fields
  const lookupMap = isSubfields 
    ? auditedDisciplinesLookup.value.subfieldMap 
    : auditedDisciplinesLookup.value.fieldMap

  const classified = rawCatalog.map(item => {
    const key = (item.name || '').trim().toLowerCase()
    const cited = lookupMap.get(key)
    const totalCitations = cited ? cited.totalCitations : 0
    const pathString = cited 
      ? cited.pathString 
      : (item.field ? `${item.domain} > ${item.field} > ${item.name}` : `${item.domain} > ${item.name}`)

    let bucket = 'zero'
    if (totalCitations >= 20) bucket = 'active'
    else if (totalCitations >= 1) bucket = 'marginal'

    return {
      ...item,
      level: isSubfields ? 'subfield' : 'field',
      totalCitations,
      pathString,
      bucket
    }
  })

  const totalCanonical = classified.length
  const zeroCount = classified.filter(i => i.bucket === 'zero').length
  const marginalCount = classified.filter(i => i.bucket === 'marginal').length
  const activeCount = classified.filter(i => i.bucket === 'active').length

  const zeroPct = totalCanonical > 0 ? ((zeroCount / totalCanonical) * 100).toFixed(1) : '0.0'
  const marginalPct = totalCanonical > 0 ? ((marginalCount / totalCanonical) * 100).toFixed(1) : '0.0'
  const activePct = totalCanonical > 0 ? ((activeCount / totalCanonical) * 100).toFixed(1) : '0.0'

  const domainGroups = DOMAIN_CANONICAL_ORDER.map(domainName => {
    const domainItems = classified.filter(i => i.domain === domainName)
    const zeroItems = domainItems.filter(i => i.bucket === 'zero').sort((a, b) => a.name.localeCompare(b.name))
    const marginalItems = domainItems.filter(i => i.bucket === 'marginal').sort((a, b) => b.totalCitations - a.totalCitations)
    const activeItems = domainItems.filter(i => i.bucket === 'active').sort((a, b) => b.totalCitations - a.totalCitations)

    const dTotal = domainItems.length
    const dZero = zeroItems.length
    const dMarginal = marginalItems.length
    const dActive = activeItems.length

    return {
      domainName,
      total: dTotal,
      zeroItems,
      marginalItems,
      activeItems,
      zeroCount: dZero,
      marginalCount: dMarginal,
      activeCount: dActive,
      zeroPct: dTotal > 0 ? Number(((dZero / dTotal) * 100).toFixed(1)) : 0,
      marginalPct: dTotal > 0 ? Number(((dMarginal / dTotal) * 100).toFixed(1)) : 0,
      activePct: dTotal > 0 ? Number(((dActive / dTotal) * 100).toFixed(1)) : 0
    }
  })

  return {
    totalCanonical,
    zeroCount,
    zeroPct,
    marginalCount,
    marginalPct,
    activeCount,
    activePct,
    domainGroups
  }
})

const handleChartClick = (params) => {
  const raw = params.data?.rawItem
  if (raw) {
    store.setTaxonomyFilter(raw.level, raw.name, raw.pathString)
    close()
  }
}

const buildQuadrantsOption = (paperMode = false) => {
  const items = flattenedData.value
  if (!items || items.length === 0) return null

  const allX = items.map(i => i.medianLag).sort((a, b) => a - b)
  const allY = items.map(i => getYVal(i)).sort((a, b) => a - b)

  const medX = allX.length % 2 === 1 
    ? allX[Math.floor(allX.length / 2)] 
    : (allX[allX.length / 2 - 1] + allX[allX.length / 2]) / 2

  const medY = allY.length % 2 === 1 
    ? allY[Math.floor(allY.length / 2)] 
    : (allY[allY.length / 2 - 1] + allY[allY.length / 2]) / 2

  const domainGroups = new Map()
  items.forEach(item => {
    const d = item.parentDomain || 'Unknown'
    if (!domainGroups.has(d)) domainGroups.set(d, [])
    domainGroups.get(d).push(item)
  })

  const top10Keys = new Set(
    [...items]
      .sort((a, b) => b.totalCitations - a.totalCitations)
      .slice(0, 10)
      .map(i => i.pathString)
  )

  const sortedDomainNames = Array.from(domainGroups.keys()).sort()

  const axisLineColor = paperMode ? '#334155' : 'rgba(255, 255, 255, 0.2)'
  const splitLineColor = paperMode ? '#e2e8f0' : 'rgba(255, 255, 255, 0.05)'
  const axisLabelColor = paperMode ? '#1e293b' : '#aaa'
  const axisNameColor = paperMode ? '#0f172a' : '#888'
  const legendTextColor = paperMode ? '#1e293b' : '#ccc'
  const markLineColor = paperMode ? '#475569' : 'rgba(255, 255, 255, 0.45)'
  const markLabelColor = paperMode ? '#0f172a' : '#bbb'
  const markLabelBg = paperMode ? 'rgba(255, 255, 255, 0.92)' : 'rgba(15, 15, 25, 0.8)'
  const markLabelBorder = paperMode ? '#cbd5e1' : 'transparent'

  const series = sortedDomainNames.map((domainName, idx) => {
    const groupItems = domainGroups.get(domainName)
    const color = getDomainColor(domainName, idx, paperMode)

    const seriesObj = {
      name: domainName,
      type: 'scatter',
      itemStyle: {
        color: color,
        opacity: paperMode ? 0.85 : 0.82,
        borderColor: paperMode ? '#1e293b' : '#ffffff',
        borderWidth: paperMode ? 0.8 : 0.6
      },
      emphasis: {
        itemStyle: {
          opacity: 1,
          borderColor: paperMode ? '#0f172a' : '#00bfff',
          borderWidth: 2,
          shadowBlur: 10,
          shadowColor: paperMode ? 'rgba(15, 23, 42, 0.25)' : 'rgba(0, 191, 255, 0.5)'
        }
      },
      label: {
        show: true,
        position: 'top',
        distance: 5,
        color: paperMode ? '#111827' : '#ddd',
        fontSize: paperMode ? 10.5 : 10,
        fontWeight: paperMode ? 500 : 'normal',
        textBorderColor: paperMode ? '#ffffff' : 'rgba(0, 0, 0, 0.85)',
        textBorderWidth: paperMode ? 3 : 2,
        formatter: (p) => {
          const raw = p.data?.rawItem
          if (!raw || !raw.isProminent) return ''
          const name = raw.name || ''
          return name.length > 18 ? name.substring(0, 16) + '…' : name
        }
      },
      symbolSize: (val) => {
        const citations = val[2] || 1
        const size = Math.round(Math.sqrt(citations) * 1.8) + 6
        return Math.max(8, Math.min(48, size))
      },
      data: groupItems.map(item => {
        const isProminent = top10Keys.has(item.pathString) || (item.medianLag !== null && item.medianLag >= 15)
        return {
          name: item.name,
          value: [
            Number(item.medianLag.toFixed(1)),
            getYVal(item),
            item.totalCitations
          ],
          rawItem: { ...item, isProminent }
        }
      })
    }

    if (idx === 0) {
      seriesObj.markLine = {
        silent: true,
        animation: false,
        lineStyle: {
          type: 'dashed',
          color: markLineColor,
          width: 1.5
        },
        data: [
          {
            xAxis: Number(medX.toFixed(1)),
            label: {
              show: true,
              formatter: `Median Lag: ${medX.toFixed(1)} yrs`,
              position: 'insideEndTop',
              distance: [0, 4],
              color: markLabelColor,
              fontSize: 10,
              backgroundColor: markLabelBg,
              borderColor: markLabelBorder,
              borderWidth: paperMode ? 1 : 0,
              padding: [2, 5],
              borderRadius: 2
            }
          },
          {
            yAxis: Number(medY.toFixed(1)),
            label: {
              show: true,
              formatter: `Median: ${medY.toFixed(1)}%`,
              position: 'insideEndTop',
              distance: [0, 4],
              color: markLabelColor,
              fontSize: 10,
              backgroundColor: markLabelBg,
              borderColor: markLabelBorder,
              borderWidth: paperMode ? 1 : 0,
              padding: [2, 5],
              borderRadius: 2
            }
          }
        ]
      }
    }

    return seriesObj
  })

  const subTL = yMetric.value === 'translator' ? '(Low Lag, High Translator %)' : '(Low Lag, High Assimilation)'
  const subTR = yMetric.value === 'translator' ? '(High Lag, High Translator %)' : '(High Lag, High Assimilation)'
  const subBL = yMetric.value === 'translator' ? '(Low Lag, Low Translator %)' : '(Low Lag, High Rejection)'
  const subBR = yMetric.value === 'translator' ? '(High Lag, Low Translator %)' : '(High Lag, High Rejection)'

  return {
    backgroundColor: paperMode ? '#ffffff' : 'transparent',
    grid: {
      left: 60,
      right: 36,
      top: 48,
      bottom: 52,
      containLabel: true
    },
    legend: {
      show: true,
      top: 8,
      textStyle: { color: legendTextColor, fontSize: 11 },
      itemWidth: 10,
      itemHeight: 10
    },
    tooltip: {
      trigger: 'item',
      backgroundColor: paperMode ? 'rgba(255, 255, 255, 0.96)' : 'rgba(15, 15, 25, 0.95)',
      borderColor: paperMode ? '#0284c7' : '#00bfff',
      borderWidth: 1,
      padding: [10, 14],
      textStyle: { color: paperMode ? '#111827' : '#eee', fontSize: 11 },
      formatter: (params) => {
        const raw = params.data?.rawItem
        if (!raw) return ''
        const assimilationRate = (100 - raw.rejectionRate).toFixed(1)
        const titleClr = paperMode ? '#0284c7' : '#00bfff'
        const lblClr = paperMode ? '#475569' : '#888'
        const valClr = paperMode ? '#0f172a' : '#fff'
        return `
          <div style="font-weight: bold; color: ${titleClr}; font-size: 13px; margin-bottom: 5px; border-bottom: 1px solid rgba(128,128,128,0.2); padding-bottom: 4px;">
            ${raw.name} <span style="font-size: 10px; color: ${lblClr}; font-weight: normal;">(${raw.level})</span>
          </div>
          <div style="display: grid; grid-template-columns: auto auto; gap: 3px 14px; font-size: 11px;">
            <span style="color: ${lblClr};">Parent Domain:</span><span style="color: ${valClr}; font-weight: 500;">${raw.parentDomain || 'Unknown'}</span>
            <span style="color: ${lblClr};">Total Citations:</span><span style="color: ${valClr}; font-weight: 500;">${raw.totalCitations.toLocaleString()}</span>
            <span style="color: ${lblClr};">Unique Works:</span><span style="color: ${valClr}; font-weight: 500;">${raw.uniqueWorks.toLocaleString()}</span>
            <span style="color: ${lblClr};">Median Epistemic Lag:</span><span style="color: #d97706; font-weight: 600;">${raw.medianLag !== null ? raw.medianLag.toFixed(1) + ' yrs' : 'N/A'}</span>
            <span style="color: ${lblClr};">Irritation Rejection:</span><span style="color: ${raw.rejectionRate > 85 ? '#dc2626' : '#16a34a'}; font-weight: 600;">${raw.rejectionRate.toFixed(1)}%</span>
            <span style="color: ${lblClr};">Translator-Backed:</span><span style="color: #16a34a; font-weight: 600;">${raw.realizedShare.toFixed(1)}%</span>
            <span style="color: ${lblClr};">Assimilation Rate:</span><span style="color: #16a34a; font-weight: 600;">${assimilationRate}%</span>
          </div>
          <div style="margin-top: 6px; font-size: 9.5px; color: ${titleClr}; font-style: italic;">
            Click bubble to filter 3D dashboard to this ${raw.level}
          </div>
        `
      }
    },
    xAxis: {
      type: 'value',
      name: 'Median Epistemic Lag (Years)',
      nameLocation: 'middle',
      nameGap: 32,
      nameTextStyle: { color: axisNameColor, fontSize: 11.5, fontWeight: paperMode ? 'bold' : 'normal' },
      axisLine: { lineStyle: { color: axisLineColor } },
      axisTick: { lineStyle: { color: axisLineColor } },
      splitLine: { lineStyle: { color: splitLineColor } },
      axisLabel: { color: axisLabelColor, formatter: '{value} yrs' }
    },
    yAxis: {
      type: 'value',
      name: yMetric.value === 'translator' ? 'Translator-Backed Share (%)' : 'Assimilation Rate (%)',
      nameLocation: 'middle',
      nameGap: 44,
      nameTextStyle: { color: axisNameColor, fontSize: 11.5, fontWeight: paperMode ? 'bold' : 'normal' },
      min: 0,
      max: (val) => Math.min(100, Math.max(20, Math.ceil((val.max + 6) / 10) * 10)),
      axisLine: { lineStyle: { color: axisLineColor } },
      axisTick: { lineStyle: { color: axisLineColor } },
      splitLine: { lineStyle: { color: splitLineColor } },
      axisLabel: { color: axisLabelColor, formatter: '{value}%' }
    },
    graphic: [
      {
        type: 'text',
        left: 72,
        top: 56,
        style: {
          text: `LIVE STRUCTURAL COUPLING\n${subTL}`,
          fill: paperMode ? 'rgba(22, 101, 52, 0.78)' : 'rgba(92, 184, 92, 0.4)',
          font: 'bold 9.5px sans-serif'
        },
        silent: true
      },
      {
        type: 'text',
        right: 44,
        top: 56,
        style: {
          text: `FROZEN CLASSICS\n${subTR}`,
          fill: paperMode ? 'rgba(3, 105, 161, 0.78)' : 'rgba(0, 191, 255, 0.4)',
          font: 'bold 9.5px sans-serif',
          textAlign: 'right'
        },
        silent: true
      },
      {
        type: 'text',
        left: 72,
        bottom: 60,
        style: {
          text: `TRANSIENT HYPE\n${subBL}`,
          fill: paperMode ? 'rgba(180, 83, 9, 0.78)' : 'rgba(240, 173, 78, 0.4)',
          font: 'bold 9.5px sans-serif'
        },
        silent: true
      },
      {
        type: 'text',
        right: 44,
        bottom: 60,
        style: {
          text: `EPISTEMIC BLIND SPOTS\n${subBR}`,
          fill: paperMode ? 'rgba(185, 28, 28, 0.78)' : 'rgba(217, 83, 79, 0.45)',
          font: 'bold 9.5px sans-serif',
          textAlign: 'right'
        },
        silent: true
      }
    ],
    series
  }
}

const updateChart = () => {
  if (!chartCanvasRef.value) return
  if (!chartInstance) {
    chartInstance = echarts.init(chartCanvasRef.value)
    chartInstance.on('click', handleChartClick)
  }

  const option = buildQuadrantsOption(isPaperMode.value)
  if (!option) {
    chartInstance.clear()
    chartInstance.setOption({
      backgroundColor: isPaperMode.value ? '#ffffff' : 'transparent',
      title: {
        text: 'No disciplines matching current threshold (min 20 citations)',
        left: 'center',
        top: 'middle',
        textStyle: { color: isPaperMode.value ? '#475569' : '#888', fontSize: 13, fontWeight: 'normal' }
      }
    })
    return
  }

  chartInstance.setOption(option, true)
}

const buildHorizonOption = (paperMode = false) => {
  const analysis = absentAnalysis.value
  if (!analysis || analysis.totalCanonical === 0) return null

  const yDomains = ['Health Sciences', 'Life Sciences', 'Social Sciences', 'Physical Sciences']

  const domainStatsMap = new Map()
  analysis.domainGroups.forEach(dg => {
    domainStatsMap.set(dg.domainName, dg)
  })

  const activePcts = []
  const marginalPcts = []
  const zeroPcts = []

  yDomains.forEach(dName => {
    const dg = domainStatsMap.get(dName)
    if (dg) {
      activePcts.push(dg.activePct)
      marginalPcts.push(dg.marginalPct)
      zeroPcts.push(dg.zeroPct)
    } else {
      activePcts.push(0)
      marginalPcts.push(0)
      zeroPcts.push(0)
    }
  })

  const axisLineColor = paperMode ? '#334155' : 'rgba(255, 255, 255, 0.2)'
  const splitLineColor = paperMode ? '#e2e8f0' : 'rgba(255, 255, 255, 0.06)'
  const axisLabelColor = paperMode ? '#1e293b' : '#ddd'
  const xAxisLabelColor = paperMode ? '#334155' : '#888'
  const legendTextColor = paperMode ? '#1e293b' : '#ccc'

  return {
    backgroundColor: paperMode ? '#ffffff' : 'transparent',
    grid: {
      left: 118,
      right: 32,
      top: 34,
      bottom: 26,
      containLabel: true
    },
    legend: {
      show: true,
      top: 2,
      textStyle: { color: legendTextColor, fontSize: 10.5 },
      itemWidth: 10,
      itemHeight: 10
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: paperMode ? 'rgba(255, 255, 255, 0.96)' : 'rgba(15, 15, 25, 0.95)',
      borderColor: paperMode ? '#0284c7' : '#00bfff',
      borderWidth: 1,
      padding: [8, 12],
      textStyle: { color: paperMode ? '#111827' : '#eee', fontSize: 11 },
      formatter: (params) => {
        if (!params || params.length === 0) return ''
        const domName = params[0].name
        const dg = domainStatsMap.get(domName)
        if (!dg) return ''
        const titleClr = paperMode ? '#0284c7' : '#00bfff'
        return `
          <div style="font-weight: bold; color: ${titleClr}; font-size: 12px; margin-bottom: 4px; border-bottom: 1px solid rgba(128,128,128,0.2); padding-bottom: 3px;">
            ${domName} (${dg.total} ${absentGranularity.value})
          </div>
          <div style="display: grid; grid-template-columns: auto auto; gap: 2px 14px; font-size: 10.5px;">
            <span style="color: #16a34a;">● Active (≥20 refs):</span><span><b>${dg.activeCount}</b> (${dg.activePct}%)</span>
            <span style="color: #d97706;">● Marginal (1–19 refs):</span><span><b>${dg.marginalCount}</b> (${dg.marginalPct}%)</span>
            <span style="color: #dc2626;">● Blind Spot (0 refs):</span><span><b>${dg.zeroCount}</b> (${dg.zeroPct}%)</span>
          </div>
        `
      }
    },
    xAxis: {
      type: 'value',
      min: 0,
      max: 100,
      axisLine: { lineStyle: { color: axisLineColor } },
      splitLine: { lineStyle: { color: splitLineColor } },
      axisLabel: { color: xAxisLabelColor, formatter: '{value}%', fontSize: 10 }
    },
    yAxis: {
      type: 'category',
      data: yDomains,
      axisLine: { lineStyle: { color: axisLineColor } },
      axisLabel: { color: axisLabelColor, fontSize: 11, fontWeight: paperMode ? 600 : 'normal' }
    },
    series: [
      {
        name: 'Active (≥20 refs)',
        type: 'bar',
        stack: 'total',
        color: paperMode ? '#16a34a' : '#5cb85c',
        label: {
          show: true,
          position: 'inside',
          formatter: (p) => p.value >= 8 ? `${p.value.toFixed(0)}%` : '',
          color: '#ffffff',
          fontSize: 10,
          fontWeight: 'bold'
        },
        data: activePcts
      },
      {
        name: 'Marginal (1–19 refs)',
        type: 'bar',
        stack: 'total',
        color: paperMode ? '#d97706' : '#f0ad4e',
        label: {
          show: true,
          position: 'inside',
          formatter: (p) => p.value >= 8 ? `${p.value.toFixed(0)}%` : '',
          color: paperMode ? '#ffffff' : '#222',
          fontSize: 10,
          fontWeight: 'bold'
        },
        data: marginalPcts
      },
      {
        name: 'Absolute Blind Spot (0 refs)',
        type: 'bar',
        stack: 'total',
        color: paperMode ? '#dc2626' : 'rgba(217, 83, 79, 0.55)',
        label: {
          show: true,
          position: 'inside',
          formatter: (p) => p.value >= 8 ? `${p.value.toFixed(0)}%` : '',
          color: '#ffffff',
          fontSize: 10,
          fontWeight: 'bold'
        },
        data: zeroPcts
      }
    ]
  }
}

const updateHorizonChart = () => {
  if (!horizonChartRef.value) return
  if (!horizonChartInstance) {
    horizonChartInstance = echarts.init(horizonChartRef.value)
  }

  const option = buildHorizonOption(isPaperMode.value)
  if (!option) {
    horizonChartInstance.clear()
    return
  }

  horizonChartInstance.setOption(option, true)
}

const exportQuadrantsForPrint = () => {
  const option = buildQuadrantsOption(true)
  if (!option) return
  const yTitle = yMetric.value === 'translator' ? 'Translator-Backed Share' : 'Assimilation Rate'
  const granLabel = granularity.value === 'fields' ? 'Fields' : 'Subfields'
  exportEChartForPrint({
    option,
    filename: `incose_irritation_quadrants_${granularity.value}_${yMetric.value}_300dpi.png`,
    width: 1200,
    height: 680,
    pixelRatio: 3,
    title: `INCOSE 2×2 Irritation Typology (${granLabel} — ${yTitle})`,
    subtitle: `${getActiveScopeSubtitle()} | Plotted: ${flattenedData.value.length} ${granLabel}`
  })
}

const exportHorizonForPrint = () => {
  const option = buildHorizonOption(true)
  if (!option) return
  const granLabel = absentGranularity.value === 'subfields' ? 'Subfields (252)' : 'Fields (26)'
  exportEChartForPrint({
    option,
    filename: `incose_epistemic_horizon_${absentGranularity.value}_300dpi.png`,
    width: 1100,
    height: 400,
    pixelRatio: 3,
    title: `INCOSE Epistemic Horizon Coverage by Domain — Canonical OpenAlex ${granLabel}`,
    subtitle: getActiveScopeSubtitle()
  })
}

const resizeCharts = () => {
  if (chartInstance) chartInstance.resize()
  if (horizonChartInstance) horizonChartInstance.resize()
}

const disposeCharts = () => {
  if (chartInstance) {
    chartInstance.dispose()
    chartInstance = null
  }
  if (horizonChartInstance) {
    horizonChartInstance.dispose()
    horizonChartInstance = null
  }
}

const onWindowResize = () => {
  if (store.isBlindSpotsOpen) {
    resizeCharts()
  }
}

watch(() => store.isBlindSpotsOpen, (isOpen) => {
  if (isOpen) {
    if (activeTab.value === 'quadrants') {
      nextTick(() => {
        updateChart()
        setTimeout(resizeCharts, 80)
      })
    } else if (activeTab.value === 'absent') {
      fetchCanonicalTaxonomy()
      nextTick(() => {
        updateHorizonChart()
        setTimeout(resizeCharts, 80)
      })
    }
  } else {
    disposeCharts()
  }
})

watch(() => store.disciplinaryBlindSpots, () => {
  if (store.isBlindSpotsOpen) {
    if (activeTab.value === 'quadrants') {
      nextTick(() => {
        updateChart()
        resizeCharts()
      })
    } else if (activeTab.value === 'absent') {
      nextTick(() => {
        updateHorizonChart()
        resizeCharts()
      })
    }
  }
})

watch(canonicalTaxonomy, () => {
  if (store.isBlindSpotsOpen && activeTab.value === 'absent') {
    nextTick(() => {
      updateHorizonChart()
      resizeCharts()
    })
  }
})

onMounted(() => {
  window.addEventListener('resize', onWindowResize)
  if (store.isBlindSpotsOpen) {
    if (activeTab.value === 'quadrants') {
      nextTick(updateChart)
    } else if (activeTab.value === 'absent') {
      fetchCanonicalTaxonomy()
      nextTick(updateHorizonChart)
    }
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
  overflow-y: auto;
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

/* Tab Bar */
.view-tabs {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
  margin-bottom: 2px;
}

.tabs-right-tools {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 6px;
}

.icon-tool-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 26px;
  padding: 0;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 4px;
  color: #ccc;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.icon-tool-btn:hover {
  background: rgba(0, 191, 255, 0.18);
  border-color: #00bfff;
  color: #fff;
}

.icon-tool-btn.active {
  background: rgba(240, 173, 78, 0.22);
  border-color: #f0ad4e;
  color: #f0ad4e;
}

.icon-tool-btn.print-btn {
  border-color: rgba(92, 184, 92, 0.45);
  color: #5cb85c;
  background: rgba(92, 184, 92, 0.12);
}

.icon-tool-btn.print-btn:hover {
  background: #5cb85c;
  border-color: #5cb85c;
  color: #050510;
}

.tab-btn {
  padding: 5px 12px;
  font-size: 11px;
  font-weight: 600;
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
  background: rgba(0, 191, 255, 0.22);
  border-color: #00bfff;
  color: #00bfff;
}

/* 2x2 Quadrants Tab */
.quadrants-wrapper {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  margin-bottom: 12px;
}

.quadrant-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 8px 12px;
  border-radius: 6px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.control-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.control-label {
  font-size: 10px;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 600;
}

.control-toggle {
  display: flex;
  gap: 4px;
}

.control-checkbox {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 10px;
  color: #bbb;
  cursor: pointer;
  user-select: none;
}

.control-checkbox input[type="checkbox"] {
  cursor: pointer;
  accent-color: #00bfff;
}

.ctrl-btn {
  padding: 4px 9px;
  font-size: 10px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 4px;
  color: #aaa;
  cursor: pointer;
  transition: all 0.15s ease;
  font-family: inherit;
}

.ctrl-btn:hover {
  background: rgba(0, 191, 255, 0.15);
  color: #fff;
}

.ctrl-btn.active {
  background: rgba(0, 191, 255, 0.25);
  border-color: #00bfff;
  color: #00bfff;
  font-weight: 600;
}

.quadrant-stat-pill {
  font-size: 10px;
  color: #888;
  padding: 3px 8px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.quadrant-stat-pill b {
  color: #00bfff;
}

.quadrant-chart-canvas {
  height: 520px;
  width: 100%;
  min-height: 520px;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 6px;
  transition: background 0.2s ease, border-color 0.2s ease;
}

.quadrant-chart-canvas.is-paper-mode {
  background: #ffffff;
  border-color: #cbd5e1;
}

/* --- 🕳 Absent Blind Spots Tab Styles --- */
.absent-wrapper {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  margin-bottom: 12px;
  gap: 10px;
}

.absent-loading-state,
.absent-error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  background: rgba(0, 0, 0, 0.25);
  border: 1px dashed rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  color: #bbb;
  font-size: 12px;
  gap: 12px;
}

.loading-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid rgba(0, 191, 255, 0.2);
  border-top-color: #00bfff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.retry-btn {
  padding: 5px 12px;
  background: rgba(0, 191, 255, 0.2);
  border: 1px solid #00bfff;
  color: #00bfff;
  border-radius: 4px;
  cursor: pointer;
  font-size: 11px;
}
.retry-btn:hover {
  background: #00bfff;
  color: #050510;
}

/* 4 KPI Ribbon */
.absent-kpi-ribbon {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.kpi-box {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.kpi-box.kpi-danger {
  border-color: rgba(217, 83, 79, 0.35);
  background: rgba(217, 83, 79, 0.07);
}
.kpi-box.kpi-warning {
  border-color: rgba(240, 173, 78, 0.35);
  background: rgba(240, 173, 78, 0.07);
}
.kpi-box.kpi-success {
  border-color: rgba(92, 184, 92, 0.35);
  background: rgba(92, 184, 92, 0.07);
}

.kpi-label {
  font-size: 9px;
  text-transform: uppercase;
  color: #888;
  letter-spacing: 0.4px;
}

.kpi-val {
  font-size: 15px;
  font-weight: 700;
  color: #eee;
}
.kpi-pct {
  font-size: 10.5px;
  font-weight: normal;
  opacity: 0.85;
}

.absent-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 6px 12px;
  border-radius: 6px;
  flex-wrap: wrap;
}

.absent-meta-note {
  font-size: 9.5px;
  color: #777;
  font-style: italic;
}

/* Horizontal Stacked Bar Chart Card */
.horizon-chart-card {
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  padding: 8px 12px;
  transition: background 0.2s ease, border-color 0.2s ease;
}

.horizon-chart-card.is-paper-mode {
  background: #ffffff;
  border-color: #cbd5e1;
}

.horizon-chart-card.is-paper-mode .chart-header-sub {
  color: #1e293b;
}

.chart-header-sub {
  font-size: 10.5px;
  font-weight: 600;
  color: #aaa;
  margin-bottom: 2px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.horizon-chart-canvas {
  height: 210px;
  width: 100%;
}

/* Tag Lists */
.absent-tags-container {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 270px;
  overflow-y: auto;
  padding-right: 4px;
}
.absent-tags-container::-webkit-scrollbar {
  width: 4px;
}
.absent-tags-container::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
}

.absent-section {
  background: rgba(0, 0, 0, 0.22);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  padding: 10px 12px;
}
.absent-section.section-zero {
  border-left: 3px solid #d9534f;
}
.absent-section.section-marginal {
  border-left: 3px solid #f0ad4e;
}

.absent-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 2px;
}

.absent-section-title {
  margin: 0;
  font-size: 11.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.title-danger {
  color: #ff6b6b;
}
.title-warning {
  color: #f0ad4e;
}

.section-count-badge {
  font-size: 9.5px;
  padding: 1px 6px;
  border-radius: 3px;
  font-weight: 600;
}

.section-desc {
  font-size: 9.5px;
  color: #777;
  margin: 2px 0 8px 0;
}

.domain-groups-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.domain-tag-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.domain-group-header {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

.tag-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.absent-tag {
  font-size: 9px;
  padding: 2px 6px;
  border-radius: 3px;
  white-space: nowrap;
  font-family: inherit;
}

.tag-zero {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #888;
}

.tag-marginal {
  background: rgba(240, 173, 78, 0.12);
  border: 1px solid rgba(240, 173, 78, 0.35);
  color: #f0ad4e;
}

.tag-clickable {
  cursor: pointer;
  transition: all 0.15s ease;
}
.tag-clickable:hover {
  background: rgba(240, 173, 78, 0.3);
  border-color: #f0ad4e;
  color: #fff;
  transform: translateY(-1px);
}

.tag-cnt {
  font-size: 8.5px;
  opacity: 0.85;
}
</style>
