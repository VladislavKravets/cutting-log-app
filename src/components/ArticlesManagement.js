import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import './ArticlesManagement.css';
import {useFileServer} from "../contexts/FileServerContext";

// Константи для кращої підтримки
const SEARCH_OPTIONS = {
    NAME: 'name',
    ARTICLE_NUM: 'article_num',
    MATERIAL_TYPE: 'material_type'
};

const SORT_DIRECTION = {
    ASC: 'asc',
    DESC: 'desc'
};

// Константи для валідації
const VALIDATION = {
    THICKNESS: {
        MAX: 999.99,
        MIN: 0,
        STEP: 0.01
    }
};

// Виносимо SearchComponent окремо з власним станом
const SearchComponent = React.memo(({
                                        onSearchChange,
                                        onSearchByChange,
                                        onShowHiddenChange,
                                        onClearSearch,
                                        initialSearchBy = SEARCH_OPTIONS.NAME,
                                        initialShowHidden = false
                                    }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [searchBy, setSearchBy] = useState(initialSearchBy);
    const [showHidden, setShowHidden] = useState(initialShowHidden);
    const searchInputRef = useRef(null);

    // Debounce для пошуку
    useEffect(() => {
        const timer = setTimeout(() => {
            onSearchChange(searchTerm, searchBy, showHidden);
        }, 500);

        return () => clearTimeout(timer);
    }, [searchTerm, searchBy, showHidden, onSearchChange]);

    const handleSearchChange = (e) => {
        setSearchTerm(e.target.value);
    };

    const handleSearchByChange = (e) => {
        const value = e.target.value;
        setSearchBy(value);
        onSearchByChange(value);
    };

    const handleShowHiddenChange = (e) => {
        const value = e.target.checked;
        setShowHidden(value);
        onShowHiddenChange(value);
    };

    const handleClearSearch = () => {
        setSearchTerm('');
        setSearchBy(SEARCH_OPTIONS.NAME);
        setShowHidden(false);
        onClearSearch();
    };

    const getSearchPlaceholder = () => {
        const placeholders = {
            [SEARCH_OPTIONS.NAME]: "Назва артикула...",
            [SEARCH_OPTIONS.ARTICLE_NUM]: "Номер артикула...",
            [SEARCH_OPTIONS.MATERIAL_TYPE]: "Тип матеріалу..."
        };
        return placeholders[searchBy];
    };

    return (
        <div className="articles-search">
            <div className="search-filters">
                <div className="filter-field">
                    <label htmlFor="search-by">Пошук за:</label>
                    <select
                        id="search-by"
                        value={searchBy}
                        onChange={handleSearchByChange}
                    >
                        <option value={SEARCH_OPTIONS.NAME}>Назвою артикула</option>
                        <option value={SEARCH_OPTIONS.ARTICLE_NUM}>Номером артикула</option>
                        <option value={SEARCH_OPTIONS.MATERIAL_TYPE}>Типом матеріалу</option>
                    </select>
                </div>

                <div className="filter-field">
                    <label htmlFor="search-term">Значення:</label>
                    <input
                        ref={searchInputRef}
                        id="search-term"
                        type="text"
                        value={searchTerm}
                        onChange={handleSearchChange}
                        placeholder={getSearchPlaceholder()}
                    />
                </div>

                <div className="filter-field">
                    <label className="checkbox-label">
                        <input
                            type="checkbox"
                            checked={showHidden}
                            onChange={handleShowHiddenChange}
                        />
                        <span className="checkmark"></span>
                        Показувати приховані
                    </label>
                </div>

                <button
                    type="button"
                    className="filter-clear"
                    onClick={handleClearSearch}
                    disabled={!searchTerm && searchBy === SEARCH_OPTIONS.NAME && !showHidden}
                >
                    Очистити
                </button>
            </div>
        </div>
    );
});

// Виносимо TableComponent окремо
const TableComponent = React.memo(({
                                       articles,
                                       loading,
                                       error,
                                       sortField,
                                       sortDirection,
                                       onSort,
                                       onToggleVisibility,
                                       onEdit,
                                       onDelete,
                                       getDownloadUrl,
                                       downloadFile,
                                       showHidden
                                   }) => {
    const renderSortIcon = (field) => {
        if (sortField !== field) return '↕️';
        return sortDirection === SORT_DIRECTION.ASC ? '↑' : '↓';
    };

    const TableRow = React.memo(({ article }) => {
        return (
            <tr className={article.is_hidden ? 'hidden-article' : ''}>
                <td className="article-num">{article.article_id}</td>
                <td className="article-num">{article.article_num}</td>
                <td className="article-name">{article.name}</td>
                <td className="article-thickness">{article.thickness} мм</td>
                <td className="article-material">{article.material_type}</td>
                <td className="article-file">
                    {article.file_url ? (
                        <button
                            onClick={() => {
                                window.open(getDownloadUrl() + article.file_url, '_blank');
                            }
                            }
                            className="file-link"
                            style={{ background: 'none', border: 'none', color: 'blue', textDecoration: 'underline', cursor: 'pointer' }}
                        >
                            📎 Файл
                        </button>
                    ) : (
                        <span className="no-file">—</span>
                    )}
                </td>
                <td className="article-visibility">
                    <span className={`visibility-status ${article.is_hidden ? 'hidden' : 'visible'}`}>
                        {article.is_hidden ? '👁️‍🗨️ Прихований' : '👀 Видимий'}
                    </span>
                </td>
                <td className="actions">
                    <button
                        className="visibility-button"
                        onClick={() => onToggleVisibility(article)}
                        title={article.is_hidden ? 'Показати артикул' : 'Приховати артикул'}
                    >
                        {article.is_hidden ? '👁️‍🗨️' : '👁️'}
                    </button>
                    <button
                        className="edit-button"
                        onClick={() => onEdit('edit', article)}
                        title="Редагувати"
                    >
                        ✏️
                    </button>
                    <button
                        className="delete-button"
                        onClick={() => onDelete('delete', article)}
                        title="Видалити"
                    >
                        🗑️
                    </button>
                </td>
            </tr>
        );
    });

    if (loading && articles.length === 0) {
        return <div className="loading">Завантаження артикулів...</div>;
    }

    return (
        <>
            {error && <div className="error-message">{error}</div>}

            <div className="search-results-count">
                Знайдено: {articles.length} артикулів
                {showHidden && <span className="hidden-count"> (включаючи приховані)</span>}
            </div>

            <div className="articles-table-container">
                <table className="articles-table">
                    <thead>
                    <tr>
                        <th onClick={() => onSort('article_id')}>
                            ID {renderSortIcon('article_id')}
                        </th>
                        <th onClick={() => onSort('article_num')}>
                            Номер {renderSortIcon('article_num')}
                        </th>
                        <th onClick={() => onSort('name')}>
                            Назва {renderSortIcon('name')}
                        </th>
                        <th onClick={() => onSort('thickness')}>
                            Товщина {renderSortIcon('thickness')}
                        </th>
                        <th onClick={() => onSort('material_type')}>
                            Матеріал {renderSortIcon('material_type')}
                        </th>
                        <th onClick={() => onSort('file_url')}>
                            Файл {renderSortIcon('file_url')}
                        </th>
                        <th onClick={() => onSort('is_hidden')}>
                            Статус {renderSortIcon('is_hidden')}
                        </th>
                        <th>Дії</th>
                    </tr>
                    </thead>
                    <tbody>
                    {articles.map(article => (
                        <TableRow
                            key={article.article_id}
                            article={article}
                        />
                    ))}
                    </tbody>
                </table>

                {articles.length === 0 && !loading && (
                    <div className="no-results">
                        Немає артикулів
                    </div>
                )}
            </div>
        </>
    );
});

// Компонент Modal
const Modal = React.memo(function Modal({
                                            title,
                                            children,
                                            onClose,
                                            onSubmit,
                                            loading,
                                            submitText,
                                            type = 'form'
                                        }) {
    return (
        <div className="modal-overlay">
            <div className={`modal-content ${type === 'delete' ? 'delete-modal' : ''}`}>
                <h2>{title}</h2>
                {type === 'form' ? (
                    <form onSubmit={onSubmit}>
                        {children}
                        <div className="modal-actions">
                            <button type="submit" className="submit-button" disabled={loading}>
                                {submitText}
                            </button>
                            <button type="button" className="cancel-button" onClick={onClose}>
                                Скасувати
                            </button>
                        </div>
                    </form>
                ) : (
                    <>
                        {children}
                        <div className="modal-actions">
                            <button className="delete-confirm-button" onClick={onSubmit} disabled={loading}>
                                {submitText}
                            </button>
                            <button className="cancel-button" onClick={onClose}>
                                Скасувати
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
});

// Компонент завантаження файлів
const FileUploadComponent = React.memo(({
                                            fileUploadData,
                                            onFileSelect,
                                            onFileUpload,
                                            onFileRemove,
                                            getDownloadUrl,
                                            onFileUrlChange
                                        }) => {
    const fileInputRef = useRef(null);

    const handleDragOver = (e) => {
        e.preventDefault();
        e.currentTarget.classList.add('dragover');
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        if (!e.currentTarget.contains(e.relatedTarget)) {
            e.currentTarget.classList.remove('dragover');
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.currentTarget.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            onFileSelect({ target: { files } });
        }
    };

    const handleBrowseClick = () => {
        fileInputRef.current?.click();
    };

    return (
        <div className="file-upload-section">
            <label className="upload-label">Завантаження DXF файлу (необов'язково):</label>

            <div
                className="upload-drop-area"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={handleBrowseClick}
            >
                <div className="upload-drop-icon">📁</div>
                <div className="upload-drop-text">Перетягніть DXF файл сюди</div>
                <div className="upload-drop-hint">або натисніть для вибору файлу</div>
                <button type="button" className="browse-btn">
                    Обрати файл
                </button>
            </div>

            {/* Вибраний файл */}
            {fileUploadData.file && (
                <div className="file-info">
                    <div className="file-icon">📎</div>
                    <div className="file-details">
                        <div className="file-name">{fileUploadData.file.name}</div>
                        <div className="file-size">
                            Розмір: {(fileUploadData.file.size / 1024 / 1024).toFixed(2)} MB
                        </div>
                    </div>
                    <button
                        type="button"
                        className="remove-btn"
                        onClick={onFileRemove}
                        title="Видалити файл"
                        disabled={fileUploadData.isUploading}
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* Прогрес завантаження */}
            {fileUploadData.isUploading && (
                <div className="upload-progress">
                    <div className="progress-bar">
                        <div
                            className="progress-fill"
                            style={{ width: `${fileUploadData.uploadProgress}%` }}
                        ></div>
                    </div>
                    <span className="progress-text">
                        {fileUploadData.uploadProgress}%
                    </span>
                </div>
            )}

            {/* Повідомлення про статус */}
            {fileUploadData.uploadSuccess && (
                <div className="upload-success">
                    ✅ Файл успішно завантажено!
                </div>
            )}

            {fileUploadData.uploadError && (
                <div className="upload-error">
                    ❌ {fileUploadData.uploadError}
                </div>
            )}

            {/* Прихований input та кнопки */}
            <div className="upload-controls">
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".dxf,.DXF"
                    onChange={onFileSelect}
                    disabled={fileUploadData.isUploading}
                    className="file-input"
                />
            </div>

            <button
                type="button"
                onClick={onFileUpload}
                disabled={!fileUploadData.file || fileUploadData.isUploading}
                className="upload-btn"
            >
                {fileUploadData.isUploading ? 'Завантаження...' : 'Завантажити файл'}
            </button>

            {/* Поле для URL файлу */}
            <div className="file-url-field">
                <label htmlFor="file_url" className="url-label">
                    URL файлу (заповниться автоматично):
                </label>
                <input
                    id="file_url"
                    type="text"
                    name="file_url"
                    value={fileUploadData.uploadSuccess ? getDownloadUrl() + fileUploadData.uploadedFileName : ''}
                    onChange={onFileUrlChange}
                    placeholder="URL файлу буде заповнено автоматично після завантаження"
                    className="url-input"
                />
                <small className="url-hint">
                    Можна ввести URL вручну або завантажити файл вище
                </small>
            </div>
        </div>
    );
});

// Компонент форми для створення/редагування
const ArticleForm = React.memo(({ formData, onChange, loading, errors = {}, fileUploadData, onFileSelect, onFileUpload, onFileRemove, getDownloadUrl, onFileUrlChange }) => {
    const validateThickness = (value) => {
        const numValue = parseFloat(value);
        if (isNaN(numValue)) return 'Товщина повинна бути числом';
        if (numValue > VALIDATION.THICKNESS.MAX) return `Товщина не може перевищувати ${VALIDATION.THICKNESS.MAX} мм`;
        if (numValue < VALIDATION.THICKNESS.MIN) return `Товщина не може бути меншою за ${VALIDATION.THICKNESS.MIN} мм`;
        return null;
    };

    const thicknessError = validateThickness(formData.thickness);

    return (
        <div className="article-form">
            <div className="form-group">
                <label htmlFor="article_num">Номер артикула *</label>
                <input
                    type="text"
                    id="article_num"
                    name="article_num"
                    value={formData.article_num}
                    onChange={onChange}
                    required
                    disabled={loading}
                    placeholder="Введіть номер артикула"
                    className={errors.article_num ? 'error' : ''}
                />
                {errors.article_num && <span className="field-error">{errors.article_num}</span>}
            </div>

            <div className="form-group">
                <label htmlFor="name">Назва артикула *</label>
                <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={onChange}
                    required
                    disabled={loading}
                    placeholder="Введіть назву артикула"
                    className={errors.name ? 'error' : ''}
                />
                {errors.name && <span className="field-error">{errors.name}</span>}
            </div>

            <div className="form-group">
                <label htmlFor="thickness">Товщина (мм) *</label>
                <input
                    type="number"
                    id="thickness"
                    name="thickness"
                    value={formData.thickness}
                    onChange={onChange}
                    step={VALIDATION.THICKNESS.STEP}
                    min={VALIDATION.THICKNESS.MIN}
                    max={VALIDATION.THICKNESS.MAX}
                    required
                    disabled={loading}
                    placeholder={`Введіть товщину (${VALIDATION.THICKNESS.MIN}-${VALIDATION.THICKNESS.MAX} мм)`}
                    className={thicknessError ? 'error' : ''}
                />
                {thicknessError && <span className="field-error">{thicknessError}</span>}
                <div className="field-hint">
                    Максимальна товщина: {VALIDATION.THICKNESS.MAX} мм
                </div>
            </div>

            <div className="form-group">
                <label htmlFor="material_type">Тип матеріалу *</label>
                <input
                    type="text"
                    id="material_type"
                    name="material_type"
                    value={formData.material_type}
                    onChange={onChange}
                    required
                    disabled={loading}
                    placeholder="Введіть тип матеріалу"
                    className={errors.material_type ? 'error' : ''}
                />
                {errors.material_type && <span className="field-error">{errors.material_type}</span>}
            </div>

            {/* Компонент завантаження файлів */}
            <FileUploadComponent
                fileUploadData={fileUploadData}
                onFileSelect={onFileSelect}
                onFileUpload={onFileUpload}
                onFileRemove={onFileRemove}
                getDownloadUrl={getDownloadUrl}
                onFileUrlChange={onFileUrlChange}
            />

            <div className="form-group checkbox-group">
                <label className="checkbox-label">
                    <input
                        type="checkbox"
                        name="is_hidden"
                        checked={formData.is_hidden}
                        onChange={onChange}
                        disabled={loading}
                    />
                    <span className="checkmark"></span>
                    Прихований артикул
                </label>
            </div>
        </div>
    );
});

function ArticlesManagement() {
    const { getHomeUrl, getUploadUrl, getDownloadUrl, config, isLoading: isFileServerLoading } = useFileServer();

    // Стани для даних
    const [articles, setArticles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Стани для пошуку та сортування
    const [searchParams, setSearchParams] = useState({
        searchTerm: '',
        searchBy: SEARCH_OPTIONS.NAME,
        showHidden: false
    });
    const [sortField, setSortField] = useState('article_id');
    const [sortDirection, setSortDirection] = useState(SORT_DIRECTION.ASC);

    // Стани для модальних вікон
    const [modalState, setModalState] = useState({
        create: false,
        edit: false,
        delete: false
    });

    // Стани для форми
    const [currentArticle, setCurrentArticle] = useState(null);
    const [formData, setFormData] = useState(getInitialFormData());
    const [formErrors, setFormErrors] = useState({});

    // Стани для завантаження файлів
    const [fileUploadData, setFileUploadData] = useState({
        file: null,
        uploadProgress: 0,
        isUploading: false,
        uploadError: null,
        uploadSuccess: false,
        uploadedFileName: ''
    });

    // Ініціалізація форми
    function getInitialFormData() {
        return {
            name: '',
            article_num: '',
            thickness: '',
            material_type: '',
            file_url: '',
            is_hidden: false
        };
    }

    // Функції для роботи з файлами
    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            const allowedExtensions = ['.dxf', '.DXF'];
            const fileName = file.name;
            const fileExtension = fileName.slice(fileName.lastIndexOf('.')).toLowerCase();

            if (!allowedExtensions.includes(fileExtension)) {
                alert('Дозволені тільки файли з розширенням .dxf');
                return;
            }

            setFileUploadData(prev => ({
                ...prev,
                file,
                uploadProgress: 0,
                uploadError: null,
                uploadSuccess: false
            }));
        }
    };

    const handleFileUpload = async () => {
        if (!fileUploadData.file) {
            alert('Будь ласка, виберіть файл для завантаження');
            return;
        }

        setFileUploadData(prev => ({
            ...prev,
            isUploading: true,
            uploadProgress: 0,
            uploadError: null,
            uploadSuccess: false
        }));

        const formData = new FormData();
        formData.append('file', fileUploadData.file);
        formData.append('fileName', fileUploadData.file.name);

        console.log(getUploadUrl)
        try {
            const response = await fetch(getUploadUrl(), {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                const result = await response.json();
                const filePath = result.filename;

                setFileUploadData(prev => ({
                    ...prev,
                    isUploading: false,
                    uploadSuccess: true,
                    uploadedFileName: filePath
                }));

                // Оновлюємо поле file_url у формі
                setFormData(prev => ({
                    ...prev,
                    file_url: filePath
                }));

                alert(`Файл успішно завантажено!`);
            } else {
                const errorData = await response.json();
                throw new Error(errorData.error || `Помилка завантаження: ${response.status}`);
            }
        } catch (error) {
            console.error('Помилка завантаження файлу:', error);
            setFileUploadData(prev => ({
                ...prev,
                isUploading: false,
                uploadError: error.message
            }));
            alert(`Помилка завантаження файлу: ${error.message}`);
        }
    };

    const handleFileRemove = () => {
        setFileUploadData(prev => ({
            ...prev,
            file: null,
            uploadSuccess: false,
            uploadError: null,
            uploadProgress: 0,
            uploadedFileName: ''
        }));

        // Очищаємо поле file_url у формі
        setFormData(prev => ({
            ...prev,
            file_url: ''
        }));
    };

    const handleFileUrlChange = (e) => {
        const { value } = e.target;
        setFormData(prev => ({
            ...prev,
            file_url: value
        }));
    };

    const downloadFile = useCallback(async (fileUrl, fileName) => {
        try {
            const response = await fetch(fileUrl);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = url;
            link.download = fileName || 'file.dxf';
            document.body.appendChild(link);
            link.click();

            window.URL.revokeObjectURL(url);
            document.body.removeChild(link);
        } catch (error) {
            console.error('Помилка при завантаженні файлу:', error);
            alert('Помилка завантаження файлу: ' + error.message);
            window.open(fileUrl, '_blank');
        }
    }, []);

    // Завантаження артикулів
    const fetchArticles = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            let query = supabase
                .from('articles')
                .select('*')
                .order(sortField, { ascending: sortDirection === SORT_DIRECTION.ASC });

            // Застосування пошуку
            if (searchParams.searchTerm) {
                query = query.ilike(searchParams.searchBy, `%${searchParams.searchTerm}%`);
            }

            // Фільтрація за видимістю
            if (!searchParams.showHidden) {
                query = query.or('is_hidden.is.null,is_hidden.eq.false');
            }

            const { data, error } = await query;
            if (error) throw error;

            setArticles(data || []);
        } catch (err) {
            console.error('Помилка завантаження артикулів:', err);
            setError('Не вдалося завантажити артикули');
        } finally {
            setLoading(false);
        }
    }, [searchParams, sortField, sortDirection]);

    // Початкове завантаження
    useEffect(() => {
        fetchArticles();
    }, []);

    // Ефект для змін параметрів
    useEffect(() => {
        fetchArticles();
    }, [searchParams, sortField, sortDirection, fetchArticles]);

    // Обробники подій
    const handleSearchChange = useCallback((searchTerm, searchBy, showHidden) => {
        setSearchParams({ searchTerm, searchBy, showHidden });
    }, []);

    const handleSearchByChange = useCallback((searchBy) => {
        setSearchParams(prev => ({ ...prev, searchBy }));
    }, []);

    const handleShowHiddenChange = useCallback((showHidden) => {
        setSearchParams(prev => ({ ...prev, showHidden }));
    }, []);

    const handleClearSearch = useCallback(() => {
        setSearchParams({
            searchTerm: '',
            searchBy: SEARCH_OPTIONS.NAME,
            showHidden: false
        });
    }, []);

    const handleSort = useCallback((field) => {
        if (sortField === field) {
            setSortDirection(current =>
                current === SORT_DIRECTION.ASC ? SORT_DIRECTION.DESC : SORT_DIRECTION.ASC
            );
        } else {
            setSortField(field);
            setSortDirection(SORT_DIRECTION.ASC);
        }
    }, [sortField]);

    const openModal = useCallback((type, article = null) => {
        setCurrentArticle(article);
        setModalState(prev => ({ ...prev, [type]: true }));
        setFormErrors({});
        setFileUploadData({
            file: null,
            uploadProgress: 0,
            isUploading: false,
            uploadError: null,
            uploadSuccess: false,
            uploadedFileName: ''
        });

        if (type === 'create') {
            setFormData(getInitialFormData());
        } else if (type === 'edit' && article) {
            setFormData({
                name: article.name,
                article_num: article.article_num,
                thickness: article.thickness,
                material_type: article.material_type,
                file_url: article.file_url || '',
                is_hidden: article.is_hidden || false
            });
        }
    }, []);

    const closeModal = useCallback((type) => {
        setModalState(prev => ({ ...prev, [type]: false }));
        setError(null);
        setFormErrors({});
        setFileUploadData({
            file: null,
            uploadProgress: 0,
            isUploading: false,
            uploadError: null,
            uploadSuccess: false,
            uploadedFileName: ''
        });
    }, []);

    // Валідація форми
    const validateForm = (formData) => {
        const errors = {};

        if (!formData.article_num.trim()) {
            errors.article_num = 'Номер артикула обов\'язковий';
        }

        if (!formData.name.trim()) {
            errors.name = 'Назва артикула обов\'язкова';
        }

        if (!formData.material_type.trim()) {
            errors.material_type = 'Тип матеріалу обов\'язковий';
        }

        if (!formData.thickness && formData.thickness !== 0) {
            errors.thickness = 'Товщина обов\'язкова';
        } else {
            const thicknessValue = parseFloat(formData.thickness);
            if (isNaN(thicknessValue)) {
                errors.thickness = 'Товщина повинна бути числом';
            } else if (thicknessValue > VALIDATION.THICKNESS.MAX) {
                errors.thickness = `Товщина не може перевищувати ${VALIDATION.THICKNESS.MAX} мм`;
            } else if (thicknessValue < VALIDATION.THICKNESS.MIN) {
                errors.thickness = `Товщина не може бути меншою за ${VALIDATION.THICKNESS.MIN} мм`;
            }
        }

        return errors;
    };

    const checkArticleNumberUnique = async (articleNum, excludeId = null) => {
        let query = supabase
            .from('articles')
            .select('article_num')
            .eq('article_num', articleNum);

        if (excludeId) {
            query = query.neq('article_id', excludeId);
        }

        const { data } = await query.single();
        return !data;
    };

    const handleSubmit = async (e, type) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setFormErrors({});

        try {
            // Валідація форми
            const errors = validateForm(formData);
            if (Object.keys(errors).length > 0) {
                setFormErrors(errors);
                setLoading(false);
                return;
            }

            // Перевірка унікальності номера артикула
            if (formData.article_num) {
                const isUnique = await checkArticleNumberUnique(
                    formData.article_num,
                    type === 'edit' ? currentArticle.article_id : null
                );

                if (!isUnique) {
                    setFormErrors({ article_num: `Артикул з номером ${formData.article_num} вже існує!` });
                    setLoading(false);
                    return;
                }
            }

            // Підготовка даних для відправки
            const submitData = {
                ...formData,
                thickness: parseFloat(formData.thickness)
            };

            if (type === 'create') {
                const { error } = await supabase
                    .from('articles')
                    .insert([submitData])
                    .select();
                if (error) throw error;

                alert('Артикул успішно створений!');
            } else if (type === 'edit') {
                const { error } = await supabase
                    .from('articles')
                    .update(submitData)
                    .eq('article_id', currentArticle.article_id);
                if (error) throw error;

                alert('Артикул успішно оновлений!');
            }

            closeModal(type);
            fetchArticles();
        } catch (err) {
            console.error(`Помилка ${type === 'create' ? 'створення' : 'оновлення'} артикула:`, err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        setLoading(true);
        setError(null);

        try {
            const { data: usageData } = await supabase
                .from('job_details')
                .select('job_detail_id')
                .eq('article_id', currentArticle.article_id)
                .limit(1);

            if (usageData?.length > 0) {
                throw new Error('Цей артикул використовується в завданнях і не може бути видалений!');
            }

            const { error } = await supabase
                .from('articles')
                .delete()
                .eq('article_id', currentArticle.article_id);
            if (error) throw error;

            closeModal('delete');
            fetchArticles();
            alert('Артикул успішно видалений!');
        } catch (err) {
            console.error('Помилка видалення артикула:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleFormChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));

        // Очистити помилку поля при зміні
        if (formErrors[name]) {
            setFormErrors(prev => ({
                ...prev,
                [name]: ''
            }));
        }
    };

    const toggleArticleVisibility = useCallback(async (article) => {
        try {
            const { error } = await supabase
                .from('articles')
                .update({ is_hidden: !article.is_hidden })
                .eq('article_id', article.article_id);

            if (error) throw error;

            setArticles(prev => prev.map(item =>
                item.article_id === article.article_id
                    ? { ...item, is_hidden: !item.is_hidden }
                    : item
            ));

            alert(`Артикул ${!article.is_hidden ? 'приховано' : 'показано'}!`);
        } catch (error) {
            console.error('Помилка зміни видимості:', error);
            alert('Помилка зміни видимості артикула');
        }
    }, []);

    return (
        <div className="articles-management">
            <div className="articles-header">
                <h1>📦 Управління Артикулами</h1>
                <button
                    className="create-button"
                    onClick={() => openModal('create')}
                    disabled={loading}
                >
                    + Додати Артикул
                </button>
            </div>

            <SearchComponent
                onSearchChange={handleSearchChange}
                onSearchByChange={handleSearchByChange}
                onShowHiddenChange={handleShowHiddenChange}
                onClearSearch={handleClearSearch}
            />

            <TableComponent
                articles={articles}
                loading={loading}
                error={error}
                sortField={sortField}
                sortDirection={sortDirection}
                onSort={handleSort}
                onToggleVisibility={toggleArticleVisibility}
                onEdit={openModal}
                onDelete={openModal}
                getDownloadUrl={getDownloadUrl}
                downloadFile={downloadFile}
                showHidden={searchParams.showHidden}
            />

            {/* Модальні вікна з формами */}
            {modalState.create && (
                <Modal
                    title="Створення нового артикула"
                    onClose={() => closeModal('create')}
                    onSubmit={(e) => handleSubmit(e, 'create')}
                    loading={loading}
                    submitText={loading ? 'Створення...' : 'Створити'}
                >
                    {error && <div className="error-message">{error}</div>}
                    <ArticleForm
                        formData={formData}
                        onChange={handleFormChange}
                        loading={loading}
                        errors={formErrors}
                        fileUploadData={fileUploadData}
                        onFileSelect={handleFileSelect}
                        onFileUpload={handleFileUpload}
                        onFileRemove={handleFileRemove}
                        getDownloadUrl={getDownloadUrl}
                        onFileUrlChange={handleFileUrlChange}
                    />
                </Modal>
            )}

            {modalState.edit && currentArticle && (
                <Modal
                    title="Редагування артикула"
                    onClose={() => closeModal('edit')}
                    onSubmit={(e) => handleSubmit(e, 'edit')}
                    loading={loading}
                    submitText={loading ? 'Оновлення...' : 'Оновити'}
                >
                    {error && <div className="error-message">{error}</div>}
                    <ArticleForm
                        formData={formData}
                        onChange={handleFormChange}
                        loading={loading}
                        errors={formErrors}
                        fileUploadData={fileUploadData}
                        onFileSelect={handleFileSelect}
                        onFileUpload={handleFileUpload}
                        onFileRemove={handleFileRemove}
                        getDownloadUrl={getDownloadUrl}
                        onFileUrlChange={handleFileUrlChange}
                    />
                </Modal>
            )}

            {modalState.delete && currentArticle && (
                <Modal
                    title="Видалення артикула"
                    onClose={() => closeModal('delete')}
                    onSubmit={handleDelete}
                    loading={loading}
                    submitText={loading ? 'Видалення...' : 'Видалити'}
                    type="delete"
                >
                    <p>Ви впевнені, що хочете видалити артикул "{currentArticle.name}" (№{currentArticle.article_num})?</p>
                    <p className="warning-text">Цю дію неможливо скасувати!</p>
                    {error && <div className="error-message">{error}</div>}
                </Modal>
            )}
        </div>
    );
}

export default ArticlesManagement;