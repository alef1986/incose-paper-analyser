<template>
  <router-view />
</template>

<script setup>
// Здесь будет корневой компонент, который просто отображает текущий экран (Router View)
</script>
<style>
/* Полный сброс дефолтных стилей браузера и Vite */
body, html {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  background-color: #050510;
  color: #fff;
}

/* Сброс контейнера Vue */
#app {
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  max-width: none; /* Убиваем дефолтное ограничение Vite */
  text-align: left; /* Убиваем дефолтное центрирование Vite */
}

/* Глобальные настройки скроллбаров (ранее были в <style> в HTML) */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.05); }
::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.2); border-radius: 3px; }
</style>