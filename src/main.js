/* ============================================
   DayStory — Main Entry Point
   ============================================ */

/* Styles */
import './css/variables.css';
import './css/base.css';
import './css/components.css';
import './css/pages.css';

/* Core modules */
import { registerRoute, initRouter, navigate, setBeforeNavigate } from './js/router.js';
import { getState, setState, applyTheme } from './js/state.js';
import { supabase } from './js/supabase.js';

/* Pages */
import { renderLogin, renderSignup } from './js/pages/login.js';
import { renderHome } from './js/pages/home.js';
import { renderDetail } from './js/pages/detail.js';
import { renderArchive } from './js/pages/archive.js';
import { renderSearch } from './js/pages/search.js';
import { renderSettings } from './js/pages/settings.js';
import { renderDonate } from './js/pages/donate.js';
import { renderReport } from './js/pages/report.js';
import { renderEditor } from './js/pages/editor.js';

/* ---- Register Routes ---- */
registerRoute('/login', () => renderLogin());
registerRoute('/signup', () => renderSignup());
registerRoute('/home', () => renderHome());
registerRoute('/detail/:id', (params) => renderDetail(params));
registerRoute('/archive', () => renderArchive());
registerRoute('/search', () => renderSearch());
registerRoute('/settings', () => renderSettings());
registerRoute('/donate', () => renderDonate());
registerRoute('/report', () => renderReport());
registerRoute('/editor', () => renderEditor());

/* ---- Auth Guard ---- */
const PUBLIC_ROUTES = ['/login', '/signup'];
setBeforeNavigate((path) => {
  const user = getState('user');
  if (!user && !PUBLIC_ROUTES.includes(path)) {
    navigate('/login');
    return false;
  }
  /* Show/hide nav */
  const nav = document.getElementById('bottom-nav');
  if (nav) {
    const hideNav = PUBLIC_ROUTES.includes(path) || path.startsWith('/detail/') || path === '/donate' || path === '/report';
    nav.style.display = hideNav ? 'none' : 'flex';
  }
  return true;
});

/* ---- Listen for auth state changes ---- */
supabase.auth.onAuthStateChange(async (event, session) => {
  if (event === 'SIGNED_IN' && session) {
    setState('user', session.user);
    /* Fetch profile */
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();
    if (profile) {
      setState('profile', profile);
      /* Apply saved preferences */
      if (profile.theme) setState('theme', profile.theme);
      if (profile.font_size) setState('fontSize', profile.font_size);
    }
    document.getElementById('bottom-nav').style.display = 'flex';
    if (window.location.hash === '#/login' || window.location.hash === '#/signup' || !window.location.hash) {
      navigate('/home');
    }
  } else if (event === 'SIGNED_OUT') {
    setState('user', null);
    setState('profile', null);
    document.getElementById('bottom-nav').style.display = 'none';
    navigate('/login');
  }
});

/* ---- App Init ---- */
async function initApp() {
  applyTheme();

  /* Check for existing session */
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    setState('user', session.user);
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();
    if (profile) {
      setState('profile', profile);
      if (profile.theme) setState('theme', profile.theme);
      if (profile.font_size) setState('fontSize', profile.font_size);
    }
  }

  /* Splash screen → hide after load bar animation */
  const splash = document.getElementById('splash-screen');
  const appContainer = document.getElementById('app-container');

  setTimeout(() => {
    appContainer.style.display = 'flex';
    splash.classList.add('hide');
    splash.addEventListener('transitionend', () => splash.remove());

    /* Start router */
    initRouter();
  }, 1800);
}

/* Start on DOM ready */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
