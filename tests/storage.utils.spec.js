import { describe, expect, it } from 'vitest';
import { isFirebaseStorageUrl } from '../src/js/utils/storage.js';

describe('Wave 5 — isFirebaseStorageUrl 헬퍼 추출', () => {
  it.each([
    'https://firebasestorage.googleapis.com/v0/b/daystory.appspot.com/o/users%2Fabc%2Fimg.webp?alt=media',
    'https://daystory.firebasestorage.app/users/abc/img.webp',
    'https://my-app.firebasestorage.app/path/to/file.png',
  ])('정상 Firebase Storage URL %s → true', (url) => {
    expect(isFirebaseStorageUrl(url)).toBe(true);
  });

  it.each([
    'https://attacker.com/firebasestorage/x.jpg',          /* 이전 includes() 위양성 */
    'https://attacker.com/?host=firebasestorage.app',
    'https://my.firebasestorage.app.evil.com/img.png',     /* 도메인 끝 매칭이 아니면 통과시키던 케이스 */
    'https://example.com/users/abc/img.webp',
    '',
    null,
    undefined,
    'not a url',
    123,
  ])('비정상/외부 URL %s → false', (url) => {
    expect(isFirebaseStorageUrl(url)).toBe(false);
  });
});
