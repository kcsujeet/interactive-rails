const encoder = new TextEncoder();
const decoder = new TextDecoder();

interface JWTPayload {
  userId: string;
  exp: number;
  iat: number;
}

function base64UrlEncode(data: Uint8Array): string {
  return btoa(String.fromCharCode(...data))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(str: string): Uint8Array {
  const padded = str + '='.repeat((4 - (str.length % 4)) % 4);
  const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64);
  return new Uint8Array([...binary].map((c) => c.charCodeAt(0)));
}

async function sign(data: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return base64UrlEncode(new Uint8Array(signature));
}

async function verify(data: string, signature: string, secret: string): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  return crypto.subtle.verify(
    'HMAC',
    key,
    base64UrlDecode(signature),
    encoder.encode(data)
  );
}

export async function createToken(
  payload: { userId: string },
  secret: string,
  expiresIn: number = 7 * 24 * 60 * 60 // 7 days default
): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);

  const fullPayload: JWTPayload = {
    ...payload,
    iat: now,
    exp: now + expiresIn,
  };

  const headerBase64 = base64UrlEncode(encoder.encode(JSON.stringify(header)));
  const payloadBase64 = base64UrlEncode(encoder.encode(JSON.stringify(fullPayload)));

  const signature = await sign(`${headerBase64}.${payloadBase64}`, secret);

  return `${headerBase64}.${payloadBase64}.${signature}`;
}

export async function verifyToken(
  token: string,
  secret: string
): Promise<{ userId: string }> {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid token format');
  }

  const [headerBase64, payloadBase64, signature] = parts as [string, string, string];

  const isValid = await verify(`${headerBase64}.${payloadBase64}`, signature, secret);
  if (!isValid) {
    throw new Error('Invalid signature');
  }

  const payload: JWTPayload = JSON.parse(decoder.decode(base64UrlDecode(payloadBase64)));

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) {
    throw new Error('Token expired');
  }

  return { userId: payload.userId };
}
