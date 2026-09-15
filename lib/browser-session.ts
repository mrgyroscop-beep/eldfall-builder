const COOKIE_NAME = '__Host-eldfall_session';
const TOKEN_PATTERN = /^[a-f0-9]{64}$/;
const SESSION_MAX_AGE = 60 * 60 * 24 * 365;

function readCookie(request: Request) {
  const cookie = request.headers.get('cookie') ?? '';
  for (const part of cookie.split(';')) {
    const [name, ...value] = part.trim().split('=');
    if (name === COOKIE_NAME) return value.join('=');
  }
  return '';
}

function newToken() {
  return `${crypto.randomUUID()}${crypto.randomUUID()}`.replaceAll('-', '');
}

export async function sessionActor(token: string) {
  const hash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(token),
  );
  return `browser:${Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')}`;
}

export async function browserSession(request: Request) {
  const existing = readCookie(request);
  const validExisting = TOKEN_PATTERN.test(existing);
  const token = validExisting ? existing : newToken();
  return {
    actor: await sessionActor(token),
    setCookie: validExisting
      ? null
      : `${COOKIE_NAME}=${token}; Max-Age=${SESSION_MAX_AGE}; Path=/; Secure; HttpOnly; SameSite=Strict`,
  };
}

export async function inviteRateKey(request: Request, fallbackActor: string) {
  const address = request.headers.get('cf-connecting-ip');
  return address ? `network:${await sessionActor(address)}` : fallbackActor;
}
