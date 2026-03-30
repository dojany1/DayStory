/* ============================================
   DayStory — State Manager (Pub/Sub)
   ============================================ */

const state = {
  user: null,
  profile: null,
  todayStory: null,
  currentStory: null,
  stories: [],
  bookmarks: [],
  isLoading: false,
  theme: localStorage.getItem('ds_theme') || 'system',
  fontSize: localStorage.getItem('ds_fontSize') || 'medium',
};

const listeners = new Map();

export function getState(key) {
  return key ? state[key] : { ...state };
}

export function setState(key, value) {
  const old = state[key];
  state[key] = value;
  if (listeners.has(key)) {
    listeners.get(key).forEach(fn => fn(value, old));
  }
  /* Persist theme/fontSize */
  if (key === 'theme') localStorage.setItem('ds_theme', value);
  if (key === 'fontSize') localStorage.setItem('ds_fontSize', value);
}

export function subscribe(key, fn) {
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key).add(fn);
  return () => listeners.get(key).delete(fn);
}

/* Apply theme & font-size to document */
export function applyTheme() {
  const t = state.theme;
  const root = document.documentElement;
  if (t === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  } else {
    root.setAttribute('data-theme', t);
  }
  root.setAttribute('data-font-size', state.fontSize);
}

/* Init */
applyTheme();
subscribe('theme', applyTheme);
subscribe('fontSize', applyTheme);
