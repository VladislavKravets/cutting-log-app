import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import './CuttingReportsFileManager.css';

function CuttingReportsFileManager() {
    const [files, setFiles] = useState([]);
    const [filteredFiles, setFilteredFiles] = useState([]);
    const [selectedFiles, setSelectedFiles] = useState(new Set());
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);

    // Фільтри
    const [sortBy, setSortBy] = useState('newest');
    const [nameFilter, setNameFilter] = useState('');

    // Перевірка прав доступу - використовуємо той самий ключ що і в AuthGuard
    const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';

    // Отримання списку файлів
    const fetchFiles = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase.storage
                .from('reports')
                .list('cutting-reports', {
                    limit: 100,
                    offset: 0,
                    sortBy: { column: 'created_at', order: 'desc' }
                });

            if (error) {
                if (error.message.includes('not found') || error.message.includes('Not Found')) {
                    console.log('Папка cutting-reports ще не існує');
                    setFiles([]);
                    setFilteredFiles([]);
                    return;
                }
                throw error;
            }

            const filesWithUrls = await Promise.all(
                (data || []).map(async (file) => {
                    const { data: urlData } = supabase.storage
                        .from('reports')
                        .getPublicUrl(`cutting-reports/${file.name}`);

                    return {
                        ...file,
                        publicUrl: urlData.publicUrl,
                        created_at: file.created_at || new Date().toISOString()
                    };
                })
            );

            setFiles(filesWithUrls);
        } catch (error) {
            console.error('Помилка отримання файлів:', error);
            if (!error.message.includes('not found') && !error.message.includes('Not Found')) {
                alert('Помилка завантаження файлів');
            }
        } finally {
            setLoading(false);
        }
    };

    // Фільтрація та сортування файлів
    useEffect(() => {
        let result = [...files];

        // Фільтрація по імені
        if (nameFilter) {
            result = result.filter(file =>
                file.name.toLowerCase().includes(nameFilter.toLowerCase())
            );
        }

        // Сортування
        result.sort((a, b) => {
            const dateA = new Date(a.created_at);
            const dateB = new Date(b.created_at);

            switch (sortBy) {
                case 'newest':
                    return dateB - dateA;
                case 'oldest':
                    return dateA - dateB;
                case 'name_asc':
                    return a.name.localeCompare(b.name);
                case 'name_desc':
                    return b.name.localeCompare(a.name);
                case 'size_asc':
                    return (a.metadata?.size || 0) - (b.metadata?.size || 0);
                case 'size_desc':
                    return (b.metadata?.size || 0) - (a.metadata?.size || 0);
                default:
                    return dateB - dateA;
            }
        });

        setFilteredFiles(result);
    }, [files, sortBy, nameFilter]);

    useEffect(() => {
        fetchFiles();
    }, []);

    // Завантаження файлів
    const handleFileUpload = async (event) => {
        // Перевірка доступу для завантаження
        if (!isAuthenticated) {
            alert('❌ Для завантаження файлів потрібна авторизація');
            return;
        }

        const files = Array.from(event.target.files);
        if (files.length === 0) return;

        setUploading(true);
        try {
            for (const file of files) {
                const fileName = `${Date.now()}_${file.name}`;
                const filePath = `cutting-reports/${fileName}`;

                const { error } = await supabase.storage
                    .from('reports')
                    .upload(filePath, file);

                if (error) throw error;
            }

            await fetchFiles();
            event.target.value = '';
            alert('Файли успішно завантажені!');
        } catch (error) {
            console.error('Помилка завантаження:', error);
            alert('Помилка завантаження файлів');
        } finally {
            setUploading(false);
        }
    };

    // Видалення файлів
    const handleDeleteFiles = async () => {
        if (selectedFiles.size === 0) return;

        // Перевірка доступу
        if (!isAuthenticated) {
            alert('❌ Для видалення файлів потрібна авторизація');
            return;
        }

        if (!window.confirm(`Видалити ${selectedFiles.size} обраних файлів?`)) return;

        setLoading(true);
        try {
            const filesToDelete = Array.from(selectedFiles).map(fileName =>
                `cutting-reports/${fileName}`
            );

            const { error } = await supabase.storage
                .from('reports')
                .remove(filesToDelete);

            if (error) throw error;

            setSelectedFiles(new Set());
            await fetchFiles();
            alert('Файли успішно видалені!');
        } catch (error) {
            console.error('Помилка видалення:', error);
            alert('Помилка видалення файлів');
        } finally {
            setLoading(false);
        }
    };

    // Отримання URL для скачування
    const getDownloadUrl = async (fileName) => {
        try {
            const { data } = await supabase.storage
                .from('reports')
                .createSignedUrl(`cutting-reports/${fileName}`, 60);
            return data.signedUrl;
        } catch (error) {
            console.error('Помилка отримання URL:', error);
            return null;
        }
    };

    // Обробник вибору файлів
    const handleFileSelect = (fileName, checked) => {
        // Дозволяємо вибір тільки авторизованим користувачам
        if (!isAuthenticated) {
            alert('❌ Для вибору файлів потрібна авторизація');
            return;
        }

        const newSelected = new Set(selectedFiles);
        if (checked) {
            newSelected.add(fileName);
        } else {
            newSelected.delete(fileName);
        }
        setSelectedFiles(newSelected);
    };

    // Вибрати всі файли
    const handleSelectAll = (checked) => {
        if (!isAuthenticated) {
            alert('❌ Для вибору файлів потрібна авторизація');
            return;
        }

        if (checked) {
            setSelectedFiles(new Set(filteredFiles.map(file => file.name)));
        } else {
            setSelectedFiles(new Set());
        }
    };

    // Скачування файлу
    const handleDownloadFile = async (fileName) => {
        const downloadUrl = await getDownloadUrl(fileName);
        if (downloadUrl) {
            window.open(downloadUrl, '_blank');
        } else {
            const file = files.find(f => f.name === fileName);
            if (file && file.publicUrl) {
                window.open(file.publicUrl, '_blank');
            } else {
                alert('Помилка отримання посилання для скачування');
            }
        }
    };

    // Форматування дати
    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleString('uk-UA');
    };

    // Форматування розміру
    const formatSize = (bytes) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    // Очистити фільтри
    const clearFilters = () => {
        setSortBy('newest');
        setNameFilter('');
    };

    // Видалення одного файлу
    const handleDeleteSingleFile = (fileName) => {
        if (!isAuthenticated) {
            alert('❌ Для видалення файлів потрібна авторизація');
            return;
        }

        if (window.confirm(`Видалити файл ${fileName}?`)) {
            handleFileSelect(fileName, true);
            handleDeleteFiles();
        }
    };

    return (
        <div className="cutting-reports-manager">
            {/* Header */}
            <div className="reports-header">
                <div className="reports-header__title">
                    <div className="reports-header__icon">📊</div>
                    <h1>Звіти різання</h1>
                    {!isAuthenticated && (
                        <div className="access-warning">
                            🔐 Обмежений доступ - тільки перегляд
                        </div>
                    )}
                </div>
                <div className="reports-header__actions">
                    <label className={`upload-btn ${uploading ? 'upload-btn--loading' : ''} ${!isAuthenticated ? 'upload-btn--disabled' : ''}`}>
                        <input
                            type="file"
                            multiple
                            onChange={handleFileUpload}
                            disabled={uploading || !isAuthenticated}
                        />
                        <span className="upload-btn__icon">📁</span>
                        <span className="upload-btn__text">
              {uploading ? 'Завантаження...' : 'Завантажити'}
            </span>
                    </label>

                    {selectedFiles.size > 0 && (
                        <button
                            onClick={handleDeleteFiles}
                            disabled={loading || !isAuthenticated}
                            className={`delete-btn ${!isAuthenticated ? 'delete-btn--disabled' : ''}`}
                        >
                            <span className="delete-btn__icon">🗑️</span>
                            Видалити ({selectedFiles.size})
                        </button>
                    )}
                </div>
            </div>

            {/* Фільтри */}
            <div className="filters-section">
                <div className="filters-header">
                    <h3>Фільтри та сортування</h3>
                    {(sortBy !== 'newest' || nameFilter) && (
                        <button onClick={clearFilters} className="clear-filters-btn">
                            Очистити фільтри
                        </button>
                    )}
                </div>

                <div className="filters-grid">
                    <div className="filter-group">
                        <label className="filter-label">Сортування:</label>
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="filter-select"
                        >
                            <option value="newest">Спочатку новіші</option>
                            <option value="oldest">Спочатку старіші</option>
                            <option value="name_asc">За назвою (А-Я)</option>
                            <option value="name_desc">За назвою (Я-А)</option>
                            <option value="size_asc">За розміром (зростання)</option>
                            <option value="size_desc">За розміром (спадання)</option>
                        </select>
                    </div>

                    <div className="filter-group">
                        <label className="filter-label">Пошук за назвою:</label>
                        <input
                            type="text"
                            value={nameFilter}
                            onChange={(e) => setNameFilter(e.target.value)}
                            placeholder="Введіть назву файлу..."
                            className="filter-input"
                        />
                    </div>

                    <div className="filter-group">
                        <label className="filter-label">Статистика:</label>
                        <div className="filter-stats">
                            <span className="stat-item">Знайдено: {filteredFiles.length}</span>
                            <span className="stat-item">Всього: {files.length}</span>
                            <span className={`access-status ${isAuthenticated ? 'access-status--granted' : 'access-status--limited'}`}>
                {isAuthenticated ? '🔑 Повний доступ' : '👀 Тільки перегляд'}
              </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Selection Bar */}
            {filteredFiles.length > 0 && isAuthenticated && (
                <div className="selection-bar">
                    <label className="select-all">
                        <input
                            type="checkbox"
                            checked={selectedFiles.size === filteredFiles.length && filteredFiles.length > 0}
                            onChange={(e) => handleSelectAll(e.target.checked)}
                            disabled={!isAuthenticated}
                        />
                        <span className="select-all__checkmark"></span>
                        Обрати всі на сторінці
                    </label>
                    <div className="selection-counter">
                        Обрано: <strong>{selectedFiles.size}</strong> з <strong>{filteredFiles.length}</strong>
                        {filteredFiles.length !== files.length && (
                            <span className="filtered-hint"> (фільтр активний)</span>
                        )}
                    </div>
                </div>
            )}

            {/* Files List */}
            <div className="files-container">
                {loading ? (
                    <div className="loading-state">
                        <div className="loading-spinner"></div>
                        <p>Завантаження файлів...</p>
                    </div>
                ) : filteredFiles.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state__icon">
                            {files.length === 0 ? '📝' : '🔍'}
                        </div>
                        <h3>
                            {files.length === 0 ? 'Немає файлів звітів' : 'Файли не знайдено'}
                        </h3>
                        <p>
                            {files.length === 0
                                ? 'Завантажте перший файл, щоб почати роботу'
                                : 'Спробуйте змінити критерії пошуку або очистити фільтри'
                            }
                        </p>
                        {nameFilter && (
                            <button onClick={clearFilters} className="clear-search-btn">
                                Очистити пошук
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="files-grid">
                        {filteredFiles.map((file) => (
                            <div
                                key={file.name}
                                className={`file-card ${selectedFiles.has(file.name) ? 'file-card--selected' : ''}`}
                            >
                                <div className="file-card__header">
                                    {isAuthenticated && (
                                        <label className="file-checkbox">
                                            <input
                                                type="checkbox"
                                                checked={selectedFiles.has(file.name)}
                                                onChange={(e) => handleFileSelect(file.name, e.target.checked)}
                                            />
                                            <span className="file-checkbox__checkmark"></span>
                                        </label>
                                    )}
                                    <div className="file-type">📄</div>
                                </div>

                                <div className="file-card__content">
                                    <h4 className="file-name" title={file.name}>
                                        {file.name}
                                    </h4>
                                    <div className="file-meta">
                                        <div className="file-size">
                                            <span className="meta-label">Розмір:</span>
                                            {formatSize(file.metadata?.size || 0)}
                                        </div>
                                        <div className="file-date">
                                            <span className="meta-label">Додано:</span>
                                            {formatDate(file.created_at)}
                                        </div>
                                    </div>
                                </div>

                                <div className="file-card__actions">
                                    <button
                                        onClick={() => handleDownloadFile(file.name)}
                                        className="action-btn action-btn--download"
                                        title="Скачати"
                                    >
                                        ⬇️
                                    </button>
                                    <button
                                        onClick={() => window.open(file.publicUrl, '_blank')}
                                        className="action-btn action-btn--view"
                                        title="Переглянути"
                                    >
                                        👁️
                                    </button>
                                    {isAuthenticated && (
                                        <button
                                            onClick={() => handleDeleteSingleFile(file.name)}
                                            className="action-btn action-btn--delete"
                                            title="Видалити"
                                        >
                                            🗑️
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Statistics */}
            {files.length > 0 && (
                <div className="stats-bar">
                    <div className="stat-item">
                        <span className="stat-label">Всього файлів:</span>
                        <span className="stat-value">{files.length}</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-label">Показано:</span>
                        <span className="stat-value">{filteredFiles.length}</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-label">Загальний розмір:</span>
                        <span className="stat-value">
              {formatSize(files.reduce((acc, file) => acc + (file.metadata?.size || 0), 0))}
            </span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-label">Доступ:</span>
                        <span className={`stat-value ${isAuthenticated ? 'stat-value--granted' : 'stat-value--limited'}`}>
              {isAuthenticated ? '🔑 Повний' : '👀 Перегляд'}
            </span>
                    </div>
                </div>
            )}
        </div>
    );
}

export default CuttingReportsFileManager;