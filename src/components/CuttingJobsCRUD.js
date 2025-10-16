import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import './CuttingJobsCRUD.css';

const CuttingJobsCRUD = () => {
    const [jobs, setJobs] = useState([]);
    const [articles, setArticles] = useState([]);
    const [jobDetails, setJobDetails] = useState([]);
    const [cuttingPrograms, setCuttingPrograms] = useState([]); // Додаємо стан для програм
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingJob, setEditingJob] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedJobDetails, setSelectedJobDetails] = useState(null);
    const [articleSearchTerm, setArticleSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

    // Додаємо стани для пагінації
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    // Додаємо стани для фільтрів
    const [statusFilter, setStatusFilter] = useState('');
    const [thicknessFilter, setThicknessFilter] = useState('');

    const [searchParams, setSearchParams] = useSearchParams();

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

    const jobIdFromUrl = searchParams.get('id');

    // Завантаження даних
    useEffect(() => {
        fetchData();
    }, []);

    // Ефект для автоматичного відкриття деталей завдання при завантаженні з параметром ID
    useEffect(() => {
        if (jobIdFromUrl && jobs.length > 0) {
            const jobExists = jobs.find(job => job.job_id.toString() === jobIdFromUrl);
            if (jobExists) {
                setSelectedJobDetails(parseInt(jobIdFromUrl));

                // Знаходимо сторінку, на якій знаходиться завдання
                const jobIndex = filteredJobs.findIndex(job => job.job_id.toString() === jobIdFromUrl);
                if (jobIndex !== -1) {
                    const page = Math.ceil((jobIndex + 1) / itemsPerPage);
                    setCurrentPage(page);
                }

                // Прокрутка до завдання
                setTimeout(() => {
                    const element = document.getElementById(`job-${jobIdFromUrl}`);
                    if (element) {
                        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }, 500);
            }
        }
    }, [jobIdFromUrl, jobs]);

    // Скидання сторінки при зміні пошуку або фільтрації
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, sortConfig, statusFilter, thicknessFilter]);

    function formatToCustomString(date) {
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const hours = date.getHours();
        const minutes = date.getMinutes();
        const seconds = date.getSeconds();

        const pad = (num) => String(num).padStart(2, '0');

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
                .order('creation_date', { ascending: false }); // Спочатку новіші

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

            // Завантажуємо програми різання
            const { data: programsData, error: programsError } = await supabase
                .from('cutting_programs')
                .select('*');

            if (programsError) throw programsError;

            setJobs(jobsData || []);
            setArticles(articlesData || []);
            setJobDetails(detailsData || []);
            setCuttingPrograms(programsData || []);
        } catch (error) {
            console.error('Помилка завантаження даних:', error);
            alert('Помилка завантаження даних');
        } finally {
            setLoading(false);
        }
    };

    // Отримання назви файлу для завдання
    const getJobFileName = (jobId) => {
        const program = cuttingPrograms.find(program => program.job_id === jobId);
        return program?.file_name || 'Н/Ф';
    };

    // Отримання унікальних товщин для завдання
    const getJobThicknesses = (jobId) => {
        const details = jobDetails.filter(detail => detail.job_id === jobId);
        const thicknesses = [...new Set(details.map(detail => detail.articles?.thickness).filter(Boolean))];
        return thicknesses.join(', ') || 'Н/Д';
    };

    // Отримання унікальних матеріалів для завдання
    const getJobMaterials = (jobId) => {
        const details = jobDetails.filter(detail => detail.job_id === jobId);
        const materials = [...new Set(details.map(detail => detail.articles?.material_type).filter(Boolean))];
        return materials.join(', ') || 'Н/Д';
    };

    // Фільтрація завдань
    const filteredJobs = jobs.filter(job => {
        // Фільтр по пошуку
        const matchesSearch = job.notes?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            job.status?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            job.job_id?.toString().includes(searchTerm) ||
            getJobFileName(job.job_id).toLowerCase().includes(searchTerm.toLowerCase());

        // Фільтр по статусу
        const matchesStatus = !statusFilter || job.status === statusFilter;

        // Фільтр по товщині
        const matchesThickness = !thicknessFilter ||
            jobDetails.some(detail =>
                detail.job_id === job.job_id &&
                detail.articles?.thickness?.toString().includes(thicknessFilter)
            );

        return matchesSearch && matchesStatus && matchesThickness;
    });

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

    // Пагінація
    const totalItems = sortedJobs.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    // Обчислюємо завдання для поточної сторінки
    const currentJobs = sortedJobs.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    // Функції для навігації по сторінках
    const goToPage = (page) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
            // Прокрутка вгору при зміні сторінки
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const goToNextPage = () => goToPage(currentPage + 1);
    const goToPrevPage = () => goToPage(currentPage - 1);

    // Генерація номерів сторінок для відображення
    const getPageNumbers = () => {
        const pages = [];
        const maxVisiblePages = 5;

        let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

        if (endPage - startPage + 1 < maxVisiblePages) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }

        for (let i = startPage; i <= endPage; i++) {
            pages.push(i);
        }

        return pages;
    };

    // Функція для перемикання деталей завдання з оновленням URL
    const toggleJobDetails = (jobId) => {
        if (selectedJobDetails === jobId) {
            setSelectedJobDetails(null);
            searchParams.delete('id');
            setSearchParams(searchParams);
        } else {
            setSelectedJobDetails(jobId);
            searchParams.set('id', jobId.toString());
            setSearchParams(searchParams);

            // Прокрутка до завдання
            setTimeout(() => {
                const element = document.getElementById(`job-${jobId}`);
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 100);
        }
    };

    // Функція для копіювання посилання на завдання
    const copyJobLink = (jobId) => {
        const currentUrl = window.location.origin + '/cutting-log-app/#' + '/view/jobs';
        const jobUrl = `${currentUrl}?id=${jobId}`;

        navigator.clipboard.writeText(jobUrl)
            .then(() => {
                alert('Посилання на завдання скопійовано в буфер обміну!');
            })
            .catch(err => {
                console.error('Помилка копіювання: ', err);
                alert('Помилка копіювання посилання');
            });
    };

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
                setCurrentPage(1); // Переходимо на першу сторінку після створення
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

            // Видаляємо програми різання
            const { error: programsError } = await supabase
                .from('cutting_programs')
                .delete()
                .eq('job_id', jobId);

            if (programsError) throw programsError;

            // Потім видаляємо саме завдання
            const { error } = await supabase
                .from('cutting_jobs')
                .delete()
                .eq('job_id', jobId);

            if (error) throw error;

            setJobs(jobs.filter(job => job.job_id !== jobId));
            setJobDetails(jobDetails.filter(detail => detail.job_id !== jobId));
            setCuttingPrograms(cuttingPrograms.filter(program => program.job_id !== jobId));

            // Якщо видаляємо відкрите завдання, закриваємо деталі
            if (selectedJobDetails === jobId) {
                setSelectedJobDetails(null);
                searchParams.delete('id');
                setSearchParams(searchParams);
            }

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

    // Очищення всіх фільтрів
    const clearAllFilters = () => {
        setSearchTerm('');
        setStatusFilter('');
        setThicknessFilter('');
        setArticleSearchTerm('');
    };

    if (loading) {
        return <div className="loading">Завантаження...</div>;
    }

    return (
        <div className="cutting-tasks-management">
            <div className="tasks-header">
                <h1>Управління Завданнями</h1>
                <button className="task-create-btn" onClick={startCreate}>
                    + Створити Завдання
                </button>
            </div>

            {/* Фільтри */}
            <div className="tasks-filters">
                <div className="filters-row">
                    {/* Пошук */}
                    <div className="filter-item">
                        <label>Пошук:</label>
                        <input
                            type="text"
                            placeholder="Пошук за ID, нотатками, статусом або файлом..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="filter-input"
                        />
                    </div>

                    {/* Фільтр по статусу */}
                    <div className="filter-item">
                        <label>Статус:</label>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <option value="">Всі статуси</option>
                            <option value="В черзі">В черзі</option>
                            <option value="В роботі">В роботі</option>
                            <option value="Виконано">Виконано</option>
                            <option value="Скасовано">Скасовано</option>
                        </select>
                    </div>

                    {/* Фільтр по товщині */}
                    <div className="filter-item">
                        <label>Товщина (мм):</label>
                        <input
                            type="number"
                            step="0.1"
                            value={thicknessFilter}
                            onChange={(e) => setThicknessFilter(e.target.value)}
                            placeholder="Фільтр по товщині"
                            className="filter-input"
                        />
                    </div>

                    {/* Кнопка очищення фільтрів */}
                    <div className="filter-item">
                        <button
                            onClick={clearAllFilters}
                            className="filters-clear-btn"
                            title="Очистити всі фільтри"
                        >
                            Очистити фільтри
                        </button>
                    </div>
                </div>
            </div>

            {/* Інформація про результати та вибір кількості елементів */}
            <div className="tasks-controls">
                <div className="tasks-count">
                    Знайдено: {totalItems} завдань
                    {jobIdFromUrl && (
                        <span className="url-job-notice">
                    (Відкрито завдання з URL: #{jobIdFromUrl})
                </span>
                    )}
                </div>

                <div className="page-size-selector">
                    <label>Показати по:</label>
                    <select
                        value={itemsPerPage}
                        onChange={(e) => {
                            setItemsPerPage(Number(e.target.value));
                            setCurrentPage(1);
                        }}
                    >
                        <option value={5}>5</option>
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                    </select>
                </div>
            </div>

            {/* Форма створення/редагування */}
            {showForm && (
                <div className="modal-overlay">
                    <div className="modal-form">
                        <h2>{editingJob ? 'Редагувати Завдання' : 'Створити Нове Завдання'}</h2>
                        <form onSubmit={editingJob ? updateJob : createJob}>
                            {editingJob && (
                                <div className="form-field">
                                    <label>Дата створення:</label>
                                    <div className="readonly-date">
                                        {formatDate(editingJob.creation_date)}
                                    </div>
                                </div>
                            )}

                            <div className="form-field">
                                <label>Термін виконання:</label>
                                <input
                                    type="date"
                                    value={formData.due_date}
                                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="form-field">
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

                            <div className="form-field">
                                <label>Нотатки:</label>
                                <textarea
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    rows="3"
                                    placeholder="Додаткові нотатки..."
                                />
                            </div>

                            <div className="form-buttons">
                                <button type="submit" className="form-save-btn">
                                    {editingJob ? 'Оновити' : 'Створити'}
                                </button>
                                <button type="button" onClick={() => setShowForm(false)} className="form-cancel-btn">
                                    Скасувати
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Таблиця завдань */}
            <div className="tasks-table-wrapper">
                <table className="tasks-table">
                    <thead>
                    <tr>
                        <th onClick={() => handleSort('job_id')} className="sortable-header">
                            ID {getSortIcon('job_id')}
                        </th>
                        <th onClick={() => handleSort('creation_date')} className="sortable-header">
                            Дата Створення {getSortIcon('creation_date')}
                        </th>
                        <th onClick={() => handleSort('due_date')} className="sortable-header">
                            Термін Виконання {getSortIcon('due_date')}
                        </th>
                        <th onClick={() => handleSort('status')} className="sortable-header">
                            Статус {getSortIcon('status')}
                        </th>
                        <th>Файл</th>
                        <th>Товщина (мм)</th>
                        <th>Сталь</th>
                        <th>Нотатки</th>
                        <th>Дії</th>
                    </tr>
                    </thead>
                    <tbody>
                    {currentJobs.map(job => (
                        <React.Fragment key={job.job_id}>
                            <tr
                                id={`job-${job.job_id}`}
                                className={selectedJobDetails === job.job_id ? 'task-row-selected' : 'task-row'}
                                onClick={() => toggleJobDetails(job.job_id)}
                            >
                                <td className="task-id">{job.job_id}</td>
                                <td className="task-created">{formatDate(job.creation_date)}</td>
                                <td className="task-due">{job.due_date}</td>
                                <td>
                            <span className={`task-status task-status-${(job.status || '').replace(/\s+/g, '').toLowerCase()}`}>
                                {job.status}
                            </span>
                                </td>
                                <td className="task-file">
                                    {getJobFileName(job.job_id)}
                                </td>
                                <td className="task-thickness">
                                    {getJobThicknesses(job.job_id)}
                                </td>
                                <td className="task-material">
                                    {getJobMaterials(job.job_id)}
                                </td>
                                <td className="task-notes">
                                    {job.notes?.substring(0,50) + (job.notes?.length > 50 ? '...' : '') || '—'}
                                </td>
                                <td>
                                    <div className="task-actions">
                                        <button onClick={(e) => {
                                            e.stopPropagation();
                                            startEdit(job);
                                        }} className="action-btn action-edit">
                                            ✏️
                                        </button>
                                        <button onClick={(e) => {
                                            e.stopPropagation();
                                            deleteJob(job.job_id);
                                        }} className="action-btn action-delete">
                                            🗑️
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleJobDetails(job.job_id);
                                            }}
                                            className="action-btn action-details"
                                        >
                                            {selectedJobDetails === job.job_id ? '▲' : '▼'}
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                copyJobLink(job.job_id);
                                            }}
                                            className="action-btn action-link"
                                            title="Копіювати посилання"
                                        >
                                            🔗
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                window.location.href = window.location.origin + '/cutting-log-app/#' + '/operator/' + job.job_id;
                                            }}
                                            className="action-btn action-log"
                                            title="Перейти до завдання"
                                        >
                                            📒
                                        </button>
                                    </div>
                                </td>
                            </tr>

                            {/* Деталі завдання (артикули) */}
                            {selectedJobDetails === job.job_id && (
                                <tr className="task-details-row">
                                    <td colSpan="9">
                                        <div className="task-details-panel">
                                            <div className="details-header">
                                                <h4>Артикули в завданні #{job.job_id}</h4>

                                                {/* Пошук в артикулах */}
                                                <div className="details-search">
                                                    <input
                                                        type="text"
                                                        placeholder="Пошук артикулів..."
                                                        value={articleSearchTerm}
                                                        onChange={(e) => setArticleSearchTerm(e.target.value)}
                                                        className="filter-input"
                                                    />
                                                </div>
                                            </div>

                                            {/* Форма додавання артикулу */}
                                            <div className="article-add-form">
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
                                                <span>Кількість:</span>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={jobDetailForm.quantity_planned}
                                                    onChange={(e) => setJobDetailForm({ ...jobDetailForm, quantity_planned: parseInt(e.target.value) || 1 })}
                                                    placeholder="Кількість"
                                                />

                                                <button
                                                    onClick={() => addArticleToJob(job.job_id)}
                                                    className="article-add-btn"
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
                                                        {/*<span className="article-name">*/}
                                                        {/*    {detail.articles?.name}*/}
                                                        {/*</span>*/}
                                                                <span className="article-specs">
                                                            {detail.articles?.name}
                                                        </span>
                                                                <span className="article-number">
                                                            {detail.articles?.article_num}
                                                        </span>
                                                                <span className="article-specs">
                                                            {"Лист " + detail.articles?.thickness + " мм"}, {"Сталь " + detail.articles?.material_type}
                                                        </span>
                                                            </div>
                                                            <div className="article-quantity">
                                                                <span>Кількість:</span>
                                                                <input
                                                                    type="number"
                                                                    min="1"
                                                                    defaultValue={detail.quantity_planned}
                                                                    onBlur={(e) => {
                                                                        const newQuantity = parseInt(e.target.value);
                                                                        if (newQuantity > 0) {
                                                                            updateArticleQuantity(detail.job_detail_id, newQuantity);
                                                                        } else {
                                                                            e.target.value = detail.quantity_planned;
                                                                        }
                                                                    }}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') {
                                                                            e.target.blur();
                                                                        }
                                                                    }}
                                                                    className="quantity-input"
                                                                />
                                                            </div>
                                                            <button
                                                                onClick={() => removeArticleFromJob(detail.job_detail_id)}
                                                                className="article-remove-btn"
                                                            >
                                                                Видалити
                                                            </button>
                                                        </div>
                                                    ))}

                                                {jobDetails.filter(detail => detail.job_id === job.job_id).length === 0 && (
                                                    <div className="no-articles-message">
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

            {/* Пагінація */}
            {totalPages > 1 && (
                <div className="tasks-pagination">
                    <div className="pagination-info">
                        Сторінка {currentPage} з {totalPages} •
                        Показано {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, totalItems)} з {totalItems} завдань
                    </div>

                    <div className="pagination-buttons">
                        <button
                            onClick={goToPrevPage}
                            disabled={currentPage === 1}
                            className="pagination-btn pagination-prev"
                        >
                            ← Попередня
                        </button>

                        {getPageNumbers().map(page => (
                            <button
                                key={page}
                                onClick={() => goToPage(page)}
                                className={`pagination-btn ${currentPage === page ? 'pagination-active' : ''}`}
                            >
                                {page}
                            </button>
                        ))}

                        <button
                            onClick={goToNextPage}
                            disabled={currentPage === totalPages}
                            className="pagination-btn pagination-next"
                        >
                            Наступна →
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CuttingJobsCRUD;