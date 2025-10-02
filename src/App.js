import React from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import './App.css';

// Імпортуємо компоненти окремо для перевірки
import CuttingJobForm from './components/CuttingJobForm';
import CuttingJobsSelectionPage from './components/CuttingJobsSelectionPage';
import JobsTableWithDetails from './components/JobsTableWithDetails';
import ArticlesManagement from './components/ArticlesManagement';
import CuttingJobsCRUD from './components/CuttingJobsCRUD';

// Додамо простий компонент для тестування
const TestComponent = () => <div>Test Component</div>;

const Navigation = () => {
  const location = useLocation();
  
  const getNavLinkClass = (path) => {
    const currentPath = location.pathname;
    
    // Якщо це головна сторінка, вважаємо її як '/create'
    if (currentPath === '/') {
      return path === '/create' ? 'nav-button active' : 'nav-button';
    }
    
    // Перевіряємо точне співпадіння або початок шляху для груп маршрутів
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
      <Link to="/create" className={getNavLinkClass('/create')}>
        Створити Нове Завдання
      </Link>
      <Link to="/operator" className={getNavLinkClass('/operator')}>
        Переглянути Завдання
      </Link>
      <Link to="/view/information" className={getNavLinkClass('/view/information')}>
        Таблиця з даними
      </Link>
      <Link to="/view/articles" className={getNavLinkClass('/view/articles')}>
        Таблиця з артикулами
      </Link>
      <Link to="/view/jobs" className={getNavLinkClass('/view/jobs')}>
        Таблиця з завданнями
      </Link>
    </nav>
  );
};

function App() {
  return (
    <BrowserRouter>
      <div className="App">
        <header>
          <Navigation />
        </header>
        
        <main className="App-content">
          <Routes>
            {/* Спочатку протестуємо з простим компонентом */}
            <Route path="/test" element={<TestComponent />} />
            
            {/* Потім додаємо по одному компоненту для виявлення проблемного */}
            <Route path="/" element={<CuttingJobForm />} />
            <Route path="/create" element={<CuttingJobForm />} />
            <Route path="/operator" element={<CuttingJobsSelectionPage />} />
            <Route path="/view/information" element={<JobsTableWithDetails />} />
            <Route path="/view/articles" element={<ArticlesManagement />} />
            <Route path="/view/jobs" element={<CuttingJobsCRUD/>} />
            <Route path="*" element={<CuttingJobForm />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;