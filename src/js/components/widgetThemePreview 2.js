export function renderWidgetThemeOption(theme, currentTheme) {
  const isDark = theme === 'dark';
  const label = isDark ? '다크' : '화이트';
  const activeClass = currentTheme === theme ? ' active' : '';

  return `
    <div class="widget-theme-option${activeClass}" data-widget-theme="${theme}">
      <div class="widget-theme-preview widget-theme-preview-${theme}" aria-hidden="true">
        <div class="widget-preview-top">
          <div class="widget-preview-date">
            <span class="widget-preview-weekday">TUE</span>
            <span class="widget-preview-day">28</span>
            <span class="widget-preview-month">APRIL 2026</span>
          </div>
          <span class="widget-preview-envelope">
            <svg class="widget-preview-envelope-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4.5 6.5h15a1.5 1.5 0 0 1 1.5 1.5v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5V8a1.5 1.5 0 0 1 1.5-1.5Z"></path>
              <path d="m4 7 8 6 8-6"></path>
            </svg>
            <span class="widget-preview-dot"></span>
          </span>
        </div>
        <div class="widget-preview-pen-button">
          <svg class="widget-preview-pen-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 20l5-1.5L19 8.5 15.5 5 5.5 15 4 20Z"></path>
            <path d="M14 6.5 17.5 10"></path>
            <path d="M5 18.5h4"></path>
          </svg>
        </div>
      </div>
      <div class="theme-option-label">${label}</div>
    </div>
  `;
}
