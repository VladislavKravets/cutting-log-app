import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import CuttingJobExecution from './CuttingJobExecution.js'; // Імпортуємо форму виконання
import './CuttingJobsSelectionPage.css';

function CuttingJobsSelectionPage() {
    // Стан для зберігання списку всіх доступних завдань
    const [allJobs, setAllJobs] = useState([]);
    // Стан для результатів пошуку/фільтрації
    const [filteredJobs, setFilteredJobs] = useState([]);
    // Стан для тексту пошуку
    const [searchTerm, setSearchTerm] = useState('');
    // Стан для вибраного завдання
    const [selectedJob, setSelectedJob] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // --- ЛОГІКА ЗАВАНТАЖЕННЯ ЗАВДАНЬ ---
    
    // Функція для завантаження всіх завдань
    const fetchCuttingJobs = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // Завантажуємо ВСІ завдання, щоб користувач міг бачити та редагувати навіть виконані
            const { data, error } = await supabase
                .from('cutting_jobs')
                .select('*')
                .order('job_id', { ascending: false });

            if (error) throw error;
            
            setAllJobs(data);
            // При початковому завантаженні або якщо пошук порожній, встановлюємо відфільтровані завдання
            if (searchTerm.length === 0) { 
                 setFilteredJobs(data); 
            }
        } catch (err) {
            console.error('Помилка завантаження списку завдань:', err.message);
            setError('Не вдалося завантажити список завдань.');
        } finally {
            setLoading(false);
        }
    }, [searchTerm]); 

    useEffect(() => {
        fetchCuttingJobs();
    }, [fetchCuttingJobs]);
    
    // --- НОВА ФУНКЦІЯ: НАЗАД ТА ОНОВЛЕННЯ ---
    // Ця функція викликається при натисканні кнопки "Назад" у формі виконання.
    // Вона забезпечує, що список завдань буде оновлено після повернення.
    const handleBackToListAndRefresh = () => {
        // 1. Приховати форму виконання
        setSelectedJob(null); 
        // 2. Оновити список завдань, щоб побачити зміни (наприклад, зміну статусу)
        fetchCuttingJobs();
    };


    // --- ЛОГІКА ПОШУКУ/ФІЛЬТРАЦІЇ ---

    useEffect(() => {
        if (searchTerm.length > 0) {
            const lowerCaseSearch = searchTerm.toLowerCase();
            const results = allJobs.filter(job => 
                // Шукаємо по ID або Примітках
                job.job_id.toString().includes(lowerCaseSearch) ||
                (job.notes && job.notes.toLowerCase().includes(lowerCaseSearch))
            );
            setFilteredJobs(results);
        } else {
            setFilteredJobs(allJobs);
        }
    }, [searchTerm, allJobs]);


    // --- РЕНДЕР: ВИБІР vs ВИКОНАННЯ ---

    if (selectedJob) {
        // Якщо завдання вибрано, переходимо до форми виконання
        return (
            <div className="job-execution-mode">
                <button 
                    onClick={handleBackToListAndRefresh} 
                    className="back-button"
                    disabled={loading} // Блокуємо, поки відбувається перезавантаження
                >
                    ← Назад до списку завдань
                </button>
                {/* Передаємо ID обраного завдання у форму виконання */}
                <CuttingJobExecution jobId={selectedJob.job_id} />
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
            
            <div className="jobs-list">
                {filteredJobs.length === 0 && !loading && (
                    <p>Активних завдань для виконання не знайдено.</p>
                )}
                
                {filteredJobs.map((job) => (
                    <div 
                        key={job.job_id} 
                        // Клас формується з статусу, наприклад: status-вчерзі, status-вроботі
                        className={`job-card status-${job.status.replace(/\s/g, '').toLowerCase()}`}
                        onClick={() => setSelectedJob(job)}
                    >
                        <div className="job-info">
                            <h3>Завдання №{job.job_id}</h3>
                            <p>**Статус:** <span className="status-badge status-text">{job.status}</span></p> 
                            <p>**План:** {job.due_date ? new Date(job.due_date).toLocaleDateString('uk-UA') : 'Не вказано'}</p>
                            <p className="notes-snippet">Примітки: {job.notes ? job.notes.substring(0, 50) + (job.notes.length > 50 ? '...' : '') : 'Немає'}</p>
                        </div>
                        <div className="job-status-indicator">
                            <button className="select-button">Обрати →</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default CuttingJobsSelectionPage;
