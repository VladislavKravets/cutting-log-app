// src/components/CuttingJobForm.js

import React, { useState, useEffect } from 'react';
import { useNotificationsDB } from '../hooks/useNotificationsDB';
import { supabase } from '../supabaseClient';
import './CuttingJobForm.css';

function CuttingJobForm() {
    const { createNotification } = useNotificationsDB();

    // Стани компонента
    const [jobData, setJobData] = useState({
        due_date: '',
        notes: '',
    });
    const [jobDetails, setJobDetails] = useState([]);
    const [newDetail, setNewDetail] = useState({ article_id: '', quantity_planned: 1 });
    const [loading, setLoading] = useState(false);
    const [createdJobId, setCreatedJobId] = useState(null);

    // Стани для пошуку артикулів
    const [selectedArticleObject, setSelectedArticleObject] = useState(null);
    const [searchResults, setSearchResults] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchBy, setSearchBy] = useState('name');

    // Стани для модального вікна
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newArticleData, setNewArticleData] = useState({
        name: '',
        article_num: '',
        thickness: 1.0,
        material_type: '',
        file_url: '',
    });

    // Утиліта debounce
    const debounce = (func, delay) => {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    };

    // Копіювання посилання в буфер обміну
    const copyJobLinkToClipboard = async () => {
        const jobLink = `${window.location.origin}${window.location.pathname}#/view/jobs?id=${createdJobId}`;

        try {
            await navigator.clipboard.writeText(jobLink);
            alert(`Посилання на завдання скопійовано в буфер обміну!\n${jobLink}`);
        } catch (err) {
            const textArea = document.createElement('textarea');
            textArea.value = jobLink;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            alert(`Посилання на завдання скопійовано в буфер обміну!\n${jobLink}`);
        }
    };

    // Логіка пошуку артикулів
    const searchArticles = async (term) => {
        if (!term || term.length < 2) {
            setSearchResults([]);
            return;
        }

        let query = supabase
            .from('articles')
            .select('article_id, name, article_num, thickness, material_type');

        if (searchBy === 'name') {
            query = query.ilike('name', `%${term}%`);
        } else {
            query = query.ilike('article_num', `%${term}%`);
        }

        const { data, error } = await query.limit(20);

        if (error) {
            console.error('Помилка пошуку артикулів:', error);
        } else {
            setSearchResults(data);
        }
    };

    const debouncedSearch = debounce(searchArticles, 300);

    useEffect(() => {
        if (!selectedArticleObject) {
            debouncedSearch(searchTerm);
        }
    }, [searchTerm, selectedArticleObject, searchBy]);

    // Обробники форми
    const handleJobDataChange = (e) => {
        setJobData({ ...jobData, [e.target.name]: e.target.value });
    };

    const handleNewDetailChange = (e) => {
        const value = e.target.name === 'quantity_planned' ? parseInt(e.target.value) : e.target.value;
        setNewDetail({ ...newDetail, [e.target.name]: value });
    };

    // Додавання артикула до специфікації
    const handleAddDetail = () => {
        if (!selectedArticleObject || newDetail.quantity_planned < 1) {
            alert('Будь ласка, оберіть артикул та вкажіть коректну кількість.');
            return;
        }

        const articleId = selectedArticleObject.article_id;

        if (jobDetails.some(d => d.article_id === articleId)) {
            alert('Цей артикул вже є у специфікації. Змініть кількість або видаліть рядок.');
            return;
        }

        setJobDetails([
            ...jobDetails,
            {
                article_id: articleId,
                quantity_planned: newDetail.quantity_planned,
                article_info: selectedArticleObject,
            }
        ]);

        setNewDetail({ article_id: '', quantity_planned: 1 });
        setSearchTerm('');
        setSelectedArticleObject(null);
        setSearchResults([]);
    };

    // Видалення артикула зі специфікації
    const handleRemoveDetail = (articleId) => {
        setJobDetails(jobDetails.filter(detail => detail.article_id !== articleId));
    };

    // Логіка створення нового артикула
    const handleNewArticleDataChange = (e) => {
        const { name, value } = e.target;
        const val = name === 'thickness' ? parseFloat(value) : value;
        setNewArticleData({ ...newArticleData, [name]: val });
    };

    const handleCreateNewArticle = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (newArticleData.article_num) {
                const { data: existingArticle } = await supabase
                    .from('articles')
                    .select('article_num')
                    .eq('article_num', newArticleData.article_num)
                    .single();

                if (existingArticle) {
                    throw new Error(`Артикул з номером ${newArticleData.article_num} вже існує!`);
                }
            }

            const { data: articleData, error } = await supabase
                .from('articles')
                .insert([newArticleData])
                .select('article_id, name, article_num, thickness, material_type');

            if (error) throw error;

            const newArt = articleData[0];
            alert(`Артикул "${newArt.name}" (${newArt.article_num}) успішно створено та вибрано!`);

            setSelectedArticleObject(newArt);
            setNewDetail({ ...newDetail, article_id: newArt.article_id.toString(), quantity_planned: 1 });
            setSearchTerm(newArt.name);

            setIsModalOpen(false);
            setNewArticleData({ name: '', article_num: '', thickness: 1.0, material_type: '', file_url: '' });

        } catch (error) {
            console.error('Помилка створення артикула:', error);
            alert(`Помилка: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    // Відправка основної форми
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (jobDetails.length === 0) {
            alert('Завдання повинно містити хоча б один артикул!');
            return;
        }

        setLoading(true);
        let newJobId = null;

        try {
            const { data: jobDataResult, error: jobError } = await supabase
                .from('cutting_jobs')
                .insert({
                    due_date: jobData.due_date || null,
                    notes: jobData.notes,
                    status: 'В черзі'
                })
                .select('job_id');

            if (jobError) throw jobError;

            newJobId = jobDataResult[0].job_id;

            const detailsToInsert = jobDetails.map(detail => ({
                job_id: newJobId,
                article_id: detail.article_id,
                quantity_planned: detail.quantity_planned,
            }));

            const { error: detailsError } = await supabase
                .from('job_details')
                .insert(detailsToInsert);

            if (detailsError) throw detailsError;

            try {
                await createNotification({
                    type: 'new_job',
                    title: 'Нове завдання',
                    message: `Створено нове завдання #${newJobId}`,
                    job_id: newJobId
                });
            } catch (notificationError) {
                console.error('❌ Помилка при створенні сповіщення:', notificationError);
            }

            setCreatedJobId(newJobId);

            const jobLink = `${window.location.origin}${window.location.pathname}#/view/jobs?id=${newJobId}`;
            alert(`Завдання №${newJobId} успішно створено! 🎉\n\nСповіщення про нове завдання буде показано всім користувачам.`);

            setJobData({ due_date: '', notes: '' });
            setJobDetails([]);
            setNewDetail({ article_id: '', quantity_planned: 1 });
            setSearchTerm('');
            setSelectedArticleObject(null);

        } catch (error) {
            console.error('Помилка під час створення завдання:', error);
            alert(`Помилка: ${error.message}. Перевірте консоль.`);
            if (newJobId) {
                await supabase.from('cutting_jobs').delete().eq('job_id', newJobId);
            }
        } finally {
            setLoading(false);
        }
    };

    // Модальне вікно створення артикула
    if (isModalOpen) {
        return (
            <div className="cutting-form-modal">
                <div className="cutting-form-modal__content">
                    <h3 className="cutting-form-modal__title">Створення нового артикула</h3>
                    <form onSubmit={handleCreateNewArticle} className="cutting-form-modal__form">
                        <div className="cutting-form-modal__field">
                            <label className="cutting-form-modal__label">Номер артикула:</label>
                            <input
                                type="text"
                                name="article_num"
                                value={newArticleData.article_num}
                                onChange={handleNewArticleDataChange}
                                placeholder="3000312.00.001"
                                required
                                disabled={loading}
                                className="cutting-form-modal__input"
                            />
                        </div>

                        <div className="cutting-form-modal__field">
                            <label className="cutting-form-modal__label">Назва артикула:</label>
                            <input
                                type="text"
                                name="name"
                                value={newArticleData.name}
                                onChange={handleNewArticleDataChange}
                                placeholder="Пластина опорна"
                                required
                                disabled={loading}
                                className="cutting-form-modal__input"
                            />
                        </div>

                        <div className="cutting-form-modal__field">
                            <label className="cutting-form-modal__label">Товщина (мм):</label>
                            <input
                                type="number"
                                name="thickness"
                                step="0.1"
                                min="0.1"
                                value={newArticleData.thickness}
                                onChange={handleNewArticleDataChange}
                                required
                                disabled={loading}
                                className="cutting-form-modal__input"
                            />
                        </div>

                        <div className="cutting-form-modal__field">
                            <label className="cutting-form-modal__label">Тип матеріалу:</label>
                            <input
                                type="text"
                                name="material_type"
                                value={newArticleData.material_type}
                                onChange={handleNewArticleDataChange}
                                placeholder="Сталь 3"
                                required
                                disabled={loading}
                                className="cutting-form-modal__input"
                            />
                        </div>

                        <div className="cutting-form-modal__field">
                            <label className="cutting-form-modal__label">URL файлу (необов'язково):</label>
                            <input
                                type="text"
                                name="file_url"
                                value={newArticleData.file_url}
                                onChange={handleNewArticleDataChange}
                                placeholder="design/file_name.dxf"
                                disabled={loading}
                                className="cutting-form-modal__input"
                            />
                        </div>

                        <div className="cutting-form-modal__actions">
                            <button type="submit" disabled={loading} className="cutting-form-btn cutting-form-btn--primary">
                                {loading ? 'Збереження...' : 'Зберегти та вибрати'}
                            </button>
                            <button type="button" onClick={() => setIsModalOpen(false)} className="cutting-form-btn cutting-form-btn--secondary">
                                Скасувати
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        );
    }

    // Основний рендер компонента
    return (
        <div className="cutting-form">
            <div className="articles-header">
                <h1>📋 Формування Завдання на Різання</h1>
            </div>

            {/* Блок створеного завдання */}
            {createdJobId && (
                <div className="cutting-form-success">
                    <div className="cutting-form-success__icon">✅</div>
                    <div className="cutting-form-success__content">
                        <h3 className="cutting-form-success__title">Завдання успішно створено!</h3>
                        <p className="cutting-form-success__text">Завдання №{createdJobId} готове до використання.</p>
                        <button
                            onClick={copyJobLinkToClipboard}
                            className="cutting-form-btn cutting-form-btn--success"
                        >
                            📋 Копіювати посилання на завдання
                        </button>
                        <p className="cutting-form-success__note">
                            Передайте це посилання для перегляду статусу завдання.
                        </p>
                    </div>
                </div>
            )}

            <form onSubmit={handleSubmit} className="cutting-form__form">
                {/* Основні дані */}
                <section className="cutting-form-section">
                    <div className="cutting-form-section__header">
                        <h2 className="cutting-form-section__title">Основні дані</h2>
                    </div>

                    <div className="cutting-form-section__content">
                        <div className="cutting-form-field">
                            <label className="cutting-form-field__label">
                                Дата Завершення (план)
                            </label>
                            <input
                                type="date"
                                name="due_date"
                                value={jobData.due_date}
                                onChange={handleJobDataChange}
                                required
                                className="cutting-form-field__input"
                            />
                        </div>

                        <div className="cutting-form-field">
                            <label className="cutting-form-field__label">
                                Примітки до Завдання
                            </label>
                            <textarea
                                name="notes"
                                value={jobData.notes}
                                onChange={handleJobDataChange}
                                rows="3"
                                placeholder="Введіть додаткові примітки..."
                                className="cutting-form-field__textarea"
                            />
                        </div>
                    </div>
                </section>

                <div className="cutting-form-divider"></div>

                {/* Додавання артикулів */}
                <section className="cutting-form-section">
                    <div className="cutting-form-section__header">
                        <h2 className="cutting-form-section__title">
                            Додати Артикул до Специфікації
                        </h2>
                    </div>

                    <div className="cutting-form-section__content">
                        <div className="cutting-form-search">
                            <div className="cutting-form-search__controls">
                                <div className="cutting-form-field cutting-form-field--inline">
                                    <label className="cutting-form-field__label">Пошук за:</label>
                                    <select
                                        value={searchBy}
                                        onChange={(e) => setSearchBy(e.target.value)}
                                        className="cutting-form-field__select"
                                        style={{"width": "100%"}}
                                    >
                                        <option value="name">Назвою</option>
                                        <option value="article_num">Номером</option>
                                    </select>
                                </div>

                                <div className="cutting-form-field cutting-form-field--inline">
                                    <label className="cutting-form-field__label">
                                        {searchBy === 'name' ? 'Пошук Артикула:' : 'Пошук за Номером:'}
                                    </label>
                                    <input
                                        type="text"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        placeholder={
                                            searchBy === 'name'
                                                ? "Введіть мінімум 2 символи..."
                                                : "3000312.00.001"
                                        }
                                        disabled={!!selectedArticleObject}
                                        className="cutting-form-field__input"
                                    />
                                </div>

                                {/* Кнопка зміни вибору */}
                                {selectedArticleObject && (
                                    <button
                                        style={{margin: "5px"}}
                                        type="button"
                                        onClick={() => {
                                            setSelectedArticleObject(null);
                                            setSearchTerm('');
                                            setNewDetail({ article_id: '', quantity_planned: 1 });
                                            setSearchResults([]);
                                        }}
                                        className="cutting-form-btn cutting-form-btn--danger cutting-form-btn--small"
                                    >
                                        &times;
                                    </button>
                                )}

                                <div className="cutting-form-field cutting-form-field--inline">
                                    <label className="cutting-form-field__label">Кількість (шт):</label>
                                    <input
                                        type="number"
                                        name="quantity_planned"
                                        value={newDetail.quantity_planned}
                                        onChange={handleNewDetailChange}
                                        min="1"
                                        required
                                        disabled={!selectedArticleObject}
                                        className="cutting-form-field__input cutting-form-field__input--small"
                                    />
                                </div>

                                <div className="cutting-form-add">

                                    <button
                                        type="button"
                                        onClick={handleAddDetail}
                                        className="cutting-form-btn cutting-form-btn--add"
                                        disabled={!selectedArticleObject || newDetail.quantity_planned < 1}
                                    >
                                        Додати в Завдання
                                    </button>
                                </div>
                            </div>

                            {/* Результати пошуку */}
                            {!selectedArticleObject && searchTerm.length >= 2 && searchResults.length > 0 && (
                                <div className="cutting-form-search__results">
                                    {searchResults.map((art) => (
                                        <div
                                            key={art.article_id}
                                            className="cutting-form-search__item"
                                            onClick={() => {
                                                setSelectedArticleObject(art);
                                                setNewDetail({ ...newDetail, article_id: art.article_id.toString() });
                                                setSearchTerm(searchBy === 'name' ? art.name : art.article_num);
                                                setSearchResults([]);
                                            }}
                                        >
                                            <div className="cutting-form-search__item-number">{art.article_num}</div>
                                            <div className="cutting-form-search__item-name">{art.name}</div>
                                            <div className="cutting-form-search__item-details">
                                                {art.thickness}мм, {art.material_type}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Створення нового артикула */}
                            {!selectedArticleObject && searchTerm.length >= 2 && searchResults.length === 0 && (
                                <div className="cutting-form-search__empty">
                                    <p className="cutting-form-search__empty-text">Артикул не знайдено</p>
                                    <button
                                        type="button"
                                        className="cutting-form-btn cutting-form-btn--create"
                                        onClick={() => {
                                            const initialData = {
                                                name: searchBy === 'name' ? searchTerm : '',
                                                article_num: searchBy === 'article_num' ? searchTerm : '',
                                                thickness: 1.0,
                                                material_type: '',
                                                file_url: '',
                                            };
                                            setNewArticleData(initialData);
                                            setIsModalOpen(true);
                                        }}
                                    >
                                        + Створити новий артикул
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Інформація про вибраний артикул */}
                        {selectedArticleObject && (
                            <div className="cutting-form-selected">
                                <div className="cutting-form-selected__icon">✓</div>
                                <div className="cutting-form-selected__info">
                                    <strong>{selectedArticleObject.article_num}</strong> - {selectedArticleObject.name}
                                    <span className="cutting-form-selected__details">
                                        Товщина: {selectedArticleObject.thickness}мм | Матеріал: {selectedArticleObject.material_type}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </section>

                <div className="cutting-form-divider"></div>

                {/* Специфікація завдання */}
                <section className="cutting-form-section">
                    <div className="cutting-form-section__header">
                        <h2 className="cutting-form-section__title">Специфікація Завдання</h2>
                        <span className="cutting-form-section__counter">{jobDetails.length} позицій</span>
                    </div>

                    <div className="cutting-form-section__content">
                        {jobDetails.length === 0 ? (
                            <div className="cutting-form-empty">
                                <div className="cutting-form-empty__icon">📝</div>
                                <p className="cutting-form-empty__text">Специфікація порожня. Додайте артикули.</p>
                            </div>
                        ) : (
                            <div className="cutting-form-table">
                                <table className="cutting-form-table__table">
                                    <thead className="cutting-form-table__head">
                                    <tr>
                                        <th className="cutting-form-table__header">Номер</th>
                                        <th className="cutting-form-table__header">Артикул</th>
                                        <th className="cutting-form-table__header">Товщина, Матеріал</th>
                                        <th className="cutting-form-table__header">Кількість</th>
                                        <th className="cutting-form-table__header">Дія</th>
                                    </tr>
                                    </thead>
                                    <tbody className="cutting-form-table__body">
                                    {jobDetails.map((detail) => (
                                        <tr key={detail.article_id} className="cutting-form-table__row">
                                            <td className="cutting-form-table__cell cutting-form-table__cell--number">
                                                <strong>{detail.article_info.article_num}</strong>
                                            </td>
                                            <td className="cutting-form-table__cell">{detail.article_info.name}</td>
                                            <td className="cutting-form-table__cell">
                                                {detail.article_info.thickness}мм, {detail.article_info.material_type}
                                            </td>
                                            <td className="cutting-form-table__cell cutting-form-table__cell--quantity">
                                                {detail.quantity_planned}
                                            </td>
                                            <td className="cutting-form-table__cell cutting-form-table__cell--actions">
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveDetail(detail.article_id)}
                                                    className="cutting-form-btn cutting-form-btn--remove"
                                                >
                                                    Видалити
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </section>

                {/* Кнопка відправки */}
                <div className="cutting-form-submit">
                    <button
                        type="submit"
                        disabled={jobDetails.length === 0 || loading}
                        className="cutting-form-btn cutting-form-btn--submit"
                    >
                        {loading ? 'Збереження...' : 'Створити Завдання'}
                    </button>
                </div>
            </form>
        </div>
    );
}

export default CuttingJobForm;