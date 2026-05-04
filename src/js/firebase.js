/* =====================================================================
   firebase.js — Firebase 백엔드 연결 설정
   =====================================================================
   역할:
     - Firebase 앱을 초기화합니다.
     - Auth(인증)와 Firestore(데이터베이스) 인스턴스를 만들어 내보냅니다.

   보안 사항:
     - API 키 등은 .env 파일에서 불러옵니다 (VITE_ 접두사 필요).
     - .env 파일은 .gitignore에 의해 Git에 올라가지 않습니다.

   환경변수 미설정 시:
     - 폴백(fallback) 객체를 사용해 앱이 멈추지 않고 게스트 모드로 동작합니다.
   ===================================================================== */

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

/*
 * .env 파일에 아래처럼 설정합니다:
 *   VITE_FIREBASE_API_KEY=AIzaSy...
 *   VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
 *   VITE_FIREBASE_PROJECT_ID=your-project
 *   VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
 *   VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
 *   VITE_FIREBASE_APP_ID=1:123456789:web:abc123
 */
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

/*
 * 환경변수가 하나라도 비어 있으면 Firebase를 초기화하지 않고
 * 폴백 모드(게스트 모드)로 동작합니다.
 */
const isConfigValid = firebaseConfig.apiKey && firebaseConfig.projectId;

let app = null;
let auth = null;
let db = null;
let storage = null;

if (isConfigValid) {
  try {
    app  = initializeApp(firebaseConfig);
    auth = getAuth(app);
    /*
     * Firestore 오프라인 캐시 활성화 — 네트워크가 없거나 느려도 기존 데이터 표시.
     * persistentLocalCache: IndexedDB 기반 영구 캐시.
     * persistentMultipleTabManager: 같은 도메인의 여러 탭에서 안전하게 캐시 공유.
     * 일부 환경(시크릿 모드, IndexedDB 차단 등)에서 실패하면 메모리 캐시로 폴백.
     */
    try {
      db = initializeFirestore(app, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      });
    } catch (cacheErr) {
      console.warn('Firestore 영구 캐시 활성화 실패, 메모리 캐시로 동작:', cacheErr);
      db = getFirestore(app);
    }
    storage = getStorage(app);
  } catch (err) {
    console.error('Firebase 초기화 실패:', err);
  }
} else {
  console.warn(
    '⚠️ Firebase 환경변수가 설정되지 않았습니다.\n' +
    '게스트 모드로 실행됩니다.\n' +
    '프로젝트 루트에 .env 파일을 만들고 Firebase 설정을 넣어주세요.'
  );
}

export { app, auth, db, storage };
