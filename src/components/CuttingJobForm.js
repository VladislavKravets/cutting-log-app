// src/components/CuttingJobForm.js

import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import './CuttingJobForm.css'; // Використовуємо покращені стилі

function CuttingJobForm() {
    // 1. Стан для даних форми Завдання (cutting_jobs)
    const [jobData, setJobData] = useState({
        due_date: '',
        notes: '',
    });
    // 2. Стан для поточної Специфікації (job_details)
    const [jobDetails, setJobDetails] = useState([]);
    // 3. Стан для додавання нового рядка Специфікації
    const [newDetail, setNewDetail] = useState({ article_id: '', quantity_planned: 1 });
    // 4. Стан для індикації завантаження
    const [loading, setLoading] = useState(false);

    // 5. Стан для пошуку та вибору артикула
    const [selectedArticleObject, setSelectedArticleObject] = useState(null);
    const [searchResults, setSearchResults] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchBy, setSearchBy] = useState('name'); // 'name' або 'article_num'

    // 6. Стан для модального вікна створення нового артикула
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newArticleData, setNewArticleData] = useState({
        name: '',
        article_num: '', // НОВЕ ПОЛЕ
        thickness: 1.0,
        material_type: '',
        file_url: '',
    });

    // --- УТИЛІТИ ---

    const debounce = (func, delay) => {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    };

    // --- ЛОГІКА ПОШУКУ ---

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

    // Запуск пошуку при зміні searchTerm або searchBy
    useEffect(() => {
        if (!selectedArticleObject) {
            debouncedSearch(searchTerm);
        }
    }, [searchTerm, selectedArticleObject, searchBy]);
    
    // --- ОБРОБНИКИ ФОРМИ ---

    const handleJobDataChange = (e) => {
        setJobData({ ...jobData, [e.target.name]: e.target.value });
    };

    const handleNewDetailChange = (e) => {
        const value = e.target.name === 'quantity_planned' ? parseInt(e.target.value) : e.target.value;
        setNewDetail({ ...newDetail, [e.target.name]: value });
    };

    // Додавання артикула до Специфікації
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
        
        // Скидання полів для наступного артикула
        setNewDetail({ article_id: '', quantity_planned: 1 });
        setSearchTerm('');
        setSelectedArticleObject(null);
        setSearchResults([]);
    };

    // Видалення артикула зі Специфікації
    const handleRemoveDetail = (articleId) => {
        setJobDetails(jobDetails.filter(detail => detail.article_id !== articleId));
    };
    
    // --- ЛОГІКА СТВОРЕННЯ НОВОГО АРТИКУЛА ---
    
    const handleNewArticleDataChange = (e) => {
        const { name, value } = e.target;
        const val = name === 'thickness' ? parseFloat(value) : value;
        setNewArticleData({ ...newArticleData, [name]: val });
    };

    const handleCreateNewArticle = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            // Перевірка на унікальність article_num
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

            // Вставка нового артикула
            const { data: articleData, error } = await supabase
                .from('articles')
                .insert([newArticleData])
                .select('article_id, name, article_num, thickness, material_type');

            if (error) throw error;

            const newArt = articleData[0];
            alert(`Артикул "${newArt.name}" (${newArt.article_num}) успішно створено та вибрано!`);

            // Автоматично вибираємо щойно створений артикул
            setSelectedArticleObject(newArt);
            setNewDetail({ ...newDetail, article_id: newArt.article_id.toString(), quantity_planned: 1 });
            setSearchTerm(newArt.name);
            
            // Закриваємо модальне вікно і скидаємо форму створення
            setIsModalOpen(false);
            setNewArticleData({ name: '', article_num: '', thickness: 1.0, material_type: '', file_url: '' });

        } catch (error) {
            console.error('Помилка створення артикула:', error);
            alert(`Помилка: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    // --- ВІДПРАВКА ОСНОВНОЇ ФОРМИ ---

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (jobDetails.length === 0) {
            alert('Завдання повинно містити хоча б один артикул!');
            return;
        }

        setLoading(true);
        let newJobId = null;

        try {
            // 1. Створення запису в cutting_jobs
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

            // 2. Створення записів в job_details
            const detailsToInsert = jobDetails.map(detail => ({
                job_id: newJobId,
                article_id: detail.article_id,
                quantity_planned: detail.quantity_planned,
            }));

            const { error: detailsError } = await supabase
                .from('job_details')
                .insert(detailsToInsert);

            if (detailsError) throw detailsError;

            alert(`Завдання №${newJobId} успішно створено та додано в чергу!`);
            
            // 3. Скидання всієї форми після успішного збереження
            setJobData({ due_date: '', notes: '' });
            setJobDetails([]);
            setNewDetail({ article_id: '', quantity_planned: 1 });
            setSearchTerm('');
            setSelectedArticleObject(null);

        } catch (error) {
            console.error('Помилка під час створення завдання:', error);
            alert(`Помилка: ${error.message}. Перевірте консоль.`);
            // Rollback
            if (newJobId) {
                await supabase.from('cutting_jobs').delete().eq('job_id', newJobId);
            }
        } finally {
            setLoading(false);
        }
    };
    
    // --- МОДАЛЬНЕ ВІКНО СТВОРЕННЯ АРТИКУЛА ---
    if (isModalOpen) {
        return (
            <div className="modal-overlay">
                <div className="modal-content">
                    <h3>Створення нового артикула</h3>
                    <form onSubmit={handleCreateNewArticle}>
                        <label>Номер артикула:</label>
                        <input
                            type="text"
                            name="article_num"
                            value={newArticleData.article_num}
                            onChange={handleNewArticleDataChange}
                            placeholder="3000312.00.001"
                            required
                            disabled={loading}
                        />

                        <label>Назва артикула:</label>
                        <input
                            type="text"
                            name="name"
                            value={newArticleData.name}
                            onChange={handleNewArticleDataChange}
                            placeholder="Пластина опорна"
                            required
                            disabled={loading}
                        />

                        <label>Товщина (мм):</label>
                        <input
                            type="number"
                            name="thickness"
                            step="0.1"
                            min="0.1"
                            value={newArticleData.thickness}
                            onChange={handleNewArticleDataChange}
                            required
                            disabled={loading}
                        />

                        <label>Тип матеріалу:</label>
                        <input
                            type="text"
                            name="material_type"
                            value={newArticleData.material_type}
                            onChange={handleNewArticleDataChange}
                            placeholder="Сталь 3"
                            required
                            disabled={loading}
                        />
                        
                        <label>URL файлу (необов'язково):</label>
                        <input
                            type="text"
                            name="file_url"
                            value={newArticleData.file_url}
                            onChange={handleNewArticleDataChange}
                            placeholder="design/file_name.dxf"
                            disabled={loading}
                        />

                        <div className="modal-actions">
                            <button type="submit" disabled={loading} className="submit-button">
                                {loading ? 'Збереження...' : 'Зберегти та вибрати'}
                            </button>
                            <button type="button" onClick={() => setIsModalOpen(false)} className="cancel-button">
                                Скасувати
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        );
    }
    
    // --- ОСНОВНИЙ РЕНДЕР КОМПОНЕНТА ---

    return (
        <div className="job-form-container">
            <h1>Формування Завдання на Різання 📋</h1>
            
            <form onSubmit={handleSubmit}>
                <section className="job-meta-data">
                    <h2>Основні дані</h2>
                    <label>
                        Дата Завершення (план):
                        <input
                            type="date"
                            name="due_date" 
                            value={jobData.due_date}
                            onChange={handleJobDataChange}
                            required
                        />
                    </label>
                    <label>
                        Примітки до Завдання:
                        <textarea
                            name="notes"
                            value={jobData.notes}
                            onChange={handleJobDataChange}
                            rows="3"
                        />
                    </label>
                </section>
                
                <hr />

                <section className="job-details-input">
                    <h2>Додати Артикул до Специфікації</h2>
                    
                    <div className="input-row">
                        <div className="search-input-wrapper">
                            <div className="search-controls">
                                <label>
                                    Пошук за:
                                    <select 
                                        value={searchBy} 
                                        onChange={(e) => setSearchBy(e.target.value)}
                                    >
                                        <option value="name">Назвою</option>
                                        <option value="article_num">Номером</option>
                                    </select>
                                </label>
                                
                                <label>
                                    {searchBy === 'name' ? 'Пошук Артикула:' : 'Пошук за Номером:'}
                                    <input
                                        type="text"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        placeholder={
                                            searchBy === 'name' 
                                                ? "Введіть мінімум 2 символи для пошуку..."
                                                : "3000312.00.001"
                                        }
                                        disabled={!!selectedArticleObject} 
                                    />
                                </label>
                            </div>

                            {/* Кнопка "Змінити" */}
                            {selectedArticleObject && (
                                <button 
                                    type="button" 
                                    onClick={() => {
                                        setSelectedArticleObject(null);
                                        setSearchTerm('');
                                        setNewDetail({ article_id: '', quantity_planned: 1 });
                                        setSearchResults([]);
                                    }}
                                    className="remove-selection-button"
                                >
                                    &times; Змінити
                                </button>
                            )}
                            
                            {/* Список результатів пошуку */}
                            {!selectedArticleObject && searchTerm.length >= 2 && searchResults.length > 0 && (
                                <div className="autocomplete-dropdown">
                                    {searchResults.map((art) => (
                                        <div
                                            key={art.article_id}
                                            className="autocomplete-item"
                                            onClick={() => {
                                                setSelectedArticleObject(art);
                                                setNewDetail({ ...newDetail, article_id: art.article_id.toString() });
                                                setSearchTerm(searchBy === 'name' ? art.name : art.article_num);
                                                setSearchResults([]);
                                            }}
                                        >
                                            {art.article_num} - {art.name} ({art.thickness}мм, {art.material_type})
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Кнопка "Створити новий" */}
                            {!selectedArticleObject && searchTerm.length >= 2 && searchResults.length === 0 && (
                                <div className="search-no-results">
                                    <p>Артикул не знайдено.</p>
                                    <button 
                                        type="button" 
                                        className="create-new-button" 
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

                            <input 
                                type="hidden" 
                                name="article_id" 
                                value={newDetail.article_id} 
                            />
                        </div>
                        
                        <label>
                            Кількість (шт):
                            <input
                                type="number"
                                name="quantity_planned" 
                                value={newDetail.quantity_planned}
                                onChange={handleNewDetailChange}
                                min="1"
                                required
                                disabled={!selectedArticleObject}
                            />
                        </label>
                        
                        <button 
                            type="button" 
                            onClick={handleAddDetail} 
                            className="add-button"
                            disabled={!selectedArticleObject || newDetail.quantity_planned < 1}
                        >
                            Додати в Завдання
                        </button>
                    </div>

                    {selectedArticleObject && (
                        <p className="article-info">
                            Вибрано: <strong>{selectedArticleObject.article_num}</strong> - {selectedArticleObject.name} | 
                            Товщина: {selectedArticleObject.thickness} мм | 
                            Матеріал: {selectedArticleObject.material_type}
                        </p>
                    )}
                </section>
                
                <hr />

                <section className="job-details-table">
                    <h2>Специфікація Завдання ({jobDetails.length} позицій)</h2>
                    
                    {jobDetails.length === 0 ? (
                        <p>Специфікація порожня. Додайте артикули.</p>
                    ) : (
                        <table>
                            <thead>
                                <tr>
                                    <th>Номер</th>
                                    <th>Артикул</th>
                                    <th>Товщина, Матеріал</th>
                                    <th>Кількість (план)</th>
                                    <th>Дія</th>
                                </tr>
                            </thead>
                            <tbody>
                                {jobDetails.map((detail) => (
                                    <tr key={detail.article_id}>
                                        <td>{detail.article_info.article_num}</td>
                                        <td>{detail.article_info.name}</td>
                                        <td>{detail.article_info.thickness}мм, {detail.article_info.material_type}</td>
                                        <td>{detail.quantity_planned}</td>
                                        <td>
                                            <button 
                                                type="button" 
                                                onClick={() => handleRemoveDetail(detail.article_id)}
                                                className="remove-button"
                                            >
                                                Видалити
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </section>

                <button 
                    type="submit" 
                    disabled={jobDetails.length === 0 || loading} 
                    className="submit-button"
                >
                    {loading ? 'Збереження...' : 'Створити Завдання'}
                </button>
                
            </form>
        </div>
    );
}

export default CuttingJobForm;