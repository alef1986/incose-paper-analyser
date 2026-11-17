// core/algorithms/GhostHunter.js

const POLITE_EMAIL = 'alexander@efremov-systems.de'
const CROSSREF_HEADERS = {
  'User-Agent': `LuhmannAnalyzer/1.0 (mailto:${POLITE_EMAIL})`
}

/**
 * Returns authorization headers for OpenAlex if API key is provided in environment
 */
export function getOpenAlexHeaders(customHeaders = {}) {
  const headers = { ...customHeaders }
  const apiKey = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_OPENALEX_API_KEY : undefined
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`
  }
  return headers
}

/**
 * Exact RegEx mandated for OpenAlex text search:
 * Finds the first chunk of at least 4 pure-letter words separated by whitespace.
 */
export const OPENALEX_TEXT_REGEX = /\b[^\W\d_]+(?:\s+[^\W\d_]+){3,}\b/ui

/**
 * Normalizes DOI string (removes URL prefixes, converts to lowercase)
 */
export function cleanDoi(doi) {
  if (!doi || typeof doi !== 'string') return ''
  return doi
    .trim()
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '')
    .replace(/^doi:/i, '')
    .toLowerCase()
}

/**
 * Extracts a DOI from a node object
 */
export function extractDoi(node) {
  if (!node) return null
  const candidates = [node.doi, node.DOI, node.id]
  for (const c of candidates) {
    if (typeof c === 'string' && c.includes('10.')) {
      const match = c.match(/10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+/i)
      if (match) return cleanDoi(match[0])
    }
  }
  return null
}

/**
 * Tokenizes text into lowercase words of length >= 3
 */
export function tokenize(text) {
  if (!text || typeof text !== 'string') return new Set()
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3)
  return new Set(words)
}

/**
 * Computes Jaccard similarity between two token sets
 */
export function jaccardSimilarity(setA, setB) {
  if (!setA || !setB || setA.size === 0 || setB.size === 0) return 0
  let intersectionSize = 0
  for (const token of setA) {
    if (setB.has(token)) {
      intersectionSize++
    }
  }
  const unionSize = setA.size + setB.size - intersectionSize
  return unionSize > 0 ? intersectionSize / unionSize : 0
}

/**
 * Extracts clean query string for OpenAlex according to the critical RegEx rule
 */
export function extractCleanOpenAlexQuery(text) {
  if (!text || typeof text !== 'string') return null
  const match = text.match(OPENALEX_TEXT_REGEX)
  return match ? match[0] : null
}

/**
 * Fetches raw references from Crossref for a given DOI with polite headers and rate-limit backoff
 */
export async function fetchCrossrefReferences(doi) {
  const normalizedDoi = cleanDoi(doi)
  if (!normalizedDoi) return []

  const url = `https://api.crossref.org/works/${encodeURIComponent(normalizedDoi)}?mailto=${POLITE_EMAIL}`

  try {
    let res = await fetch(url, { headers: CROSSREF_HEADERS })
    if (res.status === 429) {
      await new Promise(resolve => setTimeout(resolve, 2000))
      res = await fetch(url, { headers: CROSSREF_HEADERS })
    }

    if (!res.ok) return []

    const json = await res.json()
    const message = json.message || {}
    const refs = message.reference || message.references || []
    return Array.isArray(refs) ? refs : []
  } catch (err) {
    console.warn(`[GhostHunter] Failed to fetch Crossref refs for DOI ${doi}:`, err)
    return []
  }
}

/**
 * Formats an OpenAlex work response to strictly adhere to the required target node schema
 */
export function formatOpenAlexWork(work) {
  // Extract ISSNs
  let issns = []
  if (work.primary_location?.source?.issn) {
    const srcIssn = work.primary_location.source.issn
    issns = Array.isArray(srcIssn) ? srcIssn : [srcIssn]
  } else if (Array.isArray(work.locations)) {
    for (const loc of work.locations) {
      if (loc.source?.issn) {
        const locIssn = loc.source.issn
        issns.push(...(Array.isArray(locIssn) ? locIssn : [locIssn]))
      }
    }
  }
  issns = Array.from(new Set(issns)).filter(Boolean)
  if (issns.length === 0) issns = ['Unknown']

  // Extract Authors as comma-separated String
  let authors = []
  if (Array.isArray(work.authorships)) {
    authors = work.authorships
      .map(a => a.author?.display_name || a.raw_author_name)
      .filter(Boolean)
  }
  const authorString = authors.length > 0 ? authors.join(', ') : 'Unknown'

  // Extract Taxonomy
  const topic = work.primary_topic || {}
  const domain = topic.domain?.display_name || 'Unknown'
  const field = topic.field?.display_name || 'Unknown'
  const subfield = topic.subfield?.display_name || 'Unknown'

  // Extract References as String array
  const references = Array.isArray(work.referenced_works)
    ? work.referenced_works.map(String)
    : []

  const pubYear = typeof work.publication_year === 'number'
    ? work.publication_year
    : (work.publication_year ? parseInt(work.publication_year, 10) : 0)

  return {
    id: String(work.id),
    title: String(work.title || 'Untitled'),
    year: pubYear,
    issns: issns.map(String),
    pubType: String(work.type || 'journal-article'),
    authors: authorString,
    domain: String(domain),
    field: String(field),
    subfield: String(subfield),
    references: references
  }
}

/**
 * Queries OpenAlex by DOI
 */
export async function queryOpenAlexByDoi(doi) {
  const normalizedDoi = cleanDoi(doi)
  if (!normalizedDoi) return null

  try {
    const url = `https://api.openalex.org/works?filter=doi:${encodeURIComponent(normalizedDoi)}&mailto=${POLITE_EMAIL}`
    const res = await fetch(url, { headers: getOpenAlexHeaders() })
    if (res.ok) {
      const data = await res.json()
      if (data.results && data.results.length > 0) {
        return data.results[0]
      }
    }
  } catch (err) {
    console.warn(`[GhostHunter] OpenAlex query by DOI failed:`, err)
  }
  return null
}

/**
 * Queries OpenAlex by text using strict RegEx check
 */
export async function queryOpenAlexByText(rawText) {
  const cleanQuery = extractCleanOpenAlexQuery(rawText)
  if (!cleanQuery) {
    // CRITICAL RULE: Abort query if clean chunk of 4+ pure-letter words is missing
    return { aborted: true, work: null, query: null }
  }

  try {
    const url = `https://api.openalex.org/works?search=${encodeURIComponent(cleanQuery)}&per-page=3&mailto=${POLITE_EMAIL}`
    const res = await fetch(url, { headers: getOpenAlexHeaders() })
    if (res.ok) {
      const data = await res.json()
      if (data.results && data.results.length > 0) {
        return { aborted: false, work: data.results[0], query: cleanQuery }
      }
    }
  } catch (err) {
    console.warn(`[GhostHunter] OpenAlex search by text failed:`, err)
  }

  return { aborted: false, work: null, query: cleanQuery }
}

/**
 * Resolves incoming source nodes citing targetNodeId, filtered by Core / Environment
 */
export function getFilteredIncomingSourceNodes(graphModel, targetNodeId, { includeCore = true, includeEnv = true } = {}) {
  if (!graphModel || !targetNodeId) return []

  const adj = graphModel.adjacencyList.get(targetNodeId) || []
  const incomingLinks = adj.filter(l => {
    const target = typeof l.target === 'object' ? l.target.id : l.target
    return target === targetNodeId
  })

  const sourceNodes = incomingLinks
    .map(l => {
      const sourceId = typeof l.source === 'object' ? l.source.id : l.source
      return graphModel.nodes.get(sourceId)
    })
    .filter(Boolean)

  const uniqueMap = new Map()
  for (const n of sourceNodes) {
    uniqueMap.set(n.id, n)
  }

  return Array.from(uniqueMap.values()).filter(n => {
    if (n.type === 'incose_source') return includeCore
    return includeEnv
  })
}

/**
 * Main GhostHunter analysis pipeline
 */
export async function runGhostHunterAnalysis({
  targetNode,
  graphModel,
  includeCore = true,
  includeEnv = true,
  onProgress = () => {}
}) {
  if (!targetNode || !graphModel) {
    console.error('[GhostHunter] Invalid call: targetNode or graphModel missing.', { targetNode, graphModel: Boolean(graphModel) })
    throw new Error('Target node and graph model are required.')
  }
  if (!targetNode.id) {
    console.error('[GhostHunter] Invalid call: targetNode missing id.', targetNode)
    throw new Error('Target node missing id.')
  }

  onProgress({ step: 'init', percent: 5, message: 'Identifying incoming citations...' })

  // 1. Identify incoming links and filter source nodes
  const sourceNodes = getFilteredIncomingSourceNodes(graphModel, targetNode.id, { includeCore, includeEnv })

  if (sourceNodes.length === 0) {
    return {
      candidates: [],
      sourceCount: 0,
      message: 'No citing nodes match the selected boundary filters (Core / Environment).'
    }
  }

  onProgress({
    step: 'sources',
    percent: 15,
    message: `Found ${sourceNodes.length} citing source papers. Resolving DOIs...`
  })

  // 2. Resolve DOIs for source nodes
  const citingSourcesWithDoi = []
  for (const node of sourceNodes) {
    let doi = extractDoi(node)
    if (!doi && node.id.includes('openalex.org/W')) {
      try {
        const oaRes = await fetch(`https://api.openalex.org/works/${encodeURIComponent(node.id)}?select=doi&mailto=${POLITE_EMAIL}`, { headers: getOpenAlexHeaders() })
        if (oaRes.ok) {
          const oaData = await oaRes.json()
          if (oaData.doi) doi = cleanDoi(oaData.doi)
        }
      } catch {
        // Continue if lookup fails
      }
    }
    if (doi) {
      citingSourcesWithDoi.push({ node, doi })
    }
  }

  if (citingSourcesWithDoi.length === 0) {
    return {
      candidates: [],
      sourceCount: sourceNodes.length,
      message: 'None of the citing nodes possess a valid publisher DOI for Crossref bibliography extraction.'
    }
  }

  onProgress({
    step: 'crossref',
    percent: 25,
    message: `Fetching bibliographies from Crossref for ${citingSourcesWithDoi.length} papers...`
  })

  // 3. Fetch raw references from Crossref with rate limiting
  const sourceBibliographies = []
  for (let i = 0; i < citingSourcesWithDoi.length; i++) {
    const { node, doi } = citingSourcesWithDoi[i]
    const refs = await fetchCrossrefReferences(doi)
    if (refs.length > 0) {
      sourceBibliographies.push({
        sourceId: node.id,
        sourceTitle: node.title,
        sourceType: node.type,
        doi,
        refs
      })
    }

    const currentPercent = 25 + Math.floor(((i + 1) / citingSourcesWithDoi.length) * 35)
    onProgress({
      step: 'crossref',
      percent: currentPercent,
      message: `Fetched Crossref references (${i + 1}/${citingSourcesWithDoi.length})...`
    })

    if (i < citingSourcesWithDoi.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 150)) // Inter-request polite delay
    }
  }

  if (sourceBibliographies.length === 0) {
    return {
      candidates: [],
      sourceCount: citingSourcesWithDoi.length,
      message: 'No references could be retrieved from Crossref for the citing papers.'
    }
  }

  onProgress({
    step: 'features',
    percent: 65,
    message: 'Extracting reference features and computing Jaccard similarities...'
  })

  // 4. Feature extraction: [unstructured] | [author] | [year] | [title]
  const parsedReferences = []
  for (const src of sourceBibliographies) {
    for (const ref of src.refs) {
      const doi = ref.doi || ref.DOI ? cleanDoi(ref.doi || ref.DOI) : null
      const author = ref.author || ''
      const year = ref.year ? String(ref.year).trim() : ''
      const title = ref['article-title'] || ref.title || ''
      const unstructured = ref.unstructured || ''

      const textParts = [author, year, title, unstructured].filter(Boolean)
      const fullText = textParts.join(' ')
      const tokens = tokenize(fullText)

      parsedReferences.push({
        sourceId: src.sourceId,
        sourceTitle: src.sourceTitle,
        doi,
        author,
        year,
        title,
        unstructured,
        fullText,
        tokens
      })
    }
  }

  // 5. Cluster references using exact DOI matches or Jaccard similarity (>0.4)
  const clusters = []
  const targetTokens = tokenize(targetNode?.title || '')
  const targetDoi = extractDoi(targetNode)

  for (const ref of parsedReferences) {
    let matchedCluster = null

    for (const cluster of clusters) {
      if (ref.doi && cluster.doi && ref.doi === cluster.doi) {
        matchedCluster = cluster
        break
      }
      const sim = jaccardSimilarity(ref.tokens, cluster.tokens)
      if (sim > 0.4) {
        matchedCluster = cluster
        if (sim > cluster.maxSimilarity) {
          cluster.maxSimilarity = sim
        }
        break
      }
    }

    if (matchedCluster) {
      matchedCluster.sources.add(ref.sourceId)
      matchedCluster.items.push(ref)
      if (!matchedCluster.doi && ref.doi) matchedCluster.doi = ref.doi
      if (ref.fullText.length > matchedCluster.bestText.length) {
        matchedCluster.bestText = ref.fullText
        matchedCluster.tokens = new Set([...matchedCluster.tokens, ...ref.tokens])
      }
    } else {
      clusters.push({
        doi: ref.doi,
        sources: new Set([ref.sourceId]),
        items: [ref],
        bestText: ref.fullText,
        tokens: new Set(ref.tokens),
        maxSimilarity: ref.doi ? 1.0 : 0.4,
        targetSimilarity: targetTokens.size > 0 ? jaccardSimilarity(ref.tokens, targetTokens) : 0
      })
    }
  }

  // Rank clusters: prioritize multiple distinct sources, exact DOIs, or similarity to target
  clusters.sort((a, b) => {
    if (targetDoi) {
      if (a.doi === targetDoi && b.doi !== targetDoi) return -1
      if (b.doi === targetDoi && a.doi !== targetDoi) return 1
    }
    if (Math.abs(b.targetSimilarity - a.targetSimilarity) > 0.2) {
      return b.targetSimilarity - a.targetSimilarity
    }
    if (b.sources.size !== a.sources.size) {
      return b.sources.size - a.sources.size
    }
    if (a.doi && !b.doi) return -1
    if (!a.doi && b.doi) return 1
    return b.maxSimilarity - a.maxSimilarity
  })

  // Select top candidate clusters
  const topClusters = clusters.filter(c => c.sources.size >= 2 || c.doi || c.targetSimilarity > 0.4).slice(0, 5)
  const finalClusters = topClusters.length > 0 ? topClusters : clusters.slice(0, 3)

  if (finalClusters.length === 0) {
    return {
      candidates: [],
      sourceCount: citingSourcesWithDoi.length,
      message: 'No overlapping citation clusters found among citing references.'
    }
  }

  onProgress({
    step: 'openalex',
    percent: 80,
    message: 'Validating candidates via OpenAlex API (applying strict RegEx rule)...'
  })

  // 6. Validate candidates via OpenAlex
  const resolvedCandidates = []
  for (let i = 0; i < finalClusters.length; i++) {
    const cluster = finalClusters[i]
    let openAlexWork = null
    let matchType = cluster.doi ? 'Exact DOI' : 'Jaccard Text Overlap'
    let queryUsed = null
    let wasAborted = false

    // Try DOI first if present
    if (cluster.doi) {
      openAlexWork = await queryOpenAlexByDoi(cluster.doi)
    }

    // If no work found by DOI, attempt text search under CRITICAL REGEX RULE
    if (!openAlexWork && cluster.bestText) {
      const textResult = await queryOpenAlexByText(cluster.bestText)
      if (textResult.aborted) {
        wasAborted = true
      } else {
        openAlexWork = textResult.work
        queryUsed = textResult.query
      }
    }

    if (openAlexWork) {
      const formattedSchema = formatOpenAlexWork(openAlexWork)
      resolvedCandidates.push({
        clusterId: `candidate-${i + 1}`,
        confidence: cluster.sources.size >= 2 ? 'High' : (cluster.doi ? 'High' : 'Moderate'),
        consensusCount: cluster.sources.size,
        totalCitingSources: citingSourcesWithDoi.length,
        matchType,
        doi: cluster.doi || openAlexWork.doi,
        rawText: cluster.bestText,
        similarity: cluster.maxSimilarity,
        queryUsed,
        targetSchema: formattedSchema
      })
    } else {
      resolvedCandidates.push({
        clusterId: `raw-cluster-${i + 1}`,
        confidence: 'Unverified in OpenAlex',
        consensusCount: cluster.sources.size,
        totalCitingSources: citingSourcesWithDoi.length,
        matchType,
        doi: cluster.doi,
        rawText: cluster.bestText,
        similarity: cluster.maxSimilarity,
        abortedByRegEx: wasAborted,
        targetSchema: null
      })
    }
  }

  onProgress({
    step: 'done',
    percent: 100,
    message: `Completed! Found ${resolvedCandidates.filter(c => c.targetSchema).length} validated candidates.`
  })

  return {
    candidates: resolvedCandidates,
    sourceCount: citingSourcesWithDoi.length,
    message: `Found ${resolvedCandidates.length} candidate reference(s) from ${citingSourcesWithDoi.length} citing papers.`
  }
}


