<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import { useLogsStore } from '@/stores'

const { t } = useI18n()
const logsStore = useLogsStore()
</script>

<template>
  <div class="logs">
    <Empty v-if="logsStore.isEmpty" :description="t('home.overview.noLogs')" style="flex: 1" />
    <template v-else>
      <div v-for="(log, i) in logsStore.kernelLogs" :key="i" class="log">
        {{ log }}
      </div>
    </template>
  </div>
</template>

<style lang="less" scoped>
.logs {
  display: flex;
  flex-direction: column;
  height: 100%;

  .log {
    font-size: 12px;
    padding: 2px 4px;
    margin: 4px 0;
    background: var(--card-bg);
  }
}
</style>
