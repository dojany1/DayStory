import { afterEach, describe, expect, it, vi } from 'vitest';

/* =====================================================================
   functions/lib/accountPurge.js — 탈퇴 유예 만료 계정 완전 삭제 계약 테스트
   ---------------------------------------------------------------------
   스케줄러(purgePendingDeletions)가 사용하는 Admin SDK 삭제 로직의 계약을
   고정한다. 실제 Admin SDK 대신 주입 mock 으로 순서/대상만 검증한다.
   ===================================================================== */

import {
  USER_FILTERED_COLLECTIONS,
  purgeStorage,
  purgeFirestore,
  purgeAndDeleteAccount,
} from '../functions/lib/accountPurge.js';

afterEach(() => vi.restoreAllMocks());

function makeDb(docsByCollection = {}) {
  const deletedDocs = [];
  const batchDeletes = [];
  let commits = 0;
  const db = {
    doc: vi.fn(() => ({ delete: vi.fn(async () => { deletedDocs.push('profile'); }) })),
    collection: vi.fn((name) => ({
      where: vi.fn(() => ({
        get: vi.fn(async () => ({
          docs: (docsByCollection[name] || []).map((id) => ({ ref: { id } })),
        })),
      })),
    })),
    batch: vi.fn(() => ({
      delete: vi.fn((ref) => batchDeletes.push(ref.id)),
      commit: vi.fn(async () => { commits += 1; }),
    })),
  };
  return { db, deletedDocs, batchDeletes, get commits() { return commits; } };
}

describe('USER_FILTERED_COLLECTIONS — uid 소유 컬렉션 계약', () => {
  it('userStories(uid) 와 bookmarks(user_id) 를 대상으로 한다', () => {
    expect(USER_FILTERED_COLLECTIONS).toEqual([
      { name: 'userStories', field: 'uid' },
      { name: 'bookmarks', field: 'user_id' },
    ]);
  });
});

describe('purgeFirestore', () => {
  it('profiles 문서를 삭제하고 소유 컬렉션 문서를 배치로 삭제한다', async () => {
    const { db, deletedDocs, batchDeletes } = makeDb({
      userStories: ['a', 'b'],
      bookmarks: ['c'],
    });
    await purgeFirestore(db, 'uid1');
    expect(deletedDocs).toEqual(['profile']);
    expect(batchDeletes).toEqual(['a', 'b', 'c']); // 2개 컬렉션 문서 모두
  });

  it('uid 가 없으면 아무것도 하지 않는다', async () => {
    const { db, deletedDocs } = makeDb();
    await purgeFirestore(db, '');
    expect(deletedDocs).toEqual([]);
  });
});

describe('purgeStorage', () => {
  it('users/{uid}/ prefix 로 deleteFiles 를 호출한다', async () => {
    const bucket = { deleteFiles: vi.fn(async () => {}) };
    await purgeStorage(bucket, 'uid1');
    expect(bucket.deleteFiles).toHaveBeenCalledWith({ prefix: 'users/uid1/', force: true });
  });

  it('uid 가 없으면 호출하지 않는다', async () => {
    const bucket = { deleteFiles: vi.fn() };
    await purgeStorage(bucket, '');
    expect(bucket.deleteFiles).not.toHaveBeenCalled();
  });
});

describe('purgeAndDeleteAccount', () => {
  it('Storage → Firestore → Auth 순서로 삭제한다', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const order = [];
    const bucket = { deleteFiles: vi.fn(async () => { order.push('storage'); }) };
    const db = {
      doc: () => ({ delete: async () => { order.push('firestore'); } }),
      collection: () => ({ where: () => ({ get: async () => ({ docs: [] }) }) }),
      batch: () => ({ delete() {}, commit: async () => {} }),
    };
    const auth = { deleteUser: vi.fn(async () => { order.push('auth'); }) };

    await purgeAndDeleteAccount({ db, auth, bucket, uid: 'u1' });
    expect(order).toEqual(['storage', 'firestore', 'auth']);
    expect(auth.deleteUser).toHaveBeenCalledWith('u1');
  });

  it('한 단계가 실패해도 다음 단계를 계속 진행한다', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const order = [];
    const bucket = { deleteFiles: vi.fn(async () => { throw new Error('storage down'); }) };
    const db = {
      doc: () => ({ delete: async () => { order.push('firestore'); } }),
      collection: () => ({ where: () => ({ get: async () => ({ docs: [] }) }) }),
      batch: () => ({ delete() {}, commit: async () => {} }),
    };
    const auth = { deleteUser: vi.fn(async () => { order.push('auth'); }) };

    await purgeAndDeleteAccount({ db, auth, bucket, uid: 'u1' });
    /* storage 는 실패했지만 firestore·auth 는 실행된다 */
    expect(order).toEqual(['firestore', 'auth']);
  });
});
