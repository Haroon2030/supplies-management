const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';
const TOKEN_KEY = 'procure.token';

export const tokenStore = {
  get: () => (typeof window === 'undefined' ? null : window.localStorage.getItem(TOKEN_KEY)),
  set: (t: string) => window.localStorage.setItem(TOKEN_KEY, t),
  clear: () => window.localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/** يستخرج رسالة الخطأ العربية القادمة من NestJS (قد تكون نصاً أو قائمة). */
function messageOf(body: unknown, fallback: string): string {
  const m = (body as { message?: string | string[] } | null)?.message;
  return Array.isArray(m) ? m.join('، ') : m ?? fallback;
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const token = tokenStore.get();
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        ...(init.json !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
      body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
    });
  } catch {
    // الخادم متوقف أو العنوان خاطئ (وليس رداً بخطأ منه)
    throw new ApiError(`تعذر الاتصال بالخادم (${BASE}). تأكد من تشغيل الـ API وقاعدة البيانات.`, 0);
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/auth/login')) {
      tokenStore.clear();
      if (typeof window !== 'undefined') window.location.assign('/login');
    }
    throw new ApiError(messageOf(body, 'تعذر إكمال العملية'), res.status);
  }
  return body as T;
}
