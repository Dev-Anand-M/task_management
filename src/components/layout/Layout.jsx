import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import ZenWidget from './ZenWidget';

const getPageTitle = (pathname) => {
    const titles = {
        '/admin': 'Dashboard',
        '/admin/tasks': 'Manage Tasks',
        '/admin/quizzes': 'Manage Quizzes',
        '/admin/evaluations': 'Evaluations',
        '/admin/team': 'Team Members',
        '/dashboard': 'Dashboard',
        '/tasks': 'My Tasks',
        '/quizzes': 'Quizzes',
        '/leaderboard': 'Leaderboard',
        '/profile': 'My Profile',
        '/calendar': 'Activity Calendar',
        '/planner': 'Planner',
        '/routines': 'Routines'
    };

    // Check for dynamic routes
    if (pathname.startsWith('/tasks/')) return 'Task Details';
    if (pathname.startsWith('/quizzes/')) return 'Take Quiz';
    if (pathname.startsWith('/admin/tasks/')) return 'Edit Task';
    if (pathname.startsWith('/admin/quizzes/')) return 'Edit Quiz';
    if (pathname.startsWith('/admin/evaluations/')) return 'Evaluate Submission';

    return titles[pathname] || 'Zenith';
};

const Layout = () => {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const location = useLocation();

    const pageTitle = getPageTitle(location.pathname);

    return (
        <div className="app-layout">
            <Sidebar
                isOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
            />
            <main className={`main-content ${!sidebarOpen ? 'sidebar-collapsed' : ''}`}>
                <Header
                    onMenuClick={() => setSidebarOpen(!sidebarOpen)}
                    title={pageTitle}
                />
                <div className="page-content animate-fade-in">
                    <Outlet />
                </div>
            </main>
            <ZenWidget />
        </div>
    );
};

export default Layout;
