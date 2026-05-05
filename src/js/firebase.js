/* =====================================================================
   firebase.js — Firebase 백엔드 연결 설정
   =====================================================================
   역할:
     - Firebase 앱을 초기화합니다.
     - Auth(인증)와 Firestore(데이터베이스) 인스턴스를 만들어 내보냅니다.

   보안 사항:
     - .env 파일의 VITE_FIREBASE_* 값이 있으면 그 값을 우선 사용합니다.
     - .env 파일은 .gitignore에 의해 Git에 올라가지 않습니다.
     - 아래 기본값은 2026-05-05에 12.aab 웹 번들에서 복구한 Firebase 공개 설정입니다.

   환경변수와 기본값 모두 미설정 시:
     - Firebase를 초기화하지 않고 게스트 모드로 동작합니다.
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

const aabFirebaseConfig = {
  apiKey: 'AIzaSyChrxkQDK9gdE493vL-skW2WdQxa8LDOY0',
  authDomain: 'dokhu-daystory.firebaseapp.com',
  projectId: 'dokhu-daystory',
  storageBucket: 'dokhu-daystory.firebasestorage.app',
  messagingSenderId: '1063822349351',
  appId: '1:1063822349351:web:1f3eb5f05b361d2de32a02',
};

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY || aabFirebaseConfig.apiKey,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || aabFirebaseConfig.authDomain,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID || aabFirebaseConfig.projectId,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || aabFirebaseConfig.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || aabFirebaseConfig.messagingSenderId,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID || aabFirebaseConfig.appId,
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
     * 세션 1 #8: Firestore 오프라인 캐시 활성화 — 네트워크가 없거나 느려도 기존 데이터를 표시.
     * IndexedDB 차단 같은 환경에서 실패하면 메모리 캐시로 폴백한다.
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
