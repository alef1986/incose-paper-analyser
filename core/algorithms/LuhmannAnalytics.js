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

        // Limit checking up to 25 authors
        const authorsToCheck = authorships.slice(0, 25);

        // Helper to check a single author
        const checkSingleAuthor = async (auth) => {
            const authorId = auth.author?.id;
            const authorName = auth.author?.display_name || "Unknown";
            
            if (!authorId) {
                return { name: authorName, isGatekeeper: false, incosePapers: 0 };
            }

            const filterQuery = `author.id:${authorId},primary_location.source.issn:${INCOSE_ISSNS}`;
            const checkUrl = `https://api.openalex.org/works?filter=${filterQuery}&select=id&per-page=1&mailto=${POLITE_EMAIL}`;

            try {
                let checkRes = await fetch(checkUrl, { headers: getOpenAlexHeaders(POLITE_HEADER) });
                if (checkRes.status === 429) {
                    await new Promise(r => setTimeout(r, 1500));
                    checkRes = await fetch(checkUrl, { headers: getOpenAlexHeaders(POLITE_HEADER) });
                }
                if (!checkRes.ok) {
                    return { name: authorName, isGatekeeper: false, incosePapers: 0 };
                }
                
                const checkData = await checkRes.json();
                const count = checkData.meta?.count || 0;
                return {
                    name: authorName,
                    isGatekeeper: count > 0,
                    incosePapers: count
                };
            } catch {
                return { name: authorName, isGatekeeper: false, incosePapers: 0 };
            }
        };

        // Batch optimization: extract clean author IDs (up to 25)
        const cleanIds = authorsToCheck
            .map(auth => auth.author?.id ? String(auth.author.id).replace(/^https?:\/\/openalex\.org\//i, '') : null)
            .filter(Boolean);

        let skipIndividualChecks = false;

        // If multiple authors, perform a fast batch probe (up to 25 author IDs)
        if (cleanIds.length > 1) {
            try {
                const batchFilter = `author.id:${cleanIds.join('|')},primary_location.source.issn:${INCOSE_ISSNS}`;
                const batchUrl = `https://api.openalex.org/works?filter=${batchFilter}&select=id&per-page=1&mailto=${POLITE_EMAIL}`;
                let batchRes = await fetch(batchUrl, { headers: getOpenAlexHeaders(POLITE_HEADER) });
                if (batchRes.status === 429) {
                    await new Promise(r => setTimeout(r, 1500));
                    batchRes = await fetch(batchUrl, { headers: getOpenAlexHeaders(POLITE_HEADER) });
                }
                if (batchRes.ok) {
                    const batchData = await batchRes.json();
                    if ((batchData.meta?.count || 0) === 0) {
                        skipIndividualChecks = true;
                    }
                }
            } catch {
                // Fallback to concurrent individual checks
            }
        }

        if (skipIndividualChecks) {
            // Fast path: none of the co-authors published in INCOSE journals
            authorsToCheck.forEach(auth => {
                results.gatekeepers.authors.push({
                    name: auth.author?.display_name || "Unknown",
                    isGatekeeper: false,
                    incosePapers: 0
                });
            });
            results.gatekeepers.hasGatekeeper = false;
        } else {
            // Run concurrent requests with concurrency pool (up to 5 parallel requests)
            const CONCURRENCY_LIMIT = 5;
            const authorResults = Array.from({ length: authorsToCheck.length });
            let nextIdx = 0;

            const runWorker = async () => {
                while (nextIdx < authorsToCheck.length) {
                    const idx = nextIdx++;
                    authorResults[idx] = await checkSingleAuthor(authorsToCheck[idx]);
                }
            };

            const workerCount = Math.min(CONCURRENCY_LIMIT, authorsToCheck.length);
            await Promise.all(Array.from({ length: workerCount }, () => runWorker()));

            authorResults.forEach(res => {
                if (res) {
                    results.gatekeepers.authors.push(res);
                    if (res.isGatekeeper) results.gatekeepers.hasGatekeeper = true;
                }
            });
        }
        
        results.gatekeepers.status = results.gatekeepers.hasGatekeeper ? 'Gatekeeper Confirmed' : 'External Origin';

    } catch (e) {
        results.gatekeepers.status = `API Error: ${e.message}`;
    }

    return results;
}