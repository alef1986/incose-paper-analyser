// src/composables/useGhostHunter.js
import { reactive } from 'vue'
import { useGraphStore } from '../store/graphStore.js'
import { runGhostHunterAnalysis } from '../../core/algorithms/GhostHunter.js'

export function useGhostHunter() {
  const store = useGraphStore()

  const state = reactive({
    includeCore: true,
    includeEnv: true,

    isRunning: false,
    isLoading: false, // alias for isRunning
    progressPercent: 0,
    progressStatus: '',
    statusText: '', // alias for progressStatus

    candidates: [],
    errorMessage: '',
    summaryMessage: ''
  })

  const reset = () => {
    state.isRunning = false
    state.isLoading = false
    state.progressPercent = 0
    state.progressStatus = ''
    state.statusText = ''
    state.candidates = []
    state.errorMessage = ''
    state.summaryMessage = ''
  }

  const runAnalysis = async (targetNode) => {
    if (!targetNode || !targetNode.id || !store.graphModel) {
      console.error('[useGhostHunter] Target node or graph data is missing:', {
        targetNode,
        hasGraphModel: Boolean(store.graphModel)
      })
      state.errorMessage = 'Target node or graph data is missing.'
      state.isRunning = false
      state.isLoading = false
      return
    }

    reset()
    state.isRunning = true
    state.isLoading = true
    state.progressStatus = 'Initializing cross-citation analysis...'
    state.statusText = state.progressStatus

    try {
      const result = await runGhostHunterAnalysis({
        targetNode,
        graphModel: store.graphModel,
        includeCore: state.includeCore,
        includeEnv: state.includeEnv,
        onProgress: ({ percent, message }) => {
          state.progressPercent = percent
          state.progressStatus = message || ''
          state.statusText = message || ''
        }
      })

      state.candidates = result?.candidates || []
      state.summaryMessage = result?.message || ''

      if (state.candidates.length === 0 && !state.summaryMessage) {
        state.summaryMessage = 'No candidate references found.'
      }
    } catch (err) {
      console.error('[useGhostHunter] Analysis error:', err)
      state.errorMessage = err.message || 'Analysis failed due to unexpected error.'
    } finally {
      state.isRunning = false
      state.isLoading = false
    }
  }

  const applyCandidate = (candidate, onApplied = null) => {
    if (!candidate || !candidate.targetSchema) {
      state.errorMessage = 'Cannot apply: candidate does not have validated schema data.'
      return false
    }

    const currentTargetId = store.inspectedNodes[0]?.id
    if (!currentTargetId) {
      state.errorMessage = 'No node is currently inspected.'
      return false
    }

    try {
      const success = store.applyGhostHunterResult(currentTargetId, candidate.targetSchema)
      if (success) {
        if (typeof onApplied === 'function') {
          onApplied(candidate.targetSchema)
        }
        return true
      } else {
        state.errorMessage = 'Failed to apply candidate to graph state.'
        return false
      }
    } catch (err) {
      console.error('[useGhostHunter] applyCandidate error:', err)
      state.errorMessage = err.message || 'Failed to apply candidate.'
      return false
    }
  }

  state.reset = reset
  state.runAnalysis = runAnalysis
  state.applyCandidate = applyCandidate

  return state
}

