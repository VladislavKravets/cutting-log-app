import React, { useState, useEffect } from 'react';
// import { supabase } from '../../supabaseClient';
import './FileViewer.css';

function FileViewer({ fileUrl, fileName, onClose }) {
    const [fileContent, setFileContent] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const getFileExtension = (filename) => {
        return filename?.split('.').pop()?.toLowerCase();
    };

    const downloadFile = async () => {
        if (!fileUrl) return;

        try {
            setLoading(true);
            // Для PDF, зображень та текстових файлів можна відкрити в новому вікні
            const extension = getFileExtension(fileName);
            const supportedExtensions = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'txt'];

            if (supportedExtensions.includes(extension)) {
                window.open(fileUrl, '_blank');
            } else {
                // Для інших типів файлів - примусове завантаження
                const link = document.createElement('a');
                link.href = fileUrl;
                link.download = fileName || 'download';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        } catch (err) {
            console.error('Помилка відкриття файлу:', err);
            setError('Не вдалося відкрити файл');
        } finally {
            setLoading(false);
        }
    };

    const renderFilePreview = () => {
        if (!fileUrl) return null;

        const extension = getFileExtension(fileName);

        switch (extension) {
            case 'pdf':
                return (
                    <iframe
                        src={fileUrl}
                        width="100%"
                        height="600px"
                        title={fileName}
                        style={{ border: 'none' }}
                    />
                );
            case 'jpg':
            case 'jpeg':
            case 'png':
            case 'gif':
                return (
                    <img
                        src={fileUrl}
                        alt={fileName}
                        style={{ maxWidth: '100%', maxHeight: '400px' }}
                    />
                );
            case 'txt':
                return (
                    <pre className="text-file-content">
                        {fileContent || 'Завантаження...'}
                    </pre>
                );
            default:
                return (
                    <div className="unsupported-file">
                        <p>Попередній перегляд недоступний для цього типу файлу</p>
                        <button onClick={downloadFile} className="download-button">
                            Завантажити файл
                        </button>
                    </div>
                );
        }
    };

    return (
        <div className="file-viewer-overlay">
            <div className="file-viewer-modal">
                <div className="file-viewer-header">
                    <h3>{fileName || 'Файл звіту'}</h3>
                    <button onClick={onClose} className="close-button">×</button>
                </div>

                <div className="file-viewer-content">
                    {loading && <div className="loading">Завантаження...</div>}
                    {error && <div className="error">{error}</div>}
                    {renderFilePreview()}
                </div>

                <div className="file-viewer-actions">
                    <button onClick={downloadFile} className="action-button">
                        {getFileExtension(fileName) === 'pdf' ? 'Відкрити в новому вікні' : 'Завантажити'}
                    </button>
                    <button onClick={onClose} className="action-button secondary">
                        Закрити
                    </button>
                </div>
            </div>
        </div>
    );
}

export default FileViewer;