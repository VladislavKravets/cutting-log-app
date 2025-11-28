import selm from './assets/logo.ico';
import voron from './assets/logo2.ico';
import logo3 from './assets/logo3.ico';

import React, {useEffect} from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import './App.css';

import { FileServerProvider } from './contexts/FileServerContext';

// Імпортуємо компоненти
import CuttingJobForm from './components/CuttingJobForm';
import CuttingJobsSelectionPage from './components/CuttingJobsSelectionPage';
import JobsTableWithDetails from './components/JobsTableWithDetails';
import ArticlesManagement from './components/ArticlesManagement';
import CuttingJobsCRUD from './components/CuttingJobsCRUD';
import AuthGuard from './components/Auth/AuthGuard';
import CuttingJobExecutionWrapper from "./components/CuttingJobExecution/CuttingJobExecutionWrapper";
import MyDxfViewer from './components/DxfView/MyDxfViewer';


import NotificationCenter from "./components/Notification/NotificationCenterDB";
import {checkSupabaseRealtime} from "./hooks/checkSupabaseRealtime";
import StarryBackground from "./background/StarryBackground";
import FallingLeavesBackground from "./background/LeafsBackground";
import AutumnAnimation from "./background/AutumnAnimation";
import MiniChat from "./components/Chat/MiniChat";
import FileServerUrlChanger from "./components/FileServerUrlChanger";
import CuttingReportsFileManager from "./components/FileManager/CuttingReportsFileManager";

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
            return 'nav-button'; // Жодна з вкладок не активна
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

        if (path === '/view/reports') {
            return currentPath === '/view/reports' ? 'nav-button active' : 'nav-button';
        }

        return 'nav-button';
    };

    return (
        <nav className="app-navigation">
            <div className="nav-links">
                <Link to="/create" className={getNavLinkClass('/create')}>
                    Створити Завдання
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

                <Link to="/view/reports" className={getNavLinkClass('/view/reports')}>
                    Звіти
                </Link>
            </div>

            <NotificationCenter userRole={userRole} />

            {/* Логотип справа */}
            <div className="logo-container">
                <a href="/cutting-log-app">
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
                <img
                    src={logo3}
                    alt="Логотип компанії"
                    className="nav-logo"
                    height='80px'
                    width='100px'
                />
                </a>
            </div>
        </nav>
    );
};

function App() {
    useEffect(() => {
        // 1. Функція-обробник події "wheel"
        const handleWheel = (event) => {
            const activeElement = document.activeElement;
            // 2. Перевіряємо, чи елемент у фокусі є полем введення типу "number"
            if (activeElement && activeElement.type === 'number') {
                // 3. Забираємо фокус з елемента, щоб запобігти зміні значення
                activeElement.blur();
            }
        };
        // 4. Додаємо глобальний слухач події до об'єкта document
        document.addEventListener('wheel', handleWheel);
        // 5. Функція очищення: видаляємо слухача при демонтажі компонента
        return () => {
            document.removeEventListener('wheel', handleWheel);
        };
    }, []); // Пустий масив залежностей гарантує, що ефект запуститься лише один раз (при монтуванні

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
            <FileServerProvider>
            <header>
                <Navigation />
            </header>

            {/*<StarryBackground titleText="ЖУРНАЛ ЛАЗЕРНОЇ РІЗКИ" />*/} {/* Обычный фон */}
            {/*<FallingLeavesBackground/> /!* Осенний фон *!/*/}
            <AutumnAnimation/>
            <MiniChat/>
            <main className="App-content">
                <Routes>
                    {/* Захищені маршрути */}
                    <Route path="/" element={<ProtectedRoute element={TestComponent} />} />
                    <Route path="/create" element={<ProtectedRoute element={CuttingJobForm} />} />
                    {/*<Route path="/operator" element={<ProtectedRoute element={CuttingJobsSelectionPage} />} />*/}
                    <Route path="/operator/:jobId" element={<ProtectedRoute element={CuttingJobExecutionWrapper} />} />
                    <Route path="/view/articles" element={<ProtectedRoute element={ArticlesManagement} />} />
                    <Route path="/view/jobs" element={<ProtectedRoute element={CuttingJobsCRUD} />} />
                    <Route path="/view/reports" element={<PublicRoute element={CuttingReportsFileManager} />} />
                    {/* За замовчуванням - захищений */}
                    <Route path="*" element={<ProtectedRoute element={CuttingJobForm} />} />
                    <Route path="/config" element={<ProtectedRoute element={FileServerUrlChanger} />} />
                    {/* Незахищені маршрути */}
                    <Route path="/view/information" element={<PublicRoute element={JobsTableWithDetails} />} />
                    <Route path="/view/dxf" element={<PublicRoute element={MyDxfViewer} />} />
                </Routes>
            </main>
            </FileServerProvider>

        </div>
    );
}

// Додамо простий компонент для тестування
const TestComponent = () => <div></div>;

export default App;