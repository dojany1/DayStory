import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  navigateMock,
  showToastMock,
  setStateMock,
  signInWithEmailAndPasswordMock,
  signInWithPopupMock,
  signInWithCredentialMock,
  fetchSignInMethodsForEmailMock,
  sendPasswordResetEmailMock,
  getDocMock,
  setDocMock,
  docMock,
} = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  showToastMock: vi.fn(),
  setStateMock: vi.fn(),
  signInWithEmailAndPasswordMock: vi.fn(),
  signInWithPopupMock: vi.fn(),
  signInWithCredentialMock: vi.fn(),
  fetchSignInMethodsForEmailMock: vi.fn(),
  sendPasswordResetEmailMock: vi.fn(),
  getDocMock: vi.fn(),
  setDocMock: vi.fn(),
  docMock: vi.fn(),
}));

vi.mock('../src/js/router.js', () => ({
  navigate: navigateMock,
}));

vi.mock('../src/js/components/toast.js', () => ({
  showToast: showToastMock,
}));

vi.mock('../src/js/state.js', () => ({
  setState: setStateMock,
}));

vi.mock('../src/js/firebase.js', () => ({
  auth: { currentUser: null },
  db: {},
}));

vi.mock('firebase/auth', () => {
  class GoogleAuthProviderMock {
    static PROVIDER_ID = 'google.com';
    static credential = vi.fn(() => ({ providerId: 'google.com' }));
  }

  return {
    signInWithEmailAndPassword: signInWithEmailAndPasswordMock,
    createUserWithEmailAndPassword: vi.fn(),
    signInWithPopup: signInWithPopupMock,
    GoogleAuthProvider: GoogleAuthProviderMock,
    sendPasswordResetEmail: sendPasswordResetEmailMock,
    signInWithCredential: signInWithCredentialMock,
    fetchSignInMethodsForEmail: fetchSignInMethodsForEmailMock,
  };
});

vi.mock('firebase/firestore', () => ({
  doc: docMock,
  getDoc: getDocMock,
  setDoc: setDocMock,
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn(() => false),
  },
}));

vi.mock('@capacitor-firebase/authentication', () => ({
  FirebaseAuthentication: {
    signInWithGoogle: vi.fn(),
  },
}));

const { renderLogin } = await import('../src/js/pages/login.js');

async function flushLogin() {
  await Promise.resolve();
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 0));
  await Promise.resolve();
}

describe('Login page', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="bottom-nav" style="display:none"></div>';
    sessionStorage.clear();

    navigateMock.mockReset();
    showToastMock.mockReset();
    setStateMock.mockReset();
    signInWithEmailAndPasswordMock.mockReset();
    signInWithPopupMock.mockReset();
    signInWithCredentialMock.mockReset();
    fetchSignInMethodsForEmailMock.mockReset();
    sendPasswordResetEmailMock.mockReset();
    getDocMock.mockReset();
    setDocMock.mockReset();
    docMock.mockReset();

    docMock.mockReturnValue({ path: 'profiles/google-1' });
    getDocMock.mockResolvedValue({
      exists: () => false,
      data: () => ({}),
    });
    setDocMock.mockResolvedValue(undefined);
  });

  it('Given a Google-only account is submitted through the normal login form, when password auth fails, then Google auth completes the same login flow', async () => {
    signInWithEmailAndPasswordMock.mockRejectedValue({ code: 'auth/invalid-credential', message: 'invalid credential' });
    fetchSignInMethodsForEmailMock.mockResolvedValue(['google.com']);
    signInWithPopupMock.mockResolvedValue({
      user: {
        uid: 'google-1',
        email: 'ldj729@gmail.com',
        displayName: 'Admin',
        photoURL: '',
      },
    });

    const page = renderLogin();
    document.body.appendChild(page);
    await flushLogin();

    page.querySelector('#login-email').value = 'ldj729@gmail.com';
    page.querySelector('#login-password').value = 'typed-google-password';
    page.querySelector('#login-form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await flushLogin();
    await flushLogin();

    expect(signInWithPopupMock).toHaveBeenCalledTimes(1);
    expect(setStateMock).toHaveBeenCalledWith('user', expect.objectContaining({
      id: 'google-1',
      email: 'ldj729@gmail.com',
    }));
    expect(setDocMock).toHaveBeenCalledWith(
      { path: 'profiles/google-1' },
      expect.objectContaining({ role: 'editor' }),
      { merge: true },
    );
    expect(setStateMock).toHaveBeenCalledWith('profile', expect.objectContaining({ role: 'editor' }));
    expect(navigateMock).toHaveBeenCalledWith('/editorstory');
  });
});
