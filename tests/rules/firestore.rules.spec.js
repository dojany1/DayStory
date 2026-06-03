/* =====================================================================
   tests/rules/firestore.rules.spec.js — Firestore 보안 규칙 검증
   =====================================================================
   audit [HIGH 3-2] userStories.update uid 불변 + bookmarks update 미허용,
   그리고 기존 보호(role 자가승격 차단, stories 어드민 write)를 회귀로 고정.

   실행: npm run test:rules  (firebase emulators:exec 안에서 동작)
   ===================================================================== */
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'daystory-rules-test',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

/* 보안 규칙을 우회해 초기 데이터를 심는다 (테스트 전제 조건 구성용). */
async function seed(path, data) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), path), data);
  });
}

const aliceDb = () => testEnv.authenticatedContext('alice').firestore();
const bobDb = () => testEnv.authenticatedContext('bob').firestore();

describe('userStories — 소유자 격리 + uid 불변 (audit 3-2)', () => {
  it('본인 uid 로 생성 가능', async () => {
    await assertSucceeds(setDoc(doc(aliceDb(), 'userStories/s1'), { uid: 'alice', title: 'hi' }));
  });

  it('타인 uid 로 생성 불가', async () => {
    await assertFails(setDoc(doc(aliceDb(), 'userStories/s2'), { uid: 'bob', title: 'x' }));
  });

  it('본인 문서 read 가능 / 타인 문서 read 불가', async () => {
    await seed('userStories/s3', { uid: 'alice', title: 'secret' });
    await assertSucceeds(getDoc(doc(aliceDb(), 'userStories/s3')));
    await assertFails(getDoc(doc(bobDb(), 'userStories/s3')));
  });

  it('본인 문서 update 시 uid 를 유지하면 허용', async () => {
    await seed('userStories/s4', { uid: 'alice', title: 'a' });
    await assertSucceeds(updateDoc(doc(aliceDb(), 'userStories/s4'), { title: 'b' }));
    await assertSucceeds(updateDoc(doc(aliceDb(), 'userStories/s4'), { uid: 'alice', title: 'c' }));
  });

  it('★ update 로 uid 를 타인으로 변경 불가 (소유권 이전·피드 주입 차단)', async () => {
    await seed('userStories/s5', { uid: 'alice', title: 'a' });
    await assertFails(updateDoc(doc(aliceDb(), 'userStories/s5'), { uid: 'bob' }));
  });

  it('본인 문서 삭제 가능 / 타인 문서 삭제 불가', async () => {
    await seed('userStories/s6', { uid: 'alice' });
    await assertFails(deleteDoc(doc(bobDb(), 'userStories/s6')));
    await assertSucceeds(deleteDoc(doc(aliceDb(), 'userStories/s6')));
  });
});

describe('bookmarks — 토글 전용(update 미허용) (audit 3-2)', () => {
  it('본인 user_id 로 생성 가능', async () => {
    await assertSucceeds(setDoc(doc(aliceDb(), 'bookmarks/b1'), { user_id: 'alice', story_id: 's1' }));
  });

  it('★ update 는 거부 — user_id 변조 원천 차단', async () => {
    await seed('bookmarks/b2', { user_id: 'alice', story_id: 's1' });
    await assertFails(updateDoc(doc(aliceDb(), 'bookmarks/b2'), { user_id: 'bob' }));
  });

  it('타인 북마크 read/delete 불가', async () => {
    await seed('bookmarks/b3', { user_id: 'alice', story_id: 's1' });
    await assertFails(getDoc(doc(bobDb(), 'bookmarks/b3')));
    await assertFails(deleteDoc(doc(bobDb(), 'bookmarks/b3')));
  });
});

describe('profiles — role 자가승격 차단 (기존 보호 회귀)', () => {
  it('role 없이 본인 프로필 생성 가능', async () => {
    await assertSucceeds(setDoc(doc(aliceDb(), 'profiles/alice'), { nickname: 'A' }));
  });

  it('★ 생성 시 role:editor 자가 부여 불가', async () => {
    await assertFails(setDoc(doc(aliceDb(), 'profiles/alice'), { role: 'editor' }));
  });

  it('★ update 로 role:editor 승격 불가', async () => {
    await seed('profiles/alice', { nickname: 'A' });
    await assertFails(updateDoc(doc(aliceDb(), 'profiles/alice'), { role: 'editor' }));
  });
});

describe('stories — read 공개(인증) / write 어드민 전용', () => {
  it('published 카드는 인증 사용자 read 가능', async () => {
    await seed('stories/pub1', { status: 'published', title: 'card' });
    await assertSucceeds(getDoc(doc(aliceDb(), 'stories/pub1')));
  });

  it('일반 사용자는 stories write 불가', async () => {
    await assertFails(setDoc(doc(aliceDb(), 'stories/new1'), { status: 'published', title: 'x' }));
  });
});
