/*
 * Pose le thème (clair/sombre) avant le premier rendu pour éviter tout
 * « flash » de mauvaise couleur. Script classique chargé de façon synchrone
 * dans <head> : la CSP interdit les scripts en ligne.
 */
(function bootstrapTheme() {
  var STORAGE_KEY = 'lynaqe.theme';
  var stored = null;
  try {
    stored = window.localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    stored = null;
  }

  var prefersDark =
    window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  var theme = stored === 'light' || stored === 'dark' ? stored : prefersDark ? 'dark' : 'light';

  document.documentElement.setAttribute('data-theme', theme);
})();
