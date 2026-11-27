<template>
  <div v-if="store.isGuideOpen">
    <div id="guide-overlay" @click="close"></div>

    <div id="guide-modal">
      <span class="modal-close" @click="close" title="Close">✖</span>

      <div class="guide-header">
        <div class="title-row">
          <h2>Methodology, Filters &amp; Self-Citation Reference</h2>
          <span class="guide-badge">Quick Guide</span>
        </div>
        <p class="guide-subtitle">
          How filters, self-citation exclusions, translator scoring formulas, and visual encodings work across the workbench.
        </p>
      </div>

      <div class="guide-body">
        <!-- Section 1: Self-Citation & Filter Rules -->
        <section class="guide-section">
          <h3>1. Structural Filters &amp; Self-Citation Policy</h3>
          <table class="guide-table">
            <thead>
              <tr>
                <th>Filter / Metric</th>
                <th>What It Does</th>
                <th>Excludes Self-Citations?</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><b>True Translator / Translator Lens</b></td>
                <td>INCOSE Core papers with <code>Env Out ≥ 2</code> AND <code>Indep. Core In ≥ 2</code>.</td>
                <td><span class="pill-yes">Yes</span> (checks author overlap)</td>
              </tr>
              <tr>
                <td><b>Domain Translators List &amp; 3D Macro Map</b></td>
                <td>Ranks bridge papers by independent INCOSE citations &amp; external discipline references.</td>
                <td><span class="pill-yes">Yes</span> (uses <code>Indep. In</code>)</td>
              </tr>
              <tr>
                <td><b>Unique Authors Filter</b></td>
                <td>Keeps external sources cited by ≥ 2 disjoint INCOSE author teams.</td>
                <td><span class="pill-yes">Yes</span> (disjoint teams only)</td>
              </tr>
              <tr>
                <td><b>Citation Frequency</b></td>
                <td>Removes one-off external sources cited only once (<code>inDegree = 1</code>).</td>
                <td><span class="pill-no">Volume</span> (total core refs)</td>
              </tr>
              <tr>
                <td><b>Active Years / Lifespan</b></td>
                <td>Requires citations across ≥ N distinct years or a ≥ N-year span (test canon forgetting).</td>
                <td><span class="pill-no">Temporal</span> (year span)</td>
              </tr>
            </tbody>
          </table>
        </section>

        <!-- Section 2: Translator Scoring Formulas -->
        <section class="guide-section">
          <h3>2. Domain Translator Scoring Formulas</h3>
          <div class="formula-cards">
            <div class="formula-card">
              <div class="fc-title">⚡ Impact Resonance (Default)</div>
              <code>Score = Indep_In × log₂(1 + Env_Out)</code>
              <p>Prioritizes papers that achieved genuine independent adoption inside INCOSE, while applying diminishing returns to long bibliographies.</p>
            </div>
            <div class="formula-card">
              <div class="fc-title">⚖ Harmonic Balance (F1)</div>
              <code>Score = (2 × Env_Out × Indep_In) / (Env_Out + Indep_In)</code>
              <p>Classical harmonic mean: rewards papers with balanced external breadth and internal citations, penalizing extreme one-sided ratios.</p>
            </div>
          </div>
        </section>

        <!-- Section 3: Visual Encoding -->
        <section class="guide-section">
          <h3>3. Visual Encoding (Shapes &amp; Colors)</h3>
          <div class="encoding-grid">
            <div class="enc-box">
              <div class="enc-title">3D Macro Landscape (Default View)</div>
              <ul>
                <li><span class="enc-crystal">◆</span> <b>Cyan Crystals (Octahedrons):</b> Top INCOSE Domain Translator papers. Click to open 3-Tier Translation Flow.</li>
                <li><span class="enc-dot" style="background:#5b7cfa"></span> <b>Indigo Spheres:</b> Physical Sciences (OpenAlex Fields/Subfields).</li>
                <li><span class="enc-dot" style="background:#f59e0b"></span> <b>Amber Spheres:</b> Social Sciences.</li>
                <li><span class="enc-dot" style="background:#14b8a6"></span> <b>Teal Spheres:</b> Life Sciences.</li>
                <li><span class="enc-dot" style="background:#f43f5e"></span> <b>Coral Spheres:</b> Health Sciences.</li>
              </ul>
            </div>
            <div class="enc-box">
              <div class="enc-title">3D Ego / Paper-Level Graph</div>
              <ul>
                <li><span class="enc-dot" style="background:#00bfff"></span> <b>Electric Cyan:</b> INCOSE Core paper.</li>
                <li><span class="enc-dot" style="background:#5cb85c"></span> <b>Grass Green:</b> Assimilated Canon.</li>
                <li><span class="enc-dot" style="background:#64748b"></span> <b>Slate Gray:</b> External Environment source.</li>
                <li><span class="enc-dot" style="background:#ffaa00"></span> <b>Gold:</b> Focal Node (selected paper).</li>
                <li><span class="enc-dot" style="background:#9b59b6"></span> <b>Purple:</b> Citation Cluster (LPA).</li>
              </ul>
            </div>
          </div>
        </section>
      </div>

      <div class="guide-footer">
        <span class="footer-tip">💡 Tip: Click any blue <b>?</b> badge anywhere in the interface for detailed metric formulas and Wikipedia references.</span>
        <button type="button" class="footer-close-btn" @click="close">Close Guide</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useGraphStore } from '../../store/graphStore.js'

const store = useGraphStore()
const close = () => {
  store.isGuideOpen = false
}
</script>

<style scoped>
#guide-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(4px);
  z-index: 1099;
}

#guide-modal {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 820px;
  max-width: 94vw;
  max-height: 86vh;
  background: rgba(15, 17, 28, 0.98);
  border: 1px solid #00bfff;
  border-radius: 8px;
  padding: 22px 24px;
  z-index: 1100;
  display: flex;
  flex-direction: column;
  box-shadow: 0 0 32px rgba(0, 191, 255, 0.22);
  color: #e5e7eb;
  box-sizing: border-box;
}

.modal-close {
  position: absolute;
  top: 14px;
  right: 16px;
  cursor: pointer;
  color: #999;
  font-size: 16px;
}
.modal-close:hover {
  color: #fff;
}

.guide-header {
  border-bottom: 1px dashed rgba(255, 255, 255, 0.14);
  padding-bottom: 10px;
  margin-bottom: 12px;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.title-row h2 {
  margin: 0;
  font-size: 16px;
  color: #00bfff;
  font-weight: 700;
}

.guide-badge {
  font-size: 9.5px;
  padding: 2px 7px;
  border-radius: 4px;
  background: rgba(0, 191, 255, 0.15);
  border: 1px solid rgba(0, 191, 255, 0.4);
  color: #7dd3fc;
  text-transform: uppercase;
  font-weight: 700;
}

.guide-subtitle {
  margin: 5px 0 0 0;
  font-size: 11px;
  color: #9ca3af;
}

.guide-body {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding-right: 4px;
}

.guide-section h3 {
  margin: 0 0 8px 0;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: #f3f4f6;
}

.guide-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
  background: rgba(0, 0, 0, 0.24);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  overflow: hidden;
}

.guide-table th,
.guide-table td {
  padding: 7px 10px;
  text-align: left;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.guide-table th {
  background: rgba(255, 255, 255, 0.04);
  color: #9ca3af;
  font-size: 10px;
  text-transform: uppercase;
}

.guide-table code,
.formula-card code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10.5px;
  color: #7dd3fc;
  background: rgba(0, 191, 255, 0.1);
  padding: 2px 5px;
  border-radius: 3px;
}

.pill-yes {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 3px;
  background: rgba(92, 184, 92, 0.2);
  border: 1px solid rgba(92, 184, 92, 0.5);
  color: #86efac;
  font-weight: 700;
  font-size: 10px;
}

.pill-no {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #cbd5e1;
  font-size: 10px;
}

.formula-cards,
.encoding-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.formula-card,
.enc-box {
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  padding: 10px 12px;
}

.fc-title,
.enc-title {
  font-size: 11.5px;
  font-weight: 700;
  color: #00bfff;
  margin-bottom: 6px;
}

.formula-card p {
  margin: 6px 0 0 0;
  font-size: 10.5px;
  color: #cbd5e1;
  line-height: 1.45;
}

.enc-box ul {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 11px;
  color: #d1d5db;
}

.enc-dot {
  display: inline-block;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  margin-right: 6px;
  vertical-align: middle;
}

.enc-crystal {
  display: inline-block;
  color: #00bfff;
  margin-right: 6px;
  font-size: 12px;
  text-shadow: 0 0 6px rgba(0, 191, 255, 0.8);
}

.guide-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 10px;
  margin-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.footer-tip {
  font-size: 10.5px;
  color: #9ca3af;
}

.footer-close-btn {
  padding: 6px 14px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 4px;
  color: #ddd;
  font-size: 11px;
  cursor: pointer;
}
.footer-close-btn:hover {
  background: rgba(255, 255, 255, 0.18);
  color: #fff;
}
</style>
