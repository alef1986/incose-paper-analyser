/**
 * Centralized scientometric & Niklas Luhmann systems-theory glossary
 * powering interactive <HelpTip /> popovers across the workbench.
 */
export const GLOSSARY = {
  // --- Advanced Analysis Filters (EgoPanel) ---
  citationFrequency: {
    title: 'Citation Frequency (Meaning Condensation)',
    tag: 'Filter • Luhmann',
    summary:
      'Filters out one-off external references (inDegree = 1). Keeps only external works cited repeatedly across the corpus, marking the threshold where isolated references condense into recognizable shared forms.',
    formula: 'Keep external node iff Core_Citations ≥ 2',
    interpretation:
      'Separates passing background mentions from sources that actually entered community discourse.',
    links: [
      { label: 'Citation analysis (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Citation_analysis' },
      { label: 'Niklas Luhmann (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Niklas_Luhmann' }
    ]
  },
  uniqueAuthors: {
    title: 'Unique Authors (Independent Reception)',
    tag: 'Filter • Scientometrics',
    summary:
      'Requires an external source to be cited by at least two disjoint author teams (no overlapping co-authors). Filters out self-citation loops where one researcher repeatedly cites the same external reference.',
    formula: 'Disjoint citing author groups ≥ 2',
    interpretation:
      'Distinguishes personal reference habits (psychic systems) from supra-individual community reception (social system).',
    links: [
      { label: 'Bibliometrics (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Bibliometrics' }
    ]
  },
  activeYears: {
    title: 'Active Years Count (Sustained Attention)',
    tag: 'Filter • Temporal',
    summary:
      'Retains external sources cited in at least N distinct publication years. Filters out single-conference fads or transient hype spikes.',
    formula: 'Count(distinct Year of citing Core papers) ≥ N',
    interpretation:
      'Higher values isolate ideas that achieved evolutionary restabilisation across multiple publication cycles.',
    links: [
      { label: 'Scientometrics (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Scientometrics' }
    ]
  },
  lifespan: {
    title: 'Citation Lifespan (Structural Durability)',
    tag: 'Filter • Temporal',
    summary:
      'Measures the total time span between the earliest and latest INCOSE citation to an external work. Enable "Apply to Canon" to test structural forgetting (once-canonical works no longer cited in recent years).',
    formula: 'Max(Citing_Year) − Min(Citing_Year) ≥ Span',
    interpretation:
      'Long lifespans (8–15+ yrs) signal axiomatic foundations embedded in institutional memory.',
    links: [
      { label: 'Citation analysis (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Citation_analysis' }
    ]
  },
  translatorLens: {
    title: 'Translator Lens (Realized Coupling)',
    tag: 'Filter • Structural Coupling',
    summary:
      'Shows only external disciplines and references imported by verified "True Translators" — INCOSE papers that cite external science AND are subsequently cited by independent INCOSE authors.',
    formula: 'Citing Core paper has Role = "True Translator"',
    interpretation:
      'Contrasts nominal interdisciplinarity (raw references) against realized structural coupling that resonated inside INCOSE.',
    links: [
      { label: 'Boundary spanning (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Boundary_spanning' },
      { label: 'Structural coupling / Autopoiesis (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Autopoiesis' }
    ]
  },
  backboneMode: {
    title: 'Backbone Mode (Hide Orphan Leaves)',
    tag: '3D Graph Optimization',
    summary:
      'Strips external nodes cited only once (inDegree ≤ 1) in raw/ego 3D views, revealing cross-citation bridges and drastically reducing WebGL memory load.',
    formula: 'Hide external node if inDegree ≤ 1',
    interpretation:
      'Useful when inspecting dense ego-networks or raw subgraphs to focus on shared literature bridges.',
    links: [
      { label: 'Force-directed graph drawing (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Force-directed_graph_drawing' }
    ]
  },

  // --- Diffusion Panel ---
  knowledgeDiffusion: {
    title: 'Knowledge Diffusion Analysis',
    tag: 'Luhmann • Anschlussfähigkeit',
    summary:
      'Measures recursive connectability (Anschlussfähigkeit): whether importing external knowledge from the selected discipline or year cohort triggered subsequent internal citations within INCOSE.',
    interpretation:
      'A high volume of external imports with zero internal follow-up indicates unassimilated scouting rather than systemic learning.',
    links: [
      { label: 'Systems theory (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Systems_theory' },
      { label: 'Diffusion of innovations (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Diffusion_of_innovations' }
    ]
  },
  citationAge: {
    title: 'Citation Age / Lag (Eigenzeit)',
    tag: 'Scientometrics • Luhmann',
    summary:
      'Measures how old external literature is when cited by an INCOSE paper. Reported as Median and Interquartile Range (IQR: 25th–75th percentile) alongside Mean (μ) so historical classics do not skew the estimate.',
    formula: 'Lag = Year(Citing Core Paper) − Year(Cited External Work)',
    interpretation:
      'Low median lag (3–7 yrs) signals active coupling with contemporary science. High lag (>15 yrs) indicates reliance on historical classics while missing recent advances (Luhmann’s Eigenzeit / temporal asynchrony).',
    links: [
      { label: 'Interquartile range (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Interquartile_range' },
      { label: 'Citation analysis (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Citation_analysis' }
    ]
  },
  conceptRooting: {
    title: 'Concept Rooting over Time',
    tag: 'Temporal Diffusion',
    summary:
      'Tracks how frequently INCOSE papers cite the selected cohort or discipline in subsequent years. Toggle Normalized (%) to adjust for overall growth in annual INCOSE publication volume.',
    formula: 'Normalized (%) = (Cohort Citations in Year Y / Total INCOSE Papers in Year Y) × 100',
    interpretation:
      'Sustained or rising normalized bars show lasting integration; a sharp drop-off indicates a temporary fad.',
    links: [
      { label: 'Bibliometrics (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Bibliometrics' }
    ]
  },
  boundarySpanners: {
    title: 'Domain Translators (Boundary Spanners)',
    tag: 'STS • Structural Coupling',
    summary:
      'Identifies INCOSE papers that import external literature (Env Out) and earn independent citations from OTHER INCOSE authors (Indep. In — self-citations by shared co-authors are strictly excluded).',
    formula:
      'Impact Resonance = Indep_In × log₂(1 + Env_Out)   |   Harmonic F1 = 2·Env·Indep_In / (Env + Indep_In)',
    interpretation:
      'Impact Resonance prioritizes internal INCOSE adoption while applying diminishing returns to long bibliographies. Harmonic F1 rewards papers with a balanced ratio of external imports and internal citations.',
    links: [
      { label: 'Boundary spanning (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Boundary_spanning' },
      { label: 'F-score / Harmonic mean (Wikipedia)', url: 'https://en.wikipedia.org/wiki/F-score' }
    ]
  },
  translatorScoring: {
    title: 'Translator Scoring Formula',
    tag: 'Ranking • Self-Citations Excluded',
    summary:
      'Controls how Domain Translators are ranked in both the 3D Macro Landscape Map and the right-hand Domain Translators list. Both formulas use strictly independent internal INCOSE citations (excluding shared-author self-citations).',
    formula:
      'Resonance: Indep_In × log₂(1 + Env_Out)   |   F1 Balance: (2 × Env_Out × Indep_In) / (Env_Out + Indep_In)',
    interpretation:
      'Use Resonance to surface influential papers that actually moved INCOSE discourse; use Harmonic F1 to surface papers with symmetric external breadth and internal impact.',
    links: [
      { label: 'Harmonic mean (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Harmonic_mean' },
      { label: 'Citation analysis (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Citation_analysis' }
    ]
  },

  // --- Metrics Panel ---
  citationClusters: {
    title: 'Citation Clusters & Insularity',
    tag: 'Graph Analytics • LPA',
    summary:
      'Uses multi-run seeded Label Propagation (LPA) to detect densely inter-citing research sub-communities within INCOSE, together with each cluster’s external Disciplinary Profile.',
    formula: 'Core Insularity = (Intra-cluster links) / (All Core→Core links of cluster)',
    interpretation:
      'High Core Insularity (>75%) shows tightly self-referencing subfields or specialized schools of thought that rarely cite outside their own cluster. Compare with Total Closure (which includes external references).',
    links: [
      { label: 'Label propagation algorithm (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Label_propagation_algorithm' },
      { label: 'Community structure (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Community_structure' }
    ]
  },

  // --- Blind Spots Modal ---
  taxonomyHierarchy: {
    title: 'OpenAlex 3-Tier Disciplinary Taxonomy',
    tag: 'Data Schema',
    summary:
      'Every external work is classified into OpenAlex’s canonical 3-level scientific hierarchy: 4 Domains → 26 Fields → 252 Subfields. Click ▶ to drill down or click Filter to slice the entire workbench.',
    links: [
      { label: 'OpenAlex (Wikipedia)', url: 'https://en.wikipedia.org/wiki/OpenAlex' }
    ]
  },
  totalCitations: {
    title: 'Total Outgoing Citations',
    tag: 'Volume Metric',
    summary:
      'Total number of citation links from active INCOSE Core papers pointing to works in this external discipline (counting multiple citations to the same work).',
    links: [
      { label: 'Citation analysis (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Citation_analysis' }
    ]
  },
  uniqueWorks: {
    title: 'Unique External Works',
    tag: 'Breadth Metric',
    summary:
      'Number of distinct external publications (journal articles, books, standards, reports) cited at least once by active INCOSE Core papers in this discipline.',
    links: [
      { label: 'Bibliometrics (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Bibliometrics' }
    ]
  },
  oneOffRate: {
    title: 'One-Off Citation Rate (Uncondensed Irritations)',
    tag: 'Scientometrics • Luhmann',
    summary:
      'Percentage of unique external works in a discipline cited ONLY ONCE across the entire INCOSE corpus (inDegree = 1). In Luhmann’s terms, these are cognitive irritations that never condensed into shared community memory.',
    formula: 'One-Off Rate = (Works with inDegree = 1 / Unique Works) × 100%',
    interpretation:
      'Values above 85% mean the community touches this field almost exclusively via isolated, unrepeated citations.',
    links: [
      { label: 'Niklas Luhmann (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Niklas_Luhmann' },
      { label: 'Scientometrics (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Scientometrics' }
    ]
  },
  translatorBacked: {
    title: 'Translator-Backed Share (%)',
    tag: 'Structural Coupling',
    summary:
      'Percentage of outgoing citations to this discipline authored by verified "True Translators" (INCOSE papers that also earned independent citations inside INCOSE), rather than unresonated scouts.',
    formula: '(Citations from True Translators / Total Citations to Discipline) × 100%',
    interpretation:
      'Higher values (>30%) indicate disciplines whose imported ideas are actively carried by influential INCOSE bridge papers.',
    links: [
      { label: 'Boundary spanning (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Boundary_spanning' }
    ]
  },

  // --- Longitudinal Modal ---
  auditedPapers: {
    title: 'Core Papers Audited (Reference Coverage)',
    tag: 'Data Quality',
    summary:
      'Only INCOSE Core papers with at least 1 parsed outgoing reference in OpenAlex can be included in citation ratios, Price Index, and Citation Age calculations. Short INSIGHT columns or unparsed early proceedings without reference lists are excluded from the denominator.',
    links: [
      { label: 'OpenAlex (Wikipedia)', url: 'https://en.wikipedia.org/wiki/OpenAlex' }
    ]
  },
  selfReference: {
    title: 'Self-Reference Rate (Internal Citation Share)',
    tag: 'Luhmann • Selbstreferenz',
    summary:
      'Measures the balance between internal self-reference (Core → Core) and external reference (Core → Environment). Note: in Luhmann’s theory, operational closure itself is binary; this metric tracks the empirical share of internal self-reference within outgoing bibliographies.',
    formula: 'Self-Reference Rate = (Core → Core links / All Core outgoing links) × 100%',
    interpretation:
      'Rising values indicate growing internal canon reliance and disciplinary self-containment; lower values indicate heavier reliance on external scientific literature.',
    links: [
      { label: 'Autopoiesis (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Autopoiesis' },
      { label: 'Self-reference (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Self-reference' }
    ]
  },
  priceIndexLag: {
    title: 'Price Index vs. Median Citation Age (Eigenzeit)',
    tag: 'Scientometrics • Luhmann',
    summary:
      'Compares Derek de Solla Price’s Index (% of external citations ≤ 5 years old) against Median Citation Age. Together they track whether Systems Engineering stays synchronized with contemporary science or ages into a historical canon.',
    formula: 'Price Index = (External refs with 0 ≤ Lag ≤ 5 yrs / All dated external refs) × 100%',
    interpretation:
      'Hard/fast-moving sciences typically show Price Index ~40–60% (low lag). Falling Price Index with rising Median Lag signals disciplinary aging and reliance on older classics.',
    links: [
      { label: 'Derek J. de Solla Price (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Derek_J._de_Solla_Price' },
      { label: 'Scientometrics (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Scientometrics' }
    ]
  },
  shannonDiversity: {
    title: "Shannon Diversity Index (H')",
    tag: 'Information Theory • Interdisciplinarity',
    summary:
      'Measures how evenly INCOSE distributes its external citations across different OpenAlex scientific fields (or subfields when filtered to a specific domain).',
    formula: "H' = −∑ pᵢ · ln(pᵢ)   (in nats)",
    interpretation:
      'Higher H’ means broader, more balanced cross-disciplinary engagement; lower H’ indicates concentration in just one or two neighboring fields (monoculture).',
    links: [
      { label: 'Diversity index / Shannon entropy (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Diversity_index#Shannon_index' }
    ]
  }
}
