import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import './ArticlesManagement.css';

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

function ArticlesManagement() {
    // Стани для даних
    const [articles, setArticles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Стани для пошуку та сортування
    const [searchTerm, setSearchTerm] = useState('');
    const [searchBy, setSearchBy] = useState(SEARCH_OPTIONS.NAME);
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

    // Ініціалізація форми
    function getInitialFormData() {
        return {
            name: '',
            article_num: '',
            thickness: '',
            material_type: '',
            file_url: ''
        };
    }

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
            if (searchTerm) {
                query = query.ilike(searchBy, `%${searchTerm}%`);
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
    }, [searchTerm, searchBy, sortField, sortDirection]);

    useEffect(() => {
        fetchArticles();
    }, [fetchArticles]);

    // Обробка зміни сортування
    const handleSort = (field) => {
        if (sortField === field) {
            setSortDirection(current =>
                current === SORT_DIRECTION.ASC ? SORT_DIRECTION.DESC : SORT_DIRECTION.ASC
            );
        } else {
            setSortField(field);
            setSortDirection(SORT_DIRECTION.ASC);
        }
    };

    // Управління модальними вікнами
    const openModal = (type, article = null) => {
        setCurrentArticle(article);
        setModalState(prev => ({ ...prev, [type]: true }));

        if (type === 'create') {
            setFormData(getInitialFormData());
        } else if (type === 'edit' && article) {
            setFormData({
                name: article.name,
                article_num: article.article_num,
                thickness: article.thickness,
                material_type: article.material_type,
                    file_url: article.file_url || ''
            });
        }
    };

    const closeModal = (type) => {
        setModalState(prev => ({ ...prev, [type]: false }));
        setError(null);
    };

    // Перевірка унікальності номеру артикула
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

    // Обробка відправки форми
    const handleSubmit = async (e, type) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // Перевірка унікальності для створення та редагування
            if (formData.article_num) {
                const isUnique = await checkArticleNumberUnique(
                    formData.article_num,
                    type === 'edit' ? currentArticle.article_id : null
                );

                if (!isUnique) {
                    throw new Error(`Артикул з номером ${formData.article_num} вже існує!`);
                }
            }

            if (type === 'create') {
                const { error } = await supabase
                    .from('articles')
                    .insert([formData])
                    .select();
                if (error) throw error;

                alert('Артикул успішно створений!');
            } else if (type === 'edit') {
                const { error } = await supabase
                    .from('articles')
                    .update(formData)
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

    // Видалення артикула
    const handleDelete = async () => {
        setLoading(true);
        setError(null);

        try {
            // Перевірка використання артикула
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

    // Допоміжні функції
    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: name === 'thickness' ? parseFloat(value) || '' : value
        }));
    };

    const handleClearSearch = () => {
        setSearchTerm('');
        setSearchBy(SEARCH_OPTIONS.NAME);
    };

    const renderSortIcon = (field) => {
        if (sortField !== field) return '↕️';
        return sortDirection === SORT_DIRECTION.ASC ? '↑' : '↓';
    };

    const getSearchPlaceholder = () => {
        const placeholders = {
            [SEARCH_OPTIONS.NAME]: "Назва артикула...",
            [SEARCH_OPTIONS.ARTICLE_NUM]: "Номер артикула...",
            [SEARCH_OPTIONS.MATERIAL_TYPE]: "Тип матеріалу..."
        };
        return placeholders[searchBy];
    };

    // Рендер функції
    const renderTableHeader = () => (
        <thead>
        <tr>
            <th onClick={() => handleSort('article_id')}>
                ID {renderSortIcon('article_id')}
            </th>
            <th onClick={() => handleSort('article_num')}>
                Номер {renderSortIcon('article_num')}
            </th>
            <th onClick={() => handleSort('name')}>
                Назва {renderSortIcon('name')}
            </th>
            <th onClick={() => handleSort('thickness')}>
                Товщина {renderSortIcon('thickness')}
            </th>
            <th onClick={() => handleSort('material_type')}>
                Матеріал {renderSortIcon('material_type')}
            </th>
            <th onClick={() => handleSort('file_url')}>
                Файл {renderSortIcon('file_url')}
            </th>
            <th>Дії</th>
        </tr>
        </thead>
    );

    const renderTableRow = (article) => (
        <tr key={article.article_id}>
            <td className="article-num">{article.article_id}</td>
            <td className="article-num">{article.article_num}</td>
            <td className="article-name">{article.name}</td>
            <td className="article-thickness">{article.thickness} мм</td>
            <td className="article-material">{article.material_type}</td>
            <td className="article-file">
                {article.file_url ? (
                    <a
                        href={article.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="file-link"
                    >
                        📎 Файл
                    </a>
                ) : (
                    <span className="no-file">—</span>
                )}
            </td>
            <td className="actions">
                <button
                    className="edit-button"
                    onClick={() => openModal('edit', article)}
                    title="Редагувати"
                >
                    ✏️
                </button>
                <button
                    className="delete-button"
                    onClick={() => openModal('delete', article)}
                    title="Видалити"
                >
                    🗑️
                </button>
            </td>
        </tr>
    );

    const renderFormField = (label, name, type = 'text', required = true, props = {}) => (
        <div className="form-group">
            <label>{label} {required && '*'}</label>
            <input
                type={type}
                name={name}
                value={formData[name]}
                onChange={handleFormChange}
                required={required}
                {...props}
            />
        </div>
    );

    // Завантажувальний стан
    if (loading && articles.length === 0) {
        return <div className="loading">Завантаження артикулів...</div>;
    }

    return (
        <div className="articles-management">
            {/* Заголовок та кнопка додавання */}
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

            {error && <div className="error-message">{error}</div>}

            {/* Панель пошуку */}
            <div className="articles-search">
                <div className="search-filters">
                    <div className="filter-field">
                        <label htmlFor="search-by">Пошук за:</label>
                        <select
                            id="search-by"
                            value={searchBy}
                            onChange={(e) => setSearchBy(e.target.value)}
                        >
                            <option value={SEARCH_OPTIONS.NAME}>Назвою артикула</option>
                            <option value={SEARCH_OPTIONS.ARTICLE_NUM}>Номером артикула</option>
                            <option value={SEARCH_OPTIONS.MATERIAL_TYPE}>Типом матеріалу</option>
                        </select>
                    </div>

                    <div className="filter-field">
                        <label htmlFor="search-term">Значення:</label>
                        <input
                            id="search-term"
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder={getSearchPlaceholder()}
                        />
                    </div>

                    <button
                        type="button"
                        className="filter-clear"
                        onClick={handleClearSearch}
                        disabled={!searchTerm && searchBy === SEARCH_OPTIONS.NAME}
                    >
                        Очистити
                    </button>
                </div>

                <div className="search-results-count">
                    Знайдено: {articles.length} артикулів
                </div>
            </div>

            {/* Таблиця артикулів */}
            <div className="articles-table-container">
                <table className="articles-table">
                    {renderTableHeader()}
                    <tbody>
                    {articles.map(renderTableRow)}
                    </tbody>
                </table>

                {articles.length === 0 && !loading && (
                    <div className="no-results">
                        {searchTerm ? 'Артикули не знайдені' : 'Немає артикулів'}
                    </div>
                )}
            </div>

            {/* Модальне вікно створення */}
            {modalState.create && (
                <Modal
                    title="Створення нового артикула"
                    onClose={() => closeModal('create')}
                    onSubmit={(e) => handleSubmit(e, 'create')}
                    loading={loading}
                    submitText={loading ? 'Створення...' : 'Створити'}
                >
                    {renderFormField('Номер артикула', 'article_num', 'text', true, {
                        placeholder: '3000312.00.001'
                    })}
                    {renderFormField('Назва артикула', 'name', 'text', true, {
                        placeholder: 'Пластина опорна'
                    })}
                    {renderFormField('Товщина (мм)', 'thickness', 'number', true, {
                        step: "0.1",
                        min: "0.1"
                    })}
                    {renderFormField('Тип матеріалу', 'material_type', 'text', true, {
                        placeholder: 'Сталь 3'
                    })}
                    {renderFormField('URL файлу', 'file_url', 'text', false, {
                        placeholder: 'design/file_name.dxf'
                    })}
                </Modal>
            )}

            {/* Модальне вікно редагування */}
            {modalState.edit && (
                <Modal
                    title="Редагування артикула"
                    onClose={() => closeModal('edit')}
                    onSubmit={(e) => handleSubmit(e, 'edit')}
                    loading={loading}
                    submitText={loading ? 'Оновлення...' : 'Оновити'}
                >
                    {renderFormField('Номер артикула', 'article_num')}
                    {renderFormField('Назва артикула', 'name')}
                    {renderFormField('Товщина (мм)', 'thickness', 'number', true, {
                        step: "0.1",
                        min: "0.1"
                    })}
                    {renderFormField('Тип матеріалу', 'material_type')}
                    {renderFormField('URL файлу', 'file_url', 'text', false)}
                </Modal>
            )}

            {/* Модальне вікно видалення */}
            {modalState.delete && currentArticle && (
                <Modal
                    title="Видалення артикула"
                    onClose={() => closeModal('delete')}
                    onSubmit={handleDelete}
                    loading={loading}
                    submitText={loading ? 'Видалення...' : 'Так, видалити'}
                    type="delete"
                >
                    <p>Ви впевнені, що хочете видалити артикул?</p>
                    <div className="article-preview">
                        <strong>{currentArticle.article_num}</strong> - {currentArticle.name}
                    </div>
                </Modal>
            )}
        </div>
    );
}

// Допоміжний компонент Modal для кращої інкапсуляції
function Modal({
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
}

export default ArticlesManagement;