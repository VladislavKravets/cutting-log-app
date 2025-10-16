import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import './CuttingJobExecution.css';

// Константи для кращої підтримки
const VALID_STATUSES = ['В черзі', 'В роботі', 'Виконано', 'Призупинено', 'Скасовано'];
const INITIAL_LOG_FORM = {
    operator_name: '',
    cut_date: '',
    start_meter: '',
    end_meter: '',
    oxygen_pressure: '',
    air_pressure: '0',
    preparation_time: '',
    cutting_time: '',
};

// Допоміжні функції

const formatToCustomString = (date) => {
    const pad = (num) => String(num).padStart(2, '0');
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const seconds = date.getSeconds();

    return `${year}-${pad(month)}-${pad(day)} ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
};

const calculateTotalTime = (prepTime, cutTime) => (parseInt(prepTime) || 0) + (parseInt(cutTime) || 0);

/**
 * Розраховує витрату газу на основі показників лічильника та типу газу, що використовувався.
 * @param {string} start - Початковий показник лічильника.
 * @param {string} end - Кінцевий показник лічильника.
 * @param {boolean} isOxygenActive - Чи використовувався кисень (тиск введено).
 * @param {boolean} isAirActive - Чи використовувалось повітря (чекбокс ввімкнено).
 * @returns {string} Розрахована витрата з позначкою газу або повідомлення про помилку.
 */
const calculateGasConsumption = (start, end, isOxygenActive, isAirActive) => {
    // Якщо немає показників або не вказано газ
    if (!start || !end || (!isOxygenActive && !isAirActive)) {
        return '--';
    }

    const startVal = parseFloat(start);
    const endVal = parseFloat(end);

    // Перевірка коректності даних лічильників
    if (isNaN(startVal) || isNaN(endVal) || endVal < startVal) {
        return 'Помилка лічильника';
    }

    const consumption = (endVal - startVal).toFixed(2);

    // Додаємо позначку, який газ був розрахований
    if (isOxygenActive) {
        return `${consumption} (O₂)`;
    }
    if (isAirActive) {
        return `${consumption} (Air)`;
    }

    // Якщо досі не повернуто, але старт/кінець є
    return consumption;
};


function CuttingJobExecution({ jobId, onBack }) {
    // Основні стани
    const [job, setJob] = useState(null);
    const [programId, setProgramId] = useState(null);
    const [fileNameInput, setFileNameInput] = useState('');
    const [isEditingProgramName, setIsEditingProgramName] = useState(false);
    const [detailsMap, setDetailsMap] = useState({});
    const [currentLog, setCurrentLog] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Стани форми
    const [logForm, setLogForm] = useState(INITIAL_LOG_FORM);
    const [jobStatusInput, setJobStatusInput] = useState('');

    // Похідні дані (ПЕРЕМІЩЕНО СЮДИ для коректної області видимості)
    const detailsToRender = Object.values(detailsMap);
    const isMainFormDisabled = !programId;
    const isButtonDisabled = loading || !programId || isEditingProgramName;
    const isLogStarting = !currentLog?.log_entry_id;

    // Властивості для логіки XOR та розрахунку
    const isAirUsed = logForm.air_pressure === '1';
    const isOxygenEntered = logForm.oxygen_pressure !== '';

    const totalTime = calculateTotalTime(logForm.preparation_time, logForm.cutting_time);
    const gasConsumption = calculateGasConsumption(
        logForm.start_meter,
        logForm.end_meter,
        isOxygenEntered,
        isAirUsed
    );

    // Функція для створення сповіщення
    const createNotification = async (title, message, type = 'system') => {
        try {
            const { data, error } = await supabase
                .from('notifications')
                .insert([{
                    type: type,
                    title: title,
                    message: message,
                    job_id: jobId,
                    is_read: false
                }])
                .select();

            if (error) {
                console.error('❌ Помилка створення сповіщення:', error);
                return;
            }

            console.log('📢 Сповіщення створено:', data[0]);
            return data[0];
        } catch (error) {
            console.error('❌ Помилка при створенні сповіщення:', error);
        }
    };

    // Функція для перенаправлення
    const redirectToInformationPage = () => {
        const url = `#/view/information?expanded=${jobId}&job_id=${jobId}`;
        console.log('🔗 Перенаправлення на:', url);
        window.location.hash = `/view/information?expanded=${jobId}&job_id=${jobId}`;
    };

    // Обробка завершення завдання
    const handleJobCompletion = async () => {
        try {
            // Створюємо сповіщення про завершення
            const notificationTitle = `Завдання №${jobId} завершено`;
            const notificationMessage = `
            Різку завдання №${jobId} завершено 
            оператором ${logForm.operator_name || 'невідомо'}. 
            Загальний час: ${totalTime} хв`; // totalTime тепер визначений

            await createNotification(notificationTitle, notificationMessage, 'job_completed');

            // Показуємо локальне сповіщення
            if ('Notification' in window && Notification.permission === 'granted') {
                new Notification(notificationTitle, {
                    body: notificationMessage,
                    icon: '/favicon.ico'
                });
            }

            console.log('🎉 Завдання завершено, сповіщення створено');

            // Перенаправляємо на сторінку інформації
            setTimeout(() => {
                redirectToInformationPage();
            }, 1500); // Невелика затримка для показу сповіщення

        } catch (error) {
            console.error('❌ Помилка при обробці завершення завдання:', error);
        }
    };

    // Завантаження даних
    const fetchJobData = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            // Отримання завдання
            const { data: jobData, error: jobError } = await supabase
                .from('cutting_jobs')
                .select('*')
                .eq('job_id', jobId)
                .single();

            if (jobError || !jobData) throw new Error("Завдання не знайдено");
            setJob(jobData);
            setJobStatusInput(jobData.status);

            // Отримання програми
            const { data: programData } = await supabase
                .from('cutting_programs')
                .select('program_id, file_name')
                .eq('job_id', jobId)
                .limit(1)
                .single();

            if (programData) {
                await handleProgramData(programData);
            }

            // Отримання деталей завдання
            await fetchJobDetails();

        } catch (err) {
            console.error('Помилка завантаження:', err.message);
            alert(`Помилка: ${err.message}`);

            // setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [jobId]);

    const handleProgramData = async (programData) => {
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
            setLogForm({
                operator_name: latestLog.operator_name || '',
                cut_date: latestLog.cut_date?.substring(0, 10) || '',
                start_meter: latestLog.start_meter || '',
                end_meter: latestLog.end_meter || '',
                oxygen_pressure: latestLog.oxygen_pressure || '',
                air_pressure: latestLog.air_pressure ? '1' : '0',
                preparation_time: latestLog.preparation_time_minutes || '',
                cutting_time: latestLog.cutting_time_minutes || '',
            });
        }
    };

    const renderBackButton = () => (
        <button
            onClick={onBack}
            className="back-button secondary-button"
            disabled={loading}
        >
            ← Назад до списку
        </button>
    );

    const fetchJobDetails = async () => {
        const { data: detailsArray, error: detailsError } = await supabase
            .from('job_details')
            .select(`
                job_detail_id, quantity_planned, quantity_actual, rejection_count, program_id, job_id, article_id,
                articles (name, thickness, material_type, article_num)
            `)
            .eq('job_id', jobId);

        if (detailsError) {
            console.error('Помилка завантаження деталей:', detailsError);
            return;
        }

        const detailsToObject = detailsArray?.reduce((acc, detail) => {
            acc[detail.job_detail_id] = {
                ...detail,
                quantity_actual_input: detail.quantity_actual || '',
                rejection_count_input: detail.rejection_count || '0'
            };
            return acc;
        }, {}) || {};

        setDetailsMap(detailsToObject);
    };

    useEffect(() => {
        if (jobId) fetchJobData();
    }, [fetchJobData, jobId]);

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
                .insert([{ job_id: jobId, file_name: fileNameInput }])
                .select('program_id, file_name')
                .single();

            if (programError) throw programError;

            setProgramId(newProgram.program_id);
            setIsEditingProgramName(false);

            // Оновлення статусу при створенні програми
            if (job.status === 'Створено') {
                await updateJobStatus('В роботі');
            }

        } catch (err) {
            // setError(`Помилка створення програми: ${err.message}`);
            alert(`Помилка: ${err.message}`);
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
            alert(`Помилка: ${err.message}`);
            // setError(`Помилка оновлення назви: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleLogFormChange = (e) => {
        const { name, value, type, checked } = e.target;

        let newValue = value;
        let updates = {};

        if (name === 'air_pressure' && type === 'checkbox') {
            newValue = checked ? '1' : '0';

            // ЛОГІКА XOR: Якщо повітря ввімкнено ('1'), скидаємо тиск кисню
            if (newValue === '1') {
                updates.oxygen_pressure = '';
            }

            updates.air_pressure = newValue;
        } else {
            // Обробка інших полів
            updates[name] = newValue;
        }

        // ЛОГІКА XOR: Якщо вводиться тиск кисню і він не порожній, скидаємо повітря
        if (name === 'oxygen_pressure' && newValue !== '') {
            updates.air_pressure = '0';
        }

        // Якщо зміна стосується кисню або повітря, застосовуємо логіку XOR
        if (name === 'oxygen_pressure' || name === 'air_pressure') {
            setLogForm(prev => ({
                ...prev,
                ...updates
            }));
        } else {
            // Для всіх інших полів
            setLogForm(prev => ({ ...prev, [name]: newValue }));
        }
    };

    const handleDetailInputChange = (jobDetailId, field, value) => {
        setDetailsMap(prev => ({
            ...prev,
            [jobDetailId]: {
                ...prev[jobDetailId],
                [field]: value === '' ? '' : parseInt(value) || 0
            }
        }));
    };

    const handleStatusChange = (e) => setJobStatusInput(e.target.value);

    const updateJobDetails = async () => {
        try {
            const updates = Object.values(detailsMap);

            console.log('🔄 Оновлення деталей завдання:', updates);

            // Оновлюємо кожну деталь окремо
            for (const detail of updates) {
                const updateData = {
                    quantity_actual: detail.quantity_actual_input === '' ? null : parseInt(detail.quantity_actual_input) || 0,
                    rejection_count: detail.rejection_count_input === '' ? null : parseInt(detail.rejection_count_input) || 0
                };

                console.log(`📝 Оновлення деталі ${detail.job_detail_id}:`, updateData);

                const { error } = await supabase
                    .from('job_details')
                    .update(updateData)
                    .eq('job_detail_id', detail.job_detail_id);

                if (error) {
                    console.error(`❌ Помилка оновлення деталі ${detail.job_detail_id}:`, error);
                    throw new Error(`Помилка оновлення деталі: ${error.message}`);
                }
            }

            console.log('✅ Всі деталі успішно оновлені');

        } catch (err) {
            alert(`Помилка: ${err.message}`);
            console.error('❌ Помилка оновлення деталей:', err);
            throw new Error(`Помилка оновлення деталей: ${err.message}`);
        }
    };

    const updateJobStatus = async (status) => {
        console.log(jobId)
        const { error } = await supabase
            .from('cutting_jobs')
            .update({ status })
            .eq('job_id', jobId);

        if (error) throw error;
        setJob(prev => ({ ...prev, status }));
        setJobStatusInput(status);
    };

    const handleSaveData = async () => {
        if (!programId) {
            alert('Спочатку створіть програму різання'); // Використовуємо alert для початкової перевірки
            return;
        }

        setLoading(true);
        // setError(null); // Цей рядок можна закоментувати/видалити, якщо ви більше не використовуєте setError для виводу на екран

        try {
            console.log('🚀 Початок збереження даних...');

            // Валідація
            validateForm(); // Якщо тут буде помилка, вона одразу перейде в блок catch
            console.log('✅ Валідація пройдена');

            // 1. Оновлення логу різання
            console.log('📝 Оновлення логу різання...');
            await updateCuttingLog();
            console.log('✅ Лог різання оновлено');

            // 2. Оновлення деталей завдання
            console.log('🔧 Оновлення деталей завдання...');
            await updateJobDetails();
            console.log('✅ Деталі завдання оновлено');

            // 3. Оновлення статусу завдання
            if (jobStatusInput !== job.status) {
                console.log('🔄 Оновлення статусу завдання...');
                await updateJobStatus(jobStatusInput);
                console.log('✅ Статус завдання оновлено');

                // Якщо статус змінено на "Виконано" - обробляємо завершення
                if (jobStatusInput === 'Виконано') {
                    console.log('🎯 Завдання завершено, обробляємо...');
                    await handleJobCompletion();
                    return; // Не продовжуємо, бо відбудеться перенаправлення
                }
            }

            console.log('🎉 Всі дані успішно збережено');
            alert('Дані успішно збережено'); // Сповіщення про успіх

        } catch (err) {
            console.error('💥 Повна помилка збереження:', err);
            // 📌 КЛЮЧОВА ЗМІНА: Вивід помилки в alert()
            alert(`Помилка: ${err.message}`);
            // setError(null); // Якщо помилка відображалася, скидаємо її, щоб не заважала

            // ❌ ВАЖЛИВО: Ми НЕ скидаємо logForm чи detailsMap, тому інпути зберігаються.

        } finally {
            setLoading(false);
        }
    };

    const validateForm = () => {
        const isLogFinishing = jobStatusInput === 'Виконано';

        if (isLogStarting && (!logForm.operator_name || !logForm.start_meter)) {
            throw new Error('Для початку роботи заповніть оператора та початковий лічильник');
        }

        if (isLogFinishing && (!logForm.end_meter || parseFloat(logForm.end_meter) <= parseFloat(logForm.start_meter))) {
            throw new Error('Кінцевий лічильник має бути більшим за початковий');
        }
    };

    const updateCuttingLog = async () => {
        try {
            const logUpdates = {
                operator_name: logForm.operator_name,
                oxygen_pressure: logForm.oxygen_pressure || null,
                air_pressure: parseInt(logForm.air_pressure) || 0,
                start_meter: parseFloat(logForm.start_meter) || null,
                end_meter: parseFloat(logForm.end_meter) || null,
                cut_date: logForm.cut_date || null,
                preparation_time_minutes: parseInt(logForm.preparation_time) || null,
                cutting_time_minutes: parseInt(logForm.cutting_time) || null,
                end_time: formatToCustomString(new Date())
            };

            console.log('📝 Оновлення логу різання:', logUpdates);

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
                console.log('✅ Існуючий лог оновлено');
            } else {
                // Створення нового логу
                const { data, error } = await supabase
                    .from('cutting_log')
                    .insert([{
                        program_id: programId,
                        ...logUpdates,
                        start_time: formatToCustomString(new Date())
                    }])
                    .select('*')
                    .single();

                if (error) throw error;
                updatedLogData = data;
                console.log('✅ Новий лог створено');
            }

            if (updatedLogData) {
                setCurrentLog(updatedLogData);
                console.log('✅ Лог оновлено в стані');
            }

        } catch (error) {
            console.error('❌ Помилка оновлення логу:', error);
            throw new Error(`Помилка оновлення логу: ${error.message}`);
        }
    };

    // Рендер функції (залишаються незмінними)
    const renderProgramBlock = () => (
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
    );

    const renderOperatorControl = () => (
        <div className="operator-control">
            <label>
                Оператор
                <input
                    type="text"
                    name="operator_name"
                    value={logForm.operator_name}
                    onChange={handleLogFormChange}
                    placeholder="Введіть ім'я оператора"
                    disabled={isMainFormDisabled}
                />
            </label>

            <label>
                Дата різання
                <input
                    type="date"
                    name="cut_date"
                    value={logForm.cut_date}
                    onChange={handleLogFormChange}
                    disabled={isMainFormDisabled}
                />
            </label>

            <label>
                Статус
                <select value={jobStatusInput} onChange={handleStatusChange} disabled={isMainFormDisabled}>
                    {VALID_STATUSES.map(status => (
                        <option key={status} value={status}>{status}</option>
                    ))}
                </select>
            </label>
        </div>
    );

    const renderDetailsTable = () => (
        <table className="full-width-table">
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

                    <td><>{detail.articles?.name}</> <br/> <h5>{detail.articles?.article_num}</h5></td>
                    <td>{detail.quantity_planned}</td>
                    <td>
                        <input
                            type="number"
                            min="0"
                            value={detail.rejection_count_input}
                            onChange={(e) => handleDetailInputChange(detail.job_detail_id, 'rejection_count_input', e.target.value)}
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
                            onChange={(e) => handleDetailInputChange(detail.job_detail_id, 'quantity_actual_input', e.target.value)}
                            disabled={isMainFormDisabled}
                        />
                    </td>
                </tr>
            ))}
            </tbody>
        </table>
    );

    const renderAdditionalParams = () => {
        // Визначення умов відключення на основі поточних станів
        // Використовуємо змінні isAirUsed та isOxygenEntered, визначені на рівні компонента
        return (
            <div className="additional-log-params">
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

                <div className="pressure-inputs">
                    <label>
                        Тиск кисню (бар):
                        <input
                            type="number"
                            name="oxygen_pressure"
                            value={logForm.oxygen_pressure}
                            onChange={handleLogFormChange}
                            disabled={isMainFormDisabled || isAirUsed} /* ВИКЛЮЧЕННЯ 1: Вимкнути, якщо Повітря ввімкнено */
                            step="0.1"
                        />
                    </label>

                    <label className="checkbox-label">
                        Використовувалось повітря
                        <input
                            type="checkbox"
                            name="air_pressure"
                            checked={isAirUsed}
                            onChange={handleLogFormChange}
                            disabled={isMainFormDisabled || isOxygenEntered} /* ВИКЛЮЧЕННЯ 2: Вимкнути, якщо Кисень введено */
                        />
                    </label>
                </div>
            </div>
        )};

    const renderActionButtons = () => (
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

            {!programId &&
                <p className="hint-info error-text">
                    Створіть програму для розблокування форми
                </p>
            }
        </div>
    );

    // Стани завантаження
    if (loading && !job) return <div className="loading">Завантаження завдання №{jobId}...</div>;
    // if (error) return <div className="error">Помилка: {error}</div>;
    if (!job) return <div className="error">Завдання №{jobId} не знайдено.</div>;

    return (
        <div className="execution-container">
            <div className="execution-header">
                <h1>Виконання Завдання №{jobId}</h1>
                {/*{renderBackButton()}*/}
            </div>

            <div className="job-info">
                <p><strong>Запланована дата здачі:</strong> {job.due_date ? new Date(job.due_date).toLocaleDateString('uk-UA') : 'Не вказано'}</p>
                <p className="notes-snippet"><strong>Примітки:</strong> {job.notes ? job.notes : 'Немає'}</p>
            </div>

            {error && <div className="error-box">{error}</div>}

            {renderProgramBlock()}

            {/* Інформація про час та витрати */}
            <div className="time-meters-info">
                <div className="info-group">
                    <label>Загальний затрачений час</label>
                    <span className="info-value">{totalTime} хв</span>
                </div>
                <div className="info-group">
                    <label>Витрата газу</label>
                    <span className="info-value">{gasConsumption}</span>
                </div>
            </div>

            {renderOperatorControl()}

            <section className="job-results-section">
                {renderDetailsTable()}
                {renderAdditionalParams()}
                {renderActionButtons()}
            </section>
        </div>
    );
}

export default CuttingJobExecution;