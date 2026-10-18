// src/js/boot.js — classic script, loaded sync in <head>. No imports.
document.documentElement.classList.add('js');
setTimeout(() => {
  // Failsafe: if main.js failed, show all content.
  if (document.documentElement.dataset.app !== 'ready') {
    document.documentElement.classList.remove('js');
  }
}, 4000);
