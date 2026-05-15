
import { Routes, Route, Navigate, Outlet, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { Layout } from './components/layout';
import { ErrorBoundary, LoadingSpinner } from './components/common';
import BackHandler from './components/layout/BackHandler';
import GlobalAlarmListener from './components/layout/GlobalAlarmListener';

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

// AI Pages
import AIAssistant from './pages/ai/AIAssistant';
import CodeReview from './pages/ai/CodeReview';
import StudyTools from './pages/ai/StudyTools';
import QuizGenerator from './pages/ai/QuizGenerator';

// Shared Pages
import Leaderboard from './pages/Leaderboard';
import Settings from './pages/Settings';
import Notifications from './pages/Notifications';
import DebugConnection from './pages/DebugConnection';

// Protected Route Component (Layout Wrapper)
const ProtectedLayout = ({ requiredRole }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg)'
      }}>
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && user?.role !== requiredRole) {
    console.log('[ProtectedLayout] Role mismatch. User role:', user?.role, 'Required:', requiredRole);
    return <Navigate to={user?.role === 'admin' ? '/admin' : '/dashboard'} replace />;
  }

  console.log('[ProtectedLayout] Rendering Layout and Outlet. Current User Role:', user?.role);

  return (
    <Layout>
      <Outlet />
    </Layout>
  );
};

// Simple Route Guard for Role Branches
const RoleGuard = ({ role }) => {
  const { user, loading } = useAuth();

  if (loading) return <LoadingSpinner />; // Should be handled by parent but safe to keep
  if (!user) return <Navigate to="/login" replace />;

  if (user?.role !== role) {
    console.log('[RoleGuard] Role mismatch! User role:', user?.role, 'Required:', role, 'Redirecting...');
    return <Navigate to={user?.role === 'admin' ? '/admin' : '/dashboard'} replace />;
  }

  console.log('[RoleGuard] Role check passed. User role:', user?.role);

  return <Outlet />;
};

// Auth Route (redirects if already logged in)
const AuthRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg)'
      }}>
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (user) {
    // Safe navigation with fallback
    const redirectPath = user?.role === 'admin' ? '/admin' : '/dashboard';
    console.log('AuthRoute: User logged in, redirecting to:', redirectPath);
    return <Navigate to={redirectPath} replace />;
  }

  return children;
};

const AdminMemberProfile = () => {
  const { userId } = useParams();
  return <Profile userId={userId} readonly={true} />;
};

const ProfileRouter = () => {
  const { user } = useAuth();
  return user?.role === 'admin' ? <AdminProfile /> : <Profile />;
};

function AppRoutes() {
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
          <Route path="/study-materials" element={<StudyMaterials />} />
          <Route path="/study-materials/:id" element={<StudyMaterials />} />
          <Route path="/calendar" element={<MemberCalendar />} />
          <Route path="/planner" element={<Planner />} />
          <Route path="/routines" element={<Routines />} />
          <Route path="/diary" element={<Diary />} />
          <Route path="/timetable" element={<Timetable />} />
          <Route path="/study-lab" element={<StudyLab />} />
          <Route path="/study-lab/:id" element={<StudyLab />} />
        </Route>

        {/* Shared Routes */}
        <Route path="/profile" element={<ProfileRouter />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/notifications" element={<Notifications />} />

        {/* AI Tools - Available to everyone */}
        <Route path="/ai/assistant" element={<AIAssistant />} />
        <Route path="/ai/code-review" element={<CodeReview />} />
        <Route path="/ai/study-tools" element={<StudyTools />} />
        <Route path="/ai/quiz-generator" element={<QuizGenerator />} />

        <Route path="/knowledge-base" element={<KnowledgeBase />} />
        
        {/* Debug Route */}
        <Route path="/debug" element={<DebugConnection />} />
      </Route>

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}



function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <GlobalAlarmListener />
          {/* <BackHandler /> */}
          <AppRoutes />
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
