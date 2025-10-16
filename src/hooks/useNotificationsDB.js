// hooks/useNotificationsDB.js
import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient';

export const useNotificationsDB = () => {
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [lastNotificationId, setLastNotificationId] = useState(0);
    const [isAutoRefreshActive, setIsAutoRefreshActive] = useState(false);
    const pollingRef = useRef(null);

    // Ключі для локального сховища
    const READ_NOTIFICATIONS_KEY = 'read_notifications';
    const NOTIFICATIONS_CACHE_KEY = 'notifications_cache';
    const HIDDEN_NOTIFICATIONS_KEY = 'hidden_notifications';

    // Отримати прочитані сповіщення з локального сховища
    const getReadNotifications = useCallback(() => {
        try {
            const stored = localStorage.getItem(READ_NOTIFICATIONS_KEY);
            return stored ? new Set(JSON.parse(stored)) : new Set();
        } catch (error) {
            console.error('❌ Помилка читання локальних сповіщень:', error);
            return new Set();
        }
    }, []);

    // Отримати приховані сповіщення
    const getHiddenNotifications = useCallback(() => {
        try {
            const stored = localStorage.getItem(HIDDEN_NOTIFICATIONS_KEY);
            return stored ? new Set(JSON.parse(stored)) : new Set();
        } catch (error) {
            console.error('❌ Помилка читання прихованих сповіщень:', error);
            return new Set();
        }
    }, []);

    // Зберегти прочитані сповіщення в локальне сховище
    const saveReadNotifications = useCallback((readIds) => {
        try {
            localStorage.setItem(READ_NOTIFICATIONS_KEY, JSON.stringify(Array.from(readIds)));
        } catch (error) {
            console.error('❌ Помилка збереження локальних сповіщень:', error);
        }
    }, []);

    // Зберегти приховані сповіщення
    const saveHiddenNotifications = useCallback((hiddenIds) => {
        try {
            localStorage.setItem(HIDDEN_NOTIFICATIONS_KEY, JSON.stringify(Array.from(hiddenIds)));
        } catch (error) {
            console.error('❌ Помилка збереження прихованих сповіщень:', error);
        }
    }, []);

    // Кешування сповіщень
    const saveNotificationsToCache = useCallback((notifications) => {
        try {
            localStorage.setItem(NOTIFICATIONS_CACHE_KEY, JSON.stringify(notifications));
        } catch (error) {
            console.error('❌ Помилка кешування сповіщень:', error);
        }
    }, []);

    const getNotificationsFromCache = useCallback(() => {
        try {
            const cached = localStorage.getItem(NOTIFICATIONS_CACHE_KEY);
            return cached ? JSON.parse(cached) : [];
        } catch (error) {
            console.error('❌ Помилка читання кешу сповіщень:', error);
            return [];
        }
    }, []);

    // Перевірити, чи сповіщення прочитане локально
    const isReadLocal = useCallback((notificationId) => {
        const readNotifications = getReadNotifications();
        return readNotifications.has(notificationId);
    }, [getReadNotifications]);

    // Перевірити, чи сповіщення приховане локально
    const isHiddenLocal = useCallback((notificationId) => {
        const hiddenNotifications = getHiddenNotifications();
        return hiddenNotifications.has(notificationId);
    }, [getHiddenNotifications]);

    // Позначити сповіщення як прочитане локально
    const markAsReadLocal = useCallback((notificationId) => {
        const readNotifications = getReadNotifications();
        if (!readNotifications.has(notificationId)) {
            readNotifications.add(notificationId);
            saveReadNotifications(readNotifications);

            setNotifications(prev =>
                prev.map(notification =>
                    notification.id === notificationId
                        ? { ...notification, is_read_local: true }
                        : notification
                )
            );

            setUnreadCount(prev => Math.max(0, prev - 1));
        }
    }, [getReadNotifications, saveReadNotifications]);

    // Приховати сповіщення локально
    const hideNotificationLocal = useCallback((notificationId) => {
        const hiddenNotifications = getHiddenNotifications();
        if (!hiddenNotifications.has(notificationId)) {
            hiddenNotifications.add(notificationId);
            saveHiddenNotifications(hiddenNotifications);

            // Видаляємо сповіщення зі списку
            setNotifications(prev =>
                prev.filter(notification => notification.id !== notificationId)
            );

            // Оновлюємо лічильник непрочитаних
            const deletedNotification = notifications.find(n => n.id === notificationId);
            if (deletedNotification && !deletedNotification.is_read_local) {
                setUnreadCount(prev => Math.max(0, prev - 1));
            }
        }
    }, [getHiddenNotifications, saveHiddenNotifications, notifications]);

    // Функція для показу браузерних сповіщень
    const showBrowserNotification = useCallback((title, message, jobId = null) => {
        if ('Notification' in window && Notification.permission === 'granted') {
            try {
                const browserNotification = new Notification(title, {
                    body: message,
                    icon: '/favicon.ico',
                    tag: `notification-${Date.now()}`
                });

                browserNotification.onclick = () => {
                    window.focus();
                    if (jobId) {
                        window.location.href = `/view/jobs?id=${jobId}`;
                    }
                    browserNotification.close();
                };

                setTimeout(() => {
                    browserNotification.close();
                }, 5000);
            } catch (error) {
                console.error('❌ Помилка показу браузерного сповіщення:', error);
            }
        }
    }, []);

    // Оновлення лічильника непрочитаних
    const updateUnreadCount = useCallback((notificationsList) => {
        const unread = notificationsList.filter(n => !n.is_read_local).length;
        setUnreadCount(unread);
    }, []);

    // Завантаження сповіщень з БД з локальним статусом
    const loadNotifications = useCallback(async () => {
        try {
            setLoading(true);
            //console.log('📥 Завантаження сповіщень з БД...');

            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100);

            if (error) {
                console.error('❌ Помилка завантаження сповіщень:', error);
                const cached = getNotificationsFromCache();
                if (cached.length > 0) {
                    //console.log('📂 Використовуємо кешовані сповіщення');
                    setNotifications(cached);
                    updateUnreadCount(cached);
                }
                return;
            }

            if (data && data.length > 0) {
                //console.log(`✅ Завантажено ${data.length} сповіщень з БД`);

                const readNotifications = getReadNotifications();
                const hiddenNotifications = getHiddenNotifications();

                // Фільтруємо сповіщення - видаляємо приховані
                const filteredNotifications = data.filter(notification =>
                    !hiddenNotifications.has(notification.id)
                );

                // Додаємо локальний статус
                const notificationsWithLocalStatus = filteredNotifications.map(notification => ({
                    ...notification,
                    is_read_local: readNotifications.has(notification.id)
                }));

                setNotifications(notificationsWithLocalStatus);
                updateUnreadCount(notificationsWithLocalStatus);
                saveNotificationsToCache(notificationsWithLocalStatus);

                setLastNotificationId(data[0].id);
            } else {
                //console.log('📭 В БД немає сповіщень');
                setNotifications([]);
                setUnreadCount(0);
                setLastNotificationId(0);
            }
        } catch (err) {
            console.error('❌ Помилка при завантаженні сповіщень:', err);
        } finally {
            setLoading(false);
        }
    }, [getReadNotifications, getHiddenNotifications, getNotificationsFromCache, saveNotificationsToCache, updateUnreadCount]);

    // Перевірка нових сповіщень
    const checkForNewNotifications = useCallback(async () => {
        try {
            //console.log('🔍 Перевірка нових сповіщень...');

            if (lastNotificationId === 0) {
                await loadNotifications();
                return;
            }

            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .gt('id', lastNotificationId)
                .order('id', { ascending: true });

            if (error) {
                console.error('❌ Помилка при перевірці нових сповіщень:', error);
                return;
            }

            if (data && data.length > 0) {
                //console.log(`📨 Знайдено ${data.length} нових сповіщень`);

                const readNotifications = getReadNotifications();
                const hiddenNotifications = getHiddenNotifications();

                // Фільтруємо нові сповіщення - видаляємо приховані
                const filteredNewNotifications = data.filter(notification =>
                    !hiddenNotifications.has(notification.id)
                );

                const newNotificationsWithLocalStatus = filteredNewNotifications.map(notification => ({
                    ...notification,
                    is_read_local: readNotifications.has(notification.id)
                }));

                // Оновлюємо стан одним викликом
                setNotifications(prev => {
                    const updated = [...newNotificationsWithLocalStatus, ...prev];

                    // Рахуємо нові непрочитані
                    const newUnread = newNotificationsWithLocalStatus.filter(n => !n.is_read_local).length;
                    setUnreadCount(current => current + newUnread);

                    // Оновлюємо кеш
                    saveNotificationsToCache(updated);

                    return updated;
                });

                setLastNotificationId(data[data.length - 1].id);

                // Показуємо браузерні сповіщення
                newNotificationsWithLocalStatus.forEach(notification => {
                    if (!notification.is_read_local) {
                        showBrowserNotification(notification.title, notification.message, notification.job_id);
                    }
                });
            } else {
                //console.log('📭 Нових сповіщень не знайдено');
            }
        } catch (error) {
            console.error('❌ Помилка при перевірці сповіщень:', error);
        }
    }, [lastNotificationId, loadNotifications, showBrowserNotification, getReadNotifications, getHiddenNotifications, saveNotificationsToCache]);

    // Позначити як прочитане (ТІЛЬКИ локально)
    const markAsRead = useCallback((notificationId = null) => {
        try {
            const readNotifications = getReadNotifications();

            if (notificationId) {
                markAsReadLocal(notificationId);
                //console.log('✅ Сповіщення позначено як прочитане локально:', notificationId);
            } else {
                // Позначаємо всі видимі сповіщення як прочитані
                const visibleIds = notifications.map(n => n.id);
                visibleIds.forEach(id => readNotifications.add(id));
                saveReadNotifications(readNotifications);

                setNotifications(prev =>
                    prev.map(notification => ({
                        ...notification,
                        is_read_local: true
                    }))
                );

                setUnreadCount(0);
                //console.log('✅ Всі видимі сповіщення позначено як прочитані локально');
            }
        } catch (error) {
            console.error('❌ Помилка при позначенні сповіщення як прочитаного:', error);
        }
    }, [notifications, getReadNotifications, saveReadNotifications, markAsReadLocal]);

    // ЛОКАЛЬНЕ видалення сповіщення
    const deleteNotification = useCallback((notificationId) => {
        try {
            //console.log('🗑️ Локальне видалення сповіщення:', notificationId);
            hideNotificationLocal(notificationId);
        } catch (error) {
            console.error('❌ Помилка при локальному видаленні сповіщення:', error);
        }
    }, [hideNotificationLocal]);

    // ЛОКАЛЬНЕ очищення всіх сповіщень
    const clearAllNotifications = useCallback(() => {
        try {
            //console.log('🧹 Локальне очищення всіх сповіщень');

            const allNotificationIds = notifications.map(n => n.id);
            const hiddenNotifications = getHiddenNotifications();

            // Додаємо всі поточні сповіщення до прихованих
            allNotificationIds.forEach(id => hiddenNotifications.add(id));
            saveHiddenNotifications(hiddenNotifications);

            // Очищуємо локальний стан
            setNotifications([]);
            setUnreadCount(0);

            //console.log('✅ Всі сповіщення приховано локально');
        } catch (error) {
            console.error('❌ Помилка при локальному очищенні сповіщень:', error);
        }
    }, [notifications, getHiddenNotifications, saveHiddenNotifications]);

    // Обробка нового сповіщення з real-time
    const handleNewNotification = useCallback((notification) => {
        //console.log('🎯 Обробка нового сповіщення з real-time:', notification);

        // Перевіряємо, чи сповіщення не приховане
        if (isHiddenLocal(notification.id)) {
            //console.log('🚫 Сповіщення приховане, пропускаємо:', notification.id);
            return;
        }

        const isRead = isReadLocal(notification.id);
        const notificationWithLocalStatus = {
            ...notification,
            is_read_local: isRead
        };

        setNotifications(prev => {
            const exists = prev.find(n => n.id === notification.id);
            if (exists) {
                //console.log('⚠️ Сповіщення вже існує, пропускаємо');
                return prev;
            }

            const updated = [notificationWithLocalStatus, ...prev];

            // Оновлюємо лічильник
            if (!isRead) {
                setUnreadCount(current => current + 1);
                showBrowserNotification(notification.title, notification.message, notification.job_id);
            }

            // Оновлюємо кеш
            saveNotificationsToCache(updated);

            return updated;
        });

        if (notification.id > lastNotificationId) {
            setLastNotificationId(notification.id);
        }
    }, [lastNotificationId, showBrowserNotification, isReadLocal, isHiddenLocal, saveNotificationsToCache]);

    // Функція старту автооновлення
    const startAutoRefresh = useCallback(() => {
        //console.log('🔄 Запуск автоматичного оновлення сповіщень...');

        if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
        }

        pollingRef.current = setInterval(() => {
            //console.log('⏰ Автоматична перевірка нових сповіщень...');
            checkForNewNotifications();
        }, 15000);

        setIsAutoRefreshActive(true);
        //console.log('✅ Автооновлення активовано');

        return () => {
            if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
                setIsAutoRefreshActive(false);
            }
        };
    }, [checkForNewNotifications]);

    // Функція зупинки автооновлення
    const stopAutoRefresh = useCallback(() => {
        //console.log('⏹️ Зупинка автоматичного оновлення...');
        if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
            setIsAutoRefreshActive(false);
            //console.log('✅ Автооновлення зупинено');
        }
    }, []);

    // Очищення локальних даних (скидання всіх локальних налаштувань)
    const clearLocalData = useCallback(() => {
        try {
            localStorage.removeItem(READ_NOTIFICATIONS_KEY);
            localStorage.removeItem(NOTIFICATIONS_CACHE_KEY);
            localStorage.removeItem(HIDDEN_NOTIFICATIONS_KEY);
            //console.log('🧹 Всі локальні дані сповіщень очищено');
            loadNotifications();
        } catch (error) {
            console.error('❌ Помилка очищення локальних даних:', error);
        }
    }, [loadNotifications]);

    // Відновлення прихованих сповіщень
    const restoreHiddenNotifications = useCallback(() => {
        try {
            localStorage.removeItem(HIDDEN_NOTIFICATIONS_KEY);
            //console.log('🔓 Всі приховані сповіщення відновлено');
            loadNotifications();
        } catch (error) {
            console.error('❌ Помилка відновлення сповіщень:', error);
        }
    }, [loadNotifications]);

    // Real-time підписка
    useEffect(() => {
        //console.log('🔌 Ініціалізація real-time підписки...');

        let subscription;

        const initializeRealtime = async () => {
            try {
                await loadNotifications();

                subscription = supabase
                    .channel('notifications-public')
                    .on(
                        'postgres_changes',
                        {
                            event: 'INSERT',
                            schema: 'public',
                            table: 'notifications'
                        },
                        (payload) => {
                            //console.log('🎯 Нове сповіщення в реальному часі:', payload.new);
                            handleNewNotification(payload.new);
                        }
                    )
                    .subscribe((status) => {
                        //console.log('📡 Статус real-time підписки:', status);
                    });

            } catch (error) {
                console.error('❌ Помилка ініціалізації real-time:', error);
            }
        };

        initializeRealtime();

        return () => {
            if (subscription) {
                subscription.unsubscribe();
            }
        };
    }, []);

    // Автоматичне оновлення
    useEffect(() => {
        //console.log('🚀 Ініціалізація автоматичного оновлення...');
        const cleanupPolling = startAutoRefresh();

        return () => {
            if (cleanupPolling) cleanupPolling();
        };
    }, [startAutoRefresh]);

    // Інші функції залишаються без змін
    const createNotification = async (notificationData) => {
        try {
            const { data, error } = await supabase
                .from('notifications')
                .insert([{
                    type: notificationData.type || 'system',
                    title: notificationData.title,
                    message: notificationData.message,
                    job_id: notificationData.job_id || null
                }])
                .select();

            if (error) throw error;

            //console.log('📝 Нове сповіщення створено в БД:', data[0]);
            return data[0];
        } catch (error) {
            console.error('❌ Помилка при створенні сповіщення:', error);
            throw error;
        }
    };

    const manualCheckForNewNotifications = async () => {
        //console.log('🔍 Ручна перевірка нових сповіщень...');
        await checkForNewNotifications();
    };

    const getAutoRefreshStatus = useCallback(() => {
        return {
            isActive: isAutoRefreshActive,
            intervalExists: pollingRef.current !== null
        };
    }, [isAutoRefreshActive]);

    return {
        notifications,
        unreadCount,
        loading,
        loadNotifications,
        markAsRead,
        deleteNotification,
        clearAllNotifications,
        createNotification,
        manualCheckForNewNotifications,
        startAutoRefresh,
        stopAutoRefresh,
        isAutoRefreshActive,
        getAutoRefreshStatus,
        clearLocalData,
        restoreHiddenNotifications, // Нова функція для відновлення сповіщень
        isReadLocal
    };
};