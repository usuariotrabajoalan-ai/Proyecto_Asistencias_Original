/**
 * Utilidades de Autenticación y Criptografía para el Sistema de Asistencias AFEMEC.
 * Compatible con Node.js Runtime y Next.js Edge Runtime (Web Crypto API estándar).
 */

export const ADMIN_COOKIE_NAME = 'admin_session';

export const ADMIN_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24, // 24 horas
};

const SECRET_KEY = process.env.ADMIN_SESSION_SECRET || 'afemec-attendance-auth-secret-key-2026-institutional';

function base64UrlEncode(str: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(str, 'utf-8').toString('base64url');
  }
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(str, 'base64url').toString('utf-8');
  }
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  return atob(base64);
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

async function getHmacKey(): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return await crypto.subtle.importKey(
    'raw',
    enc.encode(SECRET_KEY),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

/**
 * Genera un token firmado digitalmente con HMAC-SHA256 para la sesión de administrador.
 */
export async function createAdminToken(): Promise<string> {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64UrlEncode(
    JSON.stringify({
      role: 'admin',
      iat: Date.now(),
      exp: Date.now() + 24 * 60 * 60 * 1000, // 24 horas de validez
    })
  );

  const key = await getHmacKey();
  const enc = new TextEncoder();
  const data = enc.encode(`${header}.${payload}`);
  const signatureBytes = await crypto.subtle.sign('HMAC', key, data);
  const signature = base64UrlEncode(
    String.fromCharCode(...new Uint8Array(signatureBytes))
  );

  return `${header}.${payload}.${signature}`;
}

/**
 * Valida criptográficamente el token de sesión de administrador.
 */
export async function verifyAdminToken(token: string | null | undefined): Promise<boolean> {
  if (!token || typeof token !== 'string') return false;

  const parts = token.split('.');
  if (parts.length !== 3) return false;

  const [header, payload, signature] = parts;

  try {
    const key = await getHmacKey();
    const enc = new TextEncoder();
    const data = enc.encode(`${header}.${payload}`);

    const rawSig = base64UrlDecode(signature);
    const sigBytes = new Uint8Array(rawSig.length);
    for (let i = 0; i < rawSig.length; i++) {
      sigBytes[i] = rawSig.charCodeAt(i);
    }

    const isValid = await crypto.subtle.verify('HMAC', key, sigBytes, data);
    if (!isValid) return false;

    const payloadObj = JSON.parse(base64UrlDecode(payload));
    if (payloadObj.role !== 'admin') return false;
    if (typeof payloadObj.exp !== 'number' || Date.now() > payloadObj.exp) return false;

    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Hashea una contraseña usando PBKDF2-SHA256 con salt aleatorio de 16 bytes.
 */
export async function hashPassword(password: string): Promise<string> {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iterations = 100000;

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );

  const saltHex = bytesToHex(salt);
  const hashHex = bytesToHex(new Uint8Array(derivedBits));

  return `pbkdf2:${iterations}:${saltHex}:${hashHex}`;
}

/**
 * Verifica una contraseña contra el hash almacenado.
 * Soporta de manera transparente y retrocompatible contraseñas anteriores en texto plano,
 * indicando si requiere actualización (needsRehash).
 */
export async function verifyPassword(
  inputPassword: string,
  storedValue: string
): Promise<{ valid: boolean; needsRehash: boolean }> {
  if (!storedValue || !inputPassword) {
    return { valid: false, needsRehash: false };
  }

  // Si no está hasheado (contraseña legada en texto plano)
  if (!storedValue.startsWith('pbkdf2:')) {
    const valid = inputPassword === storedValue;
    return { valid, needsRehash: valid };
  }

  const parts = storedValue.split(':');
  if (parts.length !== 4) return { valid: false, needsRehash: false };

  const [, iterationsStr, saltHex, expectedHashHex] = parts;
  const iterations = parseInt(iterationsStr, 10);
  const salt = hexToBytes(saltHex);

  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(inputPassword),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );

  const computedHashHex = bytesToHex(new Uint8Array(derivedBits));
  const valid = computedHashHex === expectedHashHex;

  return { valid, needsRehash: false };
}
