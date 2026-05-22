import { describe, expect, it } from 'vitest';
import { withTimeout } from '../src/js/utils/timeout.js';

describe('Wave 5 — withTimeout 헬퍼 추출', () => {
  it('promise 가 ms 안에 resolve 되면 그 값을 반환', async () => {
    const result = await withTimeout(Promise.resolve('ok'), 200);
    expect(result).toBe('ok');
  });

  it('promise 가 ms 를 초과하면 reject (기본 메시지: 시간 초과)', async () => {
    const slow = new Promise((resolve) => setTimeout(() => resolve('late'), 100));
    await expect(withTimeout(slow, 20)).rejects.toThrow('시간 초과');
  });

  it('커스텀 message 옵션을 사용하면 그 메시지로 reject', async () => {
    const slow = new Promise((resolve) => setTimeout(() => resolve('late'), 100));
    await expect(withTimeout(slow, 20, '네트워크가 너무 느립니다')).rejects.toThrow(
      '네트워크가 너무 느립니다'
    );
  });

  it('원본 promise 가 reject 하면 그 에러를 그대로 전파', async () => {
    const bad = Promise.reject(new Error('inner'));
    await expect(withTimeout(bad, 200)).rejects.toThrow('inner');
  });
});
