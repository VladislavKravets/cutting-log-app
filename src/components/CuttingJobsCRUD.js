// CuttingJobsCRUD.js
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import './CuttingJobsCRUD.css';

const CuttingJobsCRUD = () => {
    const [jobs, setJobs] = useState([]);
    const [articles, setArticles] = useState([]);
    const [jobDetails, setJobDetails] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingJob, setEditingJob] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedJobDetails, setSelectedJobDetails] = useState(null);
    const [articleSearchTerm, setArticleSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

    // Форма для нового/редагування завдання
    const [formData, setFormData] = useState({
        due_date: '',
        status: 'В черзі',
        notes: ''
    });

    // Форма для деталей завдання (артикули)
    const [jobDetailForm, setJobDetailForm] = useState({
        article_id: '',
        quantity_planned: 1
    });

    // Завантаження даних
    useEffect(() => {
        fetchData();
    }, []);


    function formatToCustomString(date) {
        // 1. Отримуємо компоненти (рік, місяць, день, годину, хвилину, секунду)
        const year = date.getFullYear();
        // Місяці в JS нумеруються від 0 до 11, тому додаємо 1
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const hours = date.getHours();
        const minutes = date.getMinutes();
        const seconds = date.getSeconds();

        // 2. Функція-допомога для додавання ведучого нуля (наприклад, 9 -> 09)
        const pad = (num) => String(num).padStart(2, '0');

        // 3. Збираємо рядок у потрібному форматі: РРРР-ММ-ДД ГГ:ХХ:СС
        const formattedDate =
            `${year}-${pad(month)}-${pad(day)} ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;

        return formattedDate;
    }
    const fetchData = async () => {
        try {
            setLoading(true);

            // Завантажуємо завдання
            const { data: jobsData, error: jobsError } = await supabase
                .from('cutting_jobs')
                .select('*')
                .order('creation_date', { ascending: false });

            if (jobsError) throw jobsError;

            // Завантажуємо артикули
            const { data: articlesData, error: articlesError } = await supabase
                .from('articles')
                .select('*')
                .order('name');

            if (articlesError) throw articlesError;

            // Завантажуємо деталі завдань
            const { data: detailsData, error: detailsError } = await supabase
                .from('job_details')
                .select(`
                    *,
                    articles (name, thickness, material_type, article_num)
                `);

            if (detailsError) throw detailsError;

            setJobs(jobsData || []);
            setArticles(articlesData || []);
            setJobDetails(detailsData || []);
        } catch (error) {
            console.error('Помилка завантаження даних:', error);
            alert('Помилка завантаження даних');
        } finally {
            setLoading(false);
        }
    };

    // Фільтрація завдань
    const filteredJobs = jobs.filter(job =>
        job.notes?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.status?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.job_id?.toString().includes(searchTerm)
    );

    // Сортування таблиці
    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedJobs = React.useMemo(() => {
        if (!sortConfig.key) return filteredJobs;

        return [...filteredJobs].sort((a, b) => {
            const aValue = a[sortConfig.key];
            const bValue = b[sortConfig.key];

            if (aValue < bValue) {
                return sortConfig.direction === 'asc' ? -1 : 1;
            }
            if (aValue > bValue) {
                return sortConfig.direction === 'asc' ? 1 : -1;
            }
            return 0;
        });
    }, [filteredJobs, sortConfig]);

    // Створення нового завдання
    const createJob = async (e) => {
        e.preventDefault();
        try {
            const jobData = {
                ...formData,
                creation_date: formatToCustomString(new Date())
            };

            const { data, error } = await supabase
                .from('cutting_jobs')
                .insert([jobData])
                .select();

            if (error) throw error;

            if (data && data.length > 0) {
                setJobs([data[0], ...jobs]);
                resetForm();
                setShowForm(false);
                alert('Завдання успішно створено!');
            }
        } catch (error) {
            console.error('Помилка створення завдання:', error);
            alert('Помилка створення завдання');
        }
    };

    // Оновлення завдання
    const updateJob = async (e) => {
        e.preventDefault();
        try {
            const { error } = await supabase
                .from('cutting_jobs')
                .update({
                    due_date: formData.due_date,
                    status: formData.status,
                    notes: formData.notes
                })
                .eq('job_id', editingJob.job_id);

            if (error) throw error;

            setJobs(jobs.map(job =>
                job.job_id === editingJob.job_id ? {
                    ...job,
                    due_date: formData.due_date,
                    status: formData.status,
                    notes: formData.notes
                } : job
            ));

            resetForm();
            setShowForm(false);
            alert('Завдання успішно оновлено!');
        } catch (error) {
            console.error('Помилка оновлення завдання:', error);
            alert('Помилка оновлення завдання');
        }
    };

    // Видалення завдання
    const deleteJob = async (jobId) => {
        if (!window.confirm('Ви впевнені, що хочете видалити це завдання?')) return;

        try {
            // Спочатку видаляємо пов'язані деталі завдання
            const { error: detailsError } = await supabase
                .from('job_details')
                .delete()
                .eq('job_id', jobId);

            if (detailsError) throw detailsError;

            // Потім видаляємо саме завдання
            const { error } = await supabase
                .from('cutting_jobs')
                .delete()
                .eq('job_id', jobId);

            if (error) throw error;

            setJobs(jobs.filter(job => job.job_id !== jobId));
            setJobDetails(jobDetails.filter(detail => detail.job_id !== jobId));
            alert('Завдання успішно видалено!');
        } catch (error) {
            console.error('Помилка видалення завдання:', error);
            alert('Помилка видалення завдання');
        }
    };

    // Додавання артикулу до завдання
    const addArticleToJob = async (jobId) => {
        if (!jobDetailForm.article_id) {
            alert('Будь ласка, виберіть артикул');
            return;
        }

        try {
            const { data, error } = await supabase
                .from('job_details')
                .insert([{
                    job_id: jobId,
                    article_id: jobDetailForm.article_id,
                    quantity_planned: jobDetailForm.quantity_planned,
                    quantity_actual: 0,
                    rejection_count: 0
                }])
                .select(`
                    *,
                    articles (name, thickness, material_type, article_num)
                `);

            if (error) throw error;

            if (data && data.length > 0) {
                setJobDetails([...jobDetails, data[0]]);
                setJobDetailForm({ article_id: '', quantity_planned: 1 });
                alert('Артикул успішно додано до завдання!');
            }
        } catch (error) {
            console.error('Помилка додавання артикулу:', error);
            alert('Помилка додавання артикулу');
        }
    };

    // Оновлення кількості артикулу в завданні
    const updateArticleQuantity = async (jobDetailId, newQuantity) => {
        if (newQuantity < 1) {
            alert('Кількість не може бути менше 1');
            return;
        }

        try {
            const { error } = await supabase
                .from('job_details')
                .update({ quantity_planned: newQuantity })
                .eq('job_detail_id', jobDetailId);

            if (error) throw error;

            setJobDetails(jobDetails.map(detail =>
                detail.job_detail_id === jobDetailId
                    ? { ...detail, quantity_planned: newQuantity }
                    : detail
            ));

            alert('Кількість успішно оновлена!');
        } catch (error) {
            console.error('Помилка оновлення кількості:', error);
            alert('Помилка оновлення кількості');
        }
    };

    // Видалення артикулу з завдання
    const removeArticleFromJob = async (jobDetailId) => {
        if (!window.confirm('Видалити цей артикул з завдання?')) return;

        try {
            const { error } = await supabase
                .from('job_details')
                .delete()
                .eq('job_detail_id', jobDetailId);

            if (error) throw error;

            setJobDetails(jobDetails.filter(detail => detail.job_detail_id !== jobDetailId));
            alert('Артикул успішно видалено з завдання!');
        } catch (error) {
            console.error('Помилка видалення артикулу:', error);
            alert('Помилка видалення артикулу');
        }
    };

    // Завантаження деталей завдання
    const toggleJobDetails = (jobId) => {
        if (selectedJobDetails === jobId) {
            setSelectedJobDetails(null);
        } else {
            setSelectedJobDetails(jobId);
        }
    };

    const resetForm = () => {
        setFormData({
            due_date: '',
            status: 'В черзі',
            notes: ''
        });
        setEditingJob(null);
    };

    const startEdit = (job) => {
        setFormData({
            due_date: job.due_date,
            status: job.status,
            notes: job.notes || ''
        });
        setEditingJob(job);
        setShowForm(true);
    };

    const startCreate = () => {
        resetForm();
        setShowForm(true);
    };

    // Фільтрація артикулів для пошуку
    const filteredArticles = articles.filter(article =>
        article.name?.toLowerCase().includes(articleSearchTerm.toLowerCase()) ||
        article.article_num?.toLowerCase().includes(articleSearchTerm.toLowerCase()) ||
        article.material_type?.toLowerCase().includes(articleSearchTerm.toLowerCase())
    );

    // Форматування дати
    const formatDate = (dateString) => {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleString('uk-UA', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    };

    const getSortIcon = (key) => {
        if (sortConfig.key !== key) return '↕️';
        return sortConfig.direction === 'asc' ? '↑' : '↓';
    };

    if (loading) {
        return <div className="loading">Завантаження...</div>;
    }

    return (
        <div className="cutting-jobs-crud">
            <div className="crud-header">
                <h1>Управління Завданнями</h1>
                <button className="create-button" onClick={startCreate}>
                    + Створити Завдання
                </button>
            </div>

            {/* Пошук */}
            <div className="search-container">
                <input
                    type="text"
                    placeholder="Пошук за ID, нотатками або статусом..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="search-input"
                />
            </div>

            <div className="found-info">
                Знайдено: {filteredJobs.length} завдань
            </div>

            {/* Форма створення/редагування */}
            {showForm && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h2>{editingJob ? 'Редагувати Завдання' : 'Створити Нове Завдання'}</h2>
                        <form onSubmit={editingJob ? updateJob : createJob}>
                            {editingJob && (
                                <div className="form-group">
                                    <label>Дата створення:</label>
                                    <div className="readonly-date">
                                        {formatDate(editingJob.creation_date)}
                                    </div>
                                </div>
                            )}

                            <div className="form-group">
                                <label>Термін виконання:</label>
                                <input
                                    type="date"
                                    value={formData.due_date}
                                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label>Статус:</label>
                                <select
                                    value={formData.status}
                                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                    required
                                >
                                    <option value="В черзі">В черзі</option>
                                    <option value="В роботі">В роботі</option>
                                    <option value="Виконано">Виконано</option>
                                    <option value="Скасовано">Скасовано</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Нотатки:</label>
                                <textarea
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    rows="3"
                                    placeholder="Додаткові нотатки..."
                                />
                            </div>

                            <div className="form-actions">
                                <button type="submit" className="save-button">
                                    {editingJob ? 'Оновити' : 'Створити'}
                                </button>
                                <button type="button" onClick={() => setShowForm(false)} className="cancel-button">
                                    Скасувати
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Таблиця завдань */}
            <div className="table-container">
                <table className="jobs-table">
                    <thead>
                        <tr>
                            <th onClick={() => handleSort('job_id')} className="sortable">
                                ID {getSortIcon('job_id')}
                            </th>
                            <th onClick={() => handleSort('creation_date')} className="sortable">
                                Дата Створення {getSortIcon('creation_date')}
                            </th>
                            <th onClick={() => handleSort('due_date')} className="sortable">
                                Термін Виконання {getSortIcon('due_date')}
                            </th>
                            <th onClick={() => handleSort('status')} className="sortable">
                                Статус {getSortIcon('status')}
                            </th>
                            <th>Нотатки</th>
                            <th>Дії</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedJobs.map(job => (
                            <React.Fragment key={job.job_id}>
                                <tr>
                                    <td className="job-id">{job.job_id}</td>
                                    <td className="creation-date">{formatDate(job.creation_date)}</td>
                                    <td>{job.due_date}</td>
                                    <td>
                                        <span className={`status-badge status-${(job.status || '').replace(/\s+/g, '')}`}>
                                            {job.status}
                                        </span>
                                    </td>
                                    <td className="notes">{job.notes || '—'}</td>
                                    <td>
                                        <div className="actions">
                                            <button onClick={() => startEdit(job)} className="edit-btn">
                                                ✏️
                                            </button>
                                            <button onClick={() => deleteJob(job.job_id)} className="delete-btn">
                                                🗑️
                                            </button>
                                            <button
                                                onClick={() => toggleJobDetails(job.job_id)}
                                                className="details-btn"
                                            >
                                                {selectedJobDetails === job.job_id ? 'Сховати' : 'Артикули'}
                                            </button>
                                        </div>
                                    </td>
                                </tr>

                                {/* Деталі завдання (артикули) */}
                                {selectedJobDetails === job.job_id && (
                                    <tr className="details-row">
                                        <td colSpan="6">
                                            <div className="job-details-section">
                                                <div className="details-header">
                                                    <h4>Артикули в завданні #{job.job_id}</h4>

                                                    {/* Пошук в артикулах */}
                                                    <div className="article-search">
                                                        <input
                                                            type="text"
                                                            placeholder="Пошук артикулів..."
                                                            value={articleSearchTerm}
                                                            onChange={(e) => setArticleSearchTerm(e.target.value)}
                                                            className="search-input"
                                                        />
                                                    </div>
                                                </div>

                                                {/* Форма додавання артикулу */}
                                                <div className="add-article-form">
                                                    <select
                                                        value={jobDetailForm.article_id}
                                                        onChange={(e) => setJobDetailForm({ ...jobDetailForm, article_id: e.target.value })}
                                                    >
                                                        <option value="">Виберіть артикул</option>
                                                        {filteredArticles.map(article => (
                                                            <option key={article.article_id} value={article.article_id}>
                                                                {article.article_num + " " + article.name} ({article.thickness}, {article.material_type})
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <p>Кількість: </p>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={jobDetailForm.quantity_planned}
                                                        onChange={(e) => setJobDetailForm({ ...jobDetailForm, quantity_planned: parseInt(e.target.value) || 1 })}
                                                        placeholder="Кількість"
                                                    />

                                                    <button
                                                        onClick={() => addArticleToJob(job.job_id)}
                                                        className="add-btn"
                                                    >
                                                        Додати Артикул
                                                    </button>
                                                </div>

                                                {/* Список артикулів завдання */}
                                                <div className="articles-list">
                                                    {jobDetails
                                                        .filter(detail => detail.job_id === job.job_id)
                                                        .map(detail => (
                                                            <div key={detail.job_detail_id} className="article-item">
                                                                <div className="article-info">
                                                                    <span className="article-name">
                                                                        {detail.articles?.name}
                                                                    </span>
                                                                    <span className="article-specs">
                                                                        {"Лист " + detail.articles?.thickness + " мм"}, {"Сталь " + detail.articles?.material_type}
                                                                    </span>
                                                                </div>
                                                                <div className="quantity-controls">
                                                                    <span>Кількість:</span>
                                                                    <input
                                                                        type="number"
                                                                        min="1"
                                                                        value={detail.quantity_planned}
                                                                        onChange={(e) => {
                                                                            const newQuantity = parseInt(e.target.value);
                                                                            if (newQuantity > 0) {
                                                                                updateArticleQuantity(detail.job_detail_id, newQuantity);
                                                                            }
                                                                        }}
                                                                        className="quantity-input"
                                                                    />
                                                                </div>
                                                                <button
                                                                    onClick={() => removeArticleFromJob(detail.job_detail_id)}
                                                                    className="remove-btn"
                                                                >
                                                                    Видалити
                                                                </button>
                                                            </div>
                                                        ))}

                                                    {jobDetails.filter(detail => detail.job_id === job.job_id).length === 0 && (
                                                        <div className="no-articles">
                                                            Немає доданих артикулів
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default CuttingJobsCRUD;