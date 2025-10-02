// src/components/ArticlesManagement.js
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import './ArticlesManagement.css';

function ArticlesManagement() {
    const [articles, setArticles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    // Стани для пошуку та фільтрації
    const [searchTerm, setSearchTerm] = useState('');
    const [searchBy, setSearchBy] = useState('name'); // 'name', 'article_num', 'material_type'
    const [sortField, setSortField] = useState('article_id');
    const [sortDirection, setSortDirection] = useState('asc');
    
    // Стани для модальних вікон
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    
    // Стани для форми
    const [currentArticle, setCurrentArticle] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        article_num: '',
        thickness: '',
        material_type: '',
        file_url: ''
    });

    // Завантаження артикулів
    const fetchArticles = async () => {
        setLoading(true);
        setError(null);
        try {
            let query = supabase
                .from('articles')
                .select('*')
                .order(sortField, { ascending: sortDirection === 'asc' });

            // Застосування пошуку
            if (searchTerm) {
                if (searchBy === 'name') {
                    query = query.ilike('name', `%${searchTerm}%`);
                } else if (searchBy === 'article_num') {
                    query = query.ilike('article_num', `%${searchTerm}%`);
                } else if (searchBy === 'material_type') {
                    query = query.ilike('material_type', `%${searchTerm}%`);
                }
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
    };

    useEffect(() => {
        fetchArticles();
    }, [searchTerm, searchBy, sortField, sortDirection]);

    // Обробка зміни сортування
    const handleSort = (field) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    // Відкриття модального вікна створення
    const handleCreate = () => {
        setFormData({
            name: '',
            article_num: '',
            thickness: '',
            material_type: '',
            file_url: ''
        });
        setIsCreateModalOpen(true);
    };

    // Відкриття модального вікна редагування
    const handleEdit = (article) => {
        setCurrentArticle(article);
        setFormData({
            name: article.name,
            article_num: article.article_num,
            thickness: article.thickness,
            material_type: article.material_type,
            file_url: article.file_url || ''
        });
        setIsEditModalOpen(true);
    };

    // Відкриття модального вікна видалення
    const handleDelete = (article) => {
        setCurrentArticle(article);
        setIsDeleteModalOpen(true);
    };

    // Обробка зміни форми
    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: name === 'thickness' ? parseFloat(value) || '' : value
        }));
    };

    // Створення нового артикула
    const handleCreateSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // Перевірка на унікальність article_num
            if (formData.article_num) {
                const { data: existingArticle } = await supabase
                    .from('articles')
                    .select('article_num')
                    .eq('article_num', formData.article_num)
                    .single();

                if (existingArticle) {
                    throw new Error(`Артикул з номером ${formData.article_num} вже існує!`);
                }
            }

            const { data, error } = await supabase
                .from('articles')
                .insert([formData])
                .select();

            if (error) throw error;

            setIsCreateModalOpen(false);
            fetchArticles(); // Оновлюємо список
            alert('Артикул успішно створений!');
        } catch (err) {
            console.error('Помилка створення артикула:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Оновлення артикула
    const handleEditSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // Перевірка на унікальність article_num (крім поточного артикула)
            if (formData.article_num && formData.article_num !== currentArticle.article_num) {
                const { data: existingArticle } = await supabase
                    .from('articles')
                    .select('article_num')
                    .eq('article_num', formData.article_num)
                    .neq('article_id', currentArticle.article_id)
                    .single();

                if (existingArticle) {
                    throw new Error(`Артикул з номером ${formData.article_num} вже існує!`);
                }
            }

            const { error } = await supabase
                .from('articles')
                .update(formData)
                .eq('article_id', currentArticle.article_id);

            if (error) throw error;

            setIsEditModalOpen(false);
            fetchArticles(); // Оновлюємо список
            alert('Артикул успішно оновлений!');
        } catch (err) {
            console.error('Помилка оновлення артикула:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Видалення артикула
    const handleDeleteConfirm = async () => {
        setLoading(true);
        setError(null);

        try {
            // Перевірка, чи артикул використовується в завданнях
            const { data: usageData, error: usageError } = await supabase
                .from('job_details')
                .select('job_detail_id')
                .eq('article_id', currentArticle.article_id)
                .limit(1);

            if (usageError) throw usageError;

            if (usageData && usageData.length > 0) {
                throw new Error('Цей артикул використовується в завданнях і не може бути видалений!');
            }

            const { error } = await supabase
                .from('articles')
                .delete()
                .eq('article_id', currentArticle.article_id);

            if (error) throw error;

            setIsDeleteModalOpen(false);
            fetchArticles(); // Оновлюємо список
            alert('Артикул успішно видалений!');
        } catch (err) {
            console.error('Помилка видалення артикула:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Скидання пошуку
    const handleClearSearch = () => {
        setSearchTerm('');
        setSearchBy('name');
    };

    // Рендер іконки сортування
    const renderSortIcon = (field) => {
        if (sortField !== field) return '↕️';
        return sortDirection === 'asc' ? '↑' : '↓';
    };

    if (loading && articles.length === 0) {
        return <div className="loading">Завантаження артикулів...</div>;
    }

    return (
        <div className="articles-management">
            <div className="articles-header">
                <h1>📦 Управління Артикулами</h1>
                <button 
                    className="create-button"
                    onClick={handleCreate}
                    disabled={loading}
                >
                    + Додати Артикул
                </button>
            </div>

            {error && <div className="error-message">{error}</div>}

            {/* Панель пошуку та фільтрів */}
            <div className="search-panel">
                <div className="search-controls">
                    <div className="search-group">
                        <label>Пошук за:</label>
                        <select 
                            value={searchBy} 
                            onChange={(e) => setSearchBy(e.target.value)}
                        >
                            <option value="name">Назвою</option>
                            <option value="article_num">Номером</option>
                            <option value="material_type">Матеріалом</option>
                        </select>
                    </div>

                    <div className="search-group">
                        <label>Пошук:</label>
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder={
                                searchBy === 'name' ? "Назва артикула..." :
                                searchBy === 'article_num' ? "Номер артикула..." :
                                "Тип матеріалу..."
                            }
                        />
                    </div>

                    <button 
                        className="clear-search-button"
                        onClick={handleClearSearch}
                    >
                        Очистити
                    </button>
                </div>

                <div className="results-info">
                    Знайдено: {articles.length} артикулів
                </div>
            </div>

            {/* Таблиця артикулів */}
            <div className="articles-table-container">
                <table className="articles-table">
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
                    <tbody>
                        {articles.map((article) => (
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
                                        onClick={() => handleEdit(article)}
                                        title="Редагувати"
                                    >
                                        ✏️
                                    </button>
                                    <button 
                                        className="delete-button"
                                        onClick={() => handleDelete(article)}
                                        title="Видалити"
                                    >
                                        🗑️
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {articles.length === 0 && !loading && (
                    <div className="no-results">
                        {searchTerm ? 'Артикули не знайдені' : 'Немає артикулів'}
                    </div>
                )}
            </div>

            {/* Модальне вікно створення */}
            {isCreateModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h2>Створення нового артикула</h2>
                        <form onSubmit={handleCreateSubmit}>
                            <div className="form-group">
                                <label>Номер артикула *</label>
                                <input
                                    type="text"
                                    name="article_num"
                                    value={formData.article_num}
                                    onChange={handleFormChange}
                                    placeholder="3000312.00.001"
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label>Назва артикула *</label>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleFormChange}
                                    placeholder="Пластина опорна"
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label>Товщина (мм) *</label>
                                <input
                                    type="number"
                                    name="thickness"
                                    step="0.1"
                                    min="0.1"
                                    value={formData.thickness}
                                    onChange={handleFormChange}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label>Тип матеріалу *</label>
                                <input
                                    type="text"
                                    name="material_type"
                                    value={formData.material_type}
                                    onChange={handleFormChange}
                                    placeholder="Сталь 3"
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label>URL файлу</label>
                                <input
                                    type="text"
                                    name="file_url"
                                    value={formData.file_url}
                                    onChange={handleFormChange}
                                    placeholder="design/file_name.dxf"
                                />
                            </div>

                            <div className="modal-actions">
                                <button 
                                    type="submit" 
                                    className="submit-button"
                                    disabled={loading}
                                >
                                    {loading ? 'Створення...' : 'Створити'}
                                </button>
                                <button 
                                    type="button" 
                                    className="cancel-button"
                                    onClick={() => setIsCreateModalOpen(false)}
                                >
                                    Скасувати
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Модальне вікно редагування */}
            {isEditModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h2>Редагування артикула</h2>
                        <form onSubmit={handleEditSubmit}>
                            <div className="form-group">
                                <label>Номер артикула *</label>
                                <input
                                    type="text"
                                    name="article_num"
                                    value={formData.article_num}
                                    onChange={handleFormChange}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label>Назва артикула *</label>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleFormChange}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label>Товщина (мм) *</label>
                                <input
                                    type="number"
                                    name="thickness"
                                    step="0.1"
                                    min="0.1"
                                    value={formData.thickness}
                                    onChange={handleFormChange}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label>Тип матеріалу *</label>
                                <input
                                    type="text"
                                    name="material_type"
                                    value={formData.material_type}
                                    onChange={handleFormChange}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label>URL файлу</label>
                                <input
                                    type="text"
                                    name="file_url"
                                    value={formData.file_url}
                                    onChange={handleFormChange}
                                />
                            </div>

                            <div className="modal-actions">
                                <button 
                                    type="submit" 
                                    className="submit-button"
                                    disabled={loading}
                                >
                                    {loading ? 'Оновлення...' : 'Оновити'}
                                </button>
                                <button 
                                    type="button" 
                                    className="cancel-button"
                                    onClick={() => setIsEditModalOpen(false)}
                                >
                                    Скасувати
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Модальне вікно видалення */}
            {isDeleteModalOpen && currentArticle && (
                <div className="modal-overlay">
                    <div className="modal-content delete-modal">
                        <h2>Видалення артикула</h2>
                        <p>Ви впевнені, що хочете видалити артикул?</p>
                        <div className="article-preview">
                            <strong>{currentArticle.article_num}</strong> - {currentArticle.name}
                        </div>
                        <div className="modal-actions">
                            <button 
                                className="delete-confirm-button"
                                onClick={handleDeleteConfirm}
                                disabled={loading}
                            >
                                {loading ? 'Видалення...' : 'Так, видалити'}
                            </button>
                            <button 
                                className="cancel-button"
                                onClick={() => setIsDeleteModalOpen(false)}
                            >
                                Скасувати
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ArticlesManagement;