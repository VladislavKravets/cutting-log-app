// components/AuthGuard.js
import React, { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

const AuthGuard = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isChecking, setIsChecking] = useState(true);
    const location = useLocation();

    // Сторінки, які доступні без пароля
    const publicPages = ['/view/information', '/view/reports'];

    useEffect(() => {
        const authStatus = localStorage.getItem('isAuthenticated');
        if (authStatus === 'true') {
            setIsAuthenticated(true);
        }
        setIsChecking(false);
    }, []);

    const handleLogin = (password) => {
        const correctPassword = process.env.REACT_APP_AUTH_PASSWORD;

        if (password === correctPassword) {
            setIsAuthenticated(true);
            localStorage.setItem('isAuthenticated', 'true');
            return true;
        }
        return false;
    };

    const handleLogout = () => {
        setIsAuthenticated(false);
        localStorage.removeItem('isAuthenticated');
    };

    if (isChecking) {
        return <div>Перевірка авторизації...</div>;
    }

    // Якщо сторінка публічна - пропускаємо без пароля
    const isPublicPage = publicPages.includes(location.pathname);
    if (isPublicPage) {
        return React.cloneElement(children, {
            onLogout: handleLogout,
            isAuthenticated: isAuthenticated
        });
    }

    // Для захищених сторінок - вимагаємо пароль
    if (!isAuthenticated) {
        return <LoginForm onLogin={handleLogin} />;
    }

    return React.cloneElement(children, {
        onLogout: handleLogout,
        isAuthenticated: true
    });
};

// Компонент форми логіну (залишається без змін)
const LoginForm = ({ onLogin }) => {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        setError('');

        if (onLogin(password)) {
            setError('');
        } else {
            setError('Невірний пароль');
        }
    };

    return (
        <div className="login-container">
            <div className="login-form">
                <h2>Авторизація</h2>
                <p className="login-info">Для доступу до цієї сторінки потрібен пароль</p>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="password">Пароль:</label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    {error && <div className="error-message">{error}</div>}
                    <button type="submit" className="login-button">
                        Увійти
                    </button>
                </form>
            </div>
        </div>
    );
};

export default AuthGuard;