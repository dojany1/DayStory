/* =====================================================================
   tests/rules/storage.rules.spec.js — Storage 보안 규칙 검증
   =====================================================================
   audit [CRITICAL 3-1] 사용자 간 격리:
     - users/{uid}/diary(아바타 포함) 는 본인만 read.
     - users/{uid}/editor_images(레거시 카드) 는 인증 사용자 read (하위 호환).
     - public/cards 는 인증 read / 어드민(token.admin) write.

   실행: npm run test:rules  (firebase emulators:exec 안에서 동작)
   ===================================================================== */
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { ref, uploadBytes, getBytes } from 'firebase/storage';

let testEnv;

/* 작은 PNG 바이트 + 메타 (contentType image/* 규칙 충족) */
const IMG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const META = { contentType: 'image/png' };

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'daystory-rules-test',
    storage: {
      rules: readFileSync('storage.rules', 'utf8'),
      host: '127.0.0.1',
      port: 9199,
    },
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearStorage();
});

async function seedFile(path) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await uploadBytes(ref(ctx.storage(), path), IMG, META);
  });
}

const aliceSt = () => testEnv.authenticatedContext('alice').storage();
const bobSt = () => testEnv.authenticatedContext('bob').storage();
const adminSt = () => testEnv.authenticatedContext('adminUser', { admin: true }).storage();
const anonSt = () => testEnv.unauthenticatedContext().storage();

describe('Storage — 개인 자료 격리 (audit 3-1 핵심)', () => {
  it('★ 본인 diary 이미지 read 가능 / 타인은 read 불가 (개인 일기·아바타 격리)', async () => {
    await seedFile('users/alice/diary/photo.png');
    await assertSucceeds(getBytes(ref(aliceSt(), 'users/alice/diary/photo.png')));
    await assertFails(getBytes(ref(bobSt(), 'users/alice/diary/photo.png')));
  });

  it('본인 폴더 업로드 가능 / 타인 폴더 업로드 불가', async () => {
    await assertSucceeds(uploadBytes(ref(aliceSt(), 'users/alice/diary/new.png'), IMG, META));
    await assertFails(uploadBytes(ref(aliceSt(), 'users/bob/diary/evil.png'), IMG, META));
  });

  it('비로그인 사용자는 개인 자료 read 불가', async () => {
    await seedFile('users/alice/diary/p.png');
    await assertFails(getBytes(ref(anonSt(), 'users/alice/diary/p.png')));
  });
});

describe('Storage — 카드 이미지 read (공개 자산)', () => {
  it('레거시 editor_images 는 타 사용자도 read 가능 (하위 호환 carve-out)', async () => {
    await seedFile('users/admin/editor_images/card.png');
    await assertSucceeds(getBytes(ref(bobSt(), 'users/admin/editor_images/card.png')));
  });

  it('public/cards 는 인증 사용자 read 가능', async () => {
    await seedFile('public/cards/c1.png');
    await assertSucceeds(getBytes(ref(bobSt(), 'public/cards/c1.png')));
  });
});

describe('Storage — public/cards write 는 어드민(token.admin)만', () => {
  it('★ 일반 사용자는 public/cards 업로드 불가', async () => {
    await assertFails(uploadBytes(ref(aliceSt(), 'public/cards/x.png'), IMG, META));
  });

  it('어드민 클레임 보유자는 public/cards 업로드 가능', async () => {
    await assertSucceeds(uploadBytes(ref(adminSt(), 'public/cards/y.png'), IMG, META));
  });

  it('이미지가 아닌 contentType 은 거부', async () => {
    await assertFails(
      uploadBytes(ref(adminSt(), 'public/cards/bad.txt'), IMG, { contentType: 'text/plain' })
    );
  });
});
