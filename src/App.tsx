import { useState, useEffect } from 'react';
import Header from './components/Header';
import MobileMenu from './components/MobileMenu';
import LandingPage from './components/pages/LandingPage';
import CabinetPage from './components/pages/CabinetPage';
import LoginPage from './components/pages/LoginPage';
import RegisterPage from './components/pages/RegisterPage';
import ForgotPasswordPage from './components/pages/ForgotPasswordPage';
import ResetPasswordPage from './components/pages/ResetPasswordPage';
import CompetitionsPage from './components/pages/CompetitionsPage';
import JudgesPage from './components/pages/JudgesPage';
import TeamsPage from './components/pages/TeamsPage';
import DocumentsPage from './components/pages/DocumentsPage';
import ResultsPage from './components/pages/ResultsPage';
import RatingPage from './components/pages/RatingPage';
import AdminPage from './components/pages/AdminPage';
import ManageCompetitionPage from './components/pages/ManageCompetitionWithDocumentsPage';
import ToastContainer from './components/ToastContainer';
import { auth } from './utils/auth';
import { apiRequest } from './utils/api';
import { bindDraftPersistence } from './utils/draftPersistence';
import { UserProfile } from './types';

export type PageType = 'landing' | 'cabinet' | 'login' | 'register' | 'forgot-password' | 'reset-password' | 'competitions' | 'judges' | 'teams' | 'documents' | 'results' | 'rating' | 'admin' | 'manage-competition';
export type Toast = { id: string; message: string; type: 'success' | 'error' | 'warning' | 'info'; };

type RouteState = { page: PageType; param?: string };
const RETURN_TO_KEY = 'sar-return-to';
const VALID_PAGES = new Set<PageType>(['landing','cabinet','login','register','forgot-password','reset-password','competitions','judges','teams','documents','results','rating','admin','manage-competition']);
const PROTECTED_PAGES = new Set<PageType>(['cabinet', 'rating', 'admin', 'manage-competition']);

function routeFromLocation(): RouteState {
  const params = new URLSearchParams(window.location.search);
  if (params.get('resetToken')) return { page: 'reset-password' };

  const requested = params.get('page') as PageType | null;
  const page = requested && VALID_PAGES.has(requested) ? requested : 'landing';
  if (page === 'manage-competition') {
    const competitionId = params.get('competitionId') || '';
    return competitionId ? { page, param: competitionId } : { page: 'competitions' };
  }
  return { page };
}

function urlForRoute(page: PageType, param?: string) {
  const url = new URL(window.location.pathname, window.location.origin);
  if (page !== 'landing') url.searchParams.set('page', page);
  if (page === 'manage-competition' && param) url.searchParams.set('competitionId', param);
  return `${url.pathname}${url.search}`;
}

function ensureHistoryState() {
  const state = window.history.state;
  if (!state?.sarRoute) {
    window.history.replaceState({ ...(state || {}), sarRoute: true, sarIndex: 0 }, '', window.location.href);
  }
}

export default function App() {
  ensureHistoryState();
  const initialRoute = routeFromLocation();
  const resetToken = new URLSearchParams(window.location.search).get('resetToken') || '';
  const [currentPage, setCurrentPage] = useState<PageType>(initialRoute.page);
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<string | null>(initialRoute.param || null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authInitialized, setAuthInitialized] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  const applyRoute = (route: RouteState, mode: 'push' | 'replace' | 'none' = 'push') => {
    if (mode !== 'none') {
      const currentIndex = Number(window.history.state?.sarIndex || 0);
      const state = { sarRoute: true, sarIndex: mode === 'push' ? currentIndex + 1 : currentIndex };
      const url = urlForRoute(route.page, route.param);
      if (mode === 'push') window.history.pushState(state, '', url);
      else window.history.replaceState(state, '', url);
    }
    setSelectedCompetitionId(route.page === 'manage-competition' ? route.param || null : null);
    setCurrentPage(route.page);
    setMobileMenuOpen(false);
  };

  const canAccessRoute = (route: RouteState, profile: UserProfile | null) => {
    if (route.page === 'admin') return profile?.role === 'admin';
    if (route.page === 'manage-competition') return profile?.role === 'admin' || profile?.role === 'organizer';
    return true;
  };

  const rememberReturnTo = (route: RouteState) => {
    try { sessionStorage.setItem(RETURN_TO_KEY, urlForRoute(route.page, route.param)); } catch {}
  };

  const fetchProfile = async (token?: string): Promise<UserProfile | null> => {
    try {
      if (!token) {
        const { data: { session }, error } = await auth.getSession();
        if (error || !session) return null;
        const expiresAt = session.expires_at;
        const now = Math.floor(Date.now() / 1000);
        if (expiresAt && expiresAt < now + 60) {
          const { data: { session: newSession }, error: refreshError } = await auth.refreshSession();
          if (refreshError || !newSession) {
            await auth.signOut({ scope: 'local' });
            setIsLoggedIn(false);
            setUserProfile(null);
            return null;
          }
          token = newSession.access_token;
        } else token = session.access_token;
      }
      const profile = await apiRequest('/profile', 'GET', undefined, token);
      const { data: { session: identitySession } } = await auth.getSession();
      const resolved = { ...profile, id: identitySession?.user?.id || profile.id, email: identitySession?.user?.email || profile.email } as UserProfile;
      setUserProfile(resolved);
      return resolved;
    } catch (e: any) {
      console.error('Profile fetch error:', e);
      if (e.message && (e.message.includes('401') || e.message.includes('Unauthorized'))) {
        try {
          const { data: { session }, error } = await auth.refreshSession();
          if (!session || error) {
            await auth.signOut({ scope: 'local' });
            setIsLoggedIn(false);
            setUserProfile(null);
          } else setTimeout(() => fetchProfile(session.access_token), 500);
        } catch {
          await auth.signOut({ scope: 'local' });
          setIsLoggedIn(false);
          setUserProfile(null);
        }
      } else if (e.message && e.message.includes('503')) setTimeout(() => fetchProfile(token), 2000);
      return null;
    }
  };

  useEffect(() => {
    let isCancelled = false;
    const initializeAuth = async () => {
      console.log('[App] Initializing auth state...');
      try {
        const route = routeFromLocation();
        const { data: { session }, error } = await auth.getSession();
        if (isCancelled) return;

        if (error || !session) {
          if (error) console.error('[App] Error getting initial session:', error);
          setIsLoggedIn(false);
          setUserProfile(null);
          if (PROTECTED_PAGES.has(route.page)) {
            rememberReturnTo(route);
            applyRoute({ page: 'login' }, 'replace');
          } else applyRoute(route, 'none');
          return;
        }

        setIsLoggedIn(true);
        const profile = await fetchProfile(session.access_token);
        if (isCancelled) return;

        if (!canAccessRoute(route, profile)) {
          applyRoute({ page: 'competitions' }, 'replace');
        } else {
          // Important: do not force authenticated users to Cabinet on refresh.
          // Restore exactly the route encoded in the current URL.
          applyRoute(route, 'none');
        }
      } catch (err) {
        console.error('[App] Unexpected auth initialization error:', err);
        await auth.signOut({ scope: 'local' });
        if (!isCancelled) {
          setIsLoggedIn(false);
          setUserProfile(null);
          const route = routeFromLocation();
          if (PROTECTED_PAGES.has(route.page)) {
            rememberReturnTo(route);
            applyRoute({ page: 'login' }, 'replace');
          }
        }
      } finally {
        if (!isCancelled) setAuthInitialized(true);
      }
    };

    initializeAuth();
    const { data: { subscription } } = auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session);
      if (session?.access_token) fetchProfile(session.access_token);
      else setUserProfile(null);
    });
    return () => { isCancelled = true; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      const route = routeFromLocation();
      if (PROTECTED_PAGES.has(route.page) && !isLoggedIn) {
        rememberReturnTo(route);
        applyRoute({ page: 'login' }, 'replace');
        return;
      }
      if (!canAccessRoute(route, userProfile)) {
        applyRoute({ page: 'competitions' }, 'replace');
        return;
      }
      applyRoute(route, 'none');
      window.scrollTo({ top: 0, behavior: 'auto' });
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isLoggedIn, userProfile]);

  useEffect(() => {
    if (!authInitialized) return;
    const scope = `${userProfile?.id || 'guest'}:${currentPage}:${selectedCompetitionId || ''}`;
    return bindDraftPersistence(scope);
  }, [authInitialized, userProfile?.id, currentPage, selectedCompetitionId]);

  const showToast = (message: string, type: Toast['type'] = 'success') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  };
  const removeToast = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));

  const showPage = (page: PageType, param?: string) => {
    const requested: RouteState = { page, param };
    if (PROTECTED_PAGES.has(page) && !isLoggedIn) {
      rememberReturnTo(requested);
      showToast('Увійдіть, щоб переглянути цю сторінку', 'info');
      applyRoute({ page: 'login' }, 'push');
      return;
    }
    if (!canAccessRoute(requested, userProfile)) {
      showToast('Доступ заборонено', 'error');
      return;
    }

    const sameRoute = currentPage === page && (page !== 'manage-competition' || selectedCompetitionId === (param || null));
    applyRoute(requested, sameRoute ? 'replace' : 'push');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLogin = async () => {
    const profile = await fetchProfile();
    let returnUrl = '';
    try {
      returnUrl = sessionStorage.getItem(RETURN_TO_KEY) || '';
      sessionStorage.removeItem(RETURN_TO_KEY);
    } catch {}

    if (returnUrl) {
      const url = new URL(returnUrl, window.location.origin);
      const params = url.searchParams;
      const page = params.get('page') as PageType | null;
      const route: RouteState = page && VALID_PAGES.has(page)
        ? { page, param: page === 'manage-competition' ? params.get('competitionId') || undefined : undefined }
        : { page: 'cabinet' };
      if (canAccessRoute(route, profile)) {
        applyRoute(route, 'replace');
        return;
      }
    }
    applyRoute({ page: 'cabinet' }, 'replace');
  };

  const handleLogout = async () => {
    await auth.signOut();
    setIsLoggedIn(false);
    setUserProfile(null);
    showToast('Ви вийшли з системи', 'info');
    applyRoute({ page: 'landing' }, 'replace');
  };

  const goToHome = () => showPage(isLoggedIn ? 'cabinet' : 'landing');
  const goBackFromCompetition = () => {
    const index = Number(window.history.state?.sarIndex || 0);
    if (index > 0) window.history.back();
    else applyRoute({ page: 'competitions' }, 'replace');
  };

  if (!authInitialized) return <div className="min-h-screen bg-[#F5F5F7]" />;

  return <div className="min-h-screen bg-[#F5F5F7] text-gray-900"><div className="fixed inset-0 z-0 bg-[#F5F5F7]" /><ToastContainer toasts={toasts} onRemove={removeToast} /><div className="relative z-10">
    <Header isLoggedIn={isLoggedIn} userProfile={userProfile} currentPage={currentPage} onPageChange={showPage} onLogout={handleLogout} onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)} onHomeClick={goToHome} />
    <MobileMenu isOpen={mobileMenuOpen} isLoggedIn={isLoggedIn} userProfile={userProfile} currentPage={currentPage} onPageChange={showPage} onLogout={handleLogout} />
    {currentPage === 'landing' && <LandingPage onPageChange={showPage} isLoggedIn={isLoggedIn} />}
    {currentPage === 'cabinet' && <CabinetPage userProfile={userProfile} setUserProfile={setUserProfile} onPageChange={showPage} showToast={showToast} />}
    {currentPage === 'login' && <LoginPage onLogin={handleLogin} onPageChange={showPage} showToast={showToast} />}
    {currentPage === 'register' && <RegisterPage onPageChange={showPage} showToast={showToast} />}
    {currentPage === 'forgot-password' && <ForgotPasswordPage onPageChange={showPage} showToast={showToast} />}
    {currentPage === 'reset-password' && <ResetPasswordPage token={resetToken} onPageChange={showPage} showToast={showToast} />}
    {currentPage === 'competitions' && <CompetitionsPage isLoggedIn={isLoggedIn} userProfile={userProfile} showToast={showToast} onPageChange={showPage} />}
    {currentPage === 'judges' && <JudgesPage userProfile={userProfile} showToast={showToast} />}
    {currentPage === 'teams' && <TeamsPage userProfile={userProfile} showToast={showToast} />}
    {currentPage === 'documents' && <DocumentsPage userProfile={userProfile} showToast={showToast} />}
    {currentPage === 'results' && <ResultsPage showToast={showToast} />}
    {currentPage === 'rating' && <RatingPage showToast={showToast} />}
    {currentPage === 'admin' && <AdminPage userProfile={userProfile} showToast={showToast} />}
    {currentPage === 'manage-competition' && selectedCompetitionId && isLoggedIn && userProfile && <ManageCompetitionPage competitionId={selectedCompetitionId} onBack={goBackFromCompetition} showToast={showToast} userProfile={userProfile} />}
  </div></div>;
}
