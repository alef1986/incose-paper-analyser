<!-- src/views/SingleAnalyzer.vue -->
<template>
  <div class="analyzer-container">
    <ForceGraph3D />
    <EgoPanel />
    <MetricsPanel />
    <NodeInfoModal /> <!-- Внедряем меню поверх графа -->
    
    <div id="empty-state" v-if="!store.focusedNodeId && !store.isLoaded">
      Upload JSON and select a node from the right panel to build its cluster (Radius = 1).
    </div>
  </div>
</template>

<script setup>
import { useGraphStore } from '../store/graphStore.js'
import ForceGraph3D from '../components/visualization/ForceGraph3D.vue'
import EgoPanel from '../components/panels/EgoPanel.vue'
import MetricsPanel from '../components/panels/MetricsPanel.vue'
import NodeInfoModal from '../components/modals/NodeInfoModal.vue'

const store = useGraphStore()
</script>

<style scoped>
.analyzer-container {
  width: 100vw;
  height: 100vh;
  position: relative;
}

#empty-state {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #555566;
  font-size: 18px;
  z-index: 0;
  text-align: center;
}
.analyzer-container { width: 100vw; height: 100vh; position: relative; }
#empty-state { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: #555566; font-size: 18px; z-index: 0; text-align: center; }
</style>