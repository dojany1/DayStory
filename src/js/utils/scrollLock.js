let _lockCount = 0;

const getScrollEl = () =>
  document.querySelector('.mobile-wrapper') || document.body;

export function lockScroll() {
  _lockCount++;
  if (_lockCount === 1) {
    const el = getScrollEl();
    el.style.overflow = 'hidden';
  }
}

export function unlockScroll() {
  _lockCount = Math.max(0, _lockCount - 1);
  if (_lockCount === 0) {
    const el = getScrollEl();
    el.style.overflow = '';
  }
}
