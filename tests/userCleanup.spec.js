// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  deleteDocMock, getDocsMock, writeBatchMock,
  batchDeleteMock, batchCommitMock,
  refMock, listAllMock, deleteObjectMock,
} = vi.hoisted(() => ({
  deleteDocMock: vi.fn(),
  getDocsMock: vi.fn(),
  writeBatchMock: vi.fn(),
  batchDeleteMock: vi.fn(),
  batchCommitMock: vi.fn(),
  refMock: vi.fn((_, path) => ({ fullPath: path, __type: 'ref' })),
  listAllMock: vi.fn(),
  deleteObjectMock: vi.fn(),
}));

vi.mock('../src/js/services/firebase.js', () => ({
  db: { __type: 'fake-db' },
  storage: { __type: 'fake-storage' },
  auth: null,
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_, col, id) => ({ __col: col, __id: id })),
  collection: vi.fn((_, name) => ({ __name: name })),
  query: vi.fn((...args) => ({ __query: args })),
  where: vi.fn((...args) => ({ __where: args })),
  getDocs: getDocsMock,
  deleteDoc: deleteDocMock,
  writeBatch: writeBatchMock,
}));

vi.mock('firebase/storage', () => ({
  ref: refMock,
  listAll: listAllMock,
  deleteObject: deleteObjectMock,
}));

vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: class {
    static credential() { return { __type: 'google-cred' }; }
  },
  reauthenticateWithPopup: vi.fn(),
  reauthenticateWithCredential: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => false },
}));

vi.mock('@capacitor-firebase/authentication', () => ({
  FirebaseAuthentication: { signInWithGoogle: vi.fn() },
}));

const { purgeFirestoreUserData, purgeStorageUserData, reauthenticateUser } =
  await import('../src/js/services/userCleanup.js');

beforeEach(() => {
  deleteDocMock.mockReset().mockResolvedValue();
  getDocsMock.mockReset();
  writeBatchMock.mockReset().mockReturnValue({
    delete: batchDeleteMock,
    commit: batchCommitMock,
  });
  batchDeleteMock.mockReset();
  batchCommitMock.mockReset().mockResolvedValue();
  listAllMock.mockReset();
  deleteObjectMock.mockReset().mockResolvedValue();
});

afterEach(() => vi.clearAllMocks());

describe('purgeFirestoreUserData', () => {
  it('profiles 문서를 삭제한다', async () => {
    getDocsMock.mockResolvedValue({ empty: true, docs: [] });
    await purgeFirestoreUserData('uid1');
    expect(deleteDocMock).toHaveBeenCalledTimes(1);
  });

  it('쿼리 결과가 있으면 writeBatch 로 삭제한다', async () => {
    const fakeDocs = [{ ref: { id: 'a' } }, { ref: { id: 'b' } }];
    getDocsMock.mockResolvedValue({ empty: false, docs: fakeDocs });
    await purgeFirestoreUserData('uid1');
    expect(batchDeleteMock).toHaveBeenCalledTimes(fakeDocs.length * 2); // 2 collections
    expect(batchCommitMock).toHaveBeenCalledTimes(2);
  });

  it('profiles 삭제 실패해도 컬렉션 정리를 계속한다', async () => {
    deleteDocMock.mockRejectedValueOnce(new Error('permission-denied'));
    getDocsMock.mockResolvedValue({ empty: true, docs: [] });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await purgeFirestoreUserData('uid1');
    expect(getDocsMock).toHaveBeenCalledTimes(2);
    warnSpy.mockRestore();
  });

  it('uid 없으면 아무것도 하지 않는다', async () => {
    await purgeFirestoreUserData('');
    expect(deleteDocMock).not.toHaveBeenCalled();
  });
});

describe('purgeStorageUserData', () => {
  it('users/{uid} 경로를 재귀 순회하며 파일을 삭제한다', async () => {
    listAllMock
      .mockResolvedValueOnce({
        items: [{ id: 'f1' }, { id: 'f2' }],
        prefixes: [{ fullPath: 'users/uid1/diary', __type: 'ref' }],
      })
      .mockResolvedValueOnce({ items: [{ id: 'f3' }], prefixes: [] });

    await purgeStorageUserData('uid1');

    expect(refMock).toHaveBeenCalledWith(expect.anything(), 'users/uid1');
    expect(listAllMock).toHaveBeenCalledTimes(2);
    expect(deleteObjectMock).toHaveBeenCalledTimes(3);
  });

  it('listAll 실패해도 throw 하지 않는다', async () => {
    listAllMock.mockRejectedValue(new Error('storage offline'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(purgeStorageUserData('uid1')).resolves.toBeUndefined();
    warnSpy.mockRestore();
  });

  it('uid 없으면 아무것도 하지 않는다', async () => {
    await purgeStorageUserData('');
    expect(refMock).not.toHaveBeenCalled();
  });
});

describe('reauthenticateUser', () => {
  it('user 없으면 false 반환', async () => {
    expect(await reauthenticateUser(null)).toBe(false);
  });

  it('password provider 는 false 반환 (재인증 UI 없음)', async () => {
    const user = { providerData: [{ providerId: 'password' }] };
    expect(await reauthenticateUser(user)).toBe(false);
  });
});
