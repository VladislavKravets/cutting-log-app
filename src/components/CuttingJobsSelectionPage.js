import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate, useParams } from 'react-router-dom'; // Додано useNavigate
import './CuttingJobsSelectionPage.css';

function CuttingJobsSelectionPage() {
    const [allJobs, setAllJobs] = useState([]);
    const [filteredJobs, setFilteredJobs] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const navigate = useNavigate();
    const { jobId: urlJobId } = useParams(); // Отримуємо jobId з URL якщо є

    // Функція для завантаження всіх завдань
    const fetchCuttingJobs = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const { data, error } = await supabase
                .from('cutting_jobs')
                .select('*')
                .order('job_id', { ascending: false });

            if (error) throw error;

            setAllJobs(data);

            if (searchTerm.length === 0) {
                setFilteredJobs(data);
            }

            // Якщо є jobId в URL, перевіряємо чи існує таке завдання
            if (urlJobId) {
                const jobExists = data.find(job => job.job_id === parseInt(urlJobId));
                if (jobExists) {
                    // Переходимо до сторінки виконання завдання
                    handleSelectJob(jobExists);
                } else {
                    setError(`Завдання з ID ${urlJobId} не знайдено`);
                }
            }
        } catch (err) {
            console.error('Помилка завантаження списку завдань:', err.message);
            setError('Не вдалося завантажити список завдань.');
        } finally {
            setLoading(false);
        }
    }, [searchTerm, urlJobId]);

    useEffect(() => {
        fetchCuttingJobs();
    }, [fetchCuttingJobs]);

    // Функція вибору завдання з переходом по URL
    const handleSelectJob = (job) => {
        navigate(`/operator/${job.job_id}`);
    };

    // Функція для кнопки "Назад" (якщо потрібно)
    const handleBackToListAndRefresh = () => {
        navigate('/operator');
        fetchCuttingJobs();
    };

    // Логіка пошуку/фільтрації
    useEffect(() => {
        if (searchTerm.length > 0) {
            const lowerCaseSearch = searchTerm.toLowerCase();
            const results = allJobs.filter(job =>
                job.job_id.toString().includes(lowerCaseSearch) ||
                (job.notes && job.notes.toLowerCase().includes(lowerCaseSearch))
            );
            setFilteredJobs(results);
        } else {
            setFilteredJobs(allJobs);
        }
    }, [searchTerm, allJobs]);

    // Якщо є jobId в URL і завантаження завершено, не показуємо список
    if (urlJobId && !loading) {
        return (
            <div className="loading-container">
                <p>Перехід до завдання #{urlJobId}...</p>
            </div>
        );
    }

    // Режим вибору завдання
    return (
        <div className="jobs-selection-container">
            <h1>Вибір Завдання для Виконання 🏭</h1>

            <div className="search-controls">
                <input
                    type="text"
                    placeholder="Пошук за № Завдання або Примітками..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    disabled={loading}
                />
            </div>

            {loading && <p className="loading">Завантаження завдань...</p>}
            {error && <p className="error">{error}</p>}

            <div className="jobs-list" style={{textAlign: "left"}}>
                {filteredJobs.length === 0 && !loading && (
                    <p>Активних завдань для виконання не знайдено.</p>
                )}

                {filteredJobs.map((job) => (
                    <div
                        key={job.job_id}
                        className={`job-card status-${job.status.replace(/\s/g, '').toLowerCase()}`}
                        onClick={() => handleSelectJob(job)}
                    >
                        <div className="job-info">
                            <h3>Завдання №{job.job_id}</h3>
                            <p>Статус: <span className="status-badge status-text">{job.status}</span></p>
                            <p>План: {job.due_date ? new Date(job.due_date).toLocaleDateString('uk-UA') : 'Не вказано'}</p>
                            <p className="notes-snippet">Примітки: {job.notes ? job.notes : 'Немає'}</p>
                        </div>
                        {/*<div className="job-status-indicator">*/}
                        {/*    <button className="select-button">Обрати →</button>*/}
                        {/*</div>*/}
                    </div>
                ))}
            </div>
        </div>
    );
}

export default CuttingJobsSelectionPage;