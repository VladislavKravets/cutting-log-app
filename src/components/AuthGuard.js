// components/AuthGuard.js
import React, { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

const AuthGuard = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isChecking, setIsChecking] = useState(true);
    const location = useLocation();

    useEffect(() => {
        // Перевіряємо чи користувач вже авторизований
        const authStatus = localStorage.getItem('isAuthenticated');
        if (authStatus === 'true') {
            setIsAuthenticated(true);
        }
        setIsChecking(false);
    }, []);

    const handleLogin = (password) => {
        // const correctUsername = process.env.REACT_APP_AUTH_USERNAME;
        const correctPassword = process.env.REACT_APP_AUTH_PASSWORD;

        // if (username === correctUsername && password === correctPassword) {
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

    if (!isAuthenticated) {
        return <LoginForm onLogin={handleLogin} />;
    }

    return React.cloneElement(children, { onLogout: handleLogout });
};

// Компонент форми логіну
const LoginForm = ({ onLogin }) => {
    // const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        setError('');

        if (onLogin(password)) {
            setError('');
        } else {
            setError('Невірне ім\'я користувача або пароль');
        }
    };

    return (
        <div className="login-container">
            <div className="login-form">
                <h2>Авторизація</h2>
                <form onSubmit={handleSubmit}>
                    {/*<div className="form-group">*/}
                    {/*    <label htmlFor="username">Ім'я користувача:</label>*/}
                    {/*    <input*/}
                    {/*        type="text"*/}
                    {/*        id="username"*/}
                    {/*        value={username}*/}
                    {/*        onChange={(e) => setUsername(e.target.value)}*/}
                    {/*        required*/}
                    {/*    />*/}
                    {/*</div>*/}
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