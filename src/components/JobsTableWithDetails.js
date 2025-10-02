// JobsTableWithDetails.js
import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import './JobsTableWithDetails.css';

const JobsTableWithDetails = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [jobs, setJobs] = useState([]);
  const [expandedJobs, setExpandedJobs] = useState(new Set());
  const [jobDetails, setJobDetails] = useState({});
  const [cuttingLogs, setCuttingLogs] = useState({});
  const [cuttingPrograms, setCuttingPrograms] = useState({});
  const [loading, setLoading] = useState(true);
  
  // Ініціалізація фільтрів з URL параметрів
  const [filters, setFilters] = useState({
    job_id: searchParams.get('job_id') || '',
    status: searchParams.get('status') || '',
    article_name: searchParams.get('article_name') || '',
    material_type: searchParams.get('material_type') || '',
    thickness: searchParams.get('thickness') || '',
    file_name: searchParams.get('file_name') || '',
    operator_name: searchParams.get('operator_name') || '',
    date_from: searchParams.get('date_from') || '',
    date_to: searchParams.get('date_to') || '',
    expanded: searchParams.get('expanded') || ''
  });

  // Оновлення URL при зміні фільтрів
  useEffect(() => {
    const params = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value && value !== '') {
        params.set(key, value);
      }
    });
    
    setSearchParams(params);
  }, [filters, setSearchParams]);

  // Завантаження завдань
  useEffect(() => {
    fetchJobs();
  }, []); // Залежність від searchParams

  // Функція для створення посилання з фільтрами
  const createFilterLink = (newFilters = {}) => {
    const params = new URLSearchParams(searchParams);
    
    Object.entries(newFilters).forEach(([key, value]) => {
      if (value && value !== '') {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });
    
    return `/view/information?${params.toString()}`;
  };

  // Функція для створення посилання на конкретне завдання
  const createJobLink = (jobId, expand = true) => {
    const params = new URLSearchParams(searchParams);
    
    // Очищаємо фільтри для конкретного завдання
    params.set('job_id', jobId);
    if (expand) {
      params.set('expanded', jobId);
    }
    
    // Видаляємо інші фільтри для чистоти посилання
    ['status', 'article_name', 'material_type', 'thickness', 'file_name', 'operator_name', 'date_from', 'date_to']
      .forEach(key => params.delete(key));
    
    return `/view/information?${params.toString()}`;
  };

  const fetchJobs = async () => {
    try {
      setLoading(true);

      // Отримуємо актуальні фільтри з URL
      const currentFilters = {
        job_id: searchParams.get('job_id') || '',
        status: searchParams.get('status') || '',
        article_name: searchParams.get('article_name') || '',
        material_type: searchParams.get('material_type') || '',
        thickness: searchParams.get('thickness') || '',
        file_name: searchParams.get('file_name') || '',
        operator_name: searchParams.get('operator_name') || '',
        date_from: searchParams.get('date_from') || '',
        date_to: searchParams.get('date_to') || '',
        expanded: searchParams.get('expanded') || ''
      };

      // Оновлюємо локальний стан фільтрів
      setFilters(currentFilters);

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

      // Фільтрація завдань за додатковими фільтрами
      let filteredJobs = jobsData;
      if (currentFilters.article_name || currentFilters.material_type || currentFilters.thickness || currentFilters.file_name || currentFilters.operator_name) {
        filteredJobs = await filterJobsByAdditionalCriteria(jobsData, detailsResult, logsResult, programsResult, currentFilters);
      }

      setJobs(filteredJobs);

      // Автоматичне розгортання завдання з URL параметра
      if (currentFilters.expanded) {
        const expandedId = parseInt(currentFilters.expanded);
        if (!isNaN(expandedId)) {
          setExpandedJobs(new Set([expandedId]));
        }
      }

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

  // Решта функцій залишаються незмінними (fetchJobDetails, fetchCuttingLogs, fetchCuttingPrograms, filterJobsByAdditionalCriteria)
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

  const fetchCuttingLogs = async (programIds) => {
    try {
      if (!programIds || programIds.length === 0) return [];

      const { data, error } = await supabase
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

      // Фільтр по назві артикулу
      if (currentFilters.article_name && matches) {
        matches = jobDetails.some(detail =>
          detail.articles?.name?.toLowerCase().includes(currentFilters.article_name.toLowerCase())
        );
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

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const clearFilters = () => {
    const params = new URLSearchParams();
    setSearchParams(params);
    setFilters({
      job_id: '',
      status: '',
      article_name: '',
      material_type: '',
      thickness: '',
      file_name: '',
      operator_name: '',
      date_from: '',
      date_to: '',
      expanded: ''
    });
  };

  // Копіювання посилання з поточними фільтрами
  const copyCurrentLink = () => {
    const currentUrl = `${window.location.origin}/view/information?${searchParams.toString()}`;
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
    }), { planned: 0, actual: 0, rejection: 0 });
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
    const sortedLogs = [...logs].sort((a, b) =>
      new Date(b.start_time) - new Date(a.start_time)
    );

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

  if (loading) return <div className="loading">Завантаження...</div>;

  return (
    <div className="jobs-table-container">
      <h2>Завдання на Різання</h2>

      {/* Кнопка копіювання посилання */}
      <div className="link-actions">
        <button onClick={copyCurrentLink} className="copy-link-btn">
          📋 Копіювати посилання з фільтрами
        </button>
      </div>

      {/* Фільтри */}
      <div className="filters-section">
        <div className="filter-row">
          <div className="filter-group">
            <label>ID Завдання:</label>
            <input
              type="number"
              value={filters.job_id}
              onChange={(e) => handleFilterChange('job_id', e.target.value)}
              placeholder="Фільтр по ID"
            />
          </div>

          <div className="filter-group">
            <label>Статус:</label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
            >
              <option value="">Всі статуси</option>
              <option value="В роботі">В роботі</option>
              <option value="Виконано">Виконано</option>
              <option value="В черзі">В черзі</option>
              <option value="Скасовано">Скасовано</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Назва артикулу:</label>
            <input
              type="text"
              value={filters.article_name}
              onChange={(e) => handleFilterChange('article_name', e.target.value)}
              placeholder="Пошук по назві"
            />
          </div>

          <div className="filter-group">
            <label>Матеріал:</label>
            <input
              type="text"
              value={filters.material_type}
              onChange={(e) => handleFilterChange('material_type', e.target.value)}
              placeholder="Тип матеріалу"
            />
          </div>
        </div>

        <div className="filter-row">
          <div className="filter-group">
            <label>Товщина (мм):</label>
            <input
              type="number"
              step="0.1"
              value={filters.thickness}
              onChange={(e) => handleFilterChange('thickness', e.target.value)}
              placeholder="Фільтр по товщині"
            />
          </div>

          <div className="filter-group">
            <label>Назва файлу:</label>
            <input
              type="text"
              value={filters.file_name}
              onChange={(e) => handleFilterChange('file_name', e.target.value)}
              placeholder="Пошук по файлу"
            />
          </div>

          <div className="filter-group">
            <label>Оператор:</label>
            <input
              type="text"
              value={filters.operator_name}
              onChange={(e) => handleFilterChange('operator_name', e.target.value)}
              placeholder="Ім'я оператора"
            />
          </div>

          <div className="filter-group">
            <label>Дата від:</label>
            <input
              type="date"
              value={filters.date_from}
              onChange={(e) => handleFilterChange('date_from', e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label>Дата до:</label>
            <input
              type="date"
              value={filters.date_to}
              onChange={(e) => handleFilterChange('date_to', e.target.value)}
            />
          </div>
        </div>

        <div className="filter-actions">
          <button className="clear-filters" onClick={clearFilters}>
            Очистити фільтри
          </button>

          <button className="refresh-btn" onClick={fetchJobs}>
            Оновити
          </button>
        </div>
      </div>

      {/* Таблиця завдань */}
      <div className="table-wrapper">
        {jobs.length === 0 ? (
          <div className="no-data">Завдання не знайдені</div>
        ) : (
          <div className="jobs-list">
            {jobs.map((job) => {
              const details = jobDetails[job.job_id] || [];
              const logs = cuttingLogs[job.job_id] || [];
              const programs = getJobPrograms(job.job_id);
              const latestLog = getLatestLog(job.job_id);
              const metrics = calculateCuttingMetrics(latestLog);
              const totals = calculateJobTotals(details);
              const isExpanded = expandedJobs.has(job.job_id);

              return (
                <div key={job.job_id} className="job-item">
                  {/* Заголовок завдання */}
                  <div
                    className="job-header"
                    onClick={() => toggleJobExpansion(job.job_id)}
                  >
                    <div className="job-main-info">
                      <span className="expand-icon">
                        {isExpanded ? '▼' : '►'}
                      </span>
                      <span className="job-id">
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
                      <span className={`status-badge status-${job.status.replace(' ', '-')}`}>
                        {job.status}
                      </span>
                      <span className="job-date">
                        {"Завдання створенно: " + new Date(job.creation_date).toLocaleDateString('uk-UA')}
                      </span>
                      <span className="job-date">
                        {"Заплановано на: " + new Date(job.due_date).toLocaleDateString('uk-UA')}
                      </span>
                      {programs.length > 0 && (
                        <span className="job-files">
                          Файли: {programs.join(', ')}
                        </span>
                      )}
                    </div>

                    <div className="job-totals">
                      <span>План: {totals.planned}</span>
                      <span>Факт: {totals.actual}</span>
                      <span>Брак: {totals.rejection}</span>
                      <span>Деталі: {details.length}</span>
                      {/* {logs.length > 0 && (
                        <span>Записи: {logs.length}</span>
                      )} */}
                    </div>
                  </div>

                  {/* Деталі завдання (при розгортанні) */}
                  {isExpanded && (
                    <div className="job-details">
                      {/* Деталі артикулів */}
                      {details.length > 0 && (
                        <div className="details-section">
                          <h4>Артикули та деталі</h4>
                          <table className="details-table">
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
                                  <td>{detail.job_detail_id}</td>
                                  <td className="article-info">
                                    <div className="article-name">
                                      {detail.articles?.name || 'Н/Д'}
                                    </div>
                                    {detail.articles?.article_id && (
                                      <div className="article-id">
                                        ID: {detail.articles.article_id}
                                      </div>
                                    )}
                                  </td>
                                  <td>{detail.articles?.thickness || 'Н/Д'} мм</td>
                                  <td>{detail.articles?.material_type || 'Н/Д'}</td>
                                  <td>{detail.quantity_planned}</td>
                                  <td>{detail.quantity_actual}</td>
                                  <td className={detail.rejection_count > 0 ? 'rejection-warning' : ''}>
                                    {detail.rejection_count}
                                  </td>
                                  <td>
                                    {detail.articles?.file_url ? (
                                      <a
                                        href={detail.articles.file_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="file-link"
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
                              <tr className="details-totals">
                                <td colSpan="4">Всього по завданню:</td>
                                <td>{totals.planned}</td>
                                <td>{totals.actual}</td>
                                <td>{totals.rejection}</td>
                                <td>
                                  Ефективність: {totals.planned > 0 ?
                                    Math.round(((totals.actual + totals.rejection) / totals.planned) * 100)
                                    : 0}%
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      )}

                      {/* Логи різання */}
                      {logs.length > 0 && (
                        <div className="logs-section">
                          <h4>Лог різання</h4>
                          <table className="logs-table">
                            <thead>
                              <tr>
                                <th>Програма</th>
                                <th>Оператор</th>
                                <th>Початок вводу даних при різкі</th>
                                <th>Кінець вводу даних при різкі</th>
                                <th>Тривалість підготовки(хв)</th>
                                <th>Тривалість різки(хв)</th>
                                <th>Кисень</th>
                                <th>Повітря</th>
                                <th>Старт лічильник</th>
                                <th>Кінець лічильник</th>
                                <th>Кількість затраченої енергії</th>
                              </tr>
                            </thead>
                            <tbody>
                              {logs.map((log) => {
                                const logMetrics = calculateCuttingMetrics(log);
                                return (
                                  <tr key={log.log_entry_id}>
                                    <td>{getProgramNameForLog(log, job.job_id)}</td>
                                    <td>{logMetrics?.operator_name || 'Н/Д'}</td>

                                    <td style={{fontSize: "10px"}}>
                                      {logMetrics?.start_time ?
                                        new Date(logMetrics.start_time).toLocaleString('uk-UA') : 'Н/Д'
                                      }
                                    </td>

                                    <td style={{fontSize: "10px"}}>
                                      {logMetrics?.end_time ?
                                        new Date(logMetrics.end_time).toLocaleString('uk-UA') : 'Н/Д'
                                      }
                                    </td>
                                    <td>{log?.preparation_time_minutes || 'Н/Д'}</td>
                                    <td>{log?.cutting_time_minutes || 'Н/Д'}</td>
                                    <td>{logMetrics?.oxygen_pressure || 'Н/Д'}</td>
                                    <td>{logMetrics?.air_pressure || 'Н/Д'}</td>
                                    <td>{log.start_meter || 'Н/Д'}</td>
                                    <td>{log.end_meter || 'Н/Д'}</td>
                                    <td className="consumption">
                                      {logMetrics?.consumption > 0 ? logMetrics.consumption.toFixed(2) : 'Н/Д'}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Програми різання */}
                      {cuttingPrograms[job.job_id]?.length > 0 && (
                        <div className="programs-section">
                          <h4>Програми різання</h4>
                          <div className="programs-list">
                            {cuttingPrograms[job.job_id].map((program) => (
                              <div key={program.program_id} className="program-item">
                                <span className="program-name">
                                  {"Ім'я файлу " + program.file_name + " "}
                                </span>
                                <span className="program-date">
                                  {" Дата створення:" + new Date(program.date_created).toLocaleDateString('uk-UA')}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Нотатки завдання */}
                      {job.notes && (
                        <div className="job-notes">
                          <strong>Примітки:</strong> {job.notes}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default JobsTableWithDetails;