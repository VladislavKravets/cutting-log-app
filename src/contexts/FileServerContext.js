// src/contexts/FileServerContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const FileServerContext = createContext();

export const useFileServer = () => {
    const context = useContext(FileServerContext);
    if (!context) {
        throw new Error('useFileServer must be used within a FileServerProvider');
    }
    return context;
};

export const FileServerProvider = ({ children }) => {
    const [config, setConfig] = useState(null);
    const [loading, setLoading] = useState(true);

    // Завантажуємо налаштування з Supabase одразу
    useEffect(() => {
        const fetchSettingsFromSupabase = async () => {
            try {
                setLoading(true);

                // Отримуємо налаштування з таблиці app_settings
                const { data, error } = await supabase
                    .from('app_settings')
                    .select('key, value')
                    .eq('key', 'file_server_config'); // Шукаємо запис з ключем, що містить весь config

                if (error) throw error;

                let newConfig = {
                    url: 'http://172.30.50.232:3001',
                    uploadEndpoint: '/api/upload',
                    downloadEndpoint: '/api/download'
                };

                console.log('Дані з БД:', data);

                if (data && data.length > 0) {
                    // Беремо перший запис, який містить весь об'єкт конфігурації
                    const configData = data[0].value;

                    if (configData) {
                        newConfig = {
                            url: configData.url || newConfig.url,
                            uploadEndpoint: configData.uploadEndpoint || newConfig.uploadEndpoint,
                            downloadEndpoint: configData.downloadEndpoint || newConfig.downloadEndpoint
                        };
                    }
                }

                // Перевіряємо localStorage тільки якщо в БД немає даних
                const savedConfig = localStorage.getItem('fileServerConfig');
                if (savedConfig && (!data || data.length === 0)) {
                    try {
                        newConfig = { ...newConfig, ...JSON.parse(savedConfig) };
                    } catch (error) {
                        console.error('❌ Помилка завантаження збереженої конфігурації:', error);
                    }
                }

                setConfig(newConfig);
                console.log('✅ Налаштування завантажено:', newConfig);

            } catch (error) {
                console.error('❌ Помилка завантаження з Supabase:', error);
                // Використовуємо значення за замовчуванням + localStorage
                const savedConfig = localStorage.getItem('fileServerConfig');
                const defaultConfig = {
                    url: 'http://172.30.50.232:3001',
                    uploadEndpoint: '/api/upload',
                    downloadEndpoint: '/api/download'
                };

                if (savedConfig) {
                    try {
                        setConfig({ ...defaultConfig, ...JSON.parse(savedConfig) });
                    } catch (e) {
                        setConfig(defaultConfig);
                    }
                } else {
                    setConfig(defaultConfig);
                }
            } finally {
                setLoading(false);
            }
        };

        fetchSettingsFromSupabase();
    }, []);

    // Зберігаємо конфігурацію в localStorage при зміні
    useEffect(() => {
        if (config) {
            localStorage.setItem('fileServerConfig', JSON.stringify(config));
        }
    }, [config]);

    const updateConfig = (newConfig) => {
        setConfig(prev => ({ ...prev, ...newConfig }));
        console.log('🔄 Оновлено конфігурацію файлового сервера:', { ...config, ...newConfig });
    };

    // Якщо ще завантажується, використовуємо значення за замовчуванням
    const currentConfig = config || {
        url: 'http://172.30.50.232:3001',
        uploadEndpoint: '/api/upload',
        downloadEndpoint: '/api/download'
    };

    const value = {
        config: currentConfig,
        updateConfig,
        getHomeUrl: () => `${currentConfig.url}`,
        getUploadUrl: () => `${currentConfig.url}${currentConfig.uploadEndpoint}`,
        getDownloadUrl: (filename) => `${currentConfig.url}${currentConfig.downloadEndpoint}/${filename}`
    };

    return (
        <FileServerContext.Provider value={value}>
            {children}
        </FileServerContext.Provider>
    );
};