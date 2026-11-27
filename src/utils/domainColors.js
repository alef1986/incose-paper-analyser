/**
 * Canonical OpenAlex Domain color palette shared across
 * SunburstChart, ForceGraph3D (Macro Landscape), and BlindSpotsModal.
 *
 * Deliberately shifted away from System Role colors:
 *  - Core (INCOSE): #00bfff (Electric Cyan)
 *  - Canon: #5cb85c (Grass Green)
 *  - Environment: #64748b (Slate Gray)
 */
export const DOMAIN_COLOR_MAP = {
  'Physical Sciences': '#5b7cfa', // Indigo / Royal Blue
  'Social Sciences': '#f59e0b',   // Warm Amber
  'Life Sciences': '#14b8a6',     // Teal
  'Health Sciences': '#f43f5e',   // Coral Rose
  'Formal Sciences': '#a855f7'    // Violet
}

export const DEFAULT_DOMAIN_PALETTE = [
  '#5b7cfa',
  '#f59e0b',
  '#14b8a6',
  '#f43f5e',
  '#a855f7',
  '#3b82f6',
  '#06b6d4',
  '#ea580c',
  '#ec4899'
]

export function getCanonicalDomainColor(domainName, fallbackIndex = 0) {
  if (domainName && DOMAIN_COLOR_MAP[domainName]) {
    return DOMAIN_COLOR_MAP[domainName]
  }
  return DEFAULT_DOMAIN_PALETTE[fallbackIndex % DEFAULT_DOMAIN_PALETTE.length]
}
