export type AuthUser = { id: string; email: string };
export type Session = { access_token: string; expires_at: number; user: AuthUser };
type Listener = (event: string, session: Session | null) => void;

const STORAGE_KEY = 'sar-session';
const listeners = new Set<Listener>();

function readSession(): Session | null {
  try {
    const session = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') as Session | null;
    if (!session || session.expires_at <= Math.floor(Date.now() / 1000)) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return session;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

function saveSession(session: Session | null, event: string) {
  if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  else localStorage.removeItem(STORAGE_KEY);
  listeners.forEach(listener => listener(event, session));
}

export const auth = {
  async getSession() { return { data: { session: readSession() }, error: null }; },
  async signInWithPassword(credentials: { email: string; password: string }) {
    try {
      const response = await fetch(`${(import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')}/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(credentials) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Login failed');
      saveSession(data.session, 'SIGNED_IN');
      return { data, error: null };
    } catch (error: any) {
      return { data: { user: null, session: null }, error };
    }
  },
  async signOut(_options?: unknown) {
    saveSession(null, 'SIGNED_OUT');
    return { error: null };
  },
  async refreshSession() {
    const session = readSession();
    return { data: { session }, error: session ? null : new Error('Session expired. Please sign in again.') };
  },
  onAuthStateChange(listener: Listener) {
    listeners.add(listener);
    return { data: { subscription: { unsubscribe: () => listeners.delete(listener) } } };
  },
  async updateUser(attributes: { password: string }) {
    try {
      const session = readSession();
      const response = await fetch(`${(import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')}/auth/password`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` }, body: JSON.stringify(attributes) });
      if (!response.ok) throw new Error((await response.json()).error || 'Password update failed');
      return { data: { user: readSession()?.user ?? null }, error: null };
    } catch (error: any) { return { data: { user: null }, error }; }
  }
};
