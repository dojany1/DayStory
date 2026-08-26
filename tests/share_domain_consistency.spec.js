// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/* =====================================================================
   공유 도메인 단일 출처 검증
   ---------------------------------------------------------------------
   회귀 배경(2026-08-26): sharing.js 가 deepLink.js 와 별개로 공유 도메인을
   하드코딩하고 있었고(`https://daystory.app`), 그 도메인은 Firebase Hosting
   이 아닌 Vercel 을 가리켜 실제로 404 를 반환했다. 그 결과 buildShareUrl()
   로 만든 카드 공유 링크가 운영에서 전부 죽은 주소로 나갔다.

   딥링크(Universal Link / App Link)는 apple-app-site-association 과
   assetlinks.json 이 서빙되는 호스트에서만 앱으로 가로채지므로, 공유 URL 은
   반드시 Firebase Hosting 호스트 하나로 통일되어야 한다.

   검증 계약:
     · deepLink.js 의 SHARE_APP_DOMAIN 이 유일한 출처다.
     · sharing.js 는 자체 도메인 문자열을 갖지 않는다(상수 재하드코딩 금지).
     · Cloud Functions 의 OG ORIGIN 도 같은 호스트를 쓴다.
   ===================================================================== */

const root = resolve(import.meta.dirname, '..');
const read = (rel) => readFileSync(resolve(root, rel), 'utf8');

/* Firebase Hosting 기본 호스트 — .firebaserc 의 프로젝트와 짝을 이룬다. */
const HOSTING_DOMAIN = 'dokhu-daystory.web.app';

describe('공유 도메인 단일 출처', () => {
  it('deepLink.js 가 Firebase Hosting 호스트를 출처로 선언한다', async () => {
    const { SHARE_APP_DOMAIN, SHARE_APP_ORIGIN } = await import(
      '../src/js/utils/deepLink.js'
    );
    expect(SHARE_APP_DOMAIN).toBe(HOSTING_DOMAIN);
    expect(SHARE_APP_ORIGIN).toBe(`https://${HOSTING_DOMAIN}`);
  });

  it('buildShareUrl 이 딥링크와 같은 오리진을 사용한다', async () => {
    const { SHARE_APP_ORIGIN } = await import('../src/js/utils/deepLink.js');
    const { buildShareUrl } = await import('../src/js/services/sharing.js');

    expect(buildShareUrl('abc123')).toBe(`${SHARE_APP_ORIGIN}/share/abc123`);
    /* id 가 없으면 오리진 자체로 폴백한다 */
    expect(buildShareUrl()).toBe(SHARE_APP_ORIGIN);
  });

  it('buildShareUrl 이 storyId 를 URL 인코딩한다', async () => {
    const { SHARE_APP_ORIGIN } = await import('../src/js/utils/deepLink.js');
    const { buildShareUrl } = await import('../src/js/services/sharing.js');

    expect(buildShareUrl('a b/c')).toBe(`${SHARE_APP_ORIGIN}/share/a%20b%2Fc`);
  });

  it('sharing.js 가 공유 도메인을 재선언하지 않고 deepLink 에서 받아온다', () => {
    const src = read('src/js/services/sharing.js');

    /* 자체 도메인 상수를 선언하는 순간 단일 출처가 깨진다(이번 회귀의 원인). */
    expect(src).not.toMatch(/const\s+SHARE_DOMAIN\s*=/);
    /* 오리진은 import 로만 받는다. */
    expect(src).toMatch(
      /import\s*\{[^}]*\bSHARE_APP_ORIGIN\b[^}]*\}\s*from\s*['"]\.\.\/utils\/deepLink\.js['"]/,
    );
  });

  it('미배포 도메인 daystory.app 이 공유 URL 호스트로 남아 있지 않다', () => {
    /* 호스트로 쓰인 경우(//daystory.app)만 잡는다. Android 패키지명
       `com.daystory.app` 은 정상 값이라 걸러선 안 된다. */
    const asHost = /https?:\/\/(www\.)?daystory\.app/;
    for (const rel of [
      'src/js/services/sharing.js',
      'src/js/utils/deepLink.js',
      'functions/lib/og.js',
    ]) {
      expect(read(rel), `${rel} 에 daystory.app 호스트 잔존`).not.toMatch(asHost);
    }
  });

  it('Cloud Functions OG ORIGIN 이 같은 호스트를 가리킨다', () => {
    const og = read('functions/lib/og.js');
    expect(og).toMatch(
      new RegExp(`ORIGIN\\s*=\\s*['"\`]https://${HOSTING_DOMAIN.replace(/\./g, '\\.')}['"\`]`),
    );
  });

  it('app-ads.txt 가 AdMob 게시자 ID 를 IAB 형식으로 선언한다', () => {
    const txt = read('public/app-ads.txt');
    /* 네이티브 앱 ID(ca-app-pub-<pub>~<app>) 와 같은 게시자 번호여야 한다. */
    const manifest = read('android/app/src/main/AndroidManifest.xml');
    const pub = manifest.match(/ca-app-pub-(\d+)~/)?.[1];
    expect(pub, 'AndroidManifest 에서 게시자 ID 추출 실패').toBeTruthy();

    const line = txt
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l && !l.startsWith('#'));
    expect(line).toBe(`google.com, pub-${pub}, DIRECT, f08c47fec0942fa0`);
  });
});
