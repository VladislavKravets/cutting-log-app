// components/NotificationCenterDB.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import './NotificationCenter.css';

const NotificationCenterDB = () => {
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [isOpen, setIsOpen] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState('disconnected');
    const dropdownRef = useRef(null);

    // Завантаження сповіщень
    const loadNotifications = useCallback(async () => {
        try {
            setLoading(true);
            console.log('📥 Завантаження сповіщень...');

            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;

            if (data) {
                setNotifications(data);
                const unread = data.filter(n => !n.is_read).length;
                setUnreadCount(unread);
                console.log(`✅ Завантажено ${data.length} сповіщень`);
            }
        } catch (error) {
            console.error('❌ Помилка завантаження сповіщень:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    // Real-time підписка
    useEffect(() => {
        console.log('🔌 Підключення до Real-time...');

        // Спочатку завантажуємо сповіщення
        loadNotifications();

        // Створюємо real-time підписку
        const subscription = supabase
            .channel('notifications-realtime')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications'
                },
                (payload) => {
                    console.log('🎯 Нове сповіщення в реальному часі:', payload.new);
                    handleNewNotification(payload.new);
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'notifications'
                },
                (payload) => {
                    console.log('✏️ Оновлення сповіщення:', payload.new);
                    handleUpdatedNotification(payload.new);
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'DELETE',
                    schema: 'public',
                    table: 'notifications'
                },
                (payload) => {
                    console.log('🗑️ Видалення сповіщення:', payload.old);
                    handleDeletedNotification(payload.old.id);
                }
            )
            .subscribe((status) => {
                console.log('📡 Статус Real-time підписки:', status);
                setConnectionStatus(status);

                if (status === 'SUBSCRIBED') {
                    console.log('✅ Real-time підписка активована');
                } else if (status === 'CHANNEL_ERROR') {
                    console.error('❌ Помилка підписки Real-time');
                }
            });

        return () => {
            console.log('🧹 Відписка від Real-time');
            subscription.unsubscribe();
        };
    }, [loadNotifications]);

    // Обробка нового сповіщення
    const handleNewNotification = useCallback((notification) => {
        setNotifications(prev => {
            // Перевіряємо, чи сповіщення вже є в списку
            const exists = prev.find(n => n.id === notification.id);
            if (exists) return prev;

            // Додаємо нове сповіщення на початок списку
            return [notification, ...prev];
        });

        if (!notification.is_read) {
            setUnreadCount(prev => prev + 1);

            // Показуємо браузерне сповіщення
            if ('Notification' in window && Notification.permission === 'granted') {
                new Notification(notification.title, {
                    body: notification.message,
                    icon: '/favicon.ico'
                });
            }
        }
    }, []);

    // Обробка оновлення сповіщення
    const handleUpdatedNotification = useCallback((updatedNotification) => {
        setNotifications(prev =>
            prev.map(notification =>
                notification.id === updatedNotification.id ? updatedNotification : notification
            )
        );

        // Оновлюємо лічильник непрочитаних
        if (updatedNotification.is_read) {
            setUnreadCount(prev => Math.max(0, prev - 1));
        }
    }, []);

    // Обробка видалення сповіщення
    const handleDeletedNotification = useCallback((notificationId) => {
        setNotifications(prev => {
            const deletedNotification = prev.find(n => n.id === notificationId);
            if (deletedNotification && !deletedNotification.is_read) {
                setUnreadCount(prev => Math.max(0, prev - 1));
            }
            return prev.filter(notification => notification.id !== notificationId);
        });
    }, []);

    // Обробник кліку поза модальним вікном
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
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

    // Обробник клавіші Escape
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

    // Функції для роботи з сповіщеннями
    const markAsRead = async (notificationId = null) => {
        try {
            if (notificationId) {
                const { error } = await supabase
                    .from('notifications')
                    .update({ is_read: true })
                    .eq('id', notificationId);

                if (error) throw error;
                console.log('✅ Сповіщення позначено як прочитане:', notificationId);
            } else {
                const { error } = await supabase
                    .from('notifications')
                    .update({ is_read: true })
                    .eq('is_read', false);

                if (error) throw error;
                console.log('✅ Всі сповіщення позначено як прочитані');
                setUnreadCount(0);
            }
        } catch (error) {
            console.error('❌ Помилка при позначенні сповіщення як прочитаного:', error);
        }
    };

    const deleteNotification = async (notificationId) => {
        try {
            const { error } = await supabase
                .from('notifications')
                .delete()
                .eq('id', notificationId);

            if (error) throw error;
            console.log('🗑️ Сповіщення видалено:', notificationId);
        } catch (error) {
            console.error('❌ Помилка при видаленні сповіщення:', error);
        }
    };

    const clearAllNotifications = async () => {
        try {
            const { error } = await supabase
                .from('notifications')
                .delete()
                .gte('id', 0); // Видаляємо всі сповіщення

            if (error) throw error;

            setNotifications([]);
            setUnreadCount(0);
            console.log('🧹 Всі сповіщення очищено');
        } catch (error) {
            console.error('❌ Помилка при очищенні сповіщень:', error);
        }
    };

    const handleNotificationClick = async (notification) => {
        // Позначаємо як прочитане при кліку
        if (!notification.is_read) {
            await markAsRead(notification.id);
        }

        // Переходимо до завдання
        if (notification.job_id) {
            window.location.href = `#/view/jobs?id=${notification.job_id}`;
        }

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
            case 'warning': return '⚠️';
            case 'error': return '❌';
            default: return '📢';
        }
    };

    const getConnectionStatusText = () => {
        switch (connectionStatus) {
            case 'SUBSCRIBED': return '🟢 Підключено';
            case 'CHANNEL_ERROR': return '🔴 Помилка';
            case 'TIMED_OUT': return '🟡 Таймаут';
            default: return `⚪ З'єднання...`;
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

            {isOpen && (
                <div
                    className="notification-dropdown"
                    ref={dropdownRef}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="notification-header">
                        <div>
                            <h3>📢 Сповіщення</h3>
                            <div className="connection-status">
                                <div>Всього: {notifications.length} сповіщень</div>
                                <div>Непрочитаних: {unreadCount}</div>
                                <div>
                                    Статус: {getConnectionStatusText()}
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
                                🔄 Оновлення в реальному часі
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default NotificationCenterDB;