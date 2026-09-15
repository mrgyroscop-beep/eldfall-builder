import test from 'node:test';
import assert from 'node:assert/strict';
import {
  browserSession,
  inviteRateKey,
  sessionActor,
} from '../lib/browser-session';

void test('anonymous browser session is stable, pseudonymous and set in a hardened cookie', async () => {
  const first = await browserSession(new Request('https://example.test/api'));
  assert.match(first.actor, /^browser:[a-f0-9]{64}$/);
  assert.match(
    first.setCookie ?? '',
    /^__Host-eldfall_session=[a-f0-9]{64}; Max-Age=31536000; Path=\/; Secure; HttpOnly; SameSite=Strict$/,
  );
  const token = first.setCookie!.match(/=([a-f0-9]{64});/)![1];
  const next = await browserSession(
    new Request('https://example.test/api', {
      headers: { Cookie: `other=value; __Host-eldfall_session=${token}` },
    }),
  );
  assert.equal(next.actor, first.actor);
  assert.equal(next.setCookie, null);
  assert.equal(next.actor, await sessionActor(token));
  assert.ok(!next.actor.includes(token));
});

void test('malformed cookies are rotated and invite rate limiting uses the Cloudflare address', async () => {
  const request = new Request('https://example.test/api', {
    headers: {
      Cookie: '__Host-eldfall_session=chosen-by-client',
      'CF-Connecting-IP': '203.0.113.8',
    },
  });
  const session = await browserSession(request);
  assert.ok(session.setCookie);
  assert.notEqual(session.actor, await sessionActor('chosen-by-client'));
  assert.equal(
    await inviteRateKey(request, session.actor),
    `network:${await sessionActor('203.0.113.8')}`,
  );
  assert.equal(
    await inviteRateKey(new Request('http://localhost/api'), session.actor),
    session.actor,
  );
});
