import selm from './assets/logo.ico';
import voron from './assets/logo2.ico';

import React, {useEffect} from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import './App.css';

// Імпортуємо компоненти
import CuttingJobForm from './components/CuttingJobForm';
import CuttingJobsSelectionPage from './components/CuttingJobsSelectionPage';
import JobsTableWithDetails from './components/JobsTableWithDetails';
import ArticlesManagement from './components/ArticlesManagement';
import CuttingJobsCRUD from './components/CuttingJobsCRUD';
import AuthGuard from './components/AuthGuard';
import CuttingJobExecutionWrapper from "./components/CuttingJobExecutionWrapper";

// Додаємо імпорт логотипу (замініть шлях на ваш)
import NotificationCenter from "./components/NotificationCenterDB";
import {checkSupabaseRealtime} from "./hooks/checkSupabaseRealtime";
import StarryBackground from "./background/StarryBackground"; // або './logo.svg', './images/logo.png' тощо

// Компонент-обгортка для захищених маршрутів
const ProtectedRoute = ({ element: Element, ...props }) => (
    <AuthGuard>
        <Element {...props} />
    </AuthGuard>
);

// Компонент для незахищених маршрутів
const PublicRoute = ({ element: Element, ...props }) => (
    <Element {...props} />
);

const Navigation = () => {
    const location = useLocation();

    // Отримайте роль користувача з контексту або localStorage
    const userRole = localStorage.getItem('userRole') || 'operator'; // Приклад

    const getNavLinkClass = (path) => {
        const currentPath = location.pathname;

        if (currentPath === '/') {
            return path === '/create' ? 'nav-button active' : 'nav-button';
        }

        if (path === '/create') {
            return currentPath.startsWith('/create') || currentPath === '/' ? 'nav-button active' : 'nav-button';
        }

        if (path === '/operator') {
            return currentPath === '/operator' ? 'nav-button active' : 'nav-button';
        }

        if (path === '/view/information') {
            return currentPath === '/view/information' ? 'nav-button active' : 'nav-button';
        }

        if (path === '/view/articles') {
            return currentPath === '/view/articles' ? 'nav-button active' : 'nav-button';
        }

        if (path === '/view/jobs') {
            return currentPath === '/view/jobs' ? 'nav-button active' : 'nav-button';
        }

        return 'nav-button';
    };

    return (
        <nav className="app-navigation">
            <div className="nav-links">
                <Link to="/create" className={getNavLinkClass('/create')}>
                    Створити Нове Завдання
                </Link>
                {/*<Link to="/operator" className={getNavLinkClass('/operator')}>*/}
                {/*    Переглянути Завдання*/}
                {/*</Link>*/}
                <Link to="/view/articles" className={getNavLinkClass('/view/articles')}>
                    Таблиця з артикулами
                </Link>
                <Link to="/view/jobs" className={getNavLinkClass('/view/jobs')}>
                    Таблиця з завданнями
                </Link>
                <Link to="/view/information" className={getNavLinkClass('/view/information')}>
                    Журнал різки
                </Link>
            </div>

            <NotificationCenter userRole={userRole} />

            {/* Логотип справа */}
            <div className="logo-container">
                <img
                    src={selm}
                    alt="Логотип компанії"
                    className="nav-logo"
                    height='80px'
                    width='100px'
                />
                <img
                    src={voron}
                    alt="Логотип компанії"
                    className="nav-logo"
                    height='80px'
                    width='100px'
                />
            </div>
        </nav>
    );
};

function App() {

    useEffect(() => {
        const initializeApp = async () => {
            // Запит дозволу на сповіщення
            if ('Notification' in window && Notification.permission === 'default') {
                try {
                    const permission = await Notification.requestPermission();
                    console.log('Дозвіл на сповіщення:', permission);
                } catch (error) {
                    console.error('Помилка запиту дозволу на сповіщення:', error);
                }
            }

            // Перевірка Supabase real-time
            const realtimeWorking = await checkSupabaseRealtime();
            if (!realtimeWorking) {
                console.warn('⚠️ Real-time функціонал може не працювати');
            }
        };

        initializeApp();
    }, []);

    return (
        <div className="App">
            <header>
                <Navigation />
            </header>

            <StarryBackground titleText="ЖУРНАЛ ЛАЗЕРНОЇ РІЗКИ" />

            <main className="App-content">
                <Routes>
                    {/* Захищені маршрути */}
                    <Route path="/" element={<ProtectedRoute element={CuttingJobForm} />} />
                    <Route path="/create" element={<ProtectedRoute element={CuttingJobForm} />} />
                    {/*<Route path="/operator" element={<ProtectedRoute element={CuttingJobsSelectionPage} />} />*/}
                    <Route path="/operator/:jobId" element={<ProtectedRoute element={CuttingJobExecutionWrapper} />} />
                    <Route path="/view/articles" element={<ProtectedRoute element={ArticlesManagement} />} />
                    <Route path="/view/jobs" element={<ProtectedRoute element={CuttingJobsCRUD} />} />
                    {/* За замовчуванням - захищений */}
                    <Route path="*" element={<ProtectedRoute element={CuttingJobForm} />} />
                    {/* Незахищені маршрути */}
                    <Route path="/view/information" element={<PublicRoute element={JobsTableWithDetails} />} />
                </Routes>
            </main>
        </div>
    );
}

// Додамо простий компонент для тестування
const TestComponent = () => <div>Test Component</div>;

export default App;