import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import './CuttingJobExecution.css';
import FileViewer from "../File/FileViewer";
import ReportCleanupService from '../../utils/reportCleanup';
import PDFCompressor from '../../utils/pdfCompressor';
import {useFileServer} from "../../contexts/FileServerContext";

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
    const { getHomeUrl, getUploadUrl, getDownloadUrl, config, isLoading: isFileServerLoading } = useFileServer();

    const [isDeletingFile, setIsDeletingFile] = useState(false);
    const [showFileViewer, setShowFileViewer] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [reportFile, setReportFile] = useState(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isUploading, setIsUploading] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);

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

    // Похідні дані
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

    // Обробники для drag & drop
    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        setIsDragOver(true);
    }, []);

    const handleDragLeave = useCallback((e) => {
        e.preventDefault();
        if (!e.currentTarget.contains(e.relatedTarget)) {
            setIsDragOver(false);
        }
    }, []);

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        setIsDragOver(false);
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFileSelect({ target: { files } });
        }
    }, []);

    // Допоміжні функції для файлів
    const getFileType = useCallback((file) => {
        const extension = file.name.split('.').pop().toLowerCase();
        const typeMap = {
            pdf: 'PDF документ',
            doc: 'Word документ',
            docx: 'Word документ',
            xls: 'Excel таблиця',
            xlsx: 'Excel таблиця',
            txt: 'Текстовий файл'
        };
        return typeMap[extension] || 'Файл';
    }, []);

    const formatFileSize = useCallback((bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }, []);

    // Функція видалення файлу
    const handleDeleteReportFile = async () => {
        if (!currentLog?.report_url || !currentLog?.log_entry_id) {
            alert('Файл для видалення не знайдено');
            return;
        }

        // Додаткова перевірка існування файлу
        const fileExists = await ReportCleanupService.checkFileExists(currentLog.report_url);
        if (!fileExists) {
            console.warn('⚠️ Файл не знайдено в Storage, оновлюємо тільки базу даних');
        }

        if (!window.confirm(
            `Ви впевнені, що хочете видалити цей файл звіту?${
                fileExists ? '' : ' (Файл вже відсутній в Storage)'
            } Цю дію не можна скасувати.`
        )) {
            return;
        }

        setIsDeletingFile(true);

        try {
            const result = await ReportCleanupService.deleteReportFile(
                currentLog.report_url,
                currentLog.log_entry_id
            );

            if (result.success) {
                console.log('✅ Файл успішно видалено');

                // Оновлюємо стан компонента
                setCurrentLog(prev => prev ? { ...prev, report_url: null } : null);
                setReportFile(null);

                alert('Файл звіту успішно видалено');
            } else {
                throw new Error(result.error);
            }

        } catch (error) {
            console.error('❌ Помилка видалення файлу:', error);
            alert(`Помилка видалення файлу: ${error.message}`);
        } finally {
            setIsDeletingFile(false);
        }
    };

    // Функція для відкриття файлу
    const openFileViewer = () => {
        if (currentLog?.report_url) {
            setSelectedFile({
                url: currentLog.report_url,
                name: reportFile?.name || `Звіт_${jobId}.pdf`
            });
            setShowFileViewer(true);
        }
    };

    // Функція для закриття файлу
    const closeFileViewer = () => {
        setShowFileViewer(false);
        setSelectedFile(null);
    };

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

    // Оновлена функція завантаження файлу - тепер окрема
    const uploadReportFile = async () => {
        if (!reportFile || !programId) {
            alert('Виберіть файл для завантаження');
            return null;
        }

        setIsUploading(true);
        setUploadProgress(0);

        try {
            // Запускаємо очищення старих файлів
            ReportCleanupService.safeCleanup(3).catch(err =>
                console.warn('⚠️ Помилка очищення:', err)
            );

            let fileToUpload = reportFile;
            let isCompressed = false;

            // Стискаємо PDF якщо потрібно
            if (PDFCompressor.needsCompression(reportFile)) {
                console.log('🎯 Стиснення PDF файлу...');
                setUploadProgress(10);
                fileToUpload = await PDFCompressor.compressPDF(reportFile, {
                    quality: 'medium',
                    maxSizeMB: 2
                });
                isCompressed = true;
                setUploadProgress(30);
            }

            // Генеруємо коректне ім'я файлу
            const fileExtension = fileToUpload.name.split('.').pop();
            const fileName = `job_${jobId}_report_${Date.now()}.${fileExtension}`;
            const filePath = `cutting-reports/${fileName}`;

            setUploadProgress(50);

            const { data, error } = await supabase.storage
                .from('reports')
                .upload(filePath, fileToUpload, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (error) throw error;

            setUploadProgress(80);

            const { data: urlData } = supabase.storage
                .from('reports')
                .getPublicUrl(filePath);

            console.log('✅ Файл звіту завантажено:', urlData.publicUrl);

            // Оновлюємо лог з новим URL файлу
            await updateCuttingLog(urlData.publicUrl);

            setUploadProgress(100);

            // Повертаємо коректні дані
            return {
                url: urlData.publicUrl,
                originalName: reportFile.name,
                storageName: fileName,
                isCompressed: isCompressed
            };

        } catch (error) {
            console.error('❌ Помилка завантаження файлу:', error);
            throw new Error(`Помилка завантаження файлу: ${error.message}`);
        } finally {
            setIsUploading(false);
            setTimeout(() => setUploadProgress(0), 2000);
        }
    };

    // Окрема функція для завантаження файлу
    const handleUploadFile = async () => {
        try {
            const result = await uploadReportFile();
            if (result) {
                alert('✅ Файл успішно завантажено!');
                // Оновлюємо дані, щоб побачити завантажений файл
                await fetchJobData();
            }
        } catch (error) {
            alert(`❌ Помилка: ${error.message}`);
        }
    };

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Перевірка типу файлу
        const allowedTypes = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt'];
        const fileExtension = '.' + file.name.split('.').pop().toLowerCase();

        if (!allowedTypes.includes(fileExtension)) {
            alert('❌ Недопустимий тип файлу. Дозволені формати: PDF, DOC, DOCX, XLS, XLSX, TXT');
            return;
        }

        // Перевірка розміру файлу (макс. 10MB)
        const maxSize = 10 * 1024 * 1024; // 10MB в байтах
        if (file.size > maxSize) {
            alert(`❌ Файл занадто великий. Максимальний розмір: 10MB. Ваш файл: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
            return;
        }

        // Додаткова перевірка для PDF стиснення
        if (file.type === 'application/pdf' && file.size > 2 * 1024 * 1024) {
            if (window.confirm('📄 Цей PDF файл досить великий. Рекомендуємо стиснення. Продовжити?')) {
                setReportFile(file);
            }
            return;
        }

        setReportFile(file);
        setUploadProgress(0);

        console.log('✅ Файл вибрано:', file.name, `(${(file.size / 1024 / 1024).toFixed(2)} MB)`);
    };

    // Обробка завершення завдання
    const handleJobCompletion = async () => {
        try {
            // Створюємо сповіщення про завершення
            const notificationTitle = `Завдання №${jobId} завершено`;
            const notificationMessage = `
            Різку завдання №${jobId} завершено 
            оператором ${logForm.operator_name || 'невідомо'}. 
            Загальний час: ${totalTime} хв`;

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
            }, 1500);

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

            // Якщо є файл звіту, встановлюємо коректний об'єкт File
            if (latestLog.report_url) {
                try {
                    const fileName = extractFileNameFromUrl(latestLog.report_url) || `Звіт_${jobId}.pdf`;
                    const fileObj = new File([], fileName, {
                        type: 'application/pdf',
                        name: fileName
                    });
                    setReportFile(fileObj);
                } catch (error) {
                    console.warn('Помилка створення об\'єкту файлу:', error);
                    setReportFile(new File([], `Звіт_${jobId}.pdf`, { type: 'application/pdf' }));
                }
            }
        }
    };

    // функція для отримання назви файлу з URL
    const extractFileNameFromUrl = (url) => {
        try {
            const urlObj = new URL(url);
            const pathSegments = urlObj.pathname.split('/');
            return pathSegments[pathSegments.length - 1];
        } catch (error) {
            console.error('Помилка отримання назви файлу з URL:', error);
            return null;
        }
    };

    const fetchJobDetails = async () => {
        const { data: detailsArray, error: detailsError } = await supabase
            .from('job_details')
            .select(`
                job_detail_id, quantity_planned, quantity_actual, rejection_count, program_id, job_id, article_id,
                articles (name, thickness, material_type, article_num, file_url)
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

    // Обробники подій (залишаються незмінними)
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

            if (job.status === 'Створено') {
                await updateJobStatus('В роботі');
            }

        } catch (err) {
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
            if (newValue === '1') {
                updates.oxygen_pressure = '';
            }
            updates.air_pressure = newValue;
        } else {
            updates[name] = newValue;
        }

        if (name === 'oxygen_pressure' && newValue !== '') {
            updates.air_pressure = '0';
        }

        if (name === 'oxygen_pressure' || name === 'air_pressure') {
            setLogForm(prev => ({
                ...prev,
                ...updates
            }));
        } else {
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

            for (const detail of updates) {
                const updateData = {
                    quantity_actual: detail.quantity_actual_input === '' ? null : parseInt(detail.quantity_actual_input) || 0,
                    rejection_count: detail.rejection_count_input === '' ? null : parseInt(detail.rejection_count_input) || 0
                };

                const { error } = await supabase
                    .from('job_details')
                    .update(updateData)
                    .eq('job_detail_id', detail.job_detail_id);

                if (error) throw error;
            }

            console.log('✅ Всі деталі успішно оновлені');

        } catch (err) {
            alert(`Помилка: ${err.message}`);
            throw new Error(`Помилка оновлення деталей: ${err.message}`);
        }
    };

    const updateJobStatus = async (status) => {
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
            alert('Спочатку створіть програму різання');
            return;
        }

        setLoading(true);

        try {
            console.log('🚀 Початок збереження даних...');

            // Валідація
            validateForm();
            console.log('✅ Валідація пройдена');

            // 1. Оновлення логу різання (без файлу - файл завантажується окремо)
            console.log('📝 Оновлення логу різання...');
            await updateCuttingLog(currentLog?.report_url || null);
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

                if (jobStatusInput === 'Виконано') {
                    console.log('🎯 Завдання завершено, обробляємо...');
                    await handleJobCompletion();
                    return;
                }
            }

            console.log('🎉 Всі дані успішно збережено');
            alert('Дані успішно збережено');

        } catch (err) {
            console.error('💥 Повна помилка збереження:', err);
            alert(`Помилка: ${err.message}`);
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

    const downloadFile = async (fileUrl, fileName) => {
        try {
            const response = await fetch(fileUrl);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = url;
            link.download = fileName || 'file.dxf';
            document.body.appendChild(link);
            link.click();

            window.URL.revokeObjectURL(url);
            document.body.removeChild(link);
        } catch (error) {
            console.error('Помилка при завантаженні файлу:', error);
            alert('Помилка завантаження файлу: ' + error.message);
            window.open(fileUrl, '_blank');
        }
    };

    const updateCuttingLog = async (reportUrl = null) => {
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
                end_time: formatToCustomString(new Date()),
                report_url: reportUrl
            };

            console.log('📝 Оновлення логу різання:', logUpdates);

            let updatedLogData;

            if (currentLog?.log_entry_id) {
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

    // Оновлена функція рендеру завантаження файлів з окремою кнопкою
    const renderFileUpload = () => (
        <div className="file-upload-section">
            <label className="file-upload-label">
                📎 Додати файл звіту (необов'язково):
            </label>

            <div
                className={`file-drop-area ${isDragOver ? 'file-drop-area--dragover' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => document.querySelector('.file-upload-input').click()}
            >
                <div className="file-drop-icon">📁</div>
                <div className="file-drop-text">
                    Перетягніть файл сюди
                </div>
                <div className="file-drop-hint">
                    або натисніть для вибору файлу
                </div>
                <button type="button" className="file-browse-btn">
                    Обрати файл
                </button>
            </div>

            {/* Інформація про вибраний файл */}
            {reportFile && (
                <div className="file-info-card">
                    <div className="file-info-icon">📄</div>
                    <div className="file-info-details">
                        <div className="file-info-name">{reportFile.name}</div>
                        <div className="file-info-meta">
                            <span className="file-info-type">{getFileType(reportFile)}</span>
                            <span className="file-info-size">{formatFileSize(reportFile.size)}</span>
                        </div>
                    </div>
                    <button
                        type="button"
                        className="file-remove-btn"
                        onClick={() => setReportFile(null)}
                        disabled={isUploading}
                        title="Видалити файл"
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* Кнопка завантаження файлу */}
            {reportFile && !currentLog?.report_url && (
                <div className="upload-actions">
                    <button
                        type="button"
                        onClick={handleUploadFile}
                        disabled={isUploading || isMainFormDisabled}
                        className="upload-file-button"
                    >
                        {isUploading ? '📤 Завантаження...' : '📤 Завантажити файл'}
                    </button>
                </div>
            )}

            {/* Прогрес завантаження */}
            {isUploading && (
                <div className="upload-progress">
                    <div className="progress-bar">
                        <div
                            className="progress-fill"
                            style={{ width: `${uploadProgress}%` }}
                        ></div>
                    </div>
                    <div className="progress-text">
                        <span>Завантаження...</span>
                        <span className="progress-percentage">{uploadProgress}%</span>
                    </div>
                </div>
            )}

            {/* Статусні повідомлення */}
            {uploadProgress === 100 && (
                <div className="upload-status upload-status--success">
                    ✅ Файл успішно завантажено!
                </div>
            )}

            {/* Інформація про підтримувані формати */}
            <div className="upload-status upload-status--info">
                ℹ️ Підтримувані формати: PDF, DOC, DOCX, XLS, XLSX, TXT (макс. 10MB)
            </div>

            {/* Прихований input */}
            <input
                type="file"
                className="file-upload-input"
                onChange={handleFileSelect}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
                disabled={isMainFormDisabled || isUploading}
                style={{ display: 'none' }}
            />
        </div>
    );

    // Решта функцій рендеру залишаються незмінними
    const renderUploadedFile = () => {
        if (!currentLog?.report_url) return null;

        const fileNameFromUrl = extractFileNameFromUrl(currentLog.report_url);
        const displayName = reportFile?.name || fileNameFromUrl || `Звіт_${jobId}.pdf`;

        return (
            <div className="uploaded-file-section">
                <h4>Завантажений файл звіту:</h4>
                <div className="file-display">
                    <div className="file-info-group">
                    <span className="file-name">
                        📎 {displayName}
                    </span>
                        {reportFile?.name && reportFile.name.includes('_compressed') && (
                            <span className="compressed-badge">стиснутий</span>
                        )}
                    </div>
                    <div className="file-actions">
                        <button
                            onClick={openFileViewer}
                            className="view-file-button"
                            disabled={isMainFormDisabled || isDeletingFile}
                        >
                            Переглянути
                        </button>
                        <button
                            onClick={handleDeleteReportFile}
                            className="delete-file-button"
                            disabled={isDeletingFile || isMainFormDisabled}
                            title="Видалити файл"
                        >
                            {isDeletingFile ? '🗑️ Видалення...' : '×'}
                        </button>
                    </div>
                </div>
                {isDeletingFile && (
                    <div className="deleting-progress">
                        <span>Видалення файлу...</span>
                    </div>
                )}
            </div>
        );
    };

    // Решта компонентів залишаються незмінними
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
                    <td>
                        {detail.articles?.name}
                        <br/>
                        <h5>{detail.articles?.article_num}</h5>
                        {
                            detail.articles?.file_url ? (
                                <button
                                    onClick={() => downloadFile(getHomeUrl() + detail.articles?.file_url, detail.articles?.article_num + '.dxf')}
                                    className="file-link"
                                    style={{ border: 'none', color: 'blue', textDecoration: 'underline', cursor: 'pointer' }}
                                >
                                    📎 Файл
                                </button>
                            ) : (
                                <span className="no-file">—</span>
                            )}
                    </td>
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
                            disabled={isMainFormDisabled || isAirUsed}
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
                            disabled={isMainFormDisabled || isOxygenEntered}
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
    if (!job) return <div className="error">Завдання №{jobId} не знайдено.</div>;

    return (
        <div className="execution-container">
            <div className="execution-header">
                <h1>Виконання Завдання №{jobId}</h1>
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
                {renderFileUpload()}
                {renderUploadedFile()}
                {renderActionButtons()}
            </section>

            {/* Модальне вікно для перегляду файлу */}
            {showFileViewer && selectedFile && (
                <FileViewer
                    fileUrl={selectedFile.url}
                    fileName={selectedFile.name}
                    onClose={closeFileViewer}
                />
            )}
        </div>
    );
}

export default CuttingJobExecution;