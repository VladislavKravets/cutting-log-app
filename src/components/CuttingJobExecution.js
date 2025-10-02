import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import './CuttingJobExecution.css';

function CuttingJobExecution({ jobId }) {
    const job_id = jobId;
    const VALID_STATUSES = ['В черзі', 'В роботі', 'Виконано', 'Призупинено', 'Скасовано'];

    const [job, setJob] = useState(null);
    const [programId, setProgramId] = useState(null);
    const [fileNameInput, setFileNameInput] = useState('');
    const [isEditingProgramName, setIsEditingProgramName] = useState(false);
    const [detailsMap, setDetailsMap] = useState({});
    const [currentLog, setCurrentLog] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [logForm, setLogForm] = useState({
        operator_name: '',
        cut_date: new Date().toISOString().split('T')[0],
        start_meter: '',
        end_meter: '',
        oxygen_pressure: '',
        air_pressure: '',
        preparation_time: '',
        cutting_time: '',
    });

    const [jobStatusInput, setJobStatusInput] = useState('');

    // Завантаження даних
    const fetchJobData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // Отримання завдання
            const { data: jobData, error: jobError } = await supabase
                .from('cutting_jobs')
                .select('*')
                .eq('job_id', job_id)
                .single();

            if (jobError || !jobData) throw new Error("Завдання не знайдено");
            setJob(jobData);
            setJobStatusInput(jobData.status);

            // Отримання програми
            const { data: programData } = await supabase
                .from('cutting_programs')
                .select('program_id, file_name')
                .eq('job_id', job_id)
                .limit(1)
                .single();

            if (programData) {
                setProgramId(programData.program_id);
                setFileNameInput(programData.file_name || '');

                // Отримання останнього логу
                const { data: latestLog } = await supabase
                    .from('cutting_log')
                    .select('*')
                    .eq('program_id', programData.program_id)
                    .order('start_time', { ascending: false })
                    .limit(1)
                    .single();

                if (latestLog) {
                    setCurrentLog(latestLog);
                    setLogForm(prev => ({
                        ...prev,
                        operator_name: latestLog.operator_name || '',
                        cut_date: latestLog.start_time ? latestLog.start_time.substring(0, 10) : new Date().toISOString().split('T')[0],
                        start_meter: latestLog.start_meter || '',
                        end_meter: latestLog.end_meter || '',
                        oxygen_pressure: latestLog.oxygen_pressure || '',
                        air_pressure: latestLog.air_pressure || '',
                        preparation_time: latestLog.preparation_time_minutes || '',
                        cutting_time: latestLog.cutting_time_minutes || '',
                    }));
                }
            }

            // Отримання деталей завдання
            const { data: detailsArray } = await supabase
                .from('job_details')
                .select(`
                    job_detail_id, quantity_planned, quantity_actual, rejection_count, program_id, job_id, article_id,
                    articles (name, thickness, material_type)
                `)
                .eq('job_id', job_id);

            const detailsToObject = detailsArray?.reduce((acc, detail) => {
                acc[detail.job_detail_id] = {
                    ...detail,
                    quantity_actual_input: detail.quantity_actual || '',
                    rejection_count_input: detail.rejection_count || '0'
                };
                return acc;
            }, {}) || {};

            setDetailsMap(detailsToObject);

        } catch (err) {
            console.error('Помилка завантаження:', err.message);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [job_id]);

    useEffect(() => {
        if (job_id) fetchJobData();
    }, [fetchJobData, job_id]);

    // Обробники подій
    const handleProgramNameChange = (e) => setFileNameInput(e.target.value);

    const handleCreateProgram = async () => {
        if (!fileNameInput) {
            setError('Введіть назву програми');
            return;
        }

        setLoading(true);
        try {
            const { data: newProgram, error: programError } = await supabase
                .from('cutting_programs')
                .insert([{ job_id: job_id, file_name: fileNameInput }])
                .select('program_id, file_name')
                .single();

            if (programError) throw programError;

            setProgramId(newProgram.program_id);
            setIsEditingProgramName(false);

            // Оновлення статусу при створенні програми
            if (job.status === 'Створено') {
                await supabase
                    .from('cutting_jobs')
                    .update({ status: 'В роботі' })
                    .eq('job_id', job_id);
                setJob(prev => ({ ...prev, status: 'В роботі' }));
                setJobStatusInput('В роботі');
            }

        } catch (err) {
            setError(`Помилка створення програми: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateProgramName = async () => {
        if (!fileNameInput || !programId) return;

        setLoading(true);
        try {
            await supabase
                .from('cutting_programs')
                .update({ file_name: fileNameInput })
                .eq('program_id', programId);

            setIsEditingProgramName(false);
        } catch (err) {
            setError(`Помилка оновлення назви: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleLogFormChange = (e) => {
        const { name, value } = e.target;
        setLogForm(prev => ({ ...prev, [name]: value }));
    };

    const handleDetailInputChange = (e, jobDetailId, field) => {
        const value = e.target.value;
        setDetailsMap(prev => ({
            ...prev,
            [jobDetailId]: {
                ...prev[jobDetailId],
                [field]: value === '' ? '' : parseInt(value) || 0
            }
        }));
    };

    const handleStatusChange = (e) => setJobStatusInput(e.target.value);

    // Оновлення деталей завдання - ВИПРАВЛЕНА ФУНКЦІЯ
    const updateJobDetails = async () => {
        const detailsArray = Object.values(detailsMap);
        
        // Оновлюємо кожну деталь окремо
        for (const detail of detailsArray) {
            const { error } = await supabase
                .from('job_details')
                .update({
                    quantity_actual: detail.quantity_actual_input === '' ? null : parseInt(detail.quantity_actual_input) || 0,
                    rejection_count: detail.rejection_count_input === '' ? null : parseInt(detail.rejection_count_input) || 0
                })
                .eq('job_detail_id', detail.job_detail_id);

            if (error) {
                throw new Error(`Помилка оновлення деталі ${detail.job_detail_id}: ${error.message}`);
            }
        }
    };

    // Основна функція збереження - ВИПРАВЛЕНА
    const handleSaveData = async () => {
        if (!programId) {
            setError('Спочатку створіть програму різання');
            return;
        }

        setLoading(true);
        setError(null);
        
        try {
            // Валідація
            const isLogStarting = !currentLog?.log_entry_id;
            const isLogFinishing = jobStatusInput === 'Виконано' && !currentLog?.end_time;

            if (isLogStarting && (!logForm.operator_name || !logForm.start_meter)) {
                throw new Error('Для початку роботи заповніть оператора та початковий лічильник');
            }

            if (isLogFinishing && (!logForm.end_meter || parseFloat(logForm.end_meter) <= parseFloat(logForm.start_meter))) {
                throw new Error('Кінцевий лічильник має бути більшим за початковий');
            }

            // 1. Оновлення логу різання
            const logUpdates = {
                operator_name: logForm.operator_name,
                oxygen_pressure: logForm.oxygen_pressure || null,
                air_pressure: logForm.air_pressure || null,
                start_meter: parseFloat(logForm.start_meter) || null,
                end_meter: parseFloat(logForm.end_meter) || null,
                preparation_time_minutes: parseInt(logForm.preparation_time) || null,
                cutting_time_minutes: parseInt(logForm.cutting_time) || null,
            };

            // Додаємо час завершення при завершенні роботи
            if (isLogFinishing) {
                logUpdates.end_time = new Date().toISOString();
            }

            let updatedLogData;
            if (currentLog?.log_entry_id) {
                // Оновлення існуючого логу
                const { data, error } = await supabase
                    .from('cutting_log')
                    .update(logUpdates)
                    .eq('log_entry_id', currentLog.log_entry_id)
                    .select('*')
                    .single();
                    
                if (error) throw error;
                updatedLogData = data;
            } else {
                // Створення нового логу
                const { data, error } = await supabase
                    .from('cutting_log')
                    .insert([{ 
                        program_id: programId, 
                        ...logUpdates,
                        start_time: new Date().toISOString()
                    }])
                    .select('*')
                    .single();
                    
                if (error) throw error;
                updatedLogData = data;
            }

            if (updatedLogData) setCurrentLog(updatedLogData);

            // 2. Оновлення деталей завдання - ВИПРАВЛЕНИМ МЕТОДОМ
            await updateJobDetails();

            // 3. Оновлення статусу завдання
            if (jobStatusInput !== job.status) {
                const { error: statusError } = await supabase
                    .from('cutting_jobs')
                    .update({ status: jobStatusInput })
                    .eq('job_id', job_id);
                    
                if (statusError) throw statusError;
                
                setJob(prev => ({ ...prev, status: jobStatusInput }));
            }

            // Успішне збереження
            console.log('Дані успішно збережено');

        } catch (err) {
            console.error('Помилка збереження:', err);
            setError(`Помилка збереження: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    // Розрахунок загального часу роботи
    const calculateTotalTime = () => {
        const prepTime = parseInt(logForm.preparation_time) || 0;
        const cutTime = parseInt(logForm.cutting_time) || 0;
        return prepTime + cutTime;
    };

    // Розрахунок витрати газу
    const calculateGasConsumption = () => {
        if (logForm.start_meter && logForm.end_meter) {
            return (parseFloat(logForm.end_meter) - parseFloat(logForm.start_meter)).toFixed(2);
        }
        return '--';
    };

    if (loading && !job) return <div className="loading">Завантаження завдання №{job_id}...</div>;
    if (error) return <div className="error">Помилка: {error}</div>;
    if (!job) return <div className="error">Завдання №{job_id} не знайдено.</div>;

    const detailsToRender = Object.values(detailsMap);
    const isMainFormDisabled = !programId;
    const isButtonDisabled = loading || !programId || isEditingProgramName;
    const isLogStarting = !currentLog?.log_entry_id;
    const totalTime = calculateTotalTime();
    const gasConsumption = calculateGasConsumption();

    return (
        <div className="execution-container job-table-view">
            <h1>Виконання Завдання №{job_id}</h1>

            {error && <div className="error-box">{error}</div>}

            {/* Блок програми */}
            <div className="program-control-block">
                {programId ? (
                    <div className="program-input-box">
                        <div className="program-input-row">
                            <label>
                                Назва Файлу Програми:
                                <input
                                    type="text"
                                    value={fileNameInput}
                                    onChange={handleProgramNameChange}
                                    placeholder="Наприклад: Sheet123.nc"
                                    disabled={!isEditingProgramName}
                                />
                            </label>

                            {isEditingProgramName ? (
                                <button onClick={handleUpdateProgramName} disabled={loading || !fileNameInput}>
                                    Зберегти Назву
                                </button>
                            ) : (
                                <button onClick={() => setIsEditingProgramName(true)} disabled={loading}>
                                    Редагувати
                                </button>
                            )}
                        </div>
                        <p className="program-id-display">ID: {programId}</p>
                    </div>
                ) : (
                    <div className="warning-box program-input-box">
                        <p>Створіть програму різання для початку роботи</p>
                        <div className="program-input-row">
                            <label>
                                Назва Файлу Програми:
                                <input
                                    type="text"
                                    value={fileNameInput}
                                    onChange={handleProgramNameChange}
                                    placeholder="Наприклад: Sheet123.nc"
                                />
                            </label>
                            <button onClick={handleCreateProgram} disabled={loading || !fileNameInput}>
                                Створити Програму
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Інформація про час та витрати */}
            <div className="time-meters-info">
                <div className="info-group">
                    <label>Загальний час:</label>
                    <span className="info-value">{totalTime} хв</span>
                </div>
                <div className="info-group">
                    <label>Витрата газу:</label>
                    <span className="info-value">{gasConsumption}</span>
                </div>
            </div>

            <div className="operator-control">
                <label>
                    Оператор:
                    <input
                        type="text"
                        name="operator_name"
                        // value={logForm.operator_name}
                        value={logForm.operator_name}
                        onChange={handleLogFormChange}
                        placeholder="Введіть ім'я оператора"
                        disabled={isMainFormDisabled}
                    />
                </label>

                <label>
                    Дата Різання:
                    <input
                        type="date"
                        name="cut_date"
                        value={logForm.cut_date}
                        onChange={handleLogFormChange}
                        disabled={isMainFormDisabled}
                    />
                </label>

                <label>
                    Статус:
                    <select value={jobStatusInput} onChange={handleStatusChange} disabled={isMainFormDisabled}>
                        {VALID_STATUSES.map(status => (
                            <option key={status} value={status}>{status}</option>
                        ))}
                    </select>
                </label>
            </div>

            <section className="job-results-section full-width-table">
                <table>
                    <thead>
                        <tr>
                            <th>Артикул</th>
                            <th>План</th>
                            <th>Брак</th>
                            <th>Матеріал</th>
                            <th>Товщина, мм</th>
                            <th>Факт</th>
                        </tr>
                    </thead>
                    <tbody>
                        {detailsToRender.map((detail) => (
                            <tr key={detail.job_detail_id}>
                                <td>{detail.articles?.name}</td>
                                <td>{detail.quantity_planned}</td>
                                <td>
                                    <input
                                        type="number"
                                        min="0"
                                        value={detail.rejection_count_input}
                                        onChange={(e) => handleDetailInputChange(e, detail.job_detail_id, 'rejection_count_input')}
                                        disabled={isMainFormDisabled}
                                    />
                                </td>
                                <td>{detail.articles?.material_type}</td>
                                <td>{detail.articles?.thickness}</td>
                                <td>
                                    <input
                                        type="number"
                                        min="0"
                                        value={detail.quantity_actual_input}
                                        onChange={(e) => handleDetailInputChange(e, detail.job_detail_id, 'quantity_actual_input')}
                                        disabled={isMainFormDisabled}
                                    />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <div className="additional-log-params">
                    {/* Час роботи */}
                    <div className="time-inputs">
                        <label>
                            Час підготовки (хв):
                            <input
                                type="number"
                                name="preparation_time"
                                value={logForm.preparation_time}
                                onChange={handleLogFormChange}
                                disabled={isMainFormDisabled}
                                min="0"
                                placeholder="0"
                            />
                        </label>

                        <label>
                            Час різки (хв):
                            <input
                                type="number"
                                name="cutting_time"
                                value={logForm.cutting_time}
                                onChange={handleLogFormChange}
                                disabled={isMainFormDisabled}
                                min="0"
                                placeholder="0"
                            />
                        </label>
                    </div>

                    {/* Лічильники */}
                    <div className="meter-inputs">
                        <label>
                            Початковий лічильник:
                            <input
                                type="number"
                                name="start_meter"
                                value={logForm.start_meter}
                                onChange={handleLogFormChange}
                                disabled={isMainFormDisabled}
                                step="0.01"
                                placeholder="Обов'язково для початку"
                            />
                        </label>

                        <label>
                            Кінцевий лічильник:
                            <input
                                type="number"
                                name="end_meter"
                                value={logForm.end_meter}
                                onChange={handleLogFormChange}
                                disabled={isMainFormDisabled}
                                step="0.01"
                                placeholder="Для завершення"
                            />
                        </label>
                    </div>

                    {/* Тиск */}
                    <div className="pressure-inputs">
                        <label>
                            Тиск кисню (бар):
                            <input
                                type="number"
                                name="oxygen_pressure"
                                value={logForm.oxygen_pressure}
                                onChange={handleLogFormChange}
                                disabled={isMainFormDisabled}
                                step="0.1"
                            />
                        </label>

                        <label>
                            Тиск повітря (бар):
                            <input
                                type="number"
                                name="air_pressure"
                                value={logForm.air_pressure}
                                onChange={handleLogFormChange}
                                disabled={isMainFormDisabled}
                                step="0.1"
                            />
                        </label>
                    </div>
                </div>

                <div className="action-buttons-container">
                    <button
                        onClick={handleSaveData}
                        disabled={isButtonDisabled}
                        className={jobStatusInput === 'Виконано' ? 'end-button' : 'save-button'}
                    >
                        {jobStatusInput === 'Виконано' ? 'ЗБЕРЕГТИ & ВИКОНАНО' : 'Зберегти Дані'}
                    </button>

                    {isLogStarting && programId && (
                        <p className="hint-info error-text">
                            Для початку роботи заповніть оператора та початковий лічильник
                        </p>
                    )}

                    {!programId && (
                        <p className="hint-info error-text">
                            Створіть програму для розблокування форми
                        </p>
                    )}
                </div>
            </section>
        </div>
    );
}

export default CuttingJobExecution;