import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import './CuttingJobExecution.css';
import FileViewer from "../File/FileViewer";
import ReportCleanupService from '../../utils/reportCleanup';
import PDFCompressor from '../../utils/pdfCompressor';
import { useFileServer } from "../../contexts/FileServerContext";

// Константи
const VALID_STATUSES = ['В черзі', 'В роботі', 'Частково виконано', 'Виконано', 'Призупинено', 'Скасовано'];

const INITIAL_WORK_RECORD = {
    id: null,
    preparation_time: '',
    cutting_time: '',
    start_meter: '',
    end_meter: '',
    oxygen_pressure: '',
    air_pressure: false,
    file_url: null,
    file_name: null,
    log_entry_id: null,
    temp_id: null,
    cut_details: []
};

const INITIAL_LOG_FORM = {
    operator_name: '',
    cut_date: '',
    records: []
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

const calculateTotalTime = (records) => {
    return records.reduce((total, record) => {
        return total + (parseInt(record.preparation_time) || 0) + (parseInt(record.cutting_time) || 0);
    }, 0);
};

const calculateTotalGasConsumption = (records) => {
    if (!records || records.length === 0) return '--';

    const total = records.reduce((sum, record) => {
        if (record.start_meter && record.end_meter && parseFloat(record.end_meter) > parseFloat(record.start_meter)) {
            return sum + (parseFloat(record.end_meter) - parseFloat(record.start_meter));
        }
        return sum;
    }, 0);

    return total.toFixed(2);
};

const getGasType = (record) => {
    if (record.oxygen_pressure && record.oxygen_pressure !== '') {
        return `Кисень (${record.oxygen_pressure} бар)`;
    }
    if (record.air_pressure === true) {
        return 'Повітря';
    }
    return 'Не вказано';
};

// Компонент для перегляду файлу в модальному вікні
const FilePreviewModal = ({ fileUrl, fileName, onClose }) => {
    const { getDownloadUrl } = useFileServer();

    const fullUrl = fileUrl?.startsWith('http') ? fileUrl : getDownloadUrl() + fileUrl;

    return (
        <div className="file-preview-modal-overlay" onClick={onClose}>
            <div className="file-preview-modal" onClick={(e) => e.stopPropagation()}>
                <div className="file-preview-header">
                    <h3>📄 {fileName || 'Файл'}</h3>
                    <button onClick={onClose} className="file-preview-close">✕</button>
                </div>
                <div className="file-preview-content">
                    {fullUrl && (
                        <iframe
                            src={fullUrl}
                            title={fileName}
                            className="file-preview-iframe"
                            frameBorder="0"
                        />
                    )}
                </div>
                <div className="file-preview-footer">
                    <a href={fullUrl} download={fileName} className="file-preview-download">
                        💾 Завантажити
                    </a>
                    <button onClick={onClose} className="file-preview-close-btn">Закрити</button>
                </div>
            </div>
        </div>
    );
};

// Компонент для завантаження файлу запису (виправлена версія)
const RecordFileUpload = ({ record, index, onFileUpdate, onFilePreview, disabled }) => {
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isUploading, setIsUploading] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [isDragOver, setIsDragOver] = useState(false);

    const uploadFileToSupabase = async (file, recordIndex) => {
        if (!file) return null;

        setIsUploading(true);
        setUploadProgress(0);

        try {
            // Генеруємо унікальне ім'я файлу для конкретного запису
            const fileExtension = file.name.split('.').pop();
            const fileName = `record_${recordIndex}_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExtension}`;
            const filePath = `cutting-records/${fileName}`;

            setUploadProgress(30);

            // Завантажуємо файл в Supabase Storage
            const { data, error } = await supabase.storage
                .from('reports')
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (error) throw error;

            setUploadProgress(70);

            // Отримуємо публічний URL
            const { data: urlData } = supabase.storage
                .from('reports')
                .getPublicUrl(filePath);

            setUploadProgress(100);

            console.log(`✅ Файл для запису ${recordIndex} завантажено:`, urlData.publicUrl);

            return {
                url: urlData.publicUrl,
                name: fileName,
                originalName: file.name
            };

        } catch (error) {
            console.error('❌ Помилка завантаження файлу:', error);
            throw new Error(`Помилка завантаження файлу: ${error.message}`);
        } finally {
            setIsUploading(false);
            setTimeout(() => setUploadProgress(0), 2000);
        }
    };

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const allowedTypes = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.dxf'];
        const fileExtension = '.' + file.name.split('.').pop().toLowerCase();

        if (!allowedTypes.includes(fileExtension)) {
            alert('❌ Недопустимий тип файлу. Дозволені типи: PDF, DOC, DOCX, XLS, XLSX, TXT, DXF');
            return;
        }

        setSelectedFile(file);
    };

    const handleUpload = async () => {
        if (!selectedFile) return;

        try {
            const uploadResult = await uploadFileToSupabase(selectedFile, index);

            if (uploadResult) {
                // Оновлюємо URL та ім'я файлу саме для цього запису
                onFileUpdate(index, 'file_url', uploadResult.url);
                onFileUpdate(index, 'file_name', uploadResult.originalName);
                alert('✅ Файл успішно завантажено!');
                setSelectedFile(null);
            }
        } catch (error) {
            console.error('Помилка:', error);
            alert(`❌ Помилка завантаження файлу: ${error.message}`);
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragOver(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        setIsDragOver(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragOver(false);
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFileSelect({ target: { files } });
        }
    };

    const handleRemoveFile = () => {
        // Видаляємо файл тільки для цього запису
        onFileUpdate(index, 'file_url', null);
        onFileUpdate(index, 'file_name', null);
        setSelectedFile(null);
    };

    return (
        <div className="record-file-upload">
            {record.file_url ? (
                <div className="uploaded-record-file">
                    <div className="file-info">
                        <span className="file-icon">📄</span>
                        <span className="file-name">{record.file_name || 'Файл'}</span>
                    </div>
                    <div className="file-actions">
                        <button
                            type="button"
                            onClick={() => onFilePreview(record.file_url, record.file_name)}
                            className="view-file-btn"
                            disabled={disabled}
                        >
                            👁️ Переглянути
                        </button>
                        <button
                            type="button"
                            onClick={handleRemoveFile}
                            className="remove-file-btn"
                            disabled={disabled}
                        >
                            🗑️ Видалити
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    <div
                        className={`record-drop-area ${isDragOver ? 'dragover' : ''}`}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => document.querySelector(`.record-file-input-${index}`)?.click()}
                    >
                        <div className="drop-icon">📁</div>
                        <div className="drop-text">Перетягніть файл сюди</div>
                        <div className="drop-hint">або натисніть для вибору</div>
                    </div>

                    {selectedFile && (
                        <div className="selected-file-info">
                            <span>📎 {selectedFile.name}</span>
                            <button
                                type="button"
                                onClick={() => setSelectedFile(null)}
                                className="cancel-file-btn"
                            >
                                ✕
                            </button>
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={handleUpload}
                        disabled={!selectedFile || isUploading || disabled}
                        className="upload-record-file-btn"
                    >
                        {isUploading ? `📤 Завантаження ${uploadProgress}%` : '📤 Завантажити файл'}
                    </button>

                    <input
                        type="file"
                        className={`record-file-input-${index}`}
                        onChange={handleFileSelect}
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.dxf"
                        disabled={disabled}
                        style={{ display: 'none' }}
                    />
                </>
            )}
        </div>
    );
};

// Компонент для одного запису роботи
const WorkRecord = ({ record, index, onUpdate, onRemove, disabled, canRemove, detailsMap, onFilePreview }) => {
    const consumption = record.start_meter && record.end_meter && parseFloat(record.end_meter) > parseFloat(record.start_meter)
        ? (parseFloat(record.end_meter) - parseFloat(record.start_meter)).toFixed(2)
        : null;

    const recordTime = (parseInt(record.preparation_time) || 0) + (parseInt(record.cutting_time) || 0);
    const isAirUsed = record.air_pressure === true;
    const isOxygenEntered = record.oxygen_pressure && record.oxygen_pressure !== '';

    const updateCutDetail = (detailId, value) => {
        const updatedCutDetails = [...(record.cut_details || [])];
        const existingIndex = updatedCutDetails.findIndex(d => d.detail_id === detailId);

        if (existingIndex >= 0) {
            updatedCutDetails[existingIndex].quantity = parseInt(value) || 0;
        } else {
            updatedCutDetails.push({ detail_id: detailId, quantity: parseInt(value) || 0 });
        }

        onUpdate(index, 'cut_details', updatedCutDetails);
    };

    const getCutQuantity = (detailId) => {
        const found = record.cut_details?.find(d => d.detail_id === detailId);
        return found?.quantity || '';
    };

    // Обробник зміни повітря
    const handleAirChange = (checked) => {
        onUpdate(index, 'air_pressure', checked);
        if (checked) {
            onUpdate(index, 'oxygen_pressure', ''); // Очищаємо кисень
        }
    };

    // Обробник зміни кисню
    const handleOxygenChange = (value) => {
        onUpdate(index, 'oxygen_pressure', value);
        if (value && value !== '') {
            onUpdate(index, 'air_pressure', false); // Вимикаємо повітря
        }
    };

    return (
        <div className="work-record-card">
            <div className="work-record-header">
                <div className="work-record-title">
                    <span className="record-number">Запис #{index + 1}</span>
                    {record.created_at && (
                        <span className="record-date">
                            ({new Date(record.created_at).toLocaleString('uk-UA')})
                        </span>
                    )}
                </div>
                {canRemove && (
                    <button
                        type="button"
                        onClick={() => onRemove(index)}
                        className="record-remove"
                        disabled={disabled}
                        title="Видалити запис"
                    >
                        ✕
                    </button>
                )}
            </div>

            <div className="work-record-content">
                <div className="record-row">
                    <div className="record-field">
                        <label>Час підготовки (хв):</label>
                        <input
                            type="number"
                            value={record.preparation_time || ''}
                            onChange={(e) => onUpdate(index, 'preparation_time', e.target.value)}
                            placeholder="0"
                            min="0"
                            step="1"
                            disabled={disabled}
                            className="record-input"
                        />
                    </div>

                    <div className="record-field">
                        <label>Час різки (хв):</label>
                        <input
                            type="number"
                            value={record.cutting_time || ''}
                            onChange={(e) => onUpdate(index, 'cutting_time', e.target.value)}
                            placeholder="0"
                            min="0"
                            step="1"
                            disabled={disabled}
                            className="record-input"
                        />
                    </div>
                </div>

                <div className="record-row">
                    <div className="record-field">
                        <label>Початковий лічильник:</label>
                        <input
                            type="number"
                            value={record.start_meter || ''}
                            onChange={(e) => onUpdate(index, 'start_meter', e.target.value)}
                            placeholder="Поч. показник"
                            step="0.01"
                            disabled={disabled}
                            className="record-input"
                        />
                    </div>

                    <div className="record-field">
                        <label>Кінцевий лічильник:</label>
                        <input
                            type="number"
                            value={record.end_meter || ''}
                            onChange={(e) => onUpdate(index, 'end_meter', e.target.value)}
                            placeholder="Кін. показник"
                            step="0.01"
                            disabled={disabled}
                            className="record-input"
                        />
                    </div>
                </div>

                <div className="record-row">
                    <div className="record-field">
                        <label>Тиск кисню (бар):</label>
                        <input
                            type="number"
                            value={record.oxygen_pressure || ''}
                            onChange={(e) => handleOxygenChange(e.target.value)}
                            placeholder="Тиск кисню"
                            step="0.1"
                            disabled={disabled || isAirUsed}
                            className="record-input"
                        />
                    </div>

                    <div className="record-field checkbox-field">
                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={isAirUsed}
                                onChange={(e) => handleAirChange(e.target.checked)}
                                disabled={disabled || isOxygenEntered}
                            />
                            Використовувалось повітря
                        </label>
                    </div>
                </div>

                {detailsMap && Object.keys(detailsMap).length > 0 && (
                    <div className="cut-details-section">
                        <label className="cut-details-label">Порізано деталей:</label>
                        <div className="cut-details-list">
                            {Object.values(detailsMap).map(detail => (
                                <div key={detail.job_detail_id} className="cut-detail-item">
                                    <span className="cut-detail-name">
                                        {detail.articles?.article_num} <br/> {detail.articles?.name}
                                    </span>
                                    <input
                                        type="number"
                                        min="0"
                                        value={getCutQuantity(detail.job_detail_id)}
                                        onChange={(e) => updateCutDetail(detail.job_detail_id, e.target.value)}
                                        placeholder="0"
                                        disabled={disabled}
                                        className="cut-detail-input"
                                    />
                                    <span className="cut-detail-unit">шт</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="record-info-panel">
                    {consumption && (
                        <div className="record-consumption">
                            <span>Витрата газу:</span>
                            <strong>{consumption} м³</strong>
                        </div>
                    )}
                    {recordTime > 0 && (
                        <div className="record-time">
                            <span>Загальний час:</span>
                            <strong>{recordTime} хв</strong>
                        </div>
                    )}
                    <div className="record-gas-type">
                        <span>Використаний газ:</span>
                        <strong>{getGasType(record)}</strong>
                    </div>
                </div>
            </div>

            <RecordFileUpload
                record={record}
                index={index}  // Передаємо індекс, щоб файл був прив'язаний до конкретного запису
                onFileUpdate={onUpdate}
                onFilePreview={onFilePreview}
                disabled={disabled}
            />
        </div>
    );
};

function CuttingJobExecution({ jobId, onBack }) {
    const { getDownloadUrl } = useFileServer();

    const [showFileViewer, setShowFileViewer] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);

    const [job, setJob] = useState(null);
    const [programId, setProgramId] = useState(null);
    const [fileNameInput, setFileNameInput] = useState('');
    const [isEditingProgramName, setIsEditingProgramName] = useState(false);
    const [detailsMap, setDetailsMap] = useState({});
    const [currentLog, setCurrentLog] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [logForm, setLogForm] = useState({
        ...INITIAL_LOG_FORM,
        records: []
    });
    const [jobStatusInput, setJobStatusInput] = useState('');

    const detailsToRender = Object.values(detailsMap);
    const isMainFormDisabled = !programId;
    const isButtonDisabled = loading || !programId || isEditingProgramName;

    const totalTime = calculateTotalTime(logForm.records);
    const totalGasConsumption = calculateTotalGasConsumption(logForm.records);

    const handleFilePreview = (fileUrl, fileName) => {
        setSelectedFile({ url: fileUrl, name: fileName });
        setShowFileViewer(true);
    };

    const closeFilePreview = () => {
        setShowFileViewer(false);
        setSelectedFile(null);
    };

    const addRecord = () => {
        const newRecord = {
            ...INITIAL_WORK_RECORD,
            temp_id: Date.now()
        };

        setLogForm(prev => ({
            ...prev,
            records: [...prev.records, newRecord]
        }));

        if (jobStatusInput === 'Частково виконано') {
            setJobStatusInput('В роботі');
        }
    };

    const removeRecord = (index) => {
        if (logForm.records.length === 1) {
            alert('Повинен бути хоча б один запис');
            return;
        }

        setLogForm(prev => ({
            ...prev,
            records: prev.records.filter((_, i) => i !== index)
        }));
    };

    const updateRecord = (index, field, value) => {
        setLogForm(prev => ({
            ...prev,
            records: prev.records.map((record, i) =>
                i === index ? { ...record, [field]: value } : record
            )
        }));
    };

    const fetchJobData = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const { data: jobData, error: jobError } = await supabase
                .from('cutting_jobs')
                .select('*')
                .eq('job_id', jobId)
                .single();

            if (jobError || !jobData) throw new Error("Завдання не знайдено");
            setJob(jobData);
            setJobStatusInput(jobData.status);

            const { data: programData } = await supabase
                .from('cutting_programs')
                .select('program_id, file_name')
                .eq('job_id', jobId)
                .maybeSingle();

            if (programData) {
                await handleProgramData(programData);
            }

            await fetchJobDetails();

        } catch (err) {
            console.error('Помилка завантаження:', err.message);
            alert(`Помилка: ${err.message}`);
        } finally {
            setLoading(false);
        }
    }, [jobId]);

    const convertGasToRecord = (log, gas, index) => {
        const isOxygen = gas.type === 'oxygen';
        const isAir = gas.type === 'air';

        return {
            id: gas.id || null,
            preparation_time: gas.preparation_time || '',
            cutting_time: gas.cutting_time || '',
            start_meter: gas.start_meter || '',
            end_meter: gas.end_meter || '',
            oxygen_pressure: isOxygen ? (gas.pressure || '') : '',
            air_pressure: isAir,
            // Кожен газ має свій файл - беремо з газу, а не з кореня логу
            file_url: gas.file_url || null,
            file_name: gas.file_name || null,
            log_entry_id: log.log_entry_id,
            created_at: log.start_time,
            temp_id: `${log.log_entry_id}_${index}_${Date.now()}_${Math.random()}`,
            cut_details: gas.cut_details || []
        };
    };

    const handleProgramData = async (programData) => {
        setProgramId(programData.program_id);
        setFileNameInput(programData.file_name || '');

        console.log('=== Завантаження даних програми ===');
        console.log('program_id:', programData.program_id);

        const { data: logsData, error: logsError } = await supabase
            .from('cutting_log')
            .select('*')
            .eq('program_id', programData.program_id)
            .order('start_time', { ascending: true });

        if (logsError) {
            console.error('Помилка завантаження логів:', logsError);
        }

        console.log('Знайдено логів:', logsData?.length || 0);

        if (logsData && logsData.length > 0) {
            const latestLog = logsData[logsData.length - 1];

            let allRecords = [];

            logsData.forEach(log => {
                console.log(`Лог ${log.log_entry_id}, gases:`, log.gases);

                if (log.gases && Array.isArray(log.gases) && log.gases.length > 0) {
                    log.gases.forEach((gas, idx) => {
                        // Кожен газ має свій файл
                        const record = convertGasToRecord(log, gas, idx);
                        allRecords.push(record);
                    });
                }
            });

            allRecords.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

            setLogForm({
                operator_name: latestLog.operator_name || '',
                cut_date: latestLog.cut_date?.substring(0, 10) || '',
                records: allRecords.length > 0 ? allRecords : [{ ...INITIAL_WORK_RECORD, temp_id: Date.now() }]
            });

            setCurrentLog(latestLog);
            console.log('Стан форми оновлено, кількість записів:', allRecords.length);
        } else {
            setLogForm(prev => ({
                ...prev,
                records: [{ ...INITIAL_WORK_RECORD, temp_id: Date.now() }]
            }));
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

    // Додаємо ефект для автоматичного оновлення фактичної кількості в detailsMap
    useEffect(() => {
        if (!detailsMap || Object.keys(detailsMap).length === 0) return;

        const updatedDetailsMap = { ...detailsMap };
        let hasChanges = false;

        Object.keys(detailsMap).forEach(detailId => {
            const actualFromRecords = calculateActualQuantityFromRecords(parseInt(detailId));
            const currentActual = detailsMap[detailId].quantity_actual_input;

            // Оновлюємо тільки якщо значення відрізняється
            if (currentActual !== actualFromRecords && actualFromRecords !== 0) {
                updatedDetailsMap[detailId] = {
                    ...detailsMap[detailId],
                    quantity_actual_input: actualFromRecords
                };
                hasChanges = true;
            }
        });

        if (hasChanges) {
            setDetailsMap(updatedDetailsMap);
        }
    }, [logForm.records, detailsMap]);

    useEffect(() => {
        if (jobId) fetchJobData();
    }, [fetchJobData, jobId]);

    const handleProgramNameChange = (e) => setFileNameInput(e.target.value);

    const handleCreateProgram = async () => {
        if (!fileNameInput) {
            setError('Введіть назву програми');
            return;
        }

        setLoading(true);
        try {
            // Перевіряємо чи існує програма з такою назвою
            const { data: existingProgram } = await supabase
                .from('cutting_programs')
                .select('program_id')
                .eq('file_name', fileNameInput)
                .maybeSingle();

            if (existingProgram) {
                setError(`Програма з назвою "${fileNameInput}" вже існує`);
                setLoading(false);
                return;
            }

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
            console.error('Помилка створення програми:', err);
            alert(`Помилка: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateProgramName = async () => {
        if (!fileNameInput || !programId) return;

        setLoading(true);
        try {
            // Перевіряємо чи існує програма з такою назвою (крім поточної)
            const { data: existingProgram } = await supabase
                .from('cutting_programs')
                .select('program_id')
                .eq('file_name', fileNameInput)
                .neq('program_id', programId)
                .maybeSingle();

            if (existingProgram) {
                setError(`Програма з назвою "${fileNameInput}" вже існує`);
                setLoading(false);
                return;
            }

            await supabase
                .from('cutting_programs')
                .update({ file_name: fileNameInput })
                .eq('program_id', programId);

            setIsEditingProgramName(false);
            setError(null);
        } catch (err) {
            alert(`Помилка: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleLogFormChange = (e) => {
        const { name, value } = e.target;
        setLogForm(prev => ({ ...prev, [name]: value }));
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

    const updateCuttingLog = async () => {
        try {
            const gasesToSave = logForm.records.map(record => {
                const gas = {
                    type: record.oxygen_pressure ? 'oxygen' : (record.air_pressure ? 'air' : 'unknown'),
                    pressure: record.oxygen_pressure || null,
                    start_meter: parseFloat(record.start_meter) || null,
                    end_meter: parseFloat(record.end_meter) || null,
                    preparation_time: record.preparation_time ? parseInt(record.preparation_time) : null,
                    cutting_time: record.cutting_time ? parseInt(record.cutting_time) : null,
                    // Кожен газ має свій файл
                    file_url: record.file_url || null,
                    file_name: record.file_name || null,
                    cut_details: record.cut_details || []
                };
                return gas;
            });

            const totalCutPieces = logForm.records.reduce((total, record) => {
                const recordTotal = (record.cut_details || []).reduce((sum, cd) => sum + (cd.quantity || 0), 0);
                return total + recordTotal;
            }, 0);

            const logUpdates = {
                operator_name: logForm.operator_name,
                cut_date: logForm.cut_date || null,
                gases: gasesToSave,
                total_cut_pieces: totalCutPieces,
                end_time: formatToCustomString(new Date())
            };

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
            }

            if (updatedLogData) {
                setCurrentLog(updatedLogData);
            }

        } catch (error) {
            console.error('❌ Помилка оновлення логу:', error);
            throw new Error(`Помилка оновлення логу: ${error.message}`);
        }
    };

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

    const redirectToInformationPage = () => {
        const url = `#/view/information?expanded=${jobId}&job_id=${jobId}`;
        window.location.hash = `/view/information?expanded=${jobId}&job_id=${jobId}`;
    };

    const handleJobCompletion = async () => {
        try {
            const totalCutPieces = logForm.records.reduce((total, record) => {
                const recordTotal = (record.cut_details || []).reduce((sum, cd) => sum + (cd.quantity || 0), 0);
                return total + recordTotal;
            }, 0);

            const notificationTitle = `Завдання №${jobId} завершено`;
            const notificationMessage = `
                Різку завдання №${jobId} завершено 
                оператором ${logForm.operator_name || 'невідомо'}. 
                Загальний час: ${totalTime} хв
                Витрати газу: ${totalGasConsumption} м³
                Порізано деталей: ${totalCutPieces} шт
            `;

            await createNotification(notificationTitle, notificationMessage, 'job_completed');

            if ('Notification' in window && Notification.permission === 'granted') {
                new Notification(notificationTitle, {
                    body: notificationMessage,
                    icon: '/favicon.ico'
                });
            }

            setTimeout(() => {
                redirectToInformationPage();
            }, 1500);

        } catch (error) {
            console.error('❌ Помилка при обробці завершення завдання:', error);
        }
    };

    const handleSaveData = async () => {
        if (!programId) {
            alert('Спочатку створіть програму різання');
            return;
        }

        setLoading(true);

        try {
            await updateCuttingLog();
            await updateJobDetails();

            if (jobStatusInput !== job.status) {
                await updateJobStatus(jobStatusInput);

                if (jobStatusInput === 'Виконано') {
                    await handleJobCompletion();
                    return;
                }
            }

            alert('Дані успішно збережено');

        } catch (err) {
            console.error('💥 Помилка збереження:', err);
            alert(`Помилка: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

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

    const calculateActualQuantityFromRecords = (jobDetailId) => {
        if (!logForm.records || logForm.records.length === 0) return 0;

        const total = logForm.records.reduce((sum, record) => {
            const cutDetail = record.cut_details?.find(d => d.detail_id === jobDetailId);
            return sum + (cutDetail?.quantity || 0);
        }, 0);

        return total;
    };

    const renderDetailsTable = () => (
        <table className="full-width-table">
            <thead>
            <tr>
                <th>Артикул</th>
                <th>План</th>
                <th>Брак</th>
                <th>Матеріал</th>
                <th>Товщина, мм</th>
                <th>Факт (з записів)</th>
            </tr>
            </thead>
            <tbody>
            {detailsToRender.map((detail) => {
                // Розраховуємо фактичну кількість з усіх записів
                const actualFromRecords = calculateActualQuantityFromRecords(detail.job_detail_id);

                // Оновлюємо quantity_actual_input в detailsMap для збереження
                const currentActualInput = detail.quantity_actual_input;

                return (
                    <tr key={detail.job_detail_id}>
                        <td>
                            {detail.articles?.name}
                            <br/>
                            <h5>{detail.articles?.article_num}</h5>
                            {detail.articles?.file_url ? (
                                <button
                                    onClick={() => window.open(getDownloadUrl() + detail.articles?.file_url, '_blank')}
                                    className="file-link"
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
                                className="rejection-input"
                            />
                        </td>
                        <td>{detail.articles?.material_type}</td>
                        <td>{detail.articles?.thickness}</td>
                        <td>
                            <div className="actual-quantity-display">
                                <span className="actual-from-records">
                                    {actualFromRecords} шт
                                </span>
                                {currentActualInput !== actualFromRecords && currentActualInput !== '' && (
                                    <span className="actual-warning" title="Ручне значення відрізняється від автоматичного">
                                        ⚠️
                                    </span>
                                )}
                            </div>
                            {/* Приховане поле для збереження ручного значення, якщо потрібно */}
                            <input
                                type="hidden"
                                value={actualFromRecords}
                                onChange={(e) => handleDetailInputChange(detail.job_detail_id, 'quantity_actual_input', e.target.value)}
                            />
                        </td>
                    </tr>
                );
            })}
            </tbody>
        </table>
    );

const renderRecordsSection = () => (
    <div className="records-section">
        <div className="records-header">
            <h3>📊 Записи роботи</h3>
            <button
                type="button"
                onClick={addRecord}
                disabled={isMainFormDisabled}
                className="add-record-btn"
            >
                + Додати запис
            </button>
        </div>

        <div className="records-summary">
            <div className="summary-item">
                <span>⏱️ Загальний час:</span>
                <strong>{totalTime} хв</strong>
            </div>
            <div className="summary-item">
                <span>💨 Загальна витрата газу:</span>
                <strong>{totalGasConsumption} м³</strong>
            </div>
            <div className="summary-item">
                <span>📝 Кількість записів:</span>
                <strong>{logForm.records.length}</strong>
            </div>
        </div>

        <div className="records-list">
            {logForm.records.map((record, index) => (
                <WorkRecord
                    key={record.temp_id || index}
                    record={record}
                    index={index}
                    onUpdate={updateRecord}
                    onRemove={removeRecord}
                    disabled={isMainFormDisabled}
                    canRemove={logForm.records.length > 1}
                    detailsMap={detailsMap}
                    onFilePreview={handleFilePreview}
                />
            ))}
        </div>
    </div>
);

const renderActionButtons = () => (
    <div className="action-buttons-container">
        <button
            onClick={handleSaveData}
            disabled={isButtonDisabled}
            className={jobStatusInput === 'Виконано' ? 'end-button' : 'save-button'}
        >
            {jobStatusInput === 'Виконано' ? 'ЗБЕРЕГТИ & ВИКОНАНО' : 'Зберегти Дані'}
        </button>

        {!programId &&
            <p className="hint-info error-text">
                Створіть програму для розблокування форми
            </p>
        }
    </div>
);

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
        {renderOperatorControl()}

        <section className="job-results-section">
            {renderDetailsTable()}
            {renderRecordsSection()}
            {renderActionButtons()}
        </section>

        {showFileViewer && selectedFile && (
            <FilePreviewModal
                fileUrl={selectedFile.url}
                fileName={selectedFile.name}
                onClose={closeFilePreview}
            />
        )}
    </div>
);
}

export default CuttingJobExecution;