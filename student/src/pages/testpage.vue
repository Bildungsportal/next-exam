<template>
      <h1 class="test-header">This is a test Page</h1>
</template>

<script lang="ts">
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'TestPage',

  data() {
    return {

    };
  },

  computed: {
  },

  methods: {
  },

  mounted() {
    console.log('🚀 Test Page component mounted');
  }
});
</script>

<style scoped>
.test-header {
  color: red;
}
</style>