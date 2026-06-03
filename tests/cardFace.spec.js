/* cardFace.spec.js — 공통 카드 마크업 빌더 + bindCardBase (3단계 리팩토링) */
import { describe, it, expect, vi } from 'vitest';
import {
  parseIsoDate,
  formatMonthNameDate,
  bodyToHtml,
  cardShell,
  cardFront,
  cardFrontTop,
  cardImageWrap,
  cardBack,
  emptyCardFace,
  cardActionButton,
  bindCardBase,
  FALLBACK_IMG,
  IMG_ONERROR,
} from '../src/js/components/cardDeck/cardFace.js';

function frag(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div;
}

describe('cardFace — helpers', () => {
  it('parseIsoDate 는 month(1-12)/day/year 를 분해한다', () => {
    expect(parseIsoDate('2026-04-24')).toMatchObject({ year: 2026, month: 4, day: 24, monthIndex: 3 });
  });

  it('formatMonthNameDate 는 "MON D, YYYY" 형식', () => {
    expect(formatMonthNameDate('2026-01-01')).toBe('JAN 1, 2026');
  });

  it('bodyToHtml 는 개행을 <p> 로 나누고 이스케이프한다', () => {
    const html = bodyToHtml('a\n<b>');
    expect(html).toContain('<p>a</p>');
    expect(html).toContain('&lt;b&gt;');
    expect(html).not.toContain('<b>');
  });
});

describe('cardFace — markup builders', () => {
  it('cardShell 은 flip-container > flipper 구조 + flipperClass', () => {
    const el = frag(cardShell({ frontHtml: '<div class="front"></div>', flipperClass: 'mystory-flipper' }));
    expect(el.querySelector('.flip-container > .flipper.mystory-flipper')).not.toBeNull();
    expect(el.querySelector('.flipper > .front')).not.toBeNull();
  });

  it('cardImageWrap 은 src 이스케이프 + onerror fallback', () => {
    const el = frag(cardImageWrap({ src: 'https://x/y.png', alt: 'A', title: 'T' }));
    const img = el.querySelector('.history-card-image-wrap img');
    expect(img.getAttribute('src')).toBe('https://x/y.png');
    expect(img.getAttribute('onerror')).toContain(FALLBACK_IMG);
    expect(el.querySelector('.card-image-title').textContent).toBe('T');
  });

  it('cardFrontTop 은 연도/날짜/액션/메타 슬롯을 렌더', () => {
    const el = frag(cardFront({
      topHtml: cardFrontTop({ yearHtml: '1592', yearClass: 'mystory-card-year', dateLabel: '4. 24', actionsHtml: '<button class="card-action-btn"></button>', metaHtml: 'meta' }),
    }));
    expect(el.querySelector('.card-year.mystory-card-year').textContent).toBe('1592');
    expect(el.querySelector('.card-date').textContent).toBe('4. 24');
    expect(el.querySelector('.card-actions .card-action-btn')).not.toBeNull();
    expect(el.querySelector('.card-meta').textContent).toBe('meta');
  });

  it('cardBack 은 제목/본문/푸터 + 이스케이프', () => {
    const el = frag(cardBack({ title: '<x>', bodyHtml: '<p>b</p>', footerHtml: '<div class="back-date">d</div>' }));
    expect(el.querySelector('.back.history-card-back')).not.toBeNull();
    expect(el.querySelector('.back-title').textContent).toBe('<x>');
    expect(el.querySelector('.back-body p').textContent).toBe('b');
    expect(el.querySelector('.back-footer .back-date')).not.toBeNull();
  });

  it('emptyCardFace 는 empty-story-card + extraHtml 주입', () => {
    const el = frag(emptyCardFace({ day: 24, title: '기록 없음', dateStr: 'APR 24, 2026', extraHtml: '<button class="mystory-write-btn">w</button>', flipperClass: 'mystory-flipper' }));
    expect(el.querySelector('.flipper.mystory-flipper .front.empty-story-card')).not.toBeNull();
    expect(el.querySelector('.empty-story-day-circle').textContent).toBe('24');
    expect(el.querySelector('.mystory-write-btn')).not.toBeNull();
  });

  it('cardActionButton 은 aria-label/extraClass/dataId 를 반영', () => {
    const el = frag(cardActionButton({ ariaLabel: '공유', svg: '<svg></svg>', extraClass: 'share-my-story-btn', dataId: 's1' }));
    const btn = el.querySelector('button');
    expect(btn.classList.contains('card-action-btn')).toBe(true);
    expect(btn.classList.contains('share-my-story-btn')).toBe(true);
    expect(btn.getAttribute('aria-label')).toBe('공유');
    expect(btn.dataset.id).toBe('s1');
  });
});

describe('cardFace — bindCardBase', () => {
  function mountCard() {
    const el = frag(cardShell({
      frontHtml: cardFront({ imageHtml: cardImageWrap({ src: 'x.png', alt: 'a', title: 't' }) }),
      backHtml: cardBack({ title: 't', bodyHtml: '<p>b</p>', footerHtml: '' }),
    }));
    document.body.appendChild(el);
    return el.querySelector('.flip-container');
  }

  it('카드 클릭 시 flipped 토글', () => {
    const flipContainer = mountCard();
    const flipper = bindCardBase(flipContainer, { story: { id: 's1' } });
    expect(flipper.classList.contains('flipped')).toBe(false);
    flipper.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(flipper.classList.contains('flipped')).toBe(true);
  });

  it('ignoreSelectors 에 매칭되는 클릭은 flip 하지 않는다', () => {
    const flipContainer = mountCard();
    const flipper = bindCardBase(flipContainer, { story: { id: 's1' }, ignoreSelectors: ['.card-action-btn'] });
    const btn = flipContainer.querySelector('.card-action-btn') || (() => {
      const b = document.createElement('button'); b.className = 'card-action-btn'; flipper.appendChild(b); return b;
    })();
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(flipper.classList.contains('flipped')).toBe(false);
  });

  it('onBeforeFlip 이 false 를 반환하면 flip 을 취소(말풍선 닫기 등)', () => {
    const flipContainer = mountCard();
    const onBeforeFlip = vi.fn(() => false);
    const flipper = bindCardBase(flipContainer, { story: { id: 's1' }, onBeforeFlip });
    flipper.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onBeforeFlip).toHaveBeenCalled();
    expect(flipper.classList.contains('flipped')).toBe(false);
  });

  it('story 가 없으면 flip 하지 않는다', () => {
    const flipContainer = mountCard();
    const flipper = bindCardBase(flipContainer, { story: null });
    flipper.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(flipper.classList.contains('flipped')).toBe(false);
  });

  it('Given a touch card, when touch starts and ends, then native-like active feedback is toggled immediately', () => {
    const flipContainer = mountCard();
    const flipper = bindCardBase(flipContainer, { story: { id: 's1' } });

    flipper.dispatchEvent(new Event('touchstart', { bubbles: true, cancelable: true }));
    expect(flipper.classList.contains('active')).toBe(true);

    flipper.dispatchEvent(new Event('touchend', { bubbles: true, cancelable: true }));
    expect(flipper.classList.contains('active')).toBe(false);
  });
});
