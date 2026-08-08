
import { useEffect, useState } from 'react';
import { PlatformService } from './services/infrastructure/PlatformService';
import { Routes, Route, Navigate, Outlet, useParams, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { Layout } from './components/layout';
import { ErrorBoundary, LoadingSpinner, SplashScreen, SecurityGuard } from './components/common';
import BackHandler from './components/layout/BackHandler';
import GlobalAlarmListener from './components/layout/GlobalAlarmListener';
import UpdateDialog from './components/common/UpdateDialog';
import MaintenanceOverlay from './components/common/MaintenanceOverlay';
import { updateChecker } from './services/updateChecker';
import PendingWorkPopup from './components/common/PendingWorkPopup';

// Auth Pages
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';

// Admin Pages
import AdminDashboard from './pages/admin/Dashboard';
import TaskManager from './pages/admin/TaskManager';
import QuizBuilder from './pages/admin/QuizBuilder';
import EvaluationCenter from './pages/admin/EvaluationCenter';
import TeamManagement from './pages/admin/TeamManagement';
import InviteCodes from './pages/admin/InviteCodes';
import ClassroomSettings from './pages/admin/ClassroomSettings';
import ClassroomDetail from './pages/admin/ClassroomDetail';
import KnowledgeBase from './pages/shared/KnowledgeBase';
import SprintTracker from './pages/shared/SprintTracker';
import SprintVault from './pages/shared/SprintVault';
import AdminProfile from './pages/admin/AdminProfile';

// Member Pages
import MemberDashboard from './pages/member/Dashboard';
import MyTasks from './pages/member/MyTasks';
import Quizzes from './pages/member/Quizzes';
import Profile from './pages/member/Profile';
import XPHistory from './pages/member/XPHistory';
import StudyMaterials from './pages/member/StudyMaterials';
import MemberCalendar from './pages/member/Calendar';
import Planner from './pages/member/Planner';
import Routines from './pages/member/Routines';
import Diary from './pages/member/Diary';
import Timetable from './pages/member/Timetable';
import StudyLab from './pages/member/StudyLab';
import Chat from './pages/member/Chat';

// AI Pages
import AIAssistant from './pages/ai/AIAssistant';
import CodeReview from './pages/ai/CodeReview';
import StudyTools from './pages/ai/StudyTools';
import QuizGenerator from './pages/ai/QuizGenerator';
import Zen from './pages/ai/Zen';

// Shared Pages
import Leaderboard from './pages/Leaderboard';
import Settings from './pages/Settings';
import Notifications from './pages/Notifications';
import DebugConnection from './pages/DebugConnection';

// Coming Soon wrapper for Chat (v2.0.0 feature)
const ComingSoonChat = () => {
  const navigate = useNavigate();
  return (
    <div style={{
      position: 'relative',
      width: 'calc(100% + (var(--space-lg) * 2))',
      margin: 'calc(var(--space-lg) * -1)',
      minHeight: 'calc(100vh - 72px)',
      height: '100%',
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-main, radial-gradient(circle at 50% 30%, rgba(99, 102, 241, 0.18) 0%, rgba(15, 23, 42, 0.96) 100%))'
    }}>
      {/* Blurred chat underneath as a teaser */}
      <div style={{ filter: 'blur(12px)', pointerEvents: 'none', opacity: 0.2, width: '100%', height: '100%', position: 'absolute', inset: 0 }}>
        <Chat />
      </div>

      {/* Overlay */}
      <div style={{
        position: 'relative',
        zIndex: 10,
        textAlign: 'center',
        padding: '48px 36px',
        background: 'var(--card, rgba(15, 23, 42, 0.85))',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid var(--border, rgba(255, 255, 255, 0.12))',
        borderRadius: '28px',
        maxWidth: '440px',
        width: '90%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        <div style={{
          width: '84px',
          height: '84px',
          margin: '0 auto 20px',
          background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '38px',
          boxShadow: '0 10px 30px rgba(99, 102, 241, 0.4)'
        }}>💬</div>
        <h2 style={{ margin: '0 0 10px', fontSize: '26px', fontWeight: 800, color: 'var(--text, #ffffff)' }}>Messages</h2>
        <p style={{ margin: '0 0 24px', color: 'var(--text-muted, rgba(255, 255, 255, 0.7))', fontSize: '15px', lineHeight: 1.6 }}>
          Real-time end-to-end encrypted messaging is coming soon.<br />Stay tuned!
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
          <span style={{
            padding: '7px 20px',
            background: 'color-mix(in srgb, var(--primary-500, #6366f1) 18%, transparent)',
            border: '1px solid var(--primary-500, #6366f1)',
            color: 'var(--primary-500, #6366f1)',
            borderRadius: '20px',
            fontWeight: 800,
            fontSize: '13px',
            letterSpacing: '0.05em',
            textTransform: 'uppercase'
          }}>
            Coming in v2.0.0
          </span>
          <button
            onClick={() => navigate(-1)}
            style={{
              marginTop: '8px',
              padding: '10px 28px',
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '14px',
              fontWeight: 700,
              fontSize: '14px',
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(99, 102, 241, 0.3)',
              transition: 'all 0.2s ease'
            }}
          >
            ← Back
          </button>
        </div>
      </div>
    </div>
  );
};

// Protected Route Component (Layout Wrapper)
const ProtectedLayout = ({ requiredRole }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <SplashScreen />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && user?.role !== requiredRole) {
    return <Navigate to={user?.role === 'admin' ? '/admin' : '/dashboard'} replace />;
  }


  return (
    <Layout>
      <Outlet />
      <PendingWorkPopup />
    </Layout>
  );
};

// Simple Route Guard for Role Branches
const RoleGuard = ({ role }) => {
  const { user, loading } = useAuth();

  if (loading) return <SplashScreen />; // Should be handled by parent but safe to keep
  if (!user) return <Navigate to="/login" replace />;

  if (user?.role !== role) {
    return <Navigate to={user?.role === 'admin' ? '/admin' : '/dashboard'} replace />;
  }

  return <Outlet />;
};

// Auth Route (redirects if already logged in)
const AuthRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <SplashScreen />;
  }

  if (user) {
    // Safe navigation with fallback
    const redirectPath = user?.role === 'admin' ? '/admin' : '/dashboard';
    return <Navigate to={redirectPath} replace />;
  }

  return children;
};

const AdminMemberProfile = () => {
  const { userId } = useParams();
  return <Profile userId={userId} readonly={true} />;
};

const MemberProfileView = () => {
  const { userId } = useParams();
  return <Profile userId={userId} readonly={true} />;
};

const ProfileRouter = () => {
  const { user } = useAuth();
  return user?.role === 'admin' ? <AdminProfile /> : <Profile />;
};

function AppRoutes() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleNavigate = (e) => {
      if (e.detail?.url) {
        navigate(e.detail.url);
      }
    };
    window.addEventListener('navigate-to-url', handleNavigate);
    return () => window.removeEventListener('navigate-to-url', handleNavigate);
  }, [navigate]);

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route
        path="/login"
        element={
          <AuthRoute>
            <Login />
          </AuthRoute>
        }
      />
      <Route
        path="/register"
        element={
          <AuthRoute>
            <Register />
          </AuthRoute>
        }
      />

      {/* Main Authenticated Layout
          This keeps the Sidebar/Header mounted when switching between pages
      */}
      <Route element={<ProtectedLayout />}>

        {/* Admin Section */}
        <Route path="/admin" element={<RoleGuard role="admin" />}>
          <Route index element={<AdminDashboard />} />
          <Route path="tasks" element={<TaskManager />} />
          <Route path="tasks/new" element={<TaskManager />} />
          <Route path="tasks/:taskId" element={<TaskManager />} />
          <Route path="quizzes" element={<QuizBuilder />} />
          <Route path="quizzes/new" element={<QuizBuilder />} />
          <Route path="quizzes/:quizId" element={<QuizBuilder />} />
          <Route path="evaluations" element={<EvaluationCenter />} />
          <Route path="evaluations/:type/:submissionId" element={<EvaluationCenter />} />
          <Route path="evaluations/:submissionId" element={<EvaluationCenter />} />
          <Route path="team" element={<TeamManagement />} />
          <Route path="invite-codes" element={<InviteCodes />} />
          <Route path="member/:userId" element={<AdminMemberProfile />} />
          
          {/* Classroom Management (Admins Only) */}
          <Route path="classroom" element={<ClassroomSettings />} />
          <Route path="classroom/:id" element={<ClassroomDetail />} />
        </Route>

        {/* Member Section */}
        {/* We can technically allow admins to see these or restrict them. 
            For now, let's restrict /dashboard and /tasks root to members, 
            or allow admins to see them if they want (though they have their own).
            Let's restrict strictly to match previous logic. 
        */}
        <Route element={<RoleGuard role="member" />}>
          <Route path="/dashboard" element={<MemberDashboard />} />
          <Route path="/tasks" element={<MyTasks />} />
          <Route path="/tasks/:taskId" element={<MyTasks />} />
          <Route path="/quizzes" element={<Quizzes />} />
          <Route path="/quizzes/:quizId" element={<Quizzes />} />
          <Route path="/xp-history" element={<XPHistory />} />
          <Route path="/calendar" element={<MemberCalendar />} />
          <Route path="/planner" element={<Planner />} />
          <Route path="/routines" element={<Routines />} />
          <Route path="/diary" element={<Diary />} />
          <Route path="/timetable" element={<Timetable />} />
          <Route path="/study-lab" element={<StudyLab />} />
          <Route path="/study-lab/:id" element={<StudyLab />} />
          <Route path="/team" element={<TeamManagement />} />
          <Route path="/profile/:userId" element={<MemberProfileView />} />
        </Route>

        {/* Shared Routes */}
        <Route path="/sprint-vault" element={<SprintVault />} />
        <Route path="/repository" element={<StudyMaterials />} />
        <Route path="/study-materials" element={<StudyMaterials />} />
        <Route path="/study-materials/:id" element={<StudyMaterials />} />
        <Route path="/profile" element={<ProfileRouter />} />
        <Route path="/chat" element={<ComingSoonChat />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/notifications" element={<Notifications />} />

        {/* AI Tools - Available to everyone */}
        <Route path="/ai/assistant" element={<AIAssistant />} />
        <Route path="/ai/code-review" element={<CodeReview />} />
        <Route path="/ai/study-tools" element={<StudyTools />} />
        <Route path="/ai/quiz-generator" element={<QuizGenerator />} />
        <Route path="/ai/zen" element={<Zen />} />

        <Route path="/knowledge-base" element={<KnowledgeBase />} />
        <Route path="/sprint-tracker" element={<SprintTracker />} />
        
        {/* Debug Route */}
        <Route path="/debug" element={<DebugConnection />} />
      </Route>

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}



function App() {
  const [updateInfo, setUpdateInfo] = useState(null);
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);

  // Check for updates & maintenance mode on app start
  useEffect(() => {
    const checkUpdates = async () => {
      const result = await updateChecker.checkForUpdates();
      
      if (result.updateAvailable || result.isMaintenance) {
        // Don't show if user dismissed this version (unless mandatory or maintenance)
        if (!result.mandatory && !result.isMaintenance && updateChecker.hasUserDismissedVersion(result.latestVersion)) {
          return;
        }
        
        setUpdateInfo(result);
        setShowUpdateDialog(true);
      } else {
        setUpdateInfo(null);
        setShowUpdateDialog(false);
      }
    };

    // Check immediately on mount and after small delay
    checkUpdates();
    const timer = setTimeout(checkUpdates, 1500);

    // Check every 30 seconds for live maintenance mode toggles
    const interval = setInterval(checkUpdates, 30 * 1000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, []);

  const handleDownloadUpdate = async () => {
    if (updateInfo?.downloadUrl) {
      await updateChecker.downloadUpdate(updateInfo.downloadUrl);
      // Keep dialog open if mandatory, close if optional
      if (!updateInfo.mandatory) {
        setShowUpdateDialog(false);
      }
    }
  };

  const handleDismissUpdate = () => {
    if (updateInfo?.latestVersion) {
      updateChecker.dismissVersion(updateInfo.latestVersion);
    }
    setShowUpdateDialog(false);
  };

  const handleCloseUpdate = () => {
    if (!updateInfo?.mandatory) {
      setShowUpdateDialog(false);
    }
  };

  useEffect(() => {
    const isNative = PlatformService.isNative();
    const isStandalone = isNative || (typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches);
    const os = PlatformService.getDeviceOS();

    if (isNative) {
      document.documentElement.classList.add('is-native');
    } else {
      document.documentElement.classList.add('is-web');
    }

    if (isStandalone) {
      document.documentElement.classList.add('is-standalone');
    } else {
      document.documentElement.classList.add('is-browser');
    }

    // Add main platform class
    document.documentElement.classList.add(`is-${PlatformService.getPlatformName()}`);

    // If running in standalone mobile context (native or PWA), apply specific OS classes for safe-areas
    if (isStandalone && (os === 'android' || os === 'ios')) {
      document.documentElement.classList.add(`is-${os}`);
    }
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <GlobalAlarmListener />
          <BackHandler />
          <SecurityGuard>
            <AppRoutes />
          </SecurityGuard>
          
          {/* Maintenance Overlay (Mandatory & Non-Bypassable for regular users) */}
          {showUpdateDialog && updateInfo?.isMaintenance ? (
            <MaintenanceOverlay
              maintenanceMessage={updateInfo.maintenanceMessage}
              onRefresh={async () => {
                const res = await updateChecker.checkForUpdates();
                if (!res.isMaintenance && !res.updateAvailable) {
                  setShowUpdateDialog(false);
                  setUpdateInfo(null);
                } else {
                  setUpdateInfo(res);
                }
              }}
            />
          ) : showUpdateDialog && updateInfo && (
            <UpdateDialog
              updateInfo={updateInfo}
              onDownload={handleDownloadUpdate}
              onDismiss={handleDismissUpdate}
              onClose={handleCloseUpdate}
            />
          )}
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
