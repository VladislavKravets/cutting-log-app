// JobsTableWithDetails.js
import React, {useState, useEffect} from 'react';
import {useSearchParams, useNavigate} from 'react-router-dom';
import {supabase} from '../supabaseClient';
import './JobsTableWithDetails.css';

const JobsTableWithDetails = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();

    const [jobs, setJobs] = useState([]);
    const [expandedJobs, setExpandedJobs] = useState(new Set());
    const [jobDetails, setJobDetails] = useState({});
    const [cuttingLogs, setCuttingLogs] = useState({});
    const [cuttingPrograms, setCuttingPrograms] = useState({});
    const [loading, setLoading] = useState(false);
    const [initialLoad, setInitialLoad] = useState(true);

    // Додаємо стани для пагінації
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    // Локальний стан для відображення значень в інпутах
    const [displayFilters, setDisplayFilters] = useState({
        job_id: searchParams.get('job_id') || '',
        status: searchParams.get('status') || '',
        article_name: searchParams.get('article_name') || '',
        article_num: searchParams.get('article_num') || '', // ДОДАНО
        material_type: searchParams.get('material_type') || '',
        thickness: searchParams.get('thickness') || '',
        file_name: searchParams.get('file_name') || '',
        operator_name: searchParams.get('operator_name') || '',
        date_from: searchParams.get('date_from') || '',
        date_to: searchParams.get('date_to') || '',
        expanded: searchParams.get('expanded') || ''
    });

    // Оновлення displayFilters при зміні URL параметрів
    useEffect(() => {
        const newFilters = {
            job_id: searchParams.get('job_id') || '',
            status: searchParams.get('status') || '',
            article_name: searchParams.get('article_name') || '',
            article_num: searchParams.get('article_num') || '',
            material_type: searchParams.get('material_type') || '',
            thickness: searchParams.get('thickness') || '',
            file_name: searchParams.get('file_name') || '',
            operator_name: searchParams.get('operator_name') || '',
            date_from: searchParams.get('date_from') || '',
            date_to: searchParams.get('date_to') || '',
            expanded: searchParams.get('expanded') || ''
        };

        setDisplayFilters(newFilters);

        // Автоматичне розгортання завдання з URL параметра
        if (newFilters.expanded) {
            const expandedId = parseInt(newFilters.expanded);
            if (!isNaN(expandedId)) {
                setExpandedJobs(new Set([expandedId]));

                // Знаходимо сторінку, на якій знаходиться завдання
                const jobIndex = jobs.findIndex(job => job.job_id === expandedId);
                if (jobIndex !== -1) {
                    const page = Math.ceil((jobIndex + 1) / itemsPerPage);
                    setCurrentPage(page);
                }
            }
        }
    }, [searchParams, jobs, itemsPerPage]);

    // Завантаження завдань тільки при першому рендері та при явному оновленні
    useEffect(() => {
        if (initialLoad) {
            fetchJobs();
            setInitialLoad(false);
        }
    }, [initialLoad]);

    // Пагінація
    const totalItems = jobs.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    // Обчислюємо завдання для поточної сторінки
    const currentJobs = jobs.slice(
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

    // Функція для застосування фільтрів
    const applyFilter = (key, value) => {
        const params = new URLSearchParams(searchParams);

        if (value && value !== '') {
            params.set(key, value);
        } else {
            params.delete(key);
        }

        setSearchParams(params);
        setCurrentPage(1);

        // Оновлюємо дані при зміні фільтрів
        fetchJobs();
    };

    // Функція для обробки змін в інпутах
    const handleInputChange = (key, value) => {
        setDisplayFilters(prev => ({
            ...prev,
            [key]: value
        }));
    };

    // Функція для обробки onBlur та Enter
    const handleFilterApply = (key, value) => {
        applyFilter(key, value);
    };

    // Функція для створення посилання на конкретне завдання
    const createJobLink = (jobId, expand = true) => {
        const params = new URLSearchParams();

        // Очищаємо фільтри для конкретного завдання
        params.set('job_id', jobId);
        if (expand) {
            params.set('expanded', jobId);
        }

        return `/cutting-log-app/#/view/jobs?id=${jobId}`;
    };

    const fetchJobs = async () => {
        try {
            setLoading(true);

            // Отримуємо актуальні фільтри з URL
            const currentFilters = {
                job_id: searchParams.get('job_id') || '',
                status: searchParams.get('status') || '',
                article_name: searchParams.get('article_name') || '',
                article_num: searchParams.get('article_num') || '', // ДОДАНО
                material_type: searchParams.get('material_type') || '',
                thickness: searchParams.get('thickness') || '',
                file_name: searchParams.get('file_name') || '',
                operator_name: searchParams.get('operator_name') || '',
                date_from: searchParams.get('date_from') || '',
                date_to: searchParams.get('date_to') || '',
                expanded: searchParams.get('expanded') || ''
            };

            console.log('Поточні фільтри:', currentFilters); // ДЛЯ ДЕБАГУ

            // Основний запит для завдань
            let query = supabase
                .from('cutting_jobs')
                .select('*')
                .order('creation_date', { ascending: false });

            // Застосування фільтрів
            if (currentFilters.job_id) {
                query = query.eq('job_id', parseInt(currentFilters.job_id));
            }
            if (currentFilters.status) {
                query = query.eq('status', currentFilters.status);
            }
            if (currentFilters.date_from) {
                query = query.gte('creation_date', currentFilters.date_from);
            }
            if (currentFilters.date_to) {
                query = query.lte('creation_date', currentFilters.date_to);
            }

            const { data: jobsData, error } = await query;
            if (error) throw error;

            if (!jobsData || jobsData.length === 0) {
                setJobs([]);
                setJobDetails({});
                setCuttingLogs({});
                setCuttingPrograms({});
                return;
            }

            // Отримуємо ID завдань для додаткових запитів
            const jobIds = jobsData.map(job => job.job_id);

            // Паралельні запити для отримання пов'язаних даних
            const [detailsResult, programsResult] = await Promise.all([
                fetchJobDetails(jobIds),
                fetchCuttingPrograms(jobIds)
            ]);

            // Отримуємо логи різання через program_id
            const programIds = programsResult.map(program => program.program_id);
            const logsResult = await fetchCuttingLogs(programIds);

            console.log('Знайдено деталей:', detailsResult.length); // ДЛЯ ДЕБАГУ

            // Фільтрація завдань за додатковими фільтрами
            let filteredJobs = jobsData;
            if (currentFilters.article_name || currentFilters.article_num || currentFilters.material_type || currentFilters.thickness || currentFilters.file_name || currentFilters.operator_name) {
                console.log('Застосовуємо додаткові фільтри'); // ДЛЯ ДЕБАГУ
                filteredJobs = await filterJobsByAdditionalCriteria(jobsData, detailsResult, logsResult, programsResult, currentFilters);
                console.log('Після фільтрації завдань:', filteredJobs.length); // ДЛЯ ДЕБАГУ
            }

            setJobs(filteredJobs);

            // Створюємо мапи для швидкого доступу
            const detailsMap = {};
            const logsMap = {};
            const programsMap = {};

            filteredJobs.forEach(job => {
                const jobId = job.job_id;
                detailsMap[jobId] = detailsResult.filter(detail => detail.job_id === jobId);
                programsMap[jobId] = programsResult.filter(program => program.job_id === jobId);

                // Отримуємо логи для цього завдання через програми
                const jobProgramIds = programsMap[jobId].map(program => program.program_id);
                logsMap[jobId] = logsResult.filter(log => jobProgramIds.includes(log.program_id));
            });

            setJobDetails(detailsMap);
            setCuttingLogs(logsMap);
            setCuttingPrograms(programsMap);

        } catch (error) {
            console.error('Помилка завантаження даних:', error);
            console.error('Деталі помилки:', error.message);
        } finally {
            setLoading(false);
        }
    };

    // Решта функцій залишаються незмінними
    const fetchJobDetails = async (jobIds) => {
        try {
            const {data, error} = await supabase
                .from('job_details')
                .select(`
          *,
          articles (*)
        `)
                .in('job_id', jobIds);

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Помилка завантаження деталей:', error);
            return [];
        }
    };

    const fetchCuttingLogs = async (programIds) => {
        try {
            if (!programIds || programIds.length === 0) return [];

            const {data, error} = await supabase
                .from('cutting_log')
                .select('*')
                .in('program_id', programIds);

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Помилка завантаження логів:', error);
            return [];
        }
    };

    const fetchCuttingPrograms = async (jobIds) => {
        try {
            const {data, error} = await supabase
                .from('cutting_programs')
                .select('*')
                .in('job_id', jobIds);

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Помилка завантаження програм:', error);
            return [];
        }
    };

    const filterJobsByAdditionalCriteria = async (jobs, details, logs, programs, currentFilters) => {
        return jobs.filter(job => {
            const jobId = job.job_id;
            const jobDetails = details.filter(detail => detail.job_id === jobId);
            const jobPrograms = programs.filter(program => program.job_id === jobId);
            const jobProgramIds = jobPrograms.map(program => program.program_id);
            const jobLogs = logs.filter(log => jobProgramIds.includes(log.program_id));

            let matches = true;

            // Фільтр по назві артикулу
            if (currentFilters.article_name && matches) {
                matches = jobDetails.some(detail =>
                    detail.articles?.name?.toLowerCase().includes(currentFilters.article_name.toLowerCase())
                );
            }

            // Фільтр по номеру артикулу - ПЕРЕВІРКА НА NULL/UNDEFINED
            if (currentFilters.article_num && matches) {
                matches = jobDetails.some(detail => {
                    const articleNum = detail.articles?.article_num;
                    if (!articleNum) return false;
                    return articleNum.toLowerCase().includes(currentFilters.article_num.toLowerCase());
                });
                console.log(`Фільтр article_num: ${currentFilters.article_num}, результат: ${matches}`); // ДЛЯ ДЕБАГУ
            }

            // Фільтр по матеріалу
            if (currentFilters.material_type && matches) {
                matches = jobDetails.some(detail =>
                    detail.articles?.material_type?.toLowerCase().includes(currentFilters.material_type.toLowerCase())
                );
            }

            // Фільтр по товщині
            if (currentFilters.thickness && matches) {
                matches = jobDetails.some(detail =>
                    detail.articles?.thickness?.toString().includes(currentFilters.thickness)
                );
            }

            // Фільтр по назві файлу
            if (currentFilters.file_name && matches) {
                matches = jobPrograms.some(program =>
                    program.file_name?.toLowerCase().includes(currentFilters.file_name.toLowerCase())
                );
            }

            // Фільтр по оператору
            if (currentFilters.operator_name && matches) {
                matches = jobLogs.some(log =>
                    log.operator_name?.toLowerCase().includes(currentFilters.operator_name.toLowerCase())
                );
            }

            return matches;
        });
    };

    const toggleJobExpansion = (jobId) => {
        const newExpanded = new Set(expandedJobs);
        if (newExpanded.has(jobId)) {
            newExpanded.delete(jobId);
        } else {
            newExpanded.add(jobId);
        }
        setExpandedJobs(newExpanded);

        // Оновлюємо URL при розгортанні/згортанні
        const params = new URLSearchParams(searchParams);
        if (newExpanded.has(jobId)) {
            params.set('expanded', jobId.toString());
        } else {
            params.delete('expanded');
        }
        setSearchParams(params);
    };

    const clearFilters = () => {
        const params = new URLSearchParams();
        setSearchParams(params);
        setCurrentPage(1);
        fetchJobs();
    };

    // Копіювання посилання з поточними фільтрами
    const copyCurrentLink = () => {
        const currentUrl = `${window.location.origin}/cutting-log-app/#/view/information?${searchParams.toString()}`;
        navigator.clipboard.writeText(currentUrl)
            .then(() => alert('Посилання скопійовано в буфер обміну!'))
            .catch(() => alert('Помилка копіювання посилання'));
    };

    // Розрахунок загальних показників для завдання
    const calculateJobTotals = (details) => {
        return details.reduce((totals, detail) => ({
            planned: totals.planned + (detail.quantity_planned || 0),
            actual: totals.actual + (detail.quantity_actual || 0),
            rejection: totals.rejection + (detail.rejection_count || 0)
        }), {planned: 0, actual: 0, rejection: 0});
    };

    // Отримання унікальних програм для завдання
    const getJobPrograms = (jobId) => {
        const programs = cuttingPrograms[jobId] || [];
        return programs.map(program => program.file_name).filter(Boolean);
    };

    // Отримання останнього логу для завдання
    const getLatestLog = (jobId) => {
        const logs = cuttingLogs[jobId] || [];
        if (logs.length === 0) return null;

        // Сортуємо за start_time (останній перший)
        const sortedLogs = [...logs].sort((a, b) => new Date(b.start_time) - new Date(a.start_time));

        return sortedLogs[0];
    };

    // Розрахунок метрик для логу різання
    const calculateCuttingMetrics = (log) => {
        if (!log) return null;

        const startMeter = parseFloat(log.start_meter) || 0;
        const endMeter = parseFloat(log.end_meter) || 0;
        const consumption = (endMeter - startMeter) * 120;

        let duration = 0;
        if (log.start_time && log.end_time) {
            const startTime = new Date(log.start_time);
            const endTime = new Date(log.end_time);
            duration = (endTime - startTime) / (1000 * 60); // тривалість в хвилинах
        }

        return {
            consumption,
            duration: Math.round(duration),
            oxygen_pressure: log.oxygen_pressure,
            air_pressure: log.air_pressure,
            operator_name: log.operator_name,
            start_time: log.start_time,
            end_time: log.end_time,
            start_meter: log.start_meter,
            end_meter: log.end_meter
        };
    };

    // Отримання назви програми для логу
    const getProgramNameForLog = (log, jobId) => {
        if (!log) return 'Н/Д';
        const programs = cuttingPrograms[jobId] || [];
        const program = programs.find(p => p.program_id === log.program_id);
        return program?.file_name || 'Н/Д';
    };

    if (loading && initialLoad) return <div className="loading">Завантаження...</div>;

    return (<div className="cutting-journal">
        <div className="journal-header">
            <h1>Журнал різки</h1>
            <button onClick={copyCurrentLink} className="journal-copy-link">
                📋 Копіювати посилання з фільтрами
            </button>
        </div>

        {/* Фільтри */}
        <div className="journal-filters">
            <div className="filters-grid">
                <div className="filter-field">
                    <label>ID Завдання:</label>
                    <input
                        type="number"
                        value={displayFilters.job_id}
                        onChange={(e) => handleInputChange('job_id', e.target.value)}
                        onBlur={(e) => handleFilterApply('job_id', e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                handleFilterApply('job_id', e.target.value);
                            }
                        }}
                        placeholder="Фільтр по ID"
                        className="filter-input"
                    />
                </div>

                <div className="filter-field">
                    <label>Статус:</label>
                    <select
                        value={displayFilters.status}
                        onChange={(e) => applyFilter('status', e.target.value)}
                        className="filter-select"
                    >
                        <option value="">Всі статуси</option>
                        <option value="В роботі">В роботі</option>
                        <option value="Виконано">Виконано</option>
                        <option value="В черзі">В черзі</option>
                        <option value="Скасовано">Скасовано</option>
                    </select>
                </div>

                <div className="filter-field">
                    <label>Назва артикулу:</label>
                    <input
                        type="text"
                        value={displayFilters.article_name}
                        onChange={(e) => handleInputChange('article_name', e.target.value)}
                        onBlur={(e) => handleFilterApply('article_name', e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                handleFilterApply('article_name', e.target.value);
                            }
                        }}
                        placeholder="Пошук по назві"
                        className="filter-input"
                    />
                </div>

                <div className="filter-field">
                    <label>Номер артикула:</label>
                    <input
                        type="text"
                        value={displayFilters.article_num}
                        onChange={(e) => handleInputChange('article_num', e.target.value)}
                        onBlur={(e) => handleFilterApply('article_num', e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                handleFilterApply('article_num', e.target.value);
                            }
                        }}
                        placeholder="Пошук по номеру"
                        className="filter-input"
                    />
                </div>

                <div className="filter-field">
                    <label>Матеріал:</label>
                    <input
                        type="text"
                        value={displayFilters.material_type}
                        onChange={(e) => handleInputChange('material_type', e.target.value)}
                        onBlur={(e) => handleFilterApply('material_type', e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                handleFilterApply('material_type', e.target.value);
                            }
                        }}
                        placeholder="Тип матеріалу"
                        className="filter-input"
                    />
                </div>

                <div className="filter-field">
                    <label>Товщина (мм):</label>
                    <input
                        type="number"
                        step="0.1"
                        value={displayFilters.thickness}
                        onChange={(e) => handleInputChange('thickness', e.target.value)}
                        onBlur={(e) => handleFilterApply('thickness', e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                handleFilterApply('thickness', e.target.value);
                            }
                        }}
                        placeholder="Фільтр по товщині"
                        className="filter-input"
                    />
                </div>

                <div className="filter-field">
                    <label>Назва файлу:</label>
                    <input
                        type="text"
                        value={displayFilters.file_name}
                        onChange={(e) => handleInputChange('file_name', e.target.value)}
                        onBlur={(e) => handleFilterApply('file_name', e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                handleFilterApply('file_name', e.target.value);
                            }
                        }}
                        placeholder="Пошук по файлу"
                        className="filter-input"
                    />
                </div>

                <div className="filter-field">
                    <label>Оператор:</label>
                    <input
                        type="text"
                        value={displayFilters.operator_name}
                        onChange={(e) => handleInputChange('operator_name', e.target.value)}
                        onBlur={(e) => handleFilterApply('operator_name', e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                handleFilterApply('operator_name', e.target.value);
                            }
                        }}
                        placeholder="Ім'я оператора"
                        className="filter-input"
                    />
                </div>

                <div className="filter-field">
                    <label>Дата від:</label>
                    <input
                        type="date"
                        value={displayFilters.date_from}
                        onChange={(e) => handleInputChange('date_from', e.target.value)}
                        onBlur={(e) => handleFilterApply('date_from', e.target.value)}
                        className="filter-input"
                    />
                </div>

                <div className="filter-field">
                    <label>Дата до:</label>
                    <input
                        type="date"
                        value={displayFilters.date_to}
                        onChange={(e) => handleInputChange('date_to', e.target.value)}
                        onBlur={(e) => handleFilterApply('date_to', e.target.value)}
                        className="filter-input"
                    />
                </div>
            </div>

            {/* Контроли */}
            <div className="journal-controls">
                <div className="results-summary">
                    Знайдено: {totalItems} завдань
                    {loading && <span className="loading-indicator"> (оновлення...)</span>}
                </div>

                <div className="controls-group">
                    <div className="page-size-control">
                        <label>Показати по:</label>
                        <select
                            value={itemsPerPage}
                            onChange={(e) => {
                                setItemsPerPage(Number(e.target.value));
                                setCurrentPage(1);
                            }}
                            className="page-size-select"
                        >
                            <option value={5}>5</option>
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                            <option value={50}>50</option>
                        </select>
                    </div>

                    <div className="action-buttons">
                        <button onClick={fetchJobs} className="action-btn refresh-btn">
                            🔄 Оновити дані
                        </button>
                        <button className="action-btn clear-filters-btn" onClick={clearFilters}>
                            🗑️ Очистити фільтри
                        </button>
                    </div>
                </div>
            </div>
        </div>

        {/* Таблиця завдань */}
        <div className="journal-content">
            {jobs.length === 0 ? (
                <div className="no-results">Завдання не знайдені</div>
            ) : (
                <div className="jobs-container">
                    {currentJobs.map((job) => {
                        const details = jobDetails[job.job_id] || [];
                        const logs = cuttingLogs[job.job_id] || [];
                        const programs = getJobPrograms(job.job_id);
                        const latestLog = getLatestLog(job.job_id);
                        const metrics = calculateCuttingMetrics(latestLog);
                        const totals = calculateJobTotals(details);
                        const isExpanded = expandedJobs.has(job.job_id);

                        return (
                            <div key={job.job_id} className="journal-job-card">
                                {/* Заголовок завдання */}
                                <div
                                    className="job-card-header"
                                    onClick={() => toggleJobExpansion(job.job_id)}
                                >
                                    <div className="job-main-info">
                                    <span className="expand-indicator">
                                        {isExpanded ? '▼' : '►'}
                                    </span>
                                        <span className="job-identifier">
                                        <a
                                            href={createJobLink(job.job_id)}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                navigate(createJobLink(job.job_id));
                                            }}
                                            className="job-link"
                                            title="Посилання на це завдання"
                                        >
                                            Завдання #{job.job_id}
                                        </a>
                                    </span>
                                        <span className={`job-status job-status-${job.status.replace(' ', '-').toLowerCase()}`}>
                                        {job.status}
                                    </span>
                                        <span className="job-dates">
                                        <span className="date-created">
                                            Створено: {new Date(job.creation_date).toLocaleDateString('uk-UA')}
                                        </span>
                                        <span className="date-due">
                                            Термін: {new Date(job.due_date).toLocaleDateString('uk-UA')}
                                        </span>
                                    </span>
                                        {programs.length > 0 && (
                                            <span className="job-files">
                                            Файли: {programs.join(', ')}
                                        </span>
                                        )}
                                    </div>

                                    <div className="job-summary">
                                        <span className="summary-item">План: {totals.planned}</span>
                                        <span className="summary-item">Факт: {totals.actual}</span>
                                        <span className="summary-item">Брак: {totals.rejection}</span>
                                        <span className="summary-item">Деталі: {details.length}</span>
                                    </div>
                                </div>

                                {/* Деталі завдання (при розгортанні) */}
                                {isExpanded && (
                                    <div className="job-card-details">
                                        {/* Деталі артикулів */}
                                        {details.length > 0 && (
                                            <div className="details-panel">
                                                <h4 className="panel-title">Артикули та деталі</h4>
                                                <div className="table-wrapper">
                                                    <table className="details-data-table">
                                                        <thead>
                                                        <tr>
                                                            <th>ID Деталі</th>
                                                            <th>Артикул</th>
                                                            <th>Товщина</th>
                                                            <th>Матеріал</th>
                                                            <th>План к-сть</th>
                                                            <th>Факт к-сть</th>
                                                            <th>Брак</th>
                                                            <th>Файл артикулу</th>
                                                        </tr>
                                                        </thead>
                                                        <tbody>
                                                        {details.map((detail) => (
                                                            <tr key={detail.job_detail_id}>
                                                                <td className="detail-id">{detail.job_detail_id}</td>
                                                                <td className="article-data">
                                                                    <div className="article-title">
                                                                        {detail.articles?.name || 'Н/Д'}
                                                                    </div>
                                                                    <div className="article-number">
                                                                        {detail.articles?.article_num || 'Н/Д'}
                                                                    </div>
                                                                </td>
                                                                <td className="thickness-value">{detail.articles?.thickness || 'Н/Д'} мм</td>
                                                                <td className="material-type">{detail.articles?.material_type || 'Н/Д'}</td>
                                                                <td className="quantity-planned">{detail.quantity_planned}</td>
                                                                <td className="quantity-actual">{detail.quantity_actual}</td>
                                                                <td className={`rejection-count ${detail.rejection_count > 0 ? 'has-rejection' : ''}`}>
                                                                    {detail.rejection_count}
                                                                </td>
                                                                <td className="file-cell">
                                                                    {detail.articles?.file_url ? (
                                                                        <a
                                                                            href={detail.articles.file_url}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="file-download-link"
                                                                        >
                                                                            Файл
                                                                        </a>
                                                                    ) : (
                                                                        'Н/Д'
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                        </tbody>
                                                        <tfoot>
                                                        <tr className="details-totals-row">
                                                            <td colSpan="4" className="totals-label">Всього по завданню:</td>
                                                            <td className="total-planned">{totals.planned}</td>
                                                            <td className="total-actual">{totals.actual}</td>
                                                            <td className="total-rejection">{totals.rejection}</td>
                                                            <td className="efficiency-cell">
                                                                Ефективність: {totals.planned > 0 ? Math.round(((totals.actual + totals.rejection) / totals.planned) * 100) : 0}%
                                                            </td>
                                                        </tr>
                                                        </tfoot>
                                                    </table>
                                                </div>
                                            </div>
                                        )}

                                        {/* Логи різання */}
                                        {logs.length > 0 && (
                                            <div className="logs-panel">
                                                <h4 className="panel-title">Лог різання</h4>
                                                <div className="table-wrapper">
                                                    <table className="logs-data-table">
                                                        <thead>
                                                        <tr>
                                                            <th>Програма</th>
                                                            {/*<th>Оператор</th>*/}
                                                            <th>Дата різки</th>
                                                            <th>Остання зміна</th>
                                                            <th>Підготовка (хв)</th>
                                                            <th>Різка (хв)</th>
                                                            <th>Кисень МПА</th>
                                                            <th>Повітря</th>
                                                            <th>Старт лічильник</th>
                                                            <th>Кінець лічильник</th>
                                                            <th>Енергія (кВт)</th>
                                                        </tr>
                                                        </thead>
                                                        <tbody>
                                                        {logs.map((log) => {
                                                            const logMetrics = calculateCuttingMetrics(log);
                                                            return (
                                                                <tr key={log.log_entry_id}>
                                                                    <td className="program-name">{getProgramNameForLog(log, job.job_id)}</td>
                                                                    {/*<td className="operator-name">{logMetrics?.operator_name || 'Н/Д'}</td>*/}
                                                                    <td className="cut-date">{log.cut_date?.substring(0, 10) || 'Н/Д'}</td>
                                                                    <td className="last-update">
                                                                        {logMetrics?.end_time ? new Date(logMetrics.end_time).toLocaleString('uk-UA') : 'Н/Д'}
                                                                    </td>
                                                                    <td className="prep-time">{log?.preparation_time_minutes || 'Н/Д'}</td>
                                                                    <td className="cut-time">{log?.cutting_time_minutes || 'Н/Д'}</td>
                                                                    <td className="oxygen-pressure">{logMetrics?.oxygen_pressure || 'Н/Д'}</td>
                                                                    <td className="air-pressure">{logMetrics?.air_pressure || 'Н/Д'}</td>
                                                                    <td className="start-meter">{log.start_meter || 'Н/Д'}</td>
                                                                    <td className="end-meter">{log.end_meter || 'Н/Д'}</td>
                                                                    <td className="energy-consumption">
                                                                        {logMetrics?.consumption > 0 ? logMetrics.consumption.toFixed(2) : 'Н/Д'}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}

                                        {/* Програми різання */}
                                        {cuttingPrograms[job.job_id]?.length > 0 && (
                                            <div className="programs-panel">
                                                <h4 className="panel-title">Програми різання</h4>
                                                <div className="programs-list">
                                                    {cuttingPrograms[job.job_id].map((program) => (
                                                        <div key={program.program_id} className="program-item">
                                                        <span className="program-file">
                                                            {program.file_name}
                                                        </span>
                                                            <span className="program-created">
                                                            Створено: {new Date(program.date_created).toLocaleDateString('uk-UA')}
                                                        </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Нотатки завдання */}
                                        {job.notes && (
                                            <div className="job-notes-panel">
                                                <strong>Примітки:</strong>
                                                <span className="notes-content">{job.notes}</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Пагінація */}
            {totalPages > 1 && (
                <div className="journal-pagination">
                    <div className="pagination-info">
                        Сторінка {currentPage} з {totalPages} •
                        Показано {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, totalItems)} з {totalItems} завдань
                    </div>

                    <div className="pagination-controls">
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
    </div>);
};

export default JobsTableWithDetails;