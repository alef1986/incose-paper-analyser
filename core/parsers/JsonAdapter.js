// src/core/parsers/JsonAdapter.js
import { Node, Link, Graph } from '../models/Graph.js'

export function parseIncoseJson(rawData) {
    const graph = new Graph()
    
    let rawNodes = []
    let rawLinks = []

    const isRawArray = Array.isArray(rawData);

    // 1. Determine the format of the incoming JSON
    if (isRawArray) {
        // Format A: Raw array from Python scripts (OpenAlex/Crossref API dump)
        rawNodes = rawData
        rawData.forEach(work => {
            const sourceId = work.id || work.doi
            if (work.references && Array.isArray(work.references)) {
                work.references.forEach(targetId => {
                    if (sourceId && targetId) {
                        rawLinks.push({ source: sourceId, target: targetId })
                    }
                })
            }
        })
    } else {
        // Format B: Pre-compiled D3 graph from our editor ({ nodes: [], links: [] })
        rawNodes = rawData.nodes || []
        rawLinks = rawData.links || rawData.edges || []
    }

    // 2. Pre-calculate in-degrees
    const inDegrees = {}
    rawLinks.forEach(l => {
        const targetId = typeof l.target === 'object' ? l.target.id : l.target
        inDegrees[targetId] = (inDegrees[targetId] || 0) + 1
    })

    // 3. Register explicitly known nodes from the dataset
    const knownNodeIds = new Set()
    
    rawNodes.forEach(n => {
        // Fallback chain for IDs across different schemas
        const nId = n.id || n.doi || n.DOI;
        if (!nId) return; // Skip broken records

        const degree = inDegrees[nId] || 0
        const topoType = isRawArray ? 'incose_source' : (n.type || 'external_or_unknown')
        const pubType = n.type_crossref && n.type_crossref !== 'unknown' ? n.type_crossref : n.type

        // Safely extract ISSN array
        let extractedIssns = [];
        if (Array.isArray(n.issns) && n.issns.length > 0) {
            extractedIssns = n.issns;
        } else if (n.issn) {
            extractedIssns = Array.isArray(n.issn) ? n.issn : [n.issn];
        } else if (n.primary_location?.source?.issn) {
            const locIssn = n.primary_location.source.issn;
            extractedIssns = Array.isArray(locIssn) ? locIssn : [locIssn];
        }

        // Safely extract authors
        const authorString = Array.isArray(n.authors) ? n.authors.join(', ') : (n.authors || 'Unknown');

        const node = new Node({
            id: nId,
            title: n.title || n.DOI || "Untitled",
            type: topoType,
            justification: n.justification,
            publicationYear: n.year || n.publication_year,
            inDegree: degree,
            issns: extractedIssns.length > 0 ? extractedIssns : ['Unknown'],
            authors: authorString,
            
            // CRITICAL FIX: Читаем таксономию из загружаемого JSON
            domain: n.domain || 'Unknown',
            field: n.field || 'Unknown',
            subfield: n.subfield || 'Unknown'
        });
        node.pubType = pubType;
        
        graph.addNode(node);
        knownNodeIds.add(nId);
    });

    // 4. Process links and instantiate missing external nodes (Environment)
    rawLinks.forEach(l => {
        const sId = typeof l.source === 'object' ? l.source.id : l.source
        const tId = typeof l.target === 'object' ? l.target.id : l.target
        
        if (!sId || !tId) return;

        // Create phantom nodes for targets not in our core dataset
        if (!knownNodeIds.has(tId)) {
            graph.addNode(new Node({
                id: tId,
                title: `External Source (${tId})`,
                type: 'external_or_unknown',
                inDegree: inDegrees[tId] || 1,
                issns: ['Unknown'],
                authors: 'Unknown',
                domain: 'Unknown', 
                field: 'Unknown', 
                subfield: 'Unknown'
            }))
            knownNodeIds.add(tId)
        }
        
        // Failsafe for missing source nodes
        if (!knownNodeIds.has(sId)) {
            graph.addNode(new Node({
                id: sId,
                title: `Unknown Source (${sId})`,
                type: 'external_or_unknown',
                inDegree: inDegrees[sId] || 0,
                issns: ['Unknown'],
                authors: 'Unknown'
            }))
            knownNodeIds.add(sId)
        }

        graph.addLink(new Link(sId, tId))
    })

    return graph
}