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
import ManageCompetitionPage from './components/pages/ManageCompetitionPage';
import ToastContainer from './components/ToastContainer';
import { auth } from './utils/auth';
import { apiRequest } from './utils/api';
import { UserProfile } from './types';

export type PageType = 'landing' | 'cabinet' | 'login' | 'register' | 'forgot-password' | 'reset-password' | 'competitions' | 'judges' | 'teams' | 'documents' | 'results' | 'rating' | 'admin' | 'manage-competition';

export type Toast = {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
};

export default function App() {
  const resetToken = new URLSearchParams(window.location.search).get('resetToken') || '';
  const [currentPage, setCurrentPage] = useState<PageType>(resetToken ? 'reset-password' : 'landing');
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authInitialized, setAuthInitialized] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    let isCancelled = false;

    const initializeAuth = async () => {
      console.log('[App] Initializing auth state...');

      try {
        const { data: { session }, error } = await auth.getSession();

        if (isCancelled) return;

        if (error) {
          console.error('[App] Error getting initial session:', error);
          await auth.signOut({ scope: 'local' });
          setIsLoggedIn(false);
          setUserProfile(null);
          return;
        }

        console.log('[App] Initial session check:', {
          hasSession: !!session,
          userId: session?.user?.id,
          email: session?.user?.email,
          tokenLength: session?.access_token?.length,
          tokenPreview: session?.access_token ? session.access_token.substring(0, 30) + '...' : 'N/A'
        });

        setIsLoggedIn(!!session);

        if (session?.access_token) {
          console.log('[App] ✓ Found valid session, fetching profile...');
          await fetchProfile(session.access_token);

          if (!isCancelled && !resetToken) {
            setCurrentPage(prev => prev === 'landing' ? 'cabinet' : prev);
          }
        } else {
          console.log('[App] No active session - user needs to login');
        }
      } catch (err) {
        console.error('[App] Unexpected error in getSession:', err);
        await auth.signOut({ scope: 'local' });
        if (!isCancelled) {
          setIsLoggedIn(false);
          setUserProfile(null);
        }
      } finally {
        if (!isCancelled) {
          setAuthInitialized(true);
        }
      }
    };

    initializeAuth();

    const { data: { subscription } } = auth.onAuthStateChange((event, session) => {
      console.log('[App] Auth state changed:', {
        event,
        hasSession: !!session,
        userId: session?.user?.id,
        email: session?.user?.email
      });

      setIsLoggedIn(!!session);

      if (session?.access_token) {
        console.log('[App] ✓ Session available, fetching profile...');
        fetchProfile(session.access_token);
      } else {
        console.log('[App] Session cleared');
        setUserProfile(null);
      }
    });

    return () => {
      isCancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const fetchProfile = async (token?: string) => {
    console.log('fetchProfile called with token:', !!token);

    try {
      if (!token) {
        console.log('[fetchProfile] No token provided, getting session...');
        const { data: { session }, error } = await auth.getSession();

        if (error) {
          console.error('[fetchProfile] Error getting session:', error);
          return;
        }

        if (!session) {
          console.warn('[fetchProfile] No session available');
          return;
        }

        const expiresAt = session.expires_at;
        const now = Math.floor(Date.now() / 1000);

        if (expiresAt && expiresAt < now + 60) {
          console.log('[fetchProfile] Token expiring soon, refreshing session...');

          try {
            const { data: { session: newSession }, error: refreshError } = await auth.refreshSession();

            if (refreshError || !newSession) {
              console.error('[fetchProfile] Failed to refresh session:', refreshError);
              await auth.signOut({ scope: 'local' });
              setIsLoggedIn(false);
              setUserProfile(null);
              return;
            }

            token = newSession.access_token;
            console.log('[fetchProfile] ✓ Session refreshed successfully');
          } catch (refreshErr) {
            console.error('[fetchProfile] Refresh session threw error:', refreshErr);
            await auth.signOut({ scope: 'local' });
            setIsLoggedIn(false);
            setUserProfile(null);
            return;
          }
        } else {
          token = session.access_token;
        }
      }

      const profile = await apiRequest('/profile', 'GET', undefined, token);

      // organizerId у соревнования хранится как ID пользователя из JWT-сессии.
      // В старых profile:* записях поле id могло отсутствовать, из-за чего UI
      // не узнавал собственные соревнования организатора и скрывал действия
      // «Керувати / Редагувати / Видалити», хотя backend разрешал доступ.
      // Поэтому идентификатор и email всегда берем из текущей авторизованной
      // сессии, а остальные данные (роль, имя, телефон и т.д.) — из профиля API.
      const { data: { session: identitySession } } = await auth.getSession();
      const normalizedProfile: UserProfile = {
        ...profile,
        id: identitySession?.user?.id || profile.id,
        email: identitySession?.user?.email || profile.email,
      };

      setUserProfile(normalizedProfile);
      console.log('Profile fetched successfully:', normalizedProfile);
    } catch (e: any) {
      console.error('Profile fetch error:', e);
      if (e.message && (e.message.includes('401') || e.message.includes('Unauthorized'))) {
        console.error('Profile fetch failed - unauthorized. Verifying session...');

        try {
          const { data: { session }, error } = await auth.refreshSession();

          if (!session || error) {
            console.error('No valid session found, signing out');
            await auth.signOut({ scope: 'local' });
            setIsLoggedIn(false);
            setUserProfile(null);
          } else {
            console.log('Session refreshed, retrying profile fetch...');
            setTimeout(() => fetchProfile(session.access_token), 500);
          }
        } catch (refreshErr) {
          console.error('Refresh session failed, signing out:', refreshErr);
          await auth.signOut({ scope: 'local' });
          setIsLoggedIn(false);
          setUserProfile(null);
        }
      } else if (e.message && e.message.includes('503')) {
        console.warn('Server temporarily unavailable (503), retrying in 2 seconds...');
        setTimeout(() => fetchProfile(token), 2000);
      } else {
        console.error('Profile fetch failed with unknown error:', e);
      }
    }
  };

  const showToast = (message: string, type: Toast['type'] = 'success') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, 3000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  const showPage = (page: PageType, param?: string) => {
    if ((page === 'cabinet' || page === 'rating' || page === 'admin') && !isLoggedIn) {
      showToast('Увійдіть, щоб переглянути цю сторінку', 'info');
      setCurrentPage('login');
      return;
    }
    if (page === 'admin' && userProfile?.role !== 'admin') {
      showToast('Доступ заборонно', 'error');
      return;
    }
    if (page === 'manage-competition' && param) {
      setSelectedCompetitionId(param);
    }

    if (currentPage === 'reset-password' && page !== 'reset-password') {
      window.history.replaceState(null, '', window.location.pathname);
    }

    setCurrentPage(page);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLogin = async () => {
    setCurrentPage('cabinet');
  };

  const handleLogout = async () => {
    await auth.signOut();
    setIsLoggedIn(false);
    setUserProfile(null);
    showToast('Ви вийшли з системи', 'info');
    setCurrentPage('landing');
  };

  const goToHome = () => {
    setCurrentPage(isLoggedIn ? 'cabinet' : 'landing');
  };

  if (!authInitialized) {
    return <div className="min-h-screen bg-[#F5F5F7]" />;
  }

  return (
    <div className="min-h-screen bg-[#F5F5F7] text-gray-900">
      <div className="fixed inset-0 z-0 bg-[#F5F5F7]">
      </div>

      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <div className="relative z-10">
        <Header
          isLoggedIn={isLoggedIn}
          userProfile={userProfile}
          currentPage={currentPage}
          onPageChange={showPage}
          onLogout={handleLogout}
          onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
          onHomeClick={goToHome}
        />

        <MobileMenu
          isOpen={mobileMenuOpen}
          isLoggedIn={isLoggedIn}
          userProfile={userProfile}
          currentPage={currentPage}
          onPageChange={showPage}
          onLogout={handleLogout}
        />

        {currentPage === 'landing' && <LandingPage onPageChange={showPage} isLoggedIn={isLoggedIn} />}
        {currentPage === 'cabinet' && (
          <CabinetPage
            userProfile={userProfile}
            setUserProfile={setUserProfile}
            onPageChange={showPage}
            showToast={showToast}
          />
        )}
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
        {currentPage === 'manage-competition' && selectedCompetitionId && isLoggedIn && userProfile && (
          <ManageCompetitionPage
            competitionId={selectedCompetitionId}
            onBack={() => showPage('competitions')}
            showToast={showToast}
            userProfile={userProfile}
          />
        )}
      </div>
    </div>
  );
}
