export function getSavedAppearance() {
  try {
    const saved = localStorage.getItem('ssc_appearance');
    return saved ? JSON.parse(saved) : { theme: 'cyberpunk', accent: 'sky', density: 'comfortable' };
  } catch {
    return { theme: 'cyberpunk', accent: 'sky', density: 'comfortable' };
  }
}

export function applyAppearance(settings) {
  const current = settings || getSavedAppearance();
  const root = document.documentElement;
  const body = document.body;

  // Clear previous theme, accent, and density classes
  const themeClasses = ['theme-cyberpunk', 'theme-midnight', 'theme-obsidian', 'theme-emerald', 'theme-white'];
  const accentClasses = ['accent-sky', 'accent-emerald', 'accent-amber', 'accent-indigo', 'accent-rose'];
  const densityClasses = ['density-comfortable', 'density-compact'];

  [...themeClasses, ...accentClasses, ...densityClasses].forEach(c => {
    root.classList.remove(c);
    body.classList.remove(c);
  });

  // Apply new classes
  const activeTheme = `theme-${current.theme || 'cyberpunk'}`;
  const activeAccent = `accent-${current.accent || 'sky'}`;
  const activeDensity = `density-${current.density || 'comfortable'}`;

  root.classList.add(activeTheme, activeAccent, activeDensity);
  body.classList.add(activeTheme, activeAccent, activeDensity);

  if (settings) {
    localStorage.setItem('ssc_appearance', JSON.stringify(settings));
    window.dispatchEvent(new CustomEvent('ssc-appearance-changed', { detail: settings }));
  }
}
