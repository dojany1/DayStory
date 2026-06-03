/* =====================================================================
   tests/setup.js — jsdom 테스트 환경 보강 (vitest setupFiles)
   =====================================================================
   문제: Node 22+ 는 실험적 네이티브 Web Storage 를 도입하면서
   `globalThis.localStorage` 를 `--localstorage-file` 없이는 undefined 로
   노출한다. 이 전역이 jsdom 이 제공하는 window.localStorage 를 가려서
   소스의 `localStorage.getItem(...)` 가 "Cannot read properties of
   undefined" 로 터진다(테스트 ~25건 실패).

   해결: 각 테스트 파일 환경에 인메모리 Storage 를 명시적으로 설치한다.
   추가로 @capacitor/haptics 웹 폴백이 jsdom 에 vibrate API 가 없어
   reject(unhandled rejection)하는 것을 navigator.vibrate 스텁으로 막는다.
   ===================================================================== */

/* W3C Storage 호환 인메모리 구현 */
class MemoryStorage {
  #store = new Map();
  get length() { return this.#store.size; }
  key(i) { return Array.from(this.#store.keys())[i] ?? null; }
  getItem(k) { const key = String(k); return this.#store.has(key) ? this.#store.get(key) : null; }
  setItem(k, v) { this.#store.set(String(k), String(v)); }
  removeItem(k) { this.#store.delete(String(k)); }
  clear() { this.#store.clear(); }
}

function installStorage(name) {
  const storage = new MemoryStorage();
  const define = (target) => {
    try {
      Object.defineProperty(target, name, { value: storage, configurable: true, writable: true });
    } catch {
      try { target[name] = storage; } catch { /* 무시 */ }
    }
  };
  define(globalThis);
  if (typeof window !== 'undefined' && window !== globalThis) define(window);
}

installStorage('localStorage');
installStorage('sessionStorage');

/* @capacitor/haptics web: navigator.vibrate 부재 시 reject → unhandled rejection 방지 */
if (typeof navigator !== 'undefined' && typeof navigator.vibrate !== 'function') {
  try {
    Object.defineProperty(navigator, 'vibrate', { value: () => true, configurable: true });
  } catch { /* 무시 */ }
}
