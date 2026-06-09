/* =====================================================================
   inquiries.js — 문의/건의 서비스 (UGC 신고 기능의 뼈대)
   =====================================================================
   사용자가 버그·오탈자·기능 제안·기타 의견을 보낼 수 있는 기능입니다.
   Firestore 의 inquiries 컬렉션에 저장하며, 다음 메타데이터를 자동 수집합니다.
     - userId      : 로그인 사용자 uid (getState('user').id)
     - appVersion  : package.json 버전
     - locale      : 현재 앱 언어 (getCurrentLang)
     - platform/os : Capacitor Device API (ios/android/web + osVersion/model 등)
     - entryCardId : 카드(상세)에서 진입한 경우의 스토리 ID

   도배 방지: localStorage 기반으로 최근 1시간 내 3회까지만 제출 허용.

   아키텍처 규칙(CLAUDE.md): Firestore 접근은 service 레이어에서만 한다.
   ===================================================================== */

import { db } from './firebase.js';
import { getState } from '../state.js';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { withTimeout as withTimeoutBase } from '../utils/timeout.js';
import { getCurrentLang } from '../i18n/index.js';
import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';
import pkg from '../../../package.json';

/* 문의 유형 — UI 드롭다운과 동일 순서 (버그/오탈자/기능 제안/기타) */
export const INQUIRY_TYPES = ['bug', 'typo', 'feature', 'etc'];

/* ── 도배 방지 쿨타임 (localStorage) ── */
const COOLDOWN_KEY = 'daystory:inquiry-log';
const COOLDOWN_WINDOW_MS = 60 * 60 * 1000; /* 1시간 */
const COOLDOWN_MAX = 3;                     /* 윈도우 내 최대 제출 횟수 */

function withTimeout(promise, ms = 8000) {
  return withTimeoutBase(promise, ms, 'inquiry-timeout');
}

function readLog() {
  try {
    const arr = JSON.parse(localStorage.getItem(COOLDOWN_KEY) || '[]');
    return Array.isArray(arr) ? arr.filter((n) => typeof n === 'number') : [];
  } catch {
    return [];
  }
}

/* 1시간 윈도우를 벗어난 오래된 타임스탬프를 걸러낸 목록 */
function prunedLog(now = Date.now()) {
  return readLog().filter((ts) => now - ts < COOLDOWN_WINDOW_MS);
}

/** canSubmitInquiry — 최근 1시간 내 제출이 3회 미만이면 true */
export function canSubmitInquiry(now = Date.now()) {
  return prunedLog(now).length < COOLDOWN_MAX;
}

/** recordInquirySubmission — 제출 시각을 기록하고 오래된 항목은 정리 */
export function recordInquirySubmission(now = Date.now()) {
  const next = prunedLog(now);
  next.push(now);
  try {
    localStorage.setItem(COOLDOWN_KEY, JSON.stringify(next));
  } catch {
    /* 저장 실패는 무시 (쿨타임은 best-effort) */
  }
}

/* OS/기기 메타 수집 — Device.getInfo 실패(웹 등) 시 getPlatform 폴백 */
async function collectDeviceMeta() {
  let platform = 'web';
  try {
    platform = (Capacitor.getPlatform && Capacitor.getPlatform()) || 'web';
  } catch {
    /* noop */
  }

  const os = { operatingSystem: '', osVersion: '', model: '', manufacturer: '' };
  try {
    const info = await Device.getInfo();
    if (info) {
      platform = info.platform || platform;
      os.operatingSystem = info.operatingSystem || '';
      os.osVersion = info.osVersion || '';
      os.model = info.model || '';
      os.manufacturer = info.manufacturer || '';
    }
  } catch {
    /* 네이티브가 아니거나 조회 실패 — platform 폴백만 사용 */
  }
  return { platform, os };
}

/**
 * submitInquiry — 문의를 Firestore inquiries 컬렉션에 저장한다.
 * @param {Object} args
 * @param {string} args.type        'bug' | 'typo' | 'feature' | 'etc'
 * @param {string} args.content     사용자 입력 본문
 * @param {string} [args.entryCardId] 카드에서 진입한 경우의 스토리 ID
 * @returns {Promise<{ok:boolean, error:string|null}>}
 *   error: 'empty' | 'cooldown' | 'no-db' | 'network'
 */
export async function submitInquiry({ type, content, entryCardId } = {}) {
  const normalizedType = INQUIRY_TYPES.includes(type) ? type : 'etc';
  const text = String(content || '').trim();

  if (!text) return { ok: false, error: 'empty' };
  if (!canSubmitInquiry()) return { ok: false, error: 'cooldown' };
  if (!db) return { ok: false, error: 'no-db' };

  try {
    const user = getState('user');
    const { platform, os } = await collectDeviceMeta();

    await withTimeout(addDoc(collection(db, 'inquiries'), {
      type: normalizedType,
      content: text,                       /* raw 저장 — DOM 삽입은 하지 않음 */
      userId: user?.id || null,
      appVersion: pkg.version,
      locale: getCurrentLang(),
      platform,
      os,
      entryCardId: entryCardId || null,
      status: 'open',                      /* 추후 트리아지/신고 확장용 */
      createdAt: serverTimestamp(),
      createdAtIso: new Date().toISOString(),
    }));

    recordInquirySubmission();
    return { ok: true, error: null };
  } catch (err) {
    console.error('Inquiry submit error:', err);
    return { ok: false, error: 'network' };
  }
}
