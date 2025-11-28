// src/config/fileServer.js

// Глобальна конфігурація файлового сервера
let FILE_SERVER_CONFIG = {
    url: 'http://172.30.50.232:3001',
    uploadEndpoint: '/api/upload',
    downloadEndpoint: '/api/download'
};

// Функції для роботи з конфігурацією
export const getFileServerConfig = () => ({ ...FILE_SERVER_CONFIG });

export const setFileServerConfig = (newConfig) => {
    FILE_SERVER_CONFIG = { ...FILE_SERVER_CONFIG, ...newConfig };
    console.log('🔄 Оновлено конфігурацію файлового сервера:', FILE_SERVER_CONFIG);

    // Зберігаємо в localStorage для збереження між перезавантаженнями
    if (typeof window !== 'undefined') {
        localStorage.setItem('fileServerConfig', JSON.stringify(FILE_SERVER_CONFIG));
    }
};

// Завантажуємо збережену конфігурацію при ініціалізації
if (typeof window !== 'undefined') {
    const savedConfig = localStorage.getItem('fileServerConfig');
    if (savedConfig) {
        try {
            FILE_SERVER_CONFIG = { ...FILE_SERVER_CONFIG, ...JSON.parse(savedConfig) };
        } catch (error) {
            console.error('❌ Помилка завантаження збереженої конфігурації:', error);
        }
    }
}

export default FILE_SERVER_CONFIG;