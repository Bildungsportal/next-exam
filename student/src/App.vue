<template>
    <router-view v-slot="{ Component }">
        <component :is="Component" :key="$route.fullPath" />
    </router-view>
</template>
