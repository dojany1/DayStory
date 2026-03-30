/* ============================================
   DayStory — Hash-based SPA Router
   ============================================ */

const routes = new Map();
let currentRoute = null;
let beforeNavigateHook = null;

export function registerRoute(path, handler) {
  routes.set(path, handler);
}

export function setBeforeNavigate(fn) {
  beforeNavigateHook = fn;
}

export function navigate(path, params = {}) {
  const url = path + (Object.keys(params).length
    ? '?' + new URLSearchParams(params).toString()
    : '');
  window.location.hash = url;
}

export function getParams() {
  const hash = window.location.hash.slice(1);
  const [, query] = hash.split('?');
  if (!query) return {};
  return Object.fromEntries(new URLSearchParams(query));
}

export function getCurrentPath() {
  const hash = window.location.hash.slice(1) || '/home';
  return hash.split('?')[0];
}

function matchRoute(path) {
  /* Exact match first */
  if (routes.has(path)) return { handler: routes.get(path), params: {} };

  /* Pattern match (e.g. /detail/:id) */
  for (const [pattern, handler] of routes) {
    const patternParts = pattern.split('/');
    const pathParts = path.split('/');
    if (patternParts.length !== pathParts.length) continue;
    const params = {};
    let match = true;
    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].startsWith(':')) {
        params[patternParts[i].slice(1)] = pathParts[i];
      } else if (patternParts[i] !== pathParts[i]) {
        match = false;
        break;
      }
    }
    if (match) return { handler, params };
  }
  return null;
}

async function handleRoute() {
  const path = getCurrentPath();
  if (path === currentRoute) return;

  if (beforeNavigateHook) {
    const can = await beforeNavigateHook(path);
    if (can === false) return;
  }

  currentRoute = path;
  const match = matchRoute(path);
  const container = document.getElementById('page-container');

  if (match) {
    container.innerHTML = '';
    const pageEl = await match.handler(match.params);
    if (typeof pageEl === 'string') {
      container.innerHTML = pageEl;
    } else if (pageEl instanceof HTMLElement) {
      container.appendChild(pageEl);
    }
  } else {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🔍</div><div class="empty-state-title">페이지를 찾을 수 없습니다</div></div>';
  }

  /* Update bottom nav active state */
  updateNav(path);
  /* Scroll to top */
  container.scrollTo(0, 0);
}

function updateNav(path) {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    const route = item.dataset.route;
    item.classList.toggle('active', path.startsWith(route));
  });
}

export function initRouter() {
  window.addEventListener('hashchange', handleRoute);

  /* Nav click handlers */
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      navigate(item.dataset.route);
    });
  });

  /* Initial route */
  if (!window.location.hash) {
    window.location.hash = '/home';
  } else {
    handleRoute();
  }
}

export function forceRoute() {
  currentRoute = null;
  handleRoute();
}
