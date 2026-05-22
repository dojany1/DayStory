import { describe, expect, it } from 'vitest';
import { escapeHtml, sanitizeUrl } from '../src/js/utils/sanitize.js';

describe('Wave 4 — sanitizeUrl 화이트리스트 강화', () => {
  /* 통과해야 하는 (안전한) URL */
  it.each([
    ['https://example.com', 'https://example.com'],
    ['http://example.com/path?q=1', 'http://example.com/path?q=1'],
    ['mailto:test@example.com', 'mailto:test@example.com'],
    ['tel:+82-10-1234-5678', 'tel:+82-10-1234-5678'],
    ['/relative/path', '/relative/path'],
    ['./relative', './relative'],
    ['#anchor', '#anchor'],
  ])('안전한 URL %s 를 그대로 반환', (input, expected) => {
    expect(sanitizeUrl(input)).toBe(expected);
  });

  /* 차단해야 하는 (위험한) URL — 빈 문자열 반환 */
  it.each([
    ['javascript:alert(1)'],
    ['JavaScript:alert(1)'],            /* 대소문자 변형 */
    ['  javascript:alert(1)'],          /* 앞쪽 공백 */
    ['java\tscript:alert(1)'],          /* 탭 우회 */
    ['java\nscript:alert(1)'],          /* 개행 우회 */
    ['data:text/html,<script>alert(1)</script>'],
    ['vbscript:msgbox(1)'],
    ['VBScript:msgbox(1)'],
    ['file:///etc/passwd'],
  ])('위험한 URL %s 차단', (input) => {
    expect(sanitizeUrl(input)).toBe('');
  });

  it('null/undefined/빈 문자열은 빈 문자열 반환', () => {
    expect(sanitizeUrl(null)).toBe('');
    expect(sanitizeUrl(undefined)).toBe('');
    expect(sanitizeUrl('')).toBe('');
  });
});

describe('escapeHtml — 회귀 보호', () => {
  it('스크립트 태그를 이스케이프', () => {
    expect(escapeHtml('<script>alert("XSS")</script>')).toBe(
      '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;'
    );
  });

  it('null/undefined → 빈 문자열', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });
});
