// src/hooks/useFileServer.js
import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

// Стандартні налаштування
const defaultConfig = {
    url: 'http://localhost:3001',
    uploadEndpoint: '/api/upload',
    downloadEndpoint: '/api/download'
};

export const useFileServer = () => {
    const [config, setConfig] = useState(defaultConfig);
    const [isLoading, setIsLoading] = useState(true);

    // Завантажуємо налаштування з бекенду
    const loadConfigFromBackend = async () => {
        try {
            const { data, error } = await supabase
                .from('app_settings')
                .select('value')
                .eq('key', 'file_server_config')
                .single();

            if (error) throw error;

            if (data && data.value) {
                setConfig(data.value);
                // Також зберігаємо в localStorage для швидкого доступу
                localStorage.setItem('fileServerConfig', JSON.stringify(data.value));
            }
        } catch (error) {
            console.error('❌ Помилка завантаження з бекенду:', error);
            // Якщо не вдалося, пробуємо з localStorage
            const savedConfig = localStorage.getItem('fileServerConfig');
            if (savedConfig) {
                try {
                    setConfig(JSON.parse(savedConfig));
                } catch (e) {
                    console.error('❌ Помилка парсингу localStorage:', e);
                }
            }
        } finally {
            setIsLoading(false);
        }
    };

    // Зберігаємо налаштування в бекенд
    const saveConfigToBackend = async (newConfig) => {
        try {
            const { error } = await supabase
                .from('app_settings')
                .upsert({
                    key: 'file_server_config',
                    value: newConfig,
                    description: 'Глобальні налаштування файлового сервера'
                }, {
                    onConflict: 'key'
                });

            if (error) throw error;
            return true;
        } catch (error) {
            console.error('❌ Помилка збереження в бекенд:', error);
            return false;
        }
    };

    // Завантажуємо конфігурацію при завантаженні
    useEffect(() => {
        loadConfigFromBackend();
    }, []);

    // Оновлення конфігурації
    const updateConfig = async (newConfig) => {
        const updatedConfig = { ...config, ...newConfig };
        setConfig(updatedConfig);

        // Зберігаємо в localStorage для швидкого доступу
        localStorage.setItem('fileServerConfig', JSON.stringify(updatedConfig));

        // Синхронізуємо з бекендом
        const success = await saveConfigToBackend(updatedConfig);

        if (success) {
            console.log('🔄 Оновлено конфігурацію файлового сервера (глобально):', updatedConfig);
        } else {
            console.warn('⚠️ Конфігурацію збережено тільки локально');
        }
    };

    // Функції для отримання URL
    const getUploadUrl = () => `${config.url}${config.uploadEndpoint}`;
    const getDownloadUrl = (filename) => `${config.url}${config.downloadEndpoint}/${filename}`;

    return {
        config,
        updateConfig,
        getUploadUrl,
        getDownloadUrl,
        isLoading
    };
};