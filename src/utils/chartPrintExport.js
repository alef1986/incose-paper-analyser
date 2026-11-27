import * as echarts from 'echarts'

/**
 * High-contrast academic print palette for publication figures on white paper.
 */
export const PRINT_DOMAIN_COLORS = {
  'Physical Sciences': '#0284c7',
  'Formal Sciences': '#7c3aed',
  'Social Sciences': '#d97706',
  'Life Sciences': '#16a34a',
  'Health Sciences': '#dc2626'
}

export const PRINT_DEFAULT_PALETTE = [
  '#0284c7',
  '#16a34a',
  '#d97706',
  '#dc2626',
  '#7c3aed',
  '#0d9488',
  '#c2410c',
  '#4f46e5',
  '#be123c'
]

/**
 * Renders an ECharts option in an offscreen canvas container at ~300 DPI (pixelRatio: 3)
 * on a pure white background and triggers a PNG download without flickering the live UI.
 *
 * @param {Object} params
 * @param {Object} params.option - ECharts option already styled for Paper Mode (light).
 * @param {string} params.filename - Output filename (.png appended if missing).
 * @param {number} [params.width=1200] - Logical CSS width in px.
 * @param {number} [params.height=640] - Logical CSS height in px.
 * @param {number} [params.pixelRatio=3] - Resolution multiplier (3 => 3600px wide).
 * @param {string} [params.title=''] - Optional figure title baked into the PNG.
 * @param {string} [params.subtitle=''] - Optional scope subtitle (journals / taxonomy / lens).
 */
export function exportEChartForPrint({
  option,
  filename = 'incose_figure_300dpi.png',
  width = 1200,
  height = 640,
  pixelRatio = 3,
  title = '',
  subtitle = ''
}) {
  if (!option) return

  const container = document.createElement('div')
  container.style.position = 'fixed'
  container.style.left = '-99999px'
  container.style.top = '-99999px'
  container.style.width = `${width}px`
  container.style.height = `${height}px`
  container.style.background = '#ffffff'
  container.style.pointerEvents = 'none'
  document.body.appendChild(container)

  let offscreenChart = null
  try {
    offscreenChart = echarts.init(container, null, {
      renderer: 'canvas',
      width,
      height
    })

    const printOption = {
      ...option,
      animation: false,
      backgroundColor: '#ffffff'
    }

    if (title) {
      const extraTop = subtitle ? 56 : 38
      const existingGrid = Array.isArray(printOption.grid)
        ? printOption.grid[0]
        : (printOption.grid || {})
      const currentTop = typeof existingGrid.top === 'number' ? existingGrid.top : 48

      printOption.grid = {
        ...existingGrid,
        top: currentTop + extraTop
      }

      if (
        printOption.legend &&
        typeof printOption.legend === 'object' &&
        !Array.isArray(printOption.legend)
      ) {
        const currentLegendTop =
          typeof printOption.legend.top === 'number' ? printOption.legend.top : 8
        printOption.legend = {
          ...printOption.legend,
          top: currentLegendTop + extraTop
        }
      }

      if (Array.isArray(printOption.graphic)) {
        printOption.graphic = printOption.graphic.map(g => {
          if (g && typeof g.top === 'number') {
            return { ...g, top: g.top + extraTop }
          }
          return g
        })
      }

      printOption.title = {
        text: title,
        subtext: subtitle || '',
        left: 'center',
        top: 12,
        textStyle: {
          color: '#111827',
          fontSize: 16,
          fontWeight: 'bold',
          fontFamily: 'Segoe UI, Arial, sans-serif'
        },
        subtextStyle: {
          color: '#4b5563',
          fontSize: 11,
          fontFamily: 'Segoe UI, Arial, sans-serif'
        },
        itemGap: 4
      }
    }

    offscreenChart.setOption(printOption, true)

    const dataUrl = offscreenChart.getDataURL({
      type: 'png',
      pixelRatio,
      backgroundColor: '#ffffff',
      excludeComponents: ['toolbox']
    })

    const safeName = filename.endsWith('.png') ? filename : `${filename}.png`
    const link = document.createElement('a')
    link.href = dataUrl
    link.download = safeName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  } finally {
    if (offscreenChart) {
      offscreenChart.dispose()
    }
    if (container.parentNode) {
      container.parentNode.removeChild(container)
    }
  }
}
