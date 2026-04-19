<script setup lang="ts">
import BrowsersPage from "../operations/BrowsersPage.vue";
import ConfigurationPage from "../operations/ConfigurationPage.vue";
import SettingsPage from "../operations/SettingsPage.vue";
import SystemPage from "../operations/SystemPage.vue";
import type { OperationsPageModel } from "../operations/operationsPage";

defineProps<{
  model: OperationsPageModel;
}>();
</script>

<template>
  <BrowsersPage
    v-if="model.routeName === 'browsers'"
    :model="model"
  />
  <ConfigurationPage
    v-else-if="model.routeName === 'configuration'"
    :model="model"
  />
  <SystemPage
    v-else-if="model.routeName === 'system'"
    :model="model"
  />
  <SettingsPage
    v-else
    :model="model"
  />
</template>
