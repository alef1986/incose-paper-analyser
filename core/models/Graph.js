// src/core/models/Graph.js

export class Node {
    // The parameter list must destructure 'issns = []' rather than the old 'issn'
    constructor({ id, title, type, justification = "", inDegree = 0, publicationYear = null, issns = [], authors = '', domain = 'Unknown', field = 'Unknown', subfield = 'Unknown', pubType = undefined }) {
        this.id = id;
        this.title = title || id;
        this.type = type || 'external_or_unknown';
        this.justification = justification;
        this.inDegree = inDegree;
        this.publicationYear = publicationYear;
        this.issns = issns; 
        this.authors = authors;
        this.domain = domain;
        this.field = field;
        this.subfield = subfield;
        this.pubType = pubType;
    }

    // Inside class Node:
    get nodeSize() {
        // More aggressive scaling: nodes strictly represent their citation volume
        let size = Math.max(1, Math.sqrt(this.inDegree) * 0.8);
        if ((this.type === 'incose_source' || this.type === 'assimilated_canon') && size < 2) size = 2;
        if (this.type === 'irrelevant') size = 0.5; 
        return size;
    }

    get categoryName() {
        if (this.type === 'incose_source') return 'Core (INCOSE)';
        if (this.type === 'assimilated_canon') return 'Canon (Assimilated)';
        if (this.type === 'irrelevant') return 'Not Relevant (Excluded)';
        return 'Environment (External)';
    }
}

export class Link {
    constructor(source, target) {
        this.source = typeof source === 'object' ? source.id : source;
        this.target = typeof target === 'object' ? target.id : target;
    }
}

export class Graph {
    constructor() {
        this.nodes = new Map(); 
        this.links = [];        
        this.adjacencyList = new Map(); 
    }

    addNode(node) {
        this.nodes.set(node.id, node);
        if (!this.adjacencyList.has(node.id)) {
            this.adjacencyList.set(node.id, []);
        }
    }

    addLink(link) {
        this.links.push(link);
        if (!this.adjacencyList.has(link.source)) this.adjacencyList.set(link.source, []);
        if (!this.adjacencyList.has(link.target)) this.adjacencyList.set(link.target, []);
        
        this.adjacencyList.get(link.source).push(link);
        this.adjacencyList.get(link.target).push(link);
    }
    
    // Inside class Graph:
    getEgoNetwork(centerId, activeFilters = null, vizSettings = null) {
        const subNodesMap = new Map();
        const subLinksSet = new Set();
        
        // Check global limits AND local visualiser toggles
        const passesFilters = (n, isCenter = false) => {
            if (!n) return false;
            if (isCenter) return true; 
            
            if (activeFilters) {
                if (activeFilters.citationFrequencyFilter && !activeFilters.activeNodeIds.has(n.id)) return false;
                if (!activeFilters.displayFilters[n.type]) return false;
                const nodeIssns = n.issns || [];
                const hasTracked = nodeIssns.some(i => activeFilters.trackedIssns.includes(i));
                const hasSelected = nodeIssns.some(i => activeFilters.selectedISSNs.includes(i));
                if (hasTracked && !hasSelected) return false;
            }
            
            if (vizSettings) {
                if (n.type === 'incose_source' && !vizSettings.showCore) return false;
                if (n.type === 'assimilated_canon' && !vizSettings.showCanon) return false;
                if (n.type === 'external_or_unknown' && !vizSettings.showEnv) return false;
                if (n.type === 'irrelevant') return false; 
            }
            
            if (vizSettings && vizSettings.hideLeaves) {
                // Hide external orphan leaves (cited only once in the entire network)
                if (n.type !== 'incose_source' && n.type !== 'assimilated_canon' && n.inDegree <= 1) return false;
            }
            
            return true;
        }

        const depthLimit = vizSettings ? vizSettings.depth : 1;
        const direction = vizSettings ? vizSettings.direction : 'both';
        
        let queue = [{id: centerId, d: 0}];
        let visited = new Set([centerId]);
        let head = 0;
        
        // 1. Gather all nodes within depth limits based on DIRECTION
        while (head < queue.length) {
            const curr = queue[head++];
            let nodeObj = this.nodes.get(curr.id);
            
            if(nodeObj && passesFilters(nodeObj, curr.id === centerId)) {
                subNodesMap.set(curr.id, nodeObj);
            }
            
            if (curr.d < depthLimit) {
                let adjLinks = this.adjacencyList.get(curr.id) || [];
                for(let l of adjLinks) {
                    let s = typeof l.source === 'object' ? l.source.id : l.source;
                    let t = typeof l.target === 'object' ? l.target.id : l.target;
                    
                    let neighborId = null;
                    
                    // Filter traversal by direction
                    if (direction === 'both') {
                        neighborId = (s === curr.id) ? t : s;
                    } else if (direction === 'out' && s === curr.id) {
                        neighborId = t; // Current node cites the neighbor
                    } else if (direction === 'in' && t === curr.id) {
                        neighborId = s; // Neighbor cites the current node
                    }

                    if (neighborId && !visited.has(neighborId)) {
                        visited.add(neighborId);
                        queue.push({id: neighborId, d: curr.d + 1});
                    }
                }
            }
        }
        
        // 2. Extract Cross-Links: Keep ALL links that exist between the gathered nodes
        subNodesMap.forEach((_, nId) => {
            const adj = this.adjacencyList.get(nId) || [];
            adj.forEach(l => {
                const s = typeof l.source === 'object' ? l.source.id : l.source;
                const t = typeof l.target === 'object' ? l.target.id : l.target;
                if (subNodesMap.has(s) && subNodesMap.has(t)) {
                    subLinksSet.add(l);
                }
            });
        });
        
        return {
            nodes: Array.from(subNodesMap.values()).map(n => ({ ...n, pubType: n.pubType })),
            links: Array.from(subLinksSet).map(l => ({ ...l }))
        };
    }

    getCliqueNetwork(cliqueMembersSet, collapseToSuperNode = false, cliqueMeta = null) {
        if (!collapseToSuperNode) {
            const subNodesMap = new Map();
            const subLinksSet = new Set();
            
            // Add all clique members
            cliqueMembersSet.forEach(id => {
                const node = this.nodes.get(id);
                if (node) subNodesMap.set(id, node);
            });

            // Add 1-hop environment targets
            this.links.forEach(l => {
                const s = typeof l.source === 'object' ? l.source.id : l.source;
                const t = typeof l.target === 'object' ? l.target.id : l.target;
                if (cliqueMembersSet.has(s)) {
                    const tNode = this.nodes.get(t);
                    if (tNode && tNode.type !== 'irrelevant') {
                        subNodesMap.set(t, tNode);
                    }
                }
            });

            // Keep all links between collected nodes
            subNodesMap.forEach((_, nId) => {
                const adj = this.adjacencyList.get(nId) || [];
                adj.forEach(l => {
                    const s = typeof l.source === 'object' ? l.source.id : l.source;
                    const t = typeof l.target === 'object' ? l.target.id : l.target;
                    if (subNodesMap.has(s) && subNodesMap.has(t)) {
                        subLinksSet.add(l);
                    }
                });
            });

            return {
                nodes: Array.from(subNodesMap.values()).map(n => ({ ...n, pubType: n.pubType })),
                links: Array.from(subLinksSet).map(l => ({ ...l }))
            };
        }

        // Collapse to virtual super-node
        const superNodeId = `clique-super-${cliqueMeta?.id || 'node'}`;
        const superNode = {
            id: superNodeId,
            title: `Clique (${cliqueMembersSet.size} Core Papers) — Top:${cliqueMeta?.topAuthors || 'Various'}`,
            type: 'clique_supernode',
            inDegree: cliqueMembersSet.size * 5,
            authors: cliqueMeta?.topAuthors || 'Clique Collective',
            issns: [],
            domain: 'INCOSE Clique',
            isSuperNode: true,
            memberCount: cliqueMembersSet.size
        };

        const externalNodesMap = new Map();
        const outgoingCounts = new Map(); // extId -> count
        const incomingCounts = new Map(); // otherCoreId -> count

        this.links.forEach(l => {
            const s = typeof l.source === 'object' ? l.source.id : l.source;
            const t = typeof l.target === 'object' ? l.target.id : l.target;

            const sInClique = cliqueMembersSet.has(s);
            const tInClique = cliqueMembersSet.has(t);

            if (sInClique && !tInClique) {
                const tNode = this.nodes.get(t);
                if (tNode && tNode.type !== 'irrelevant') {
                    externalNodesMap.set(t, tNode);
                    outgoingCounts.set(t, (outgoingCounts.get(t) || 0) + 1);
                }
            } else if (!sInClique && tInClique) {
                const sNode = this.nodes.get(s);
                if (sNode && sNode.type !== 'irrelevant') {
                    externalNodesMap.set(s, sNode);
                    incomingCounts.set(s, (incomingCounts.get(s) || 0) + 1);
                }
            }
        });

        const aggregatedLinks = [];
        outgoingCounts.forEach((count, extId) => {
            aggregatedLinks.push({
                source: superNodeId,
                target: extId,
                weight: count
            });
        });

        incomingCounts.forEach((count, otherId) => {
            aggregatedLinks.push({
                source: otherId,
                target: superNodeId,
                weight: count
            });
        });

        return {
            nodes: [superNode, ...Array.from(externalNodesMap.values()).map(n => ({ ...n, pubType: n.pubType }))],
            links: aggregatedLinks
        };
    }

    getFilteredGlobalNetwork(filteredCoreNodes, store, vizSettings) {
        const subNodesMap = new Map();
        const subLinksSet = new Set();
        
        const coreIdsSet = new Set(filteredCoreNodes.map(n => n.id));
        
        const passesFilters = (n, isStartingCore = false) => {
            if (!n) return false;
            if (isStartingCore) return true; // Starting core nodes are always allowed
            
            if (store) {
                if (store.citationFrequencyFilter && !store.activeNodeIds.has(n.id)) return false;
                if (!store.displayFilters[n.type]) return false;
                const nodeIssns = n.issns || [];
                const hasTracked = nodeIssns.some(i => store.trackedIssns.includes(i));
                const hasSelected = nodeIssns.some(i => store.selectedISSNs.includes(i));
                if (hasTracked && !hasSelected) return false;
            }
            
            if (vizSettings) {
                if (n.type === 'incose_source' && !vizSettings.showCore) return false;
                if (n.type === 'assimilated_canon' && !vizSettings.showCanon) return false;
                if (n.type === 'external_or_unknown' && !vizSettings.showEnv) return false;
                if (n.type === 'irrelevant') return false; 
            }
            
            if (vizSettings && vizSettings.hideLeaves) {
                // Hide external orphan leaves (cited only once in the entire network)
                if (n.type !== 'incose_source' && n.type !== 'assimilated_canon' && n.inDegree <= 1) return false;
            }
            
            return true;
        }

        const depthLimit = vizSettings ? vizSettings.depth : 1;
        const direction = vizSettings ? vizSettings.direction : 'both';
        
        // Initialize queue with all filtered core nodes at depth 0
        let queue = filteredCoreNodes.map(n => ({ id: n.id, d: 0 }));
        let visited = new Set(filteredCoreNodes.map(n => n.id));
        let head = 0;
        
        while (head < queue.length) {
            const curr = queue[head++];
            let nodeObj = this.nodes.get(curr.id);
            
            if (nodeObj && passesFilters(nodeObj, coreIdsSet.has(curr.id))) {
                subNodesMap.set(curr.id, nodeObj);
            }
            
            if (curr.d < depthLimit) {
                let adjLinks = this.adjacencyList.get(curr.id) || [];
                for (let l of adjLinks) {
                    let s = typeof l.source === 'object' ? l.source.id : l.source;
                    let t = typeof l.target === 'object' ? l.target.id : l.target;
                    
                    let neighborId = null;
                    
                    if (direction === 'both') {
                        neighborId = (s === curr.id) ? t : s;
                    } else if (direction === 'out' && s === curr.id) {
                        neighborId = t;
                    } else if (direction === 'in' && t === curr.id) {
                        neighborId = s;
                    }

                    if (neighborId && !visited.has(neighborId)) {
                        visited.add(neighborId);
                        queue.push({ id: neighborId, d: curr.d + 1 });
                    }
                }
            }
        }
        
        // Keep links where both source and target are in the subNodesMap
        subNodesMap.forEach((_, nId) => {
            const adj = this.adjacencyList.get(nId) || [];
            adj.forEach(l => {
                const s = typeof l.source === 'object' ? l.source.id : l.source;
                const t = typeof l.target === 'object' ? l.target.id : l.target;
                if (subNodesMap.has(s) && subNodesMap.has(t)) {
                    subLinksSet.add(l);
                }
            });
        });
        
        return {
            nodes: Array.from(subNodesMap.values()).map(n => ({ ...n, pubType: n.pubType })),
            links: Array.from(subLinksSet).map(l => ({ ...l }))
        };
    }
}
