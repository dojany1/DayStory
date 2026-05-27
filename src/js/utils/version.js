/* =====================================================================
   version.js — 앱 버전 SemVer 비교 유틸 (순수 함수)
   =====================================================================
   사용처: src/js/services/appUpdate.js 의 업데이트 알림 판단.
   "1.3.5" < "1.3.6" 같은 정식 릴리스 비교만 정확히 다루며,
   pre-release / build metadata 의 정밀 비교는 의도적으로 건너뛴다
   (사용자 노출용 알림은 정식 버전 차이로만 판단).
   ===================================================================== */

/**
 * parseVersion — "v1.3.6-beta+sha.123" → [1, 3, 6]
 * 숫자가 아닌 segment 는 0 으로, 누락된 trailing segment 도 0 으로.
 * @param {unknown} input
 * @returns {number[]}  최소 1개 segment 보장
 */
function parseVersion(input) {
  const raw = typeof input === 'string' ? input.trim() : '';
  if (!raw) return [0];
  /* leading v / V 제거, pre-release(-) / build(+) suffix 잘라냄 */
  const numeric = raw.replace(/^[vV]/, '').split(/[-+]/)[0];
  const parts = numeric.split('.').map((seg) => {
    const n = parseInt(seg, 10);
    return Number.isFinite(n) ? n : 0;
  });
  return parts.length > 0 ? parts : [0];
}

/**
 * compareVersions — 두 버전 문자열을 SemVer 숫자 prefix 기준으로 비교한다.
 * @param {string} a
 * @param {string} b
 * @returns {number}  a < b 면 음수, a > b 면 양수, 같으면 0
 */
export function compareVersions(a, b) {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * isUpdateAvailable — 사용자에게 업데이트 알림을 띄울지 판단한다.
 * current 와 latest 둘 다 유효한 비-zero 버전 문자열일 때만 true 가능.
 * latest 가 빈 문자열/숫자 0 segments 만으로 파싱되면 신뢰할 수 없다고 보고 false.
 * @param {string|null|undefined} current  현재 설치된 버전
 * @param {string|null|undefined} latest   Remote Config 의 최신 버전
 * @returns {boolean}
 */
export function isUpdateAvailable(current, latest) {
  if (typeof current !== 'string' || typeof latest !== 'string') return false;
  if (!current.trim() || !latest.trim()) return false;
  const pl = parseVersion(latest);
  if (pl.every((n) => n === 0)) return false; /* "not-a-version" 같은 무의미 값 차단 */
  return compareVersions(current, latest) < 0;
}
