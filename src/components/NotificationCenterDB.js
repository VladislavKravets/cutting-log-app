// components/NotificationCenterDB.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNotificationsDB } from '../hooks/useNotificationsDB';
import './NotificationCenter.css';

const NotificationCenterDB = () => {
    const {
        notifications,
        unreadCount,
        loading,
        markAsRead,
        deleteNotification,
        clearAllNotifications,
        manualCheckForNewNotifications,
        startAutoRefresh,
        stopAutoRefresh,
        isAutoRefreshActive,
        getAutoRefreshStatus
    } = useNotificationsDB();

    const [isOpen, setIsOpen] = useState(false);
    const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
    const dropdownRef = useRef(null);

    // Обробник кліку поза модальним вікном
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                // Перевіряємо, що клік не по кнопці сповіщень
                const notificationButton = document.querySelector('.notification-button');
                if (notificationButton && !notificationButton.contains(event.target)) {
                    setIsOpen(false);
                }
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('touchstart', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
        };
    }, [isOpen]);

    // Додаємо обробник клавіші Escape
    useEffect(() => {
        const handleEscapeKey = (event) => {
            if (event.key === 'Escape' && isOpen) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscapeKey);
        }

        return () => {
            document.removeEventListener('keydown', handleEscapeKey);
        };
    }, [isOpen]);

    // Видаляємо useEffect для автооновлення при відкритті,
    // тому що тепер автооновлення працює завжди

    // Додаємо логіку для перевірки статусу
    useEffect(() => {
        const status = getAutoRefreshStatus();
        console.log('🔧 Статус автооновлення:', {
            isOpen,
            autoRefreshEnabled,
            isAutoRefreshActive,
            status
        });
    }, [isOpen, autoRefreshEnabled, isAutoRefreshActive, getAutoRefreshStatus]);

    // Покращена функція перемикача
    const toggleAutoRefresh = useCallback(() => {
        if (autoRefreshEnabled) {
            console.log('🔴 Вимкнення автооновлення');
            stopAutoRefresh();
            setAutoRefreshEnabled(false);
        } else {
            console.log('🟢 Увімкнення автооновлення');
            startAutoRefresh();
            setAutoRefreshEnabled(true);
        }
    }, [autoRefreshEnabled, startAutoRefresh, stopAutoRefresh]);

    // Додаємо обробник видимості стоінки
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden) {
                console.log('📄 Сторінка неактивна - зупиняємо автооновлення');
                stopAutoRefresh();
            } else if (autoRefreshEnabled) {
                console.log('📄 Сторінка активна - відновлюємо автооновлення');
                startAutoRefresh();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [autoRefreshEnabled, startAutoRefresh, stopAutoRefresh]);

    const handleNotificationClick = async (notification) => {
        // Позначаємо як прочитане при кліку
        if (!notification.is_read) {
            await markAsRead(notification.id);
        }

        // Переходимо до завдання
        if (notification.job_id) {
            window.location.href = `#/view/jobs?id=${notification.job_id}`;
        }

        // Закриваємо модальне вікно при кліку на сповіщення
        setIsOpen(false);
    };

    const formatTime = (timestamp) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'щойно';
        if (diffMins < 60) return `${diffMins} хв тому`;
        if (diffHours < 24) return `${diffHours} год тому`;
        if (diffDays < 7) return `${diffDays} дн тому`;

        return date.toLocaleDateString('uk-UA', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    const getNotificationIcon = (type) => {
        switch (type) {
            case 'new_job': return '🆕';
            case 'job_completed': return '✅';
            case 'system': return 'ℹ️';
            default: return '📢';
        }
    };

    if (loading && notifications.length === 0) {
        return (
            <div className="notification-center">
                <button className="notification-button" disabled>
                    ⏳
                </button>
            </div>
        );
    }

    return (
        <div className="notification-center">
            <button
                className="notification-button"
                onClick={() => setIsOpen(!isOpen)}
                title="Сповіщення"
            >
                📢
                {unreadCount > 0 && (
                    <span className="notification-badge">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Кнопки управління */}
            <div className="test-buttons">
                <button
                    onClick={manualCheckForNewNotifications}
                    className="test-btn"
                    title="Перевірити нові сповіщення"
                >
                    🔄
                </button>
            </div>

            {isOpen && (
                <div
                    className="notification-dropdown"
                    ref={dropdownRef}
                    onClick={(e) => e.stopPropagation()} // Запобігаємо закриттю при кліку всередині
                >
                    <div className="notification-header">
                        <div>
                            <h3>📢 Сповіщення</h3>
                            <div className="connection-status">
                                <div>Всього: {notifications.length} сповіщень</div>
                                <div>Непрочитаних: {unreadCount}</div>
                                <div>
                                    Статус автооновлення:
                                    <span className={`status-indicator ${isAutoRefreshActive ? 'active' : 'inactive'}`}>
                                        {isAutoRefreshActive ? '🟢 Активне' : '🔴 Неактивне'}
                                    </span>
                                </div>
                                <div>
                                    Авто-оновлення:
                                    <button
                                        onClick={toggleAutoRefresh}
                                        className={`auto-refresh-btn ${autoRefreshEnabled ? 'enabled' : 'disabled'}`}
                                    >
                                        {autoRefreshEnabled ? '✅ Увімкнено' : '❌ Вимкнено'}
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="notification-actions">
                            {unreadCount > 0 && (
                                <button onClick={() => markAsRead()}>Прочитати всі</button>
                            )}
                            {notifications.length > 0 && (
                                <button onClick={clearAllNotifications}>Очистити всі</button>
                            )}
                            {/* Кнопка закриття */}
                            <button
                                className="close-dropdown-btn"
                                onClick={() => setIsOpen(false)}
                                title="Закрити"
                            >
                                ×
                            </button>
                        </div>
                    </div>

                    <div className="notification-list">
                        {notifications.length === 0 ? (
                            <div className="no-notifications">
                                📭 Немає сповіщень
                            </div>
                        ) : (
                            notifications.map((notification) => (
                                <div
                                    key={notification.id}
                                    className={`notification-item ${!notification.is_read ? 'unread' : ''}`}
                                >
                                    <div
                                        className="notification-content"
                                        onClick={() => handleNotificationClick(notification)}
                                    >
                                        <div className="notification-icon">
                                            {getNotificationIcon(notification.type)}
                                        </div>
                                        <div className="notification-text">
                                            <div className="notification-title">
                                                {notification.title}
                                            </div>
                                            <div className="notification-message">
                                                {notification.message}
                                            </div>
                                            <div className="notification-time">
                                                {formatTime(notification.created_at)}
                                                {notification.job_id && ` • Завдання #${notification.job_id}`}
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        className="delete-notification-btn"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            deleteNotification(notification.id);
                                        }}
                                        title="Видалити сповіщення"
                                    >
                                        ×
                                    </button>
                                </div>
                            ))
                        )}
                    </div>

                    {notifications.length > 0 && (
                        <div className="notification-footer">
                            <div className="notification-stats">
                                {autoRefreshEnabled ? (
                                    <>🔄 Автоматичне оновлення кожні 8 секунд</>
                                ) : (
                                    <>⏸️ Автоматичне оновлення вимкнено</>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default NotificationCenterDB;