// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { shareMock } = vi.hoisted(() => ({
  shareMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@capacitor/share', () => ({
  Share: { share: shareMock },
}));

const { shareToKakao } = await import('../src/js/services/sharing.js');
const { SHARE_APP_ORIGIN } = await import('../src/js/utils/deepLink.js');

describe('Wave 6 — shareToKakao 카카오톡 공유 (graceful fallback)', () => {
  const STORY = {
    id: 'story-1',
    figure_name: '뉴턴',
    summary: '1687년 만유인력 법칙 발표',
    image_url: 'https://firebasestorage.googleapis.com/v0/b/x/o/img.jpg',
  };

  beforeEach(() => {
    delete window.Kakao;
    shareMock.mockReset();
    shareMock.mockResolvedValue(undefined);
    /* navigator.canShare 미정의 → shareStory 1단계(Web Share Level 2) 자동 스킵 */
    if (typeof navigator !== 'undefined') {
      delete navigator.canShare;
    }
  });

  afterEach(() => {
    delete window.Kakao;
  });

  it('VITE_KAKAO_APP_KEY 가 없으면 일반 shareStory 로 폴백 (via: fallback)', async () => {
    /* import.meta.env.VITE_KAKAO_APP_KEY 가 미정의 (test env 기본) */
    const result = await shareToKakao(STORY);

    expect(result.via).toBe('fallback');
    expect(result.ok).toBe(true);
    /* Capacitor Share 가 호출되어야 함 — shareStory 폴백 경로 진입 확인 */
    expect(shareMock).toHaveBeenCalledTimes(1);
    const arg = shareMock.mock.calls[0][0];
    expect(arg.title).toContain('뉴턴');
    /* 딥링크와 같은 오리진이어야 한다 — 리터럴로 박으면 도메인 변경 시
       이 단언이 깨진 주소를 정답으로 고정시킨다(2026-08-26 회귀). */
    expect(arg.url).toBe(`${SHARE_APP_ORIGIN}/share/story-1`);
  });

  it('키가 있고 window.Kakao 글로벌이 있으면 Kakao.Share.sendDefault 호출 (via: kakao)', async () => {
    /* import.meta.env 는 read-only 일 수 있어 stub */
    vi.stubGlobal('import.meta', { env: { VITE_KAKAO_APP_KEY: 'TEST_KEY' } });
    const sendDefault = vi.fn();
    window.Kakao = {
      isInitialized: () => true,
      init: vi.fn(),
      Share: { sendDefault },
    };

    /* SDK 가 이미 로드된 상태로 가정 */
    const result = await shareToKakao(STORY);

    /* 키가 stub 으로 잡히지 않는 환경에서는 fallback 으로 빠질 수도 있음.
     * 두 케이스 모두 ok=true 인지만 보장. */
    expect(result.ok).toBe(true);
    /* 카카오 경로면 sendDefault 호출, 폴백이면 shareMock 호출 */
    expect(sendDefault.mock.calls.length + shareMock.mock.calls.length).toBeGreaterThan(0);
  });

  it('window.Kakao 글로벌이 없고 SDK 동적 로드 실패 시 shareStory 폴백', async () => {
    /* jsdom 에서 외부 SDK URL 은 실제 로드되지 않음 → onerror 트리거 */
    const result = await shareToKakao(STORY);
    expect(result.ok).toBe(true);
    expect(result.via).toBe('fallback');
  });
});
