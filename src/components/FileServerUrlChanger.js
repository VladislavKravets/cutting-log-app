// src/components/FileServerUrlChanger.js
import React, { useState } from 'react';
import { useFileServer } from '../hooks/useFileServer';
import './FileServerUrlChanger.css';

function FileServerUrlChanger() {
    const { config, updateConfig, isLoading } = useFileServer();
    const [isVisible, setIsVisible] = useState(false);
    const [newUrl, setNewUrl] = useState(config.url);
    const [isSaving, setIsSaving] = useState(false);

    // Оновлюємо форму при зміні конфігурації
    React.useEffect(() => {
        if (!isLoading) {
            setNewUrl(config.url);
        }
    }, [config, isLoading]);

    const handleSave = async () => {
        setIsSaving(true);
        await updateConfig({ url: newUrl });
        setIsSaving(false);
        setIsVisible(false);
        alert(`✅ URL файлового сервера змінено глобально на: ${newUrl}`);
    };

    const handleTest = async () => {
        try {
            const response = await fetch(`${newUrl}/api/files`);
            if (response.ok) {
                alert('✅ Файловий сервер доступний!');
            } else {
                alert('⚠️ Сервер відповідає, але з помилкою');
            }
        } catch (error) {
            alert(`❌ Не вдалося підключитися: ${error.message}`);
        }
    };

    if (isLoading) {
        return (
            <button className="file-url-changer__btn" disabled>
                ⏳
            </button>
        );
    }

    return (
        <>
            <button
                onClick={() => setIsVisible(true)}
                className="file-url-changer__btn"
                title="Змінити URL файлового сервера (глобально)"
            >
                🔧
            </button>

            {isVisible && (
                <div className="file-url-changer__overlay">
                    <div className="file-url-changer__modal">
                        <div className="file-url-changer__header">
                            <h3>⚙️ Глобальні налаштування файлового сервера</h3>
                            <button
                                onClick={() => setIsVisible(false)}
                                className="file-url-changer__close"
                                disabled={isSaving}
                            >
                                ×
                            </button>
                        </div>

                        <div className="file-url-changer__content">
                            <div className="file-url-changer__current">
                                <strong>Поточний URL (глобально):</strong>
                                <code>{config.url}</code>
                            </div>

                            <div className="file-url-changer__input-group">
                                <label>Новий URL файлового сервера:</label>
                                <input
                                    type="url"
                                    value={newUrl}
                                    onChange={(e) => setNewUrl(e.target.value)}
                                    placeholder="http://localhost:3001"
                                    className="file-url-changer__input"
                                    disabled={isSaving}
                                />
                                <small>
                                    Ця зміна вплине на всіх користувачів системи
                                </small>
                            </div>

                            <div className="file-url-changer__actions">
                                <button
                                    onClick={handleTest}
                                    className="file-url-changer__action file-url-changer__action--test"
                                    disabled={isSaving}
                                >
                                    Тестувати
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving || !newUrl}
                                    className="file-url-changer__action file-url-changer__action--save"
                                >
                                    {isSaving ? 'Збереження...' : 'Зберегти глобально'}
                                </button>
                                <button
                                    onClick={() => setIsVisible(false)}
                                    disabled={isSaving}
                                    className="file-url-changer__action file-url-changer__action--cancel"
                                >
                                    Скасувати
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default FileServerUrlChanger;