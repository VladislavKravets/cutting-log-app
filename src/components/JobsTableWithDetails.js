import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import FileViewer from './File/FileViewer';
import './JobsTableWithDetails.css';
import { useFileServer } from "../contexts/FileServerContext";

const JobsTableWithDetails = () => {
    const { getDownloadUrl } = useFileServer();

    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();

    const [jobs, setJobs] = useState([]);
    const [expandedJobs, setExpandedJobs] = useState(new Set());
    const [jobDetails, setJobDetails] = useState({});
    const [cuttingLogs, setCuttingLogs] = useState({});
    const [cuttingPrograms, setCuttingPrograms] = useState({});
    const [loading, setLoading] = useState(false);
    const [initialLoad, setInitialLoad] = useState(true);

    // Стани для перегляду файлів
    const [showFileViewer, setShowFileViewer] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);

    // Стани для пагінації
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    // Стан для сортування
    const [sortByCutDate, setSortByCutDate] = useState('');

    // Локальний стан для відображення значень в інпутах
    const [displayFilters, setDisplayFilters] = useState({
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
    });

    const [filtersApplied, setFiltersApplied] = useState(false);

    // ==================== ДОПОМІЖНІ ФУНКЦІЇ ====================

    // Функція для отримання всіх газів з логу
    const getGasesFromLog = (log) => {
        if (log.gases && Array.isArray(log.gases) && log.gases.length > 0) {
            return log.gases;
        }

        if (log.start_meter || log.end_meter || log.oxygen_pressure || log.air_pressure) {
            const gasType = log.oxygen_pressure ? 'oxygen' : (log.air_pressure > 0 ? 'air' : 'unknown');
            return [{
                type: gasType,
                pressure: log.oxygen_pressure || null,
                start_meter: log.start_meter,
                end_meter: log.end_meter,
                file_url: log.report_url,
                file_name: null,
                preparation_time: log.preparation_time_minutes,
                cutting_time: log.cutting_time_minutes,
                cut_files: log.cut_files || log.cut_details || [],
                cut_details: log.cut_details || []
            }];
        }

        return [];
    };

    // Функція для отримання назви програми для логу
    const getProgramNameForLog = (log, programId) => {
        if (log.program_name) return log.program_name;

        for (const jobPrograms of Object.values(cuttingPrograms)) {
            const program = jobPrograms.find(p => p.program_id === programId);
            if (program) return program.file_name;
        }
        return 'Н/Д';
    };

    // Функція для отримання назви файлу з URL
    const extractFileNameFromUrl = (url) => {
        try {
            if (!url) return null;
            const urlObj = new URL(url);
            const pathSegments = urlObj.pathname.split('/');
            return pathSegments[pathSegments.length - 1];
        } catch (error) {
            return null;
        }
    };

    // Функція для отримання порізаних файлів з запису
    const getCutFiles = (record) => {
        if (record.cut_files && Array.isArray(record.cut_files) && record.cut_files.length > 0) {
            return record.cut_files;
        }
        if (record.cut_details && Array.isArray(record.cut_details) && record.cut_details.length > 0) {
            return record.cut_details;
        }
        return [];
    };

    // Функція для збагачення порізаних файлів інформацією про артикули
    const enrichCutFilesWithArticles = (cutFiles, jobDetailsMap) => {
        if (!cutFiles || cutFiles.length === 0) return [];

        return cutFiles.map(file => {
            // Якщо є detail_id, шукаємо відповідний артикул у специфікації
            if (file.detail_id && jobDetailsMap) {
                const detail = jobDetailsMap[file.detail_id];
                if (detail && detail.articles) {
                    return {
                        ...file,
                        article_id: detail.articles.article_id,
                        article_num: detail.articles.article_num,
                        article_name: detail.articles.name,
                        quantity: file.quantity || 1
                    };
                }
            }

            // Якщо є article_id, шукаємо за ним
            if (file.article_id && jobDetailsMap) {
                const detail = Object.values(jobDetailsMap).find(d =>
                    d.articles?.article_id === file.article_id
                );
                if (detail && detail.articles) {
                    return {
                        ...file,
                        article_id: detail.articles.article_id,
                        article_num: detail.articles.article_num,
                        article_name: detail.articles.name,
                        quantity: file.quantity || 1
                    };
                }
            }

            // Якщо є article_num, шукаємо за ним
            if (file.article_num && jobDetailsMap) {
                const detail = Object.values(jobDetailsMap).find(d =>
                    d.articles?.article_num === file.article_num
                );
                if (detail && detail.articles) {
                    return {
                        ...file,
                        article_id: detail.articles.article_id,
                        article_num: detail.articles.article_num,
                        article_name: detail.articles.name,
                        quantity: file.quantity || 1
                    };
                }
            }

            // Якщо не знайшли, повертаємо з даними з файлу
            return {
                ...file,
                article_name: file.article_name || 'Невідомий артикул',
                article_num: file.article_num || 'Н/Д',
                quantity: file.quantity || 1
            };
        });
    };

    // Функція для отримання всіх записів роботи
    const getWorkRecords = (logs, jobDetailsMap) => {
        const records = [];

        logs.forEach(log => {
            const gases = getGasesFromLog(log);

            if (gases.length > 0) {
                gases.forEach((gas, index) => {
                    let gasType = gas.type;
                    let pressure = gas.pressure;
                    let startMeter = gas.start_meter;
                    let endMeter = gas.end_meter;
                    let preparationTime = gas.preparation_time || log.preparation_time_minutes;
                    let cuttingTime = gas.cutting_time || log.cutting_time_minutes;

                    if (!startMeter && log.start_meter) startMeter = log.start_meter;
                    if (!endMeter && log.end_meter) endMeter = log.end_meter;
                    if (!pressure && log.oxygen_pressure) pressure = log.oxygen_pressure;

                    if (gasType === 'unknown') {
                        if (pressure) {
                            gasType = 'oxygen';
                        } else if (log.air_pressure > 0) {
                            gasType = 'air';
                        }
                    }

                    let cutFiles = gas.cut_files || gas.cut_details || [];
                    if (cutFiles.length === 0 && log.cut_files) cutFiles = log.cut_files;
                    if (cutFiles.length === 0 && log.cut_details) cutFiles = log.cut_details;

                    const enrichedCutFiles = enrichCutFilesWithArticles(cutFiles, jobDetailsMap);

                    records.push({
                        id: `${log.log_entry_id}_${index}`,
                        log_entry_id: log.log_entry_id,
                        program_id: log.program_id,
                        program_name: getProgramNameForLog(log, log.program_id),
                        cut_date: log.cut_date,
                        start_time: log.start_time,
                        end_time: log.end_time,
                        preparation_time: preparationTime,
                        cutting_time: cuttingTime,
                        gas_type: gasType,
                        pressure: pressure,
                        start_meter: startMeter,
                        end_meter: endMeter,
                        file_url: gas.file_url,
                        file_name: gas.file_name,
                        cut_files: enrichedCutFiles,
                        cut_details: enrichedCutFiles,
                        operator_name: log.operator_name
                    });
                });
            } else if (log.start_meter || log.end_meter || log.report_url) {
                const gasType = log.oxygen_pressure ? 'oxygen' : (log.air_pressure > 0 ? 'air' : 'unknown');

                let cutFiles = log.cut_files || log.cut_details || [];
                const enrichedCutFiles = enrichCutFilesWithArticles(cutFiles, jobDetailsMap);

                records.push({
                    id: `${log.log_entry_id}_0`,
                    log_entry_id: log.log_entry_id,
                    program_id: log.program_id,
                    program_name: getProgramNameForLog(log, log.program_id),
                    cut_date: log.cut_date,
                    start_time: log.start_time,
                    end_time: log.end_time,
                    preparation_time: log.preparation_time_minutes,
                    cutting_time: log.cutting_time_minutes,
                    gas_type: gasType,
                    pressure: log.oxygen_pressure,
                    start_meter: log.start_meter,
                    end_meter: log.end_meter,
                    file_url: log.report_url,
                    file_name: extractFileNameFromUrl(log.report_url),
                    cut_files: enrichedCutFiles,
                    cut_details: enrichedCutFiles,
                    operator_name: log.operator_name
                });
            }
        });

        records.sort((a, b) => new Date(b.start_time) - new Date(a.start_time));

        return records;
    };

    // Функція для отримання тиску газу
    const getGasPressure = (record) => {
        if (record.gas_type === 'oxygen') {
            return record.pressure || 'Н/Д';
        }
        return '—';
    };

    // Функція для перевірки чи використовувалось повітря
    const isAirUsed = (record) => {
        return record.gas_type === 'air';
    };

    // Функція для отримання показників лічильника
    const getMeterValue = (value) => {
        return value || 'Н/Д';
    };

    // Функція для розрахунку енергії
    const calculateEnergy = (record) => {
        if (record.start_meter && record.end_meter && parseFloat(record.end_meter) > parseFloat(record.start_meter)) {
            const consumption = parseFloat(record.end_meter) - parseFloat(record.start_meter);
            const energy = (consumption * 120).toFixed(2);
            return `${energy} кВт`;
        }
        return '—';
    };

    // Функція для розрахунку загальної енергії
    const calculateTotalEnergy = (records) => {
        if (!records || records.length === 0) return '0.00';

        const total = records.reduce((sum, record) => {
            if (record.start_meter && record.end_meter && parseFloat(record.end_meter) > parseFloat(record.start_meter)) {
                const consumption = parseFloat(record.end_meter) - parseFloat(record.start_meter);
                return sum + (consumption * 120);
            }
            return sum;
        }, 0);

        return total.toFixed(2);
    };

    // Функція для розрахунку загального часу підготовки
    const calculateTotalPreparationTime = (records) => {
        if (!records || records.length === 0) return 0;
        return records.reduce((sum, record) => sum + (parseInt(record.preparation_time) || 0), 0);
    };

    // Функція для розрахунку загального часу різки
    const calculateTotalCuttingTime = (records) => {
        if (!records || records.length === 0) return 0;
        return records.reduce((sum, record) => sum + (parseInt(record.cutting_time) || 0), 0);
    };

    // Функція для розрахунку загального часу (підготовка + різка)
    const calculateTotalTime = (records) => {
        return calculateTotalPreparationTime(records) + calculateTotalCuttingTime(records);
    };

    // Функція для групування порізаних файлів по артикулах
    const groupCutFilesByArticle = (cutFiles, jobDetailsMap) => {
        const grouped = {};

        cutFiles.forEach(file => {
            let articleKey = null;
            let articleInfo = null;

            // Якщо є detail_id, шукаємо артикул
            if (file.detail_id && jobDetailsMap) {
                const detail = jobDetailsMap[file.detail_id];
                if (detail && detail.articles) {
                    articleKey = detail.articles.article_id;
                    articleInfo = {
                        article_id: detail.articles.article_id,
                        article_num: detail.articles.article_num,
                        article_name: detail.articles.name
                    };
                }
            }

            // Якщо є article_id
            if (!articleKey && file.article_id && jobDetailsMap) {
                const detail = Object.values(jobDetailsMap).find(d =>
                    d.articles?.article_id === file.article_id
                );
                if (detail && detail.articles) {
                    articleKey = detail.articles.article_id;
                    articleInfo = {
                        article_id: detail.articles.article_id,
                        article_num: detail.articles.article_num,
                        article_name: detail.articles.name
                    };
                }
            }

            // Якщо є article_num
            if (!articleKey && file.article_num && jobDetailsMap) {
                const detail = Object.values(jobDetailsMap).find(d =>
                    d.articles?.article_num === file.article_num
                );
                if (detail && detail.articles) {
                    articleKey = detail.articles.article_id;
                    articleInfo = {
                        article_id: detail.articles.article_id,
                        article_num: detail.articles.article_num,
                        article_name: detail.articles.name
                    };
                }
            }

            // Якщо не знайшли, використовуємо 'unknown'
            if (!articleKey) {
                articleKey = 'unknown';
                articleInfo = {
                    article_id: null,
                    article_num: file.article_num || 'Н/Д',
                    article_name: file.article_name || 'Невідомий артикул'
                };
            }

            if (!grouped[articleKey]) {
                grouped[articleKey] = {
                    article_id: articleInfo.article_id,
                    article_num: articleInfo.article_num,
                    article_name: articleInfo.article_name,
                    total_quantity: 0,
                    files: []
                };
            }

            grouped[articleKey].total_quantity += (file.quantity || 1);
            grouped[articleKey].files.push(file);
        });

        return Object.values(grouped);
    };

    // Функція для підрахунку загальної кількості порізаних деталей по артикулах
    const calculateTotalCutByArticle = (records, jobDetailsMap) => {
        const totals = {};

        // Спочатку створюємо записи для всіх артикулів зі специфікації
        if (jobDetailsMap) {
            Object.values(jobDetailsMap).forEach(detail => {
                const articleId = detail.articles?.article_id;
                const articleNum = detail.articles?.article_num;
                const key = articleId || articleNum;
                if (key) {
                    totals[key] = {
                        article_id: articleId,
                        article_num: articleNum,
                        article_name: detail.articles?.name || 'Невідомий артикул',
                        quantity: 0,
                        planned: detail.quantity_planned || 0
                    };
                }
            });
        }

        // Додаємо порізані кількості
        records.forEach(record => {
            const cutFiles = getCutFiles(record);
            cutFiles.forEach(file => {
                let matchedKey = null;

                // Шукаємо відповідний артикул
                for (const [key, total] of Object.entries(totals)) {
                    if ((file.article_id && total.article_id === file.article_id) ||
                        (file.article_num && total.article_num === file.article_num)) {
                        matchedKey = key;
                        break;
                    }
                }

                if (matchedKey && totals[matchedKey]) {
                    totals[matchedKey].quantity += (file.quantity || 1);
                }
            });
        });

        // Повертаємо тільки ті артикули, які є в специфікації
        return Object.values(totals);
    };

    // Функція для отримання найпізнішої дати різки
    const getLatestCutDate = (jobId) => {
        const logs = cuttingLogs[jobId] || [];
        if (logs.length === 0) return null;

        let latestDate = null;

        logs.forEach(log => {
            if (log.cut_date) {
                try {
                    const logDate = new Date(log.cut_date);
                    if (!isNaN(logDate.getTime())) {
                        if (!latestDate || logDate > latestDate) {
                            latestDate = logDate;
                        }
                    }
                } catch (error) {
                    console.warn(`Помилка парсингу дати для логу ${log.log_entry_id}:`, log.cut_date);
                }
            }
        });

        return latestDate;
    };

    const getCutDateTimestamp = (jobId) => {
        const date = getLatestCutDate(jobId);
        return date ? date.getTime() : 0;
    };

    const sortJobsByCutDate = (jobsList, order) => {
        const jobsWithDates = jobsList.map(job => ({
            ...job,
            cutDateTimestamp: getCutDateTimestamp(job.job_id)
        }));

        const sortedJobs = [...jobsWithDates].sort((a, b) => {
            if (a.cutDateTimestamp === 0 && b.cutDateTimestamp === 0) return 0;
            if (a.cutDateTimestamp === 0) return 1;
            if (b.cutDateTimestamp === 0) return -1;

            if (order === 'desc') {
                return b.cutDateTimestamp - a.cutDateTimestamp;
            } else {
                return a.cutDateTimestamp - b.cutDateTimestamp;
            }
        });

        return sortedJobs.map(({ cutDateTimestamp, ...job }) => job);
    };

    const getSortedAndPaginatedJobs = () => {
        let sortedJobs = [...jobs];
        if (sortByCutDate) {
            sortedJobs = sortJobsByCutDate(sortedJobs, sortByCutDate);
        }
        return sortedJobs.slice(
            (currentPage - 1) * itemsPerPage,
            currentPage * itemsPerPage
        );
    };

    const currentJobs = getSortedAndPaginatedJobs();

    const openFileViewer = (fileUrl, fileName) => {
        setSelectedFile({
            url: fileUrl,
            name: fileName || `Звіт.pdf`
        });
        setShowFileViewer(true);
    };

    const closeFileViewer = () => {
        setShowFileViewer(false);
        setSelectedFile(null);
    };

    // ==================== ЕФЕКТИ ====================

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

        const sortFromUrl = searchParams.get('sort_cut_date');
        if (sortFromUrl) {
            setSortByCutDate(sortFromUrl);
        }

        if (newFilters.expanded) {
            const expandedId = parseInt(newFilters.expanded);
            if (!isNaN(expandedId)) {
                setExpandedJobs(new Set([expandedId]));
            }
        } else {
            setExpandedJobs(new Set());
        }
    }, [searchParams]);

    useEffect(() => {
        if (initialLoad) {
            fetchJobs();
            setInitialLoad(false);
        }
    }, [initialLoad]);

    useEffect(() => {
        const hasActiveFilters = searchParams.get('job_id') ||
            searchParams.get('status') ||
            searchParams.get('article_name') ||
            searchParams.get('article_num') ||
            searchParams.get('material_type') ||
            searchParams.get('thickness') ||
            searchParams.get('file_name') ||
            searchParams.get('operator_name') ||
            searchParams.get('date_from') ||
            searchParams.get('date_to');

        setFiltersApplied(!!hasActiveFilters);
    }, [searchParams]);

    // ==================== ФУНКЦІЇ ЗАВАНТАЖЕННЯ ДАНИХ ====================

    const fetchJobs = async () => {
        try {
            setLoading(true);

            const currentFilters = {
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
                expanded: searchParams.get('expanded') || '',
                sort_cut_date: searchParams.get('sort_cut_date') || '',
                page: searchParams.get('page') || '1'
            };

            const pageFromUrl = parseInt(currentFilters.page);
            if (!isNaN(pageFromUrl) && pageFromUrl >= 1) {
                setCurrentPage(pageFromUrl);
            }

            let query = supabase
                .from('cutting_jobs')
                .select('*')
                .order('creation_date', { ascending: false });

            if (currentFilters.job_id) {
                query = query.eq('job_id', parseInt(currentFilters.job_id));
            }
            if (currentFilters.status) {
                query = query.eq('status', currentFilters.status);
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

            const jobIds = jobsData.map(job => job.job_id);

            const [detailsResult, programsResult, logsResult] = await Promise.all([
                fetchJobDetails(jobIds),
                fetchCuttingPrograms(jobIds),
                fetchAllCuttingLogs()
            ]);

            let filteredJobs = await filterJobsByAdditionalCriteria(jobsData, detailsResult, logsResult, programsResult, currentFilters);

            setJobs(filteredJobs);

            const detailsMap = {};
            const logsMap = {};
            const programsMap = {};

            filteredJobs.forEach(job => {
                const jobId = job.job_id;
                detailsMap[jobId] = detailsResult.filter(detail => detail.job_id === jobId);
                programsMap[jobId] = programsResult.filter(program => program.job_id === jobId);

                const jobProgramIds = programsMap[jobId].map(program => program.program_id);
                logsMap[jobId] = logsResult.filter(log => jobProgramIds.includes(log.program_id));
            });

            setJobDetails(detailsMap);
            setCuttingLogs(logsMap);
            setCuttingPrograms(programsMap);

        } catch (error) {
            console.error('Помилка завантаження даних:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchAllCuttingLogs = async () => {
        try {
            const { data, error } = await supabase
                .from('cutting_log')
                .select('*');

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Помилка завантаження всіх логів:', error);
            return [];
        }
    };

    const fetchJobDetails = async (jobIds) => {
        try {
            const { data, error } = await supabase
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

    const fetchCuttingPrograms = async (jobIds) => {
        try {
            const { data, error } = await supabase
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

            if (currentFilters.article_name && matches) {
                matches = jobDetails.some(detail =>
                    detail.articles?.name?.toLowerCase().includes(currentFilters.article_name.toLowerCase())
                );
                if (!matches) return false;
            }

            if (currentFilters.article_num && matches) {
                matches = jobDetails.some(detail => {
                    const articleNum = detail.articles?.article_num;
                    if (!articleNum) return false;
                    return articleNum.toLowerCase().includes(currentFilters.article_num.toLowerCase());
                });
                if (!matches) return false;
            }

            if (currentFilters.material_type && matches) {
                matches = jobDetails.some(detail =>
                    detail.articles?.material_type?.toLowerCase().includes(currentFilters.material_type.toLowerCase())
                );
                if (!matches) return false;
            }

            if (currentFilters.thickness && matches) {
                matches = jobDetails.some(detail =>
                    detail.articles?.thickness?.toString().includes(currentFilters.thickness)
                );
                if (!matches) return false;
            }

            if (currentFilters.file_name && matches) {
                matches = jobPrograms.some(program =>
                    program.file_name?.toLowerCase().includes(currentFilters.file_name.toLowerCase())
                );
                if (!matches) return false;
            }

            if (currentFilters.operator_name && matches) {
                matches = jobLogs.some(log =>
                    log.operator_name?.toLowerCase().includes(currentFilters.operator_name.toLowerCase())
                );
                if (!matches) return false;
            }

            if ((currentFilters.date_from || currentFilters.date_to) && matches) {
                const hasMatchingCutDate = jobLogs.some(log => {
                    const cutDate = log.cut_date;
                    if (!cutDate) return false;

                    const logDate = new Date(cutDate);
                    logDate.setHours(0, 0, 0, 0);

                    let dateMatch = true;

                    if (currentFilters.date_from) {
                        const fromDate = new Date(currentFilters.date_from);
                        fromDate.setHours(0, 0, 0, 0);
                        dateMatch = dateMatch && logDate >= fromDate;
                    }

                    if (currentFilters.date_to) {
                        const toDate = new Date(currentFilters.date_to);
                        toDate.setHours(23, 59, 59, 999);
                        dateMatch = dateMatch && logDate <= toDate;
                    }

                    return dateMatch;
                });

                if (!hasMatchingCutDate) {
                    matches = false;
                }
            }

            return matches;
        });
    };

    // ==================== ФУНКЦІЇ ФІЛЬТРАЦІЇ ТА УПРАВЛІННЯ ====================

    const totalItems = jobs.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    const goToPage = (page) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
            window.scrollTo({ top: 0, behavior: 'smooth' });
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

    const applyFilter = (key, value) => {
        const params = new URLSearchParams(searchParams);

        if (value && value !== '') {
            params.set(key, value);
        } else {
            params.delete(key);
        }

        if (sortByCutDate) {
            params.set('sort_cut_date', sortByCutDate);
        }

        setSearchParams(params);
        setCurrentPage(1);
        setFiltersApplied(true);
        fetchJobs();
    };

    const handleSortByCutDate = (order = 'desc') => {
        const newSortOrder = sortByCutDate === order ? '' : order;
        setSortByCutDate(newSortOrder);
        setCurrentPage(1);

        const params = new URLSearchParams(searchParams);
        if (newSortOrder) {
            params.set('sort_cut_date', newSortOrder);
        } else {
            params.delete('sort_cut_date');
        }
        setSearchParams(params);
    };

    const handleInputChange = (key, value) => {
        setDisplayFilters(prev => ({
            ...prev,
            [key]: value
        }));
    };

    const handleFilterApply = (key, value) => {
        applyFilter(key, value);
    };

    const createJobLink = (jobId, expand = true) => {
        const params = new URLSearchParams();
        params.set('job_id', jobId);
        if (expand) {
            params.set('expanded', jobId);
        }
        return `/cutting-log-app/#/view/jobs?id=${jobId}`;
    };

    const toggleJobExpansion = (jobId) => {
        const newExpanded = new Set(expandedJobs);
        if (newExpanded.has(jobId)) {
            newExpanded.delete(jobId);
        } else {
            newExpanded.add(jobId);
        }
        setExpandedJobs(newExpanded);

        const params = new URLSearchParams(searchParams);
        if (newExpanded.has(jobId)) {
            params.set('expanded', jobId.toString());
        } else {
            params.delete('expanded');
        }

        if (currentPage > 1) {
            params.set('page', currentPage.toString());
        } else {
            params.delete('page');
        }

        setSearchParams(params);
    };

    const clearFilters = () => {
        const params = new URLSearchParams();
        setSearchParams(params);
        setCurrentPage(1);
        setFiltersApplied(false);
        setSortByCutDate('');
        fetchJobs();
    };

    const copyCurrentLink = () => {
        const currentUrl = `${window.location.origin}/cutting-log-app/#/view/information?${searchParams.toString()}`;
        navigator.clipboard.writeText(currentUrl)
            .then(() => alert('Посилання скопійовано в буфер обміну!'))
            .catch(() => alert('Помилка копіювання посилання'));
    };

    const calculateJobTotals = (details) => {
        return details.reduce((totals, detail) => ({
            planned: totals.planned + (detail.quantity_planned || 0),
            actual: totals.actual + (detail.quantity_actual || 0),
            rejection: totals.rejection + (detail.rejection_count || 0)
        }), { planned: 0, actual: 0, rejection: 0 });
    };

    const getJobPrograms = (jobId) => {
        const programs = cuttingPrograms[jobId] || [];
        return programs.map(program => program.file_name).filter(Boolean);
    };

    const getJobReportFiles = (jobId) => {
        const logs = cuttingLogs[jobId] || [];
        const reportFiles = [];

        logs.forEach(log => {
            const gases = getGasesFromLog(log);

            if (gases.length > 0) {
                gases.forEach((gas, index) => {
                    if (gas.file_url) {
                        reportFiles.push({
                            url: gas.file_url,
                            name: gas.file_name || `Звіт_${jobId}_${index}.pdf`,
                            logEntryId: log.log_entry_id,
                            gasType: gas.type,
                            date: log.end_time || log.start_time
                        });
                    }
                });
            } else if (log.report_url) {
                reportFiles.push({
                    url: log.report_url,
                    name: extractFileNameFromUrl(log.report_url) || `Звіт_${jobId}.pdf`,
                    logEntryId: log.log_entry_id,
                    gasType: null,
                    date: log.end_time || log.start_time
                });
            }
        });

        return reportFiles;
    };

    // ==================== РЕНДЕРИНГ ====================

    if (loading && initialLoad) return <div className="loading">Завантаження...</div>;

    return (
        <div className="cutting-journal">
            <div className="journal-header">
                <h1>Журнал різки</h1>
                <button onClick={copyCurrentLink} className="journal-copy-link">
                    📋 Копіювати посилання з фільтрами
                </button>
            </div>

            {/* Фільтри (залишаються без змін) */}
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
                            <option value="Частково виконано">Частково виконано</option>
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
                        <label>Дата різки від:</label>
                        <input
                            type="date"
                            value={displayFilters.date_from}
                            onChange={(e) => handleInputChange('date_from', e.target.value)}
                            onBlur={(e) => handleFilterApply('date_from', e.target.value)}
                            className="filter-input"
                            title="Фільтр за датою різки (cut_date)"
                        />
                    </div>

                    <div className="filter-field">
                        <label>Дата різки до:</label>
                        <input
                            type="date"
                            value={displayFilters.date_to}
                            onChange={(e) => handleInputChange('date_to', e.target.value)}
                            onBlur={(e) => handleFilterApply('date_to', e.target.value)}
                            className="filter-input"
                            title="Фільтр за датою різки (cut_date)"
                        />
                    </div>
                </div>

                <div className="journal-controls">
                    <div className="results-summary">
                        Знайдено: {totalItems} завдань
                        {filtersApplied && <span className="filters-active"> (фільтри застосовані)</span>}
                        {loading && <span className="loading-indicator"> (оновлення...)</span>}
                    </div>
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

                    <div className="controls-group">
                        <div className="action-buttons">
                            <div className="sort-buttons">
                                <button
                                    onClick={() => handleSortByCutDate('desc')}
                                    className={`action-btn sort-btn ${sortByCutDate === 'desc' ? 'sort-active' : ''}`}
                                    title="Сортувати від нових до старих за датою різки"
                                >
                                    {sortByCutDate === 'desc' ? '✅' : '🔬'} Новіші різки
                                </button>
                                <button
                                    onClick={() => handleSortByCutDate('asc')}
                                    className={`action-btn sort-btn ${sortByCutDate === 'asc' ? 'sort-active' : ''}`}
                                    title="Сортувати від старих до нових за датою різки"
                                >
                                    {sortByCutDate === 'asc' ? '✅' : '🔬'} Старіші різки
                                </button>
                            </div>

                            <button onClick={fetchJobs} className="action-btn refresh-btn">
                                🔄 Оновити дані
                            </button>
                            <button className="action-btn clear-filters-btn" onClick={clearFilters}>
                                🗑️ Очистити всі фільтри
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
                            const jobDetailsMap = details.reduce((acc, detail) => {
                                acc[detail.job_detail_id] = detail;
                                return acc;
                            }, {});
                            const workRecords = getWorkRecords(logs, jobDetailsMap);
                            const programs = getJobPrograms(job.job_id);
                            const totals = calculateJobTotals(details);
                            const isExpanded = expandedJobs.has(job.job_id);
                            const reportFiles = getJobReportFiles(job.job_id);
                            const totalEnergy = calculateTotalEnergy(workRecords);
                            const totalPreparationTime = calculateTotalPreparationTime(workRecords);
                            const totalCuttingTime = calculateTotalCuttingTime(workRecords);
                            const totalTime = calculateTotalTime(workRecords);
                            const cutSummary = calculateTotalCutByArticle(workRecords, jobDetailsMap);

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
                                                {/*<span className="date-due">*/}
                                                {/*    Термін: {new Date(job.due_date).toLocaleDateString('uk-UA')}*/}
                                                {/*</span>*/}
                                            </span>

                                            {/*{programs.length > 0 && (*/}
                                            {/*    <span className="job-files">*/}
                                            {/*        Файл створено ✅*/}
                                            {/*    </span>*/}
                                            {/*)}*/}

                                            {reportFiles.length > 0 && (
                                                <span className="job-reports">
                                                    📎 Звіти: {reportFiles.length}
                                                </span>
                                            )}
                                        </div>

                                        <div className="job-summary" style={{ alignItems: 'center' }}>
                                            <span className="summary-item">План: {totals.planned}</span>
                                            <span className="summary-item">Факт: {totals.actual}</span>
                                            <span className="summary-item">Брак: {totals.rejection}</span>
                                            <span className="summary-item">Енергія: {totalEnergy} кВт</span>
                                            <span className="summary-item">Час: {totalTime} хв</span>
                                        </div>
                                    </div>

                                    {/* Деталі завдання (при розгортанні) */}
                                    {isExpanded && (
                                        <div className="job-card-details">
                                            {/* Файли звітів */}
                                            {reportFiles.length > 0 && (
                                                <div className="reports-panel">
                                                    <h4 className="panel-title">Файли звітів</h4>
                                                    <div className="reports-list">
                                                        {reportFiles.map((file, index) => (
                                                            <div key={file.logEntryId || index} className="report-file-item">
                                                                <div className="report-file-info">
                                                                    <span className="report-file-name">📎 {file.name}
                                                                        {file.gasType && (
                                                                            <span className="report-gas-type">
                                                                                ({file.gasType === 'oxygen' ? 'Кисень' : 'Повітря'})
                                                                            </span>
                                                                        )}
                                                                        {file.date && (
                                                                            <span className="report-date">
                                                                                {new Date(file.date).toLocaleDateString('uk-UA')}
                                                                            </span>
                                                                        )}
                                                                    </span>
                                                                </div>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        openFileViewer(file.url, file.name);
                                                                    }}
                                                                    className="view-report-button"
                                                                >
                                                                    Переглянути
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

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
                                                                                href={getDownloadUrl() + detail.articles?.file_url}
                                                                                target="_blank"
                                                                                rel="noopener noreferrer"
                                                                                className="file-link"
                                                                            >
                                                                                📎 Файл
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
                                                                <td className="total-energy">{totalEnergy} кВт</td>
                                                            </tr>
                                                            </tfoot>
                                                        </table>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Зведення по артикулах */}
                                            {cutSummary.length > 0 && (
                                                <div className="cut-summary-panel">
                                                    <h4 className="panel-title">📊 Зведення по артикулах</h4>
                                                    <div className="table-wrapper">
                                                        <table className="cut-summary-table">
                                                            <thead>
                                                            <tr>
                                                                <th>Артикул</th>
                                                                <th>Назва</th>
                                                                <th>План</th>
                                                                <th>Порізано</th>
                                                                <th>Виконання</th>
                                                            </tr>
                                                            </thead>
                                                            <tbody>
                                                            {cutSummary.map((summary, idx) => {
                                                                const percentage = summary.planned > 0
                                                                    ? Math.round((summary.quantity / summary.planned) * 100)
                                                                    : 0;

                                                                return (
                                                                    <tr key={idx}>
                                                                        <td className="article-number-cell">
                                                                            <strong>{summary.article_num || 'Н/Д'}</strong>
                                                                        </td>
                                                                        <td className="article-name-cell">{summary.article_name}</td>
                                                                        <td className="planned-cell">{summary.planned}</td>
                                                                        <td className={`cut-cell ${summary.quantity >= summary.planned ? 'completed' : 'in-progress'}`}>
                                                                            {summary.quantity}
                                                                        </td>
                                                                        <td className="percentage-cell">
                                                                            <div className="percentage-bar">
                                                                                <div
                                                                                    className="percentage-fill"
                                                                                    style={{ width: `${percentage}%` }}
                                                                                ></div>
                                                                                <span className="percentage-text">{percentage}%</span>
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Показники роботи */}
                                            {workRecords.length > 0 && (
                                                <div className="logs-panel">
                                                    <h4 className="panel-title">Показники роботи</h4>
                                                    <div className="table-wrapper">
                                                        <table className="logs-data-table">
                                                            <thead>
                                                            <tr>
                                                                <th>Дата</th>
                                                                <th>Підготовка (хв)</th>
                                                                <th>Різка (хв)</th>
                                                                <th>Тиск кисню (бар)</th>
                                                                <th>Повітря</th>
                                                                <th>Початковий <br/> лічильник</th>
                                                                <th>Кінцевий <br/> лічильник</th>
                                                                <th>Енергія (кВт)</th>
                                                                <th>Порізані деталі</th>
                                                                <th>Файл звіту</th>
                                                            </tr>
                                                            </thead>
                                                            <tbody>
                                                            {workRecords.map((record, idx) => {
                                                                const cutFiles = getCutFiles(record);
                                                                const enrichedCutFiles = enrichCutFilesWithArticles(cutFiles, jobDetailsMap);
                                                                const groupedFiles = groupCutFilesByArticle(enrichedCutFiles, jobDetailsMap);

                                                                return (
                                                                    <tr key={record.id || idx}>
                                                                        <td className="cut-date">
                                                                            {record.cut_date ? new Date(record.cut_date).toLocaleDateString('uk-UA') : 'Н/Д'}
                                                                        </td>
                                                                        <td className="prep-time">{record.preparation_time || '0'}</td>
                                                                        <td className="cut-time">{record.cutting_time || '0'}</td>
                                                                        <td className="oxygen-pressure">
                                                                            {getGasPressure(record)}
                                                                        </td>
                                                                        <td className="air-pressure">
                                                                            {isAirUsed(record) ? '✅' : '—'}
                                                                        </td>
                                                                        <td className="start-meter">{getMeterValue(record.start_meter)}</td>
                                                                        <td className="end-meter">{getMeterValue(record.end_meter)}</td>
                                                                        <td className="energy-consumption">{calculateEnergy(record)}</td>
                                                                        <td className="cut-files-cell">
                                                                            {groupedFiles.length > 0 ? (
                                                                                <div className="cut-files-list">
                                                                                    {groupedFiles.map((group, groupIdx) => (
                                                                                        <div key={groupIdx} className="cut-file-group">
                                                                                            <div className="cut-file-article">
                                                                                                <strong>{group.article_num || 'Н/Д'}</strong>
                                                                                                <span className="cut-file-article-name">
                                                                                                        {group.article_name}
                                                                                                    </span>
                                                                                                <span className="cut-file-quantity">
                                                                                                        {group.total_quantity} шт
                                                                                                    </span>
                                                                                            </div>
                                                                                            {group.files.length > 1 && (
                                                                                                <div className="cut-file-subitems">
                                                                                                    {group.files.map((file, fileIdx) => (
                                                                                                        <div key={fileIdx} className="cut-file-subitem">
                                                                                                            {file.file_name && (
                                                                                                                <span className="cut-file-subname">
                                                                                                                        📄 {file.file_name}
                                                                                                                    </span>
                                                                                                            )}
                                                                                                        </div>
                                                                                                    ))}
                                                                                                </div>
                                                                                            )}
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            ) : '—'}
                                                                        </td>
                                                                        <td className="file-cell">
                                                                            {record.file_url ? (
                                                                                <button
                                                                                    onClick={() => openFileViewer(record.file_url, record.file_name)}
                                                                                    className="view-file-btn"
                                                                                    title="Переглянути файл звіту"
                                                                                >
                                                                                    📄
                                                                                </button>
                                                                            ) : (
                                                                                '—'
                                                                            )}
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                            </tbody>
                                                            <tfoot>
                                                            <tr className="logs-totals-row">
                                                                <td colSpan="4" className="totals-label">Загальний час підготовки: {totalPreparationTime} хв</td>
                                                                <td colSpan="4" className="totals-label">Загальний час різки: {totalCuttingTime} хв</td>
                                                                <td className="total-energy">{totalEnergy} кВт</td>
                                                                <td colSpan="1"></td>
                                                            </tr>
                                                            </tfoot>
                                                        </table>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Програми різання */}
                                            {/*{cuttingPrograms[job.job_id]?.length > 0 && (*/}
                                            {/*    <div className="programs-panel">*/}
                                            {/*        <h4 className="panel-title">Програми різання</h4>*/}
                                            {/*        <div className="programs-list">*/}
                                            {/*            {cuttingPrograms[job.job_id].map((program) => (*/}
                                            {/*                <div key={program.program_id} className="program-item">*/}
                                            {/*                    <span className="program-file">*/}
                                            {/*                        {program.file_name}*/}
                                            {/*                    </span>*/}
                                            {/*                    <span className="program-created">*/}
                                            {/*                        Створено: {new Date(program.date_created).toLocaleDateString('uk-UA')}*/}
                                            {/*                    </span>*/}
                                            {/*                </div>*/}
                                            {/*            ))}*/}
                                            {/*        </div>*/}
                                            {/*    </div>*/}
                                            {/*)}*/}

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

            {/* Модальне вікно для перегляду файлів */}
            {showFileViewer && selectedFile && (
                <FileViewer
                    fileUrl={selectedFile.url}
                    fileName={selectedFile.name}
                    onClose={closeFileViewer}
                />
            )}
        </div>
    );
};

export default JobsTableWithDetails;