import React, {useState, useEffect, useMemo} from 'react';
import {useSearchParams} from 'react-router-dom';
import {supabase} from '../supabaseClient';
import './CuttingJobsCRUD.css';

const CuttingJobsCRUD = () => {
    const [jobs, setJobs] = useState([]);
    const [articles, setArticles] = useState([]);
    const [jobDetails, setJobDetails] = useState([]);
    const [cuttingPrograms, setCuttingPrograms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingJob, setEditingJob] = useState(null);
    const [selectedJobDetails, setSelectedJobDetails] = useState(null);
    const [articleSearchTerm, setArticleSearchTerm] = useState('');
    const [prioritySelectJobId, setPrioritySelectJobId] = useState(null);

    const [searchParams, setSearchParams] = useSearchParams();

    // Ключ для збереження в sessionStorage
    const STORAGE_KEY = 'cutting_jobs_filters';

    // Функція для завантаження стану з sessionStorage або URL
    const loadStateFromStorage = () => {
        try {
            // Спочатку пробуємо завантажити з sessionStorage
            const savedState = sessionStorage.getItem(STORAGE_KEY);
            if (savedState) {
                const parsed = JSON.parse(savedState);
                // Перевіряємо, чи є в URL параметри, які мають пріоритет
                const hasUrlParams = searchParams.toString().length > 0;
                if (!hasUrlParams) {
                    return parsed;
                }
            }
        } catch (e) {
            console.error('Помилка завантаження стану:', e);
        }
        return null;
    };

    // Завантаження стану з URL
    const loadStateFromUrl = () => {
        return {
            searchTerm: searchParams.get('search') || '',
            statusFilter: searchParams.get('status') || '',
            thicknessFilter: searchParams.get('thickness') || '',
            metalAvailableFilter: searchParams.get('metal') || '',
            cuttingNeedFilter: searchParams.get('cutting') || '',
            showAllJobs: searchParams.get('showAll') === 'true',
            sortKey: searchParams.get('sortKey') || null,
            sortDirection: searchParams.get('sortDirection') || 'asc',
            currentPage: parseInt(searchParams.get('page')) || 1,
            itemsPerPage: parseInt(searchParams.get('perPage')) || 10,
            selectedJobDetails: searchParams.get('id') ? parseInt(searchParams.get('id')) : null
        };
    };

    // Ініціалізація станів
    const [searchTerm, setSearchTerm] = useState(() => {
        const saved = loadStateFromStorage();
        if (saved && saved.searchTerm !== undefined) return saved.searchTerm;
        return searchParams.get('search') || '';
    });

    const [statusFilter, setStatusFilter] = useState(() => {
        const saved = loadStateFromStorage();
        if (saved && saved.statusFilter !== undefined) return saved.statusFilter;
        return searchParams.get('status') || '';
    });

    const [thicknessFilter, setThicknessFilter] = useState(() => {
        const saved = loadStateFromStorage();
        if (saved && saved.thicknessFilter !== undefined) return saved.thicknessFilter;
        return searchParams.get('thickness') || '';
    });

    const [metalAvailableFilter, setMetalAvailableFilter] = useState(() => {
        const saved = loadStateFromStorage();
        if (saved && saved.metalAvailableFilter !== undefined) return saved.metalAvailableFilter;
        return searchParams.get('metal') || '';
    });

    const [cuttingNeedFilter, setCuttingNeedFilter] = useState(() => {
        const saved = loadStateFromStorage();
        if (saved && saved.cuttingNeedFilter !== undefined) return saved.cuttingNeedFilter;
        return searchParams.get('cutting') || '';
    });

    const [showAllJobs, setShowAllJobs] = useState(() => {
        const saved = loadStateFromStorage();
        if (saved && saved.showAllJobs !== undefined) return saved.showAllJobs;
        return searchParams.get('showAll') === 'true';
    });

    const [sortConfig, setSortConfig] = useState(() => {
        const saved = loadStateFromStorage();
        if (saved && saved.sortKey !== undefined) {
            return {key: saved.sortKey, direction: saved.sortDirection || 'asc'};
        }
        return {
            key: searchParams.get('sortKey') || null,
            direction: searchParams.get('sortDirection') || 'asc'
        };
    });

    const [currentPage, setCurrentPage] = useState(() => {
        const saved = loadStateFromStorage();
        if (saved && saved.currentPage !== undefined) return saved.currentPage;
        return parseInt(searchParams.get('page')) || 1;
    });

    const [itemsPerPage, setItemsPerPage] = useState(() => {
        const saved = loadStateFromStorage();
        if (saved && saved.itemsPerPage !== undefined) return saved.itemsPerPage;
        return parseInt(searchParams.get('perPage')) || 10;
    });

    // Форма для нового/редагування завдання
    const [formData, setFormData] = useState({
        // due_date: '',
        status: 'В черзі',
        notes: '',
        metal_available: false,
        cutting_need: false,
        priority: 3
    });

    // Форма для деталей завдання (артикули)
    const [jobDetailForm, setJobDetailForm] = useState({
        article_id: '',
        quantity_planned: ''
    });

    const jobIdFromUrl = searchParams.get('id');

    // Збереження стану в sessionStorage та URL
    useEffect(() => {
        // Зберігаємо в sessionStorage
        const stateToSave = {
            searchTerm,
            statusFilter,
            thicknessFilter,
            metalAvailableFilter,
            cuttingNeedFilter,
            showAllJobs,
            sortKey: sortConfig.key,
            sortDirection: sortConfig.direction,
            currentPage,
            itemsPerPage,
            selectedJobDetails
        };
        try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
        } catch (e) {
            console.error('Помилка збереження стану:', e);
        }

        // Оновлюємо URL
        const params = new URLSearchParams();

        if (searchTerm) params.set('search', searchTerm);
        if (statusFilter) params.set('status', statusFilter);
        if (thicknessFilter) params.set('thickness', thicknessFilter);
        if (metalAvailableFilter) params.set('metal', metalAvailableFilter);
        if (cuttingNeedFilter) params.set('cutting', cuttingNeedFilter);
        if (showAllJobs) params.set('showAll', 'true');
        if (sortConfig.key) {
            params.set('sortKey', sortConfig.key);
            params.set('sortDirection', sortConfig.direction);
        }
        if (currentPage > 1) params.set('page', currentPage.toString());
        if (itemsPerPage !== 10) params.set('perPage', itemsPerPage.toString());
        if (selectedJobDetails) params.set('id', selectedJobDetails.toString());

        setSearchParams(params);
    }, [
        searchTerm, statusFilter, thicknessFilter,
        metalAvailableFilter, cuttingNeedFilter, showAllJobs,
        sortConfig, currentPage, itemsPerPage, selectedJobDetails
    ]);

    // Відновлення selectedJobDetails з URL при завантаженні
    useEffect(() => {
        if (jobIdFromUrl && jobs.length > 0) {
            const jobExists = jobs.find(job => job.job_id.toString() === jobIdFromUrl);
            if (jobExists) {
                setSelectedJobDetails(parseInt(jobIdFromUrl));
            }
        }
    }, [jobIdFromUrl, jobs]);

    // Завантаження даних
    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        const checkScrollable = () => {
            const tableWrappers = document.querySelectorAll('.tasks-table-wrapper');
            tableWrappers.forEach(wrapper => {
                const isScrollable = wrapper.scrollWidth > wrapper.clientWidth;
                if (isScrollable) {
                    wrapper.classList.add('scrollable');
                } else {
                    wrapper.classList.remove('scrollable');
                }
            });
        };

        checkScrollable();
        window.addEventListener('resize', checkScrollable);

        return () => {
            window.removeEventListener('resize', checkScrollable);
        };
    }, []);

    // Скидання сторінки при зміні пошуку або фільтрації
    useEffect(() => {
        const pageFromUrl = searchParams.get('page');
        if (!pageFromUrl) {
            setCurrentPage(1);
        }
    }, [searchTerm, sortConfig, statusFilter, thicknessFilter, metalAvailableFilter, cuttingNeedFilter, showAllJobs]);

    function formatToCustomString(date) {
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const hours = date.getHours();
        const minutes = date.getMinutes();
        const seconds = date.getSeconds();

        const pad = (num) => String(num).padStart(2, '0');

        const formattedDate = `${year}-${pad(month)}-${pad(day)} ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;

        return formattedDate;
    }

    const fetchData = async () => {
        try {
            setLoading(true);

            const {data: jobsData, error: jobsError} = await supabase
                .from('cutting_jobs')
                .select('*')
                .order('creation_date', {ascending: false});

            if (jobsError) throw jobsError;

            const {data: articlesData, error: articlesError} = await supabase
                .from('articles')
                .select('*')
                .order('name');

            if (articlesError) throw articlesError;

            const {data: detailsData, error: detailsError} = await supabase
                .from('job_details')
                .select(`
                    *,
                    articles (name, thickness, material_type, article_num)
                `);

            if (detailsError) throw detailsError;

            const {data: programsData, error: programsError} = await supabase
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

    const getJobFileName = (jobId) => {
        const program = cuttingPrograms.find(program => program.job_id === jobId);
        return program?.file_name || 'Н/Ф';
    };

    const getJobThicknesses = (jobId) => {
        const details = jobDetails.filter(detail => detail.job_id === jobId);
        const thicknesses = [...new Set(details.map(detail => detail.articles?.thickness).filter(Boolean))];
        return thicknesses.join(', ') || 'Н/Д';
    };

    const getJobMaterials = (jobId) => {
        const details = jobDetails.filter(detail => detail.job_id === jobId);
        const materials = [...new Set(details.map(detail => detail.articles?.material_type).filter(Boolean))];
        return materials.join(', ') || 'Н/Д';
    };

    const getPriorityName = (priority) => {
        switch(priority) {
            case 1: return 'Срочно';
            case 2: return 'Високий';
            case 3: return 'Середній';
            case 4: return 'Низький';
            case 5: return 'Мінімальний';
            default: return 'Середній';
        }
    };

    const updatePriority = async (jobId, newPriority) => {
        try {
            const {error} = await supabase
                .from('cutting_jobs')
                .update({priority: newPriority})
                .eq('job_id', jobId);

            if (error) throw error;

            setJobs(jobs.map(job =>
                job.job_id === jobId ? {...job, priority: newPriority} : job
            ));

            console.log(`Пріоритет завдання ${jobId} змінено на ${newPriority}`);
        } catch (error) {
            console.error('Помилка оновлення пріоритету:', error);
            alert('Помилка оновлення пріоритету');
        }
    };

    const handlePriorityClick = (jobId, e) => {
        e.stopPropagation();
        setPrioritySelectJobId(prioritySelectJobId === jobId ? null : jobId);
    };

    const handlePriorityChange = async (jobId, newPriority) => {
        try {
            await updatePriority(jobId, newPriority);
            setPrioritySelectJobId(null);
        } catch (error) {
            console.error('Помилка зміни пріоритету:', error);
        }
    };

    const toggleCuttingNeed = async (jobId, currentValue) => {
        const job = jobs.find(j => j.job_id === jobId);

        if (job?.status === 'Виконано') {
            alert('Не можна змінювати потребу в розкрої для виконаного завдання');
            return;
        }

        try {
            const newValue = !currentValue;

            const {error} = await supabase
                .from('cutting_jobs')
                .update({cutting_need: newValue})
                .eq('job_id', jobId);

            if (error) throw error;

            setJobs(jobs.map(job => job.job_id === jobId ? {...job, cutting_need: newValue} : job));

            console.log(`Потреба в розкрої ${newValue ? 'активна' : 'неактивна'} для завдання ${jobId}`);
        } catch (error) {
            console.error('Помилка оновлення потреби в розкрої:', error);
            alert('Помилка оновлення потреби в розкрої');
        }
    };

    const toggleMetalAvailable = async (jobId, currentValue) => {
        const job = jobs.find(j => j.job_id === jobId);

        if (job?.status === 'Виконано') {
            alert('Не можна змінювати наявність металу для виконаного завдання');
            return;
        }

        try {
            const newValue = !currentValue;

            const {error} = await supabase
                .from('cutting_jobs')
                .update({metal_available: newValue})
                .eq('job_id', jobId);

            if (error) throw error;

            setJobs(jobs.map(job => job.job_id === jobId ? {...job, metal_available: newValue} : job));

            console.log(`Метал ${newValue ? 'доступний' : 'недоступний'} для завдання ${jobId}`);
        } catch (error) {
            console.error('Помилка оновлення статусу металу:', error);
            alert('Помилка оновлення статусу металу');
        }
    };

    // Функція для отримання відфільтрованих завдань
    const getFilteredJobs = (jobsList) => {
        return jobsList.filter(job => {
            // Фільтр "Показувати всі" - якщо вимкнено, приховуємо виконані
            if (!showAllJobs && job.status === 'Виконано') {
                return false;
            }

            const matchesSearch = job.notes?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                job.status?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                job.job_id?.toString().includes(searchTerm) ||
                getJobFileName(job.job_id).toLowerCase().includes(searchTerm.toLowerCase()) ||
                getPriorityName(job.priority).toLowerCase().includes(searchTerm.toLowerCase());

            const matchesStatus = !statusFilter || job.status === statusFilter;

            const matchesThickness = !thicknessFilter || jobDetails.some(detail => detail.job_id === job.job_id && detail.articles?.thickness?.toString().includes(thicknessFilter));

            const matchesMetalAvailable = !metalAvailableFilter ||
                (metalAvailableFilter === 'yes' && job.metal_available) ||
                (metalAvailableFilter === 'no' && !job.metal_available);

            const matchesCuttingNeed = !cuttingNeedFilter ||
                (cuttingNeedFilter === 'yes' && job.cutting_need) ||
                (cuttingNeedFilter === 'no' && !job.cutting_need);

            return matchesSearch && matchesStatus && matchesThickness && matchesMetalAvailable && matchesCuttingNeed;
        });
    };

    // Оновлена фільтрація з використанням getFilteredJobs
    const filteredJobs = getFilteredJobs(jobs);

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({key, direction});
    };

    const sortedJobs = useMemo(() => {
        if (!sortConfig.key) return filteredJobs;

        return [...filteredJobs].sort((a, b) => {
            const aValue = a[sortConfig.key];
            const bValue = b[sortConfig.key];

            if (sortConfig.key === 'metal_available') {
                if (aValue === bValue) return 0;
                if (sortConfig.direction === 'asc') {
                    return aValue ? -1 : 1;
                } else {
                    return aValue ? 1 : -1;
                }
            }

            if (sortConfig.key === 'cutting_need') {
                if (aValue === bValue) return 0;
                if (sortConfig.direction === 'asc') {
                    return aValue ? -1 : 1;
                } else {
                    return aValue ? 1 : -1;
                }
            }

            if (sortConfig.key === 'priority') {
                if (sortConfig.direction === 'asc') {
                    return aValue - bValue;
                } else {
                    return bValue - aValue;
                }
            }

            if (aValue < bValue) {
                return sortConfig.direction === 'asc' ? -1 : 1;
            }
            if (aValue > bValue) {
                return sortConfig.direction === 'asc' ? 1 : -1;
            }
            return 0;
        });
    }, [filteredJobs, sortConfig]);

    const totalItems = sortedJobs.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const currentJobs = sortedJobs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const goToPage = (page) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
            window.scrollTo({top: 0, behavior: 'smooth'});
        }
    };

    const goToNextPage = () => goToPage(currentPage + 1);
    const goToPrevPage = () => goToPage(currentPage - 1);

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

    const toggleJobDetails = (jobId) => {
        if (selectedJobDetails === jobId) {
            setSelectedJobDetails(null);
        } else {
            setSelectedJobDetails(jobId);

            setTimeout(() => {
                const element = document.getElementById(`job-${jobId}`);
                if (element) {
                    element.scrollIntoView({behavior: 'smooth', block: 'center'});
                }
            }, 100);
        }
    };

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

    const createJob = async (e) => {
        e.preventDefault();
        try {
            const jobData = {
                ...formData,
                priority: formData.priority || 3,
                creation_date: formatToCustomString(new Date())
            };

            const {data, error} = await supabase
                .from('cutting_jobs')
                .insert([jobData])
                .select();

            if (error) throw error;

            if (data && data.length > 0) {
                setJobs([data[0], ...jobs]);
                resetForm();
                setShowForm(false);
                setCurrentPage(1);
                alert('Завдання успішно створено!');
            }
        } catch (error) {
            console.error('Помилка створення завдання:', error);
            alert('Помилка створення завдання');
        }
    };

    const updateJob = async (e) => {
        e.preventDefault();
        try {
            const {error} = await supabase
                .from('cutting_jobs')
                .update({
                    // due_date: formData.due_date,
                    status: formData.status,
                    notes: formData.notes,
                    metal_available: formData.metal_available,
                    cutting_need: formData.cutting_need,
                    priority: formData.priority
                })
                .eq('job_id', editingJob.job_id);

            if (error) throw error;

            setJobs(jobs.map(job => job.job_id === editingJob.job_id ? {
                ...job,
                // due_date: formData.due_date,
                status: formData.status,
                notes: formData.notes,
                metal_available: formData.metal_available,
                cutting_need: formData.cutting_need,
                priority: formData.priority
            } : job));

            resetForm();
            setShowForm(false);
            alert('Завдання успішно оновлено!');
        } catch (error) {
            console.error('Помилка оновлення завдання:', error);
            alert('Помилка оновлення завдання');
        }
    };

    const deleteJob = async (jobId) => {
        if (!window.confirm('Ви впевнені, що хочете видалити це завдання?')) return;

        try {
            const {error: detailsError} = await supabase
                .from('job_details')
                .delete()
                .eq('job_id', jobId);

            if (detailsError) throw detailsError;

            const {error: programsError} = await supabase
                .from('cutting_programs')
                .delete()
                .eq('job_id', jobId);

            if (programsError) throw programsError;

            const {error} = await supabase
                .from('cutting_jobs')
                .delete()
                .eq('job_id', jobId);

            if (error) throw error;

            setJobs(jobs.filter(job => job.job_id !== jobId));
            setJobDetails(jobDetails.filter(detail => detail.job_id !== jobId));
            setCuttingPrograms(cuttingPrograms.filter(program => program.job_id !== jobId));

            if (selectedJobDetails === jobId) {
                setSelectedJobDetails(null);
            }

            alert('Завдання успішно видалено!');
        } catch (error) {
            console.error('Помилка видалення завдання:', error);
            alert('Помилка видалення завдання');
        }
    };

    const addArticleToJob = async (jobId) => {
        if (!jobDetailForm.article_id) {
            alert('Будь ласка, виберіть артикул');
            return;
        }

        try {
            const {data, error} = await supabase
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
                setJobDetailForm({article_id: '', quantity_planned: 1});
                alert('Артикул успішно додано до завдання!');
            }
        } catch (error) {
            console.error('Помилка додавання артикулу:', error);
            alert('Помилка додавання артикулу');
        }
    };

    const updateArticleQuantity = async (jobDetailId, newQuantity) => {
        if (newQuantity < 1) {
            alert('Кількість не може бути менше 1');
            return;
        }

        try {
            const {error} = await supabase
                .from('job_details')
                .update({quantity_planned: newQuantity})
                .eq('job_detail_id', jobDetailId);

            if (error) throw error;

            setJobDetails(jobDetails.map(detail => detail.job_detail_id === jobDetailId ? {
                ...detail,
                quantity_planned: newQuantity
            } : detail));

            alert('Кількість успішно оновлена!');
        } catch (error) {
            console.error('Помилка оновлення кількості:', error);
            alert('Помилка оновлення кількості');
        }
    };

    const removeArticleFromJob = async (jobDetailId) => {
        if (!window.confirm('Видалити цей артикул з завдання?')) return;

        try {
            const {error} = await supabase
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
            // due_date: '',
            status: 'В черзі',
            notes: '',
            metal_available: false,
            cutting_need: false,
            priority: 3
        });
        setEditingJob(null);
    };

    const startEdit = (job) => {
        setFormData({
            // due_date: job.due_date,
            status: job.status,
            notes: job.notes || '',
            metal_available: job.metal_available || false,
            cutting_need: job.cutting_need || false,
            priority: job.priority || 3
        });
        setEditingJob(job);
        setShowForm(true);
    };

    const startCreate = () => {
        resetForm();
        setShowForm(true);
    };

    const filteredArticles = articles.filter(article =>
        article.name?.toLowerCase().includes(articleSearchTerm.toLowerCase()) ||
        article.article_num?.toLowerCase().includes(articleSearchTerm.toLowerCase()) ||
        article.material_type?.toLowerCase().includes(articleSearchTerm.toLowerCase())
    );

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

    const clearAllFilters = () => {
        setSearchTerm('');
        setStatusFilter('');
        setThicknessFilter('');
        setMetalAvailableFilter('');
        setCuttingNeedFilter('');
        setArticleSearchTerm('');
        setPrioritySelectJobId(null);
        setShowAllJobs(false);
        setSortConfig({key: null, direction: 'asc'});
        setCurrentPage(1);
        setItemsPerPage(10);
        setSelectedJobDetails(null);
        // Очищаємо sessionStorage
        try {
            sessionStorage.removeItem(STORAGE_KEY);
        } catch (e) {
            console.error('Помилка очищення стану:', e);
        }
    };

    if (loading) {
        return <div className="loading">Завантаження...</div>;
    }

    return (
        <div className="cutting-tasks-management">
            <div className="tasks-header">
                <h1>Управління Завданнями</h1>
                <div>
                    <button className="task-create-btn" onClick={startCreate}>
                        + Створити Завдання
                    </button>
                </div>
            </div>

            {/* Фільтри */}
            <div className="tasks-filters">
                <div className="filters-row">
                    <div className="filter-item">
                        <label>Пошук:</label>
                        <input
                            type="text"
                            placeholder="Пошук за ID, нотатками, статусом, пріоритетом або файлом..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="filter-input"
                        />
                    </div>

                    <div className="filter-item">
                        <label>Статус:</label>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <option value="">Всі статуси</option>
                            <option value="В черзі">В черзі</option>
                            <option value="В роботі">В роботі</option>
                            <option value="Частково виконано">Частково виконано</option>
                            <option value="Виконано">Виконано</option>
                            <option value="Скасовано">Скасовано</option>
                        </select>
                    </div>

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

                    <div className="filter-item">
                        <label>Метал:</label>
                        <select
                            value={metalAvailableFilter}
                            onChange={(e) => setMetalAvailableFilter(e.target.value)}
                        >
                            <option value="">Всі</option>
                            <option value="yes">Є в наявності</option>
                            <option value="no">Відсутній</option>
                        </select>
                    </div>

                    <div className="filter-item">
                        <label>Потреба в розкрої:</label>
                        <select
                            value={cuttingNeedFilter}
                            onChange={(e) => setCuttingNeedFilter(e.target.value)}
                        >
                            <option value="">Всі</option>
                            <option value="yes">Потрібно</option>
                            <option value="no">Не потрібно</option>
                        </select>
                    </div>
                </div>

                <div className="filters-row filters-row-second">
                    <div className="filter-item filter-checkbox">
                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={showAllJobs}
                                onChange={(e) => setShowAllJobs(e.target.checked)}
                            />
                            <h3>Показувати виконані завдання</h3>
                        </label>
                    </div>


                </div>
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

            {/* Інформація про результати та вибір кількості елементів */}
            <div className="tasks-controls">
                <div className="tasks-count">
                    Знайдено: {totalItems} завдань
                    {!showAllJobs && (
                        <span className="completed-hidden-notice">
                            (виконані завдання приховані)
                        </span>
                    )}
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

                            {/*<div className="form-field">*/}
                            {/*    <label>Термін виконання:</label>*/}
                            {/*    <input*/}
                            {/*        type="date"*/}
                            {/*        value={formData.due_date}*/}
                            {/*        onChange={(e) => setFormData({...formData, due_date: e.target.value})}*/}
                            {/*        required*/}
                            {/*    />*/}
                            {/*</div>*/}

                            <div className="form-field">
                                <label>Статус:</label>
                                <select
                                    value={formData.status}
                                    onChange={(e) => setFormData({...formData, status: e.target.value})}
                                    required
                                >
                                    <option value="В черзі">В черзі</option>
                                    <option value="В роботі">В роботі</option>
                                    <option value="Частково виконано">Частково виконано</option>
                                    <option value="Виконано">Виконано</option>
                                    <option value="Скасовано">Скасовано</option>
                                </select>
                            </div>

                            <div className="form-field">
                                <label>Пріоритет:</label>
                                <select
                                    value={formData.priority}
                                    onChange={(e) => setFormData({...formData, priority: parseInt(e.target.value)})}
                                    required
                                >
                                    <option value="1">1 - Срочно</option>
                                    <option value="2">2 - Високий</option>
                                    <option value="3">3 - Середній</option>
                                    <option value="4">4 - Низький</option>
                                    <option value="5">5 - Мінімальний</option>
                                </select>
                            </div>

                            <div className="form-field checkbox-field">
                                <label className="checkbox-label">
                                    <input
                                        type="checkbox"
                                        checked={formData.metal_available}
                                        onChange={(e) => setFormData({...formData, metal_available: e.target.checked})}
                                        disabled={editingJob?.status === 'Виконано'}
                                    />
                                    Метал в наявності
                                    {editingJob?.status === 'Виконано' && (
                                        <span className="disabled-hint">(недоступно для виконаних завдань)</span>
                                    )}
                                </label>
                            </div>

                            <div className="form-field checkbox-field">
                                <label className="checkbox-label">
                                    <input
                                        type="checkbox"
                                        checked={formData.cutting_need}
                                        onChange={(e) => setFormData({...formData, cutting_need: e.target.checked})}
                                        disabled={editingJob?.status === 'Виконано'}
                                    />
                                    Потреба в розкрої
                                    {editingJob?.status === 'Виконано' && (
                                        <span className="disabled-hint">(недоступно для виконаних завдань)</span>
                                    )}
                                </label>
                            </div>

                            <div className="form-field">
                                <label>Нотатки:</label>
                                <textarea
                                    value={formData.notes}
                                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
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

            {/* Мобільні карточки */}
            <div className="mobile-tasks-list">
                {currentJobs.map(job => (
                    <div key={job.job_id} className="mobile-task-card">
                        <div className="mobile-task-header">
                            <div className="mobile-task-id">#{job.job_id}</div>
                            <div className="mobile-task-priority">
                                <div className="priority-cell">
                                    {job.status === 'Виконано' ? (
                                        <div className="priority-disabled-mobile" title="Для виконаного завдання не відображається">
                                            —
                                        </div>
                                    ) : (
                                        <>
                                            {prioritySelectJobId === job.job_id ? (
                                                <select
                                                    value={job.priority}
                                                    onChange={(e) => handlePriorityChange(job.job_id, parseInt(e.target.value))}
                                                    className="priority-select-mobile"
                                                    autoFocus
                                                    onBlur={() => setPrioritySelectJobId(null)}
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <option value="1">1 - Срочно</option>
                                                    <option value="2">2 - Високий</option>
                                                    <option value="3">3 - Середній</option>
                                                    <option value="4">4 - Низький</option>
                                                    <option value="5">5 - Мінімальний</option>
                                                </select>
                                            ) : (
                                                <button
                                                    className={`priority-btn priority-${job.priority}`}
                                                    onClick={(e) => handlePriorityClick(job.job_id, e)}
                                                    title="Натисніть для зміни пріоритету"
                                                >
                                                    {getPriorityName(job.priority)}
                                                </button>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                            <div className={`mobile-task-status mobile-task-status-${(job.status || '').replace(/\s+/g, '').toLowerCase()}`}>
                                {job.status}
                            </div>
                        </div>

                        <div className="mobile-task-details">
                            <div className="mobile-task-detail">
                                <span className="mobile-detail-label">Дата створення:</span>
                                <span className="mobile-detail-value">{formatDate(job.creation_date)}</span>
                            </div>
                            <div className="mobile-task-detail">
                                <span className="mobile-detail-label">Пріоритет:</span>
                                <span className="mobile-detail-value">
                                    {job.status === 'Виконано' ? '—' : getPriorityName(job.priority)}
                                </span>
                            </div>
                            <div className="mobile-task-detail">
                                <span className="mobile-detail-label">Файл:</span>
                                <span className="mobile-detail-value">{getJobFileName(job.job_id)}</span>
                            </div>
                            <div className="mobile-task-detail">
                                <span className="mobile-detail-label">Товщина:</span>
                                <span className="mobile-detail-value">{getJobThicknesses(job.job_id)}</span>
                            </div>
                            <div className="mobile-task-detail">
                                <span className="mobile-detail-label">Сталь:</span>
                                <span className="mobile-detail-value">{getJobMaterials(job.job_id)}</span>
                            </div>
                            <div className="mobile-task-detail">
                                <span className="mobile-detail-label">Метал:</span>
                                <span className="mobile-detail-value">
                                    {job.status === 'Виконано' ? (
                                        <span className="metal-status-completed">—</span>
                                    ) : (
                                        <span className={job.metal_available ? 'metal-available' : 'metal-not-available'}>
                                            {job.metal_available ? 'Є' : 'Немає'}
                                        </span>
                                    )}
                                </span>
                            </div>
                            <div className="mobile-task-detail">
                                <span className="mobile-detail-label">Розкрій:</span>
                                <span className="mobile-detail-value">
                                    {job.status === 'Виконано' ? (
                                        <span className="cutting-need-status-completed">—</span>
                                    ) : (
                                        <span className={job.cutting_need ? 'cutting-need-yes' : 'cutting-need-no'}>
                                            {job.cutting_need ? 'Потрібно' : 'Не потрібно'}
                                        </span>
                                    )}
                                </span>
                            </div>
                        </div>

                        {job.notes && (
                            <div className="mobile-task-notes">
                                <strong>Нотатки:</strong> {job.notes}
                            </div>
                        )}

                        <div className="mobile-task-actions">
                            <button onClick={() => startEdit(job)} className="mobile-action-btn">
                                ✏️ Редагувати
                            </button>
                            <button onClick={() => deleteJob(job.job_id)} className="mobile-action-btn">
                                🗑️ Видалити
                            </button>
                            <button onClick={() => toggleJobDetails(job.job_id)} className="mobile-action-btn">
                                {selectedJobDetails === job.job_id ? '▲ Деталі' : '▼ Деталі'}
                            </button>
                            <button onClick={() => copyJobLink(job.job_id)} className="mobile-action-btn">
                                🔗 Посилання
                            </button>
                            <button onClick={() => {
                                window.location.href = window.location.origin + '/cutting-log-app/#' + '/operator/' + job.job_id;
                            }} className="mobile-action-btn primary">
                                📒 Виконання
                            </button>
                        </div>

                        {/* Деталі завдання для мобільних */}
                        {selectedJobDetails === job.job_id && (
                            <div className="task-details-panel">
                                <div className="details-header">
                                    <h4>Артикули в завданні #{job.job_id}</h4>
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

                                <div className="article-add-form">
                                    <select
                                        value={jobDetailForm.article_id}
                                        onChange={(e) => setJobDetailForm({
                                            ...jobDetailForm, article_id: e.target.value
                                        })}
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
                                        onChange={(e) => setJobDetailForm({
                                            ...jobDetailForm, quantity_planned: parseInt(e.target.value) || 1
                                        })}
                                        placeholder="Кількість"
                                    />
                                    <button
                                        onClick={() => addArticleToJob(job.job_id)}
                                        className="article-add-btn"
                                    >
                                        Додати Артикул
                                    </button>
                                </div>

                                <div className="articles-list">
                                    {jobDetails
                                        .filter(detail => detail.job_id === job.job_id)
                                        .map(detail => (
                                            <div key={detail.job_detail_id} className="article-item">
                                                <div className="article-info">
                                                    <span className="article-specs">{detail.articles?.name}</span>
                                                    <span className="article-number">{detail.articles?.article_num}</span>
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
                                        <div className="no-articles-message">Немає доданих артикулів</div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Таблиця завдань */}
            <div className="tasks-table-wrapper">
                <table className="tasks-table">
                    <thead>
                    <tr>
                        <th onClick={() => handleSort('job_id')} className="sortable-header">
                            ID {getSortIcon('job_id')}
                        </th>
                        <th onClick={() => handleSort('creation_date')} className="sortable-header">
                            Дата <br/> Створення {getSortIcon('creation_date')}
                        </th>
                        <th onClick={() => handleSort('priority')} className="sortable-header">
                            Пріоритет {getSortIcon('priority')}
                        </th>
                        <th onClick={() => handleSort('status')} className="sortable-header">
                            Статус {getSortIcon('status')}
                        </th>
                        <th>Файл</th>
                        <th>Товщина (мм)</th>
                        <th>Сталь</th>
                        <th onClick={() => handleSort('metal_available')} className="sortable-header">
                            Метал {getSortIcon('metal_available')}
                        </th>
                        <th onClick={() => handleSort('cutting_need')} className="sortable-header">
                            Розкрій <br/> на замовлення {getSortIcon('cutting_need')}
                        </th>
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
                                onClick={(e) => {
                                    if (!e.target.closest('.priority-cell')) {
                                        toggleJobDetails(job.job_id);
                                    }
                                }}
                            >
                                <td className="task-id">{job.job_id}</td>
                                <td className="task-created">{formatDate(job.creation_date)}</td>
                                <td className="task-priority">
                                    <div className="priority-cell">
                                        {job.status === 'Виконано' ? (
                                            <div className="priority-disabled" title="Для виконаного завдання не відображається">
                                                —
                                            </div>
                                        ) : (
                                            <div>
                                                {prioritySelectJobId === job.job_id ? (
                                                    <select
                                                        value={job.priority}
                                                        onChange={(e) => handlePriorityChange(job.job_id, parseInt(e.target.value))}
                                                        className="priority-select"
                                                        autoFocus
                                                        onBlur={() => setPrioritySelectJobId(null)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Escape') {
                                                                setPrioritySelectJobId(null);
                                                            }
                                                        }}
                                                    >
                                                        <option value="1">1 - Срочно</option>
                                                        <option value="2">2 - Високий</option>
                                                        <option value="3">3 - Середній</option>
                                                        <option value="4">4 - Низький</option>
                                                        <option value="5">5 - Мінімальний</option>
                                                    </select>
                                                ) : (
                                                    <button
                                                        className={`priority-btn priority-${job.priority}`}
                                                        onClick={(e) => handlePriorityClick(job.job_id, e)}
                                                        title="Натисніть для зміни пріоритету"
                                                    >
                                                        {job.priority} - {getPriorityName(job.priority)}
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </td>
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
                                <td className="task-metal">
                                    {job.status === 'Виконано' ? (
                                        <div className="metal-status-completed" title="Для виконаного завдання не відображається">
                                            —
                                        </div>
                                    ) : (
                                        <div
                                            className={`metal-status ${job.metal_available ? 'metal-available' : 'metal-not-available'}`}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleMetalAvailable(job.job_id, job.metal_available);
                                            }}
                                            title={job.metal_available ? "Метал в наявності (натисніть щоб змінити)" : "Метал відсутній (натисніть щоб змінити)"}
                                        >
                                            {job.metal_available ? '✅' : '❌'}
                                            <span className="metal-status-text">
                                                {job.metal_available ? 'Є' : 'Немає'}
                                            </span>
                                        </div>
                                    )}
                                </td>
                                <td className="task-cutting-need">
                                    {job.status === 'Виконано' ? (
                                        <div className="cutting-need-status-completed" title="Для виконаного завдання не відображається">
                                            —
                                        </div>
                                    ) : (
                                        <div
                                            className={`cutting-need-status ${job.cutting_need ? 'cutting-need-yes' : 'cutting-need-no'}`}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleCuttingNeed(job.job_id, job.cutting_need);
                                            }}
                                            title={job.cutting_need ? "Потреба в розкрої активна (натисніть щоб змінити)" : "Потреба в розкрої неактивна (натисніть щоб змінити)"}
                                        >
                                            {job.cutting_need ? '✂️' : '⛔'}
                                            <span className="cutting-need-text">
                                                {job.cutting_need ? '+' : '-'}
                                            </span>
                                        </div>
                                    )}
                                </td>
                                <td className="task-notes">
                                    {job.notes?.substring(0, 50) + (job.notes?.length > 50 ? '...' : '') || '—'}
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
                                    <td colSpan="11">
                                        <div className="task-details-panel">
                                            <div className="details-header">
                                                <h4>Артикули в завданні #{job.job_id}</h4>
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

                                            <div className="article-add-form">
                                                <select
                                                    value={jobDetailForm.article_id}
                                                    onChange={(e) => setJobDetailForm({
                                                        ...jobDetailForm, article_id: e.target.value
                                                    })}
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
                                                    onChange={(e) => setJobDetailForm({
                                                        ...jobDetailForm,
                                                        quantity_planned: parseInt(e.target.value) || 1
                                                    })}
                                                    placeholder="Кількість"
                                                />
                                                <button
                                                    onClick={() => addArticleToJob(job.job_id)}
                                                    className="article-add-btn"
                                                >
                                                    Додати Артикул
                                                </button>
                                            </div>

                                            <div className="articles-list">
                                                {jobDetails
                                                    .filter(detail => detail.job_id === job.job_id)
                                                    .map(detail => (
                                                        <div key={detail.job_detail_id} className="article-item">
                                                            <div className="article-info">
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