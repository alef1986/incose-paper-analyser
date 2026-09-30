// src/core/algorithms/LuhmannAnalytics.js

const INCOSE_ISSNS = "1520-6858|1098-1241|2156-4868|2156-485X|2334-5837";
const POLITE_EMAIL = "alexander@efremov-systems.de";
const POLITE_HEADER = { "User-Agent": `mailto:${POLITE_EMAIL}` };

export function getOpenAlexHeaders(customHeaders = {}) {
    const headers = { ...customHeaders };
    const apiKey = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_OPENALEX_API_KEY : undefined;
    if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
    }
    return headers;
}

export async function runLuhmannAnalysis(nodeId, graphModel) {
    const results = {
        gatekeepers: { authors: [], hasGatekeeper: false, status: 'pending' },
        penetration: { rate: 0, citingCoreCount: 0, totalCoreCount: 0, rawScore: 'Low' },
        temporal: { spanYears: 0, minYear: null, maxYear: null, status: 'Unknown' }
    };

    const node = graphModel.nodes.get(nodeId);
    if (!node) throw new Error("Node not found in graph model.");

    // --- 1. CORE PENETRATION RATE ---
    const totalCoreNodes = Array.from(graphModel.nodes.values()).filter(n => n.type === 'incose_source').length;
    const adjLinks = graphModel.adjacencyList.get(nodeId) || [];
    
    // Find core nodes that cite this target node
    const citingCoreNodes = adjLinks
        .filter(l => (typeof l.target === 'object' ? l.target.id : l.target) === nodeId)
        .map(l => graphModel.nodes.get(typeof l.source === 'object' ? l.source.id : l.source))
        .filter(n => n && n.type === 'incose_source');

    results.penetration.totalCoreCount = totalCoreNodes;
    results.penetration.citingCoreCount = citingCoreNodes.length;
    
    if (totalCoreNodes > 0) {
        const rate = (citingCoreNodes.length / totalCoreNodes) * 100;
        results.penetration.rate = rate.toFixed(3);
        // Adjusted heuristic: Even 0.1% of a 50k core (50 citations) is highly significant
        if (citingCoreNodes.length > 30) results.penetration.rawScore = 'High (Canon Candidate)';
        else if (citingCoreNodes.length > 5) results.penetration.rawScore = 'Moderate';
        else results.penetration.rawScore = 'Low (Environment Noise)';
    }

    // --- 2. TEMPORAL STABILITY ---
    // Extract valid publication years from citing core nodes
    const citingYears = citingCoreNodes
        .map(n => parseInt(n.publicationYear))
        .filter(y => !isNaN(y) && y > 1900 && y <= new Date().getFullYear());

    results.temporal.distribution = [];
    results.temporal.maxCitationsInYear = 0;

    if (citingYears.length > 0) {
        const minYear = Math.min(...citingYears);
        const maxYear = Math.max(...citingYears);
        const span = maxYear - minYear;
        
        results.temporal.minYear = minYear;
        results.temporal.maxYear = maxYear;
        results.temporal.spanYears = span;
        
        if (span >= 10) results.temporal.status = 'Highly Stable (Axiomatic)';
        else if (span >= 4) results.temporal.status = 'Stabilising';
        else results.temporal.status = 'Transient / Hype (Noise)';

        // Calculate year-by-year distribution
        const yearCounts = {};
        citingYears.forEach(y => {
            yearCounts[y] = (yearCounts[y] || 0) + 1;
        });
        
        results.temporal.distribution = Object.keys(yearCounts)
            .map(y => ({ year: parseInt(y), count: yearCounts[y] }))
            .sort((a, b) => a.year - b.year);
            
        results.temporal.maxCitationsInYear = Math.max(...results.temporal.distribution.map(d => d.count));

    } else {
        results.temporal.status = 'Insufficient temporal metadata';
    }
    
    // --- 3. GATEKEEPERS CHECK (OpenAlex API) ---
    // Only execute if the node is an OpenAlex entity
    if (!nodeId.includes("openalex.org")) {
        results.gatekeepers.status = 'Skipped (Not an OpenAlex ID)';
        return results;
    }

    try {
        // Fix: Route through api.openalex.org instead of the public web URL
        const apiUrl = `https://api.openalex.org/works/${encodeURIComponent(nodeId)}?mailto=${POLITE_EMAIL}`;
        const workRes = await fetch(apiUrl, { headers: getOpenAlexHeaders(POLITE_HEADER) });
        
        if (!workRes.ok) throw new Error(`HTTP ${workRes.status}`);
        const workData = await workRes.json();
        
        const authorships = workData.authorships || [];
        if (authorships.length === 0) {
            results.gatekeepers.status = 'No authors found';
            return results;
        }

        // For each author, check if they have published in INCOSE journals
        for (const auth of authorships) {
            const authorId = auth.author?.id;
            const authorName = auth.author?.display_name || "Unknown";
            
            if (!authorId) continue;

            const filterQuery = `author.id:${authorId},primary_location.source.issn:${INCOSE_ISSNS}`;
            const checkUrl = `https://api.openalex.org/works?filter=${filterQuery}&select=id&per-page=1&mailto=${POLITE_EMAIL}`;
            
            const checkRes = await fetch(checkUrl, { headers: getOpenAlexHeaders(POLITE_HEADER) });
            if (!checkRes.ok) continue;
            
            const checkData = await checkRes.json();
            const isGatekeeper = checkData.meta?.count > 0;
            
            results.gatekeepers.authors.push({
                name: authorName,
                isGatekeeper: isGatekeeper,
                incosePapers: checkData.meta?.count || 0
            });

            if (isGatekeeper) results.gatekeepers.hasGatekeeper = true;
        }
        
        results.gatekeepers.status = results.gatekeepers.hasGatekeeper ? 'Gatekeeper Confirmed' : 'External Origin';

    } catch (e) {
        results.gatekeepers.status = `API Error: ${e.message}`;
    }

    return results;
}