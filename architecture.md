# INCOSE Graph Analyser — Architecture Context

## 1. Overview
A Vue 3 (Composition API) Single Page Application and bibliometric processing pipeline for visualising and analysing large-scale bibliometric citation networks (Ego-Networks) and Knowledge Diffusion. Grounded in Niklas Luhmann's autopoietic systems theory, the system treats Systems Engineering discourse (specifically INCOSE publications) as an operationally closed social system. It ingests data from Crossref and OpenAlex APIs to observe how external scientific concepts penetrate the boundary between the autopoietic core and its environment over time.

## 2. Directory Structure

### Pipeline & Analytical Scripts (Root Workspace)
*   **`crossref_core.py`** (`crossref_harvester`): Harvests the authoritative institutional record of publications directly from the Crossref REST API using official INCOSE ISSNs. Captures formal publication metadata, publisher DOIs, and full bibliography reference arrays (both linked and unlinked).
*   **`openalex_core.py` / `CreateGraph_OpenAlex.py`**: Queries the OpenAlex API to extract the algorithmic citation network, author metadata, and OpenAlex three-tiered taxonomy. Builds directed graphs tracking core-to-core and core-to-environment citations.
*   **`compare_OA_CR.py` / `comparison.py`**: Comparative audit engines. Reconciles Crossref institutional records against OpenAlex and Semantic Scholar graphs to detect algorithmic loss, unindexed works, and discrepancies in internal closure edges.
*   **`semanticScholar.py`**: Secondary verification harvester querying Semantic Scholar's Graph API for title-matched core publications to cross-validate citation counts and external references.
*   **`graphConverter.py`**: Utility for converting flat JSON dumps of works into NetworkX directed node-link graph schemas.
*   **`luhmann_analytics.js`**: Standalone analytical and stub-identification library. Contains the original heuristic engine and the **GhostHunter** string-overlap intersection algorithm for unmasking phantom citations.

### Application Core (`core/`)
Isolated, framework-agnostic JavaScript library implementing graph mathematics and Luhmann systems metrics.
*   **`core/algorithms/LuhmannAnalytics.js`**: Operationalises Luhmann systems metrics for individual nodes:
    *   **Core Penetration Rate**: Calculates the percentage of the autopoietic core referencing the target work ($\frac{\text{Citing Core Count}}{\text{Total Core Nodes}} \times 100\%$). Heuristically classifies nodes into Canon candidates ($>30$ citations or $>5\%$), Moderate discourse, or Environmental noise.
    *   **Temporal Stability**: Determines whether an external irritation has achieved axiomatic status or remains transient hype by analyzing the year-by-year citation distribution and total span ($maxYear - minYear \ge 10$ yrs indicates axiomatic stabilization; $<4$ yrs indicates transient fashion).
    *   **Gatekeeper Verification**: Queries the OpenAlex API to determine if authors of an external environmental work possess publications within INCOSE journals (matching tracked ISSNs). Authors with internal publications serve as verified *gatekeepers*, providing empirical evidence of structural coupling between the external discipline and the core system.
*   **`core/models/Graph.js`**: Contains `Node`, `Link`, and `Graph` classes. Implements breadth-first search (BFS) ego-subgraph extraction (`getEgoNetwork`, `extractCoreCenteredSubgraph`), adjacency indexing, and dynamic node scaling based on citation volume and Luhmann classification.
*   **`core/parsers/JsonAdapter.js`**: Ingests raw Python API dumps or pre-compiled D3 graph structures into the unified `Graph` model. Instantiates phantom nodes (`external_or_unknown`) for unresolved citations present in bibliographies but missing from the primary dataset, preserving environmental context.

### Reactive Application State (`src/store/`)
*   **`src/store/graphStore.js`**: Pinia state management — the central analytical coordinator. Holds the active `graphModel` (wrapped in `markRaw` to bypass Vue reactivity overhead), tracks active analytical slices (taxonomic branch, temporal intervals, ISSN subsets), manages view transitions (`graph` vs `sunburst`), and provides heavy computational getters (`filteredCoreNodes`, `diffusionStats`, `topNodes`).

### User Interface Components (`src/components/` & `src/views/`)
*   **`src/views/SingleAnalyzer.vue`**: The primary operational dashboard integrating the 3D WebGL viewport, analytical sidebars, and classification overlays.
*   **`src/components/modals/NodeInfoModal.vue`**: Node semantic inspector and reclassification terminal. Supports single and batch metadata enrichment via OpenAlex API, manual taxonomy correction, citing node traversal, and on-demand execution of `LuhmannAnalytics`.
*   **`src/components/panels/EgoPanel.vue`**: Left-side system boundary controller. Handles graph file ingestion, temporal horizon filtering, depth/direction visualization settings, tracked ISSN toggles, and deduplication triggers.
*   **`src/components/panels/MetricsPanel.vue`**: Right-side system metrics panel. Displays overall operational closure indicators, system boundary visibility toggles (Core, Canon, Environment, Excluded), the ranked Top Hubs index, and node editing triggers.
*   **`src/components/panels/DiffusionPanel.vue`**: Knowledge Diffusion visualizer. Renders temporal concept histograms tracking how ideas from filtered external domains or specific publication cohorts root themselves into core publications across subsequent years.
*   **`src/components/panels/SunburstChart.vue`**: Multi-level hierarchical sunburst visualizer (Domain > Field > Subfield) representing external environmental knowledge. Features PiP/Fullscreen toggling, zoom drill-down, and uniform color anchoring across dynamic temporal filtering.
*   **`src/components/panels/SearchPanel.vue`**: Multi-criteria author/title search engine with batch selection capabilities, designed for mass categorization of environmental entities into Canon or Irrelevant noise.
*   **`src/components/visualization/ForceGraph3D.vue`**: WebGL 3D network visualizer based on `3d-force-graph`. Translates sociological boundaries into spatial structures and applies visual "Ghosting" (reduced opacity and unlinking) to nodes filtered out of the active analytical scope.

---

## 3. The GhostHunter Algorithm (Stub Resolution)

In citation aggregators (such as OpenAlex), citations to non-indexed literature — monographs, foundational textbooks, technical military/defense standards (e.g., MIL-STD, ISO/IEC 15288), and gray literature — fail to resolve into canonical entities. They materialize in citation networks as anonymous "phantom" nodes or stubs (`external_or_unknown` nodes with numeric IDs or missing titles).

The **GhostHunter** algorithm (prototyped in `luhmann_analytics.js`) resolves these epistemic blind spots through cross-citation string intersection:

1.  **Citation Context Retrieval**: For a given unresolved stub, the algorithm queries all known Core nodes (`incose_source`) that cite this target.
2.  **Raw Bibliography Extraction**: Utilizing Crossref's raw metadata, the engine fetches the original unstructured reference arrays (`unstructured`, `article-title`, `author`, `year`) from the citing core works, filtering for references that lack a resolved publisher DOI.
3.  **Cross-Document Word-Overlap Clustering**: 
    *   Computes pairwise lexical similarity across unparsed citation strings extracted from independent citing papers using word-token Jaccard overlap:
        $$\text{Overlap}(S_1, S_2) = \frac{|W_1 \cap W_2|}{\min(|W_1|, |W_2|)}$$
    *   Where $W_i$ represents significant word tokens ($\text{length} \ge 3$).
4.  **Consensus Identification**: When citation text strings across distinct, independent INCOSE papers match above a predefined threshold ($>0.30$), the candidate string is clustered and ranked by citation frequency.
5.  **Resolution & Reclassification**: The consensus citation text reveals the true historical identity of the stub (e.g., *“Blanchard, B. S., Fabrycky, W. J. Systems Engineering and Analysis”* or *“EIA-632”*), allowing researchers to update the stub's title, assign proper taxonomy, and reclassify it from an unresolved environmental anomaly into the assimilated **Canon**.

---

## 4. Core Data Model (`Node`)

Each entity in the graph corresponds to a scientific communication or referenced artifact, classified according to Luhmann's system-environment distinction:

*   **`id`**: String. Persistent identifier (publisher DOI or OpenAlex URL).
*   **`type`**: Enum representing systemic status:
    *   `incose_source` (**Core**): Autopoietic self-reproduction. Articles published within official INCOSE channels (Systems Engineering Journal, INSIGHT, Annual Symposium Proceedings).
    *   `assimilated_canon` (**Canon**): Environmental knowledge that has achieved structural coupling and sustained assimilation into core institutional memory through repeated core citations over time.
    *   `external_or_unknown` (**Environment / Umwelt**): External communications from other disciplines (Computer Science, Management, Physics) acting as cognitive irritations to the core.
    *   `irrelevant` (**Excluded Noise**): Communications identified as outside the analytical boundary or invalid records, excluded from visual calculations.
*   **`justification`**: String. Qualitative rationale documenting why an external source was promoted to Canon or relegated to Excluded.
*   **`publicationYear` / `year`**: Integer. Temporal anchor used for chronological filtering and diffusion rate calculations.
*   **Taxonomy Fields (`domain`, `field`, `subfield`)**: Three-tier disciplinary categorization (mapped from OpenAlex topics or Crossref subjects), providing an epistemic map of the environment.
*   **`inDegree`**: Integer. Citation volume within the currently loaded network graph.
*   **`issns`**: Array of strings. Tracks journal origin, handling multi-ISSN publication channels (print, electronic, and historical variations).
*   **`authors`**: String (comma-separated). Essential for verifying authorial lineage and gatekeeper roles.
*   **`pubType` / `type_crossref`**: Publication type metadata (journal-article, proceedings-article, book, standard).

---

## 5. Data Harvesting & Validation Pipeline

Beyond the client-side Vue dashboard, the project incorporates an autonomous Python harvesting and verification architecture. Its architectural objective is the rigorous separation between the **institutional registry of record (Crossref)** and the **algorithmic semantic aggregator (OpenAlex / Semantic Scholar)**.

```
       [ Official ISSNs ]
               │
       ┌───────┴────────────────────────┐
       ▼                                ▼
[ Crossref REST API ]         [ OpenAlex REST API ]
 (Publisher Registry)          (Semantic Aggregator)
       │                                │
       ▼                                ▼
 crossref_core.py               openalex_core.py
 [crossref_core.json]           [openalex_core.json]
       │                                │
       └──────────────┬─────────────────┘
                      ▼
               compare_OA_CR.py
            (Blind Spot Evaluation)
                      │
       ┌──────────────┴─────────────────┐
       ▼                                ▼
 [missing_in_openalex.json]     [Reconciled Graph JSON]
   (Discrepancies & Stubs)              │
                                        ▼
                            INCOSE Graph Analyser
                            (Vue 3 / Core SPA Engine)
```

### Architectural & Epistemological Role (Luhmann's *Blinde Flecken*)
In Luhmann’s second-order cybernetics, every observation relies on a distinction that creates a necessary **"blind spot" (*blinder Fleck*)** — that which the observer cannot observe because it serves as the instrument of observation. Commercial and automated bibliometric aggregators (OpenAlex, Semantic Scholar) observe literature through probabilistic parsers, web scrapers, and automated citation linkers:
1.  **Algorithmic Blind Spots of Aggregators**: OpenAlex systematically undercounts citations where publisher reference strings deviate from standard formatting, misses monographs and early conference proceedings, and fails to parse unlinked citations. This artificially diminishes the observed **operational closure** of the INCOSE core (core works citing core works).
2.  **Crossref as Institutional Registry**: Crossref acts as the deterministic baseline of publisher deposit. While it lacks rich semantic topic clustering and author disambiguation, its reference lists represent the historical communication acts formally registered by Wiley and INCOSE.
3.  **Comparator Pipeline (`compare_OA_CR.py`, `comparison.py`)**:
    *   Quantifies algorithmic loss: calculates the percentage of official INCOSE articles missing in OpenAlex despite possessing valid DOIs.
    *   Cross-evaluates internal core closure edges ($\text{Core} \rightarrow \text{Core}$) across both repositories, identifying discrepancies where OpenAlex severed legitimate internal autopoietic citations.
    *   Isolates true missing citations (`missing_in_openalex.json`) and unresolved bibliography items, which directly feed the GhostHunter algorithm.
    *   Ensures that empirical sociological analysis conducted in the Vue dashboard rests on validated, reconciled data rather than aggregator artifacts.

---

## 6. Key Architectural Patterns

*   **Separation of Concerns**: Vue components handle DOM rendering, user interactions, and visual layout. Mathematical graph transformations, depth-first/breadth-first traversals, and API normalization remain strictly encapsulated inside vanilla JavaScript in `core/`.
*   **Reactivity Bypass (`markRaw`)**: Large graph instances containing tens of thousands of links are excluded from Vue's deep proxy tracking via `markRaw()`. The 3D force simulation runs independently on WebGL canvas threads using shallow clones, preventing reactivity cascades and memory exhaustion.
*   **Cross-Component Synchronization (Pinia-Driven)**: Filtering is centralized in `graphStore.js`. Slicing a temporal range in `EgoPanel` or clicking a disciplinary wedge in `SunburstChart` updates `activeFilters`. Store getters recompute the active subgraph, which immediately cascades into the `DiffusionPanel` histogram and applies 3D ghosting in `ForceGraph3D`.
*   **Fixed Color Mapping & Structural Integrity**: The Sunburst visualizer establishes a deterministic color palette based on an alphabetically sorted tree of domains. Uncited or filtered-out disciplines retain their structural positions with `opacity: 0`, preventing color shifting and cognitive disorientation during dynamic filtering.
