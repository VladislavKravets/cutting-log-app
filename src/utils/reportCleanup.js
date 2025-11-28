// utils/reportCleanup.js
import { supabase } from '../supabaseClient';

/**
 * Сервіс для очищення старих звітів
 */
export const ReportCleanupService = {
    /**
     * Видаляє файли звітів старіші за вказану кількість місяців
     * @param {number} monthsAgo - Кількість місяців (за замовчуванням 1)
     */
    async deleteOldReportFiles(monthsAgo = 3) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setMonth(cutoffDate.getMonth() - monthsAgo);

            console.log('🗑️ Пошук файлів звітів старших за:', cutoffDate.toLocaleDateString());

            // Отримуємо всі файли в папці cutting-reports
            const { data: files, error } = await supabase.storage
                .from('reports')
                .list('cutting-reports');

            if (error) {
                console.error('❌ Помилка отримання списку файлів:', error);
                return { success: false, error: error.message };
            }

            if (!files || files.length === 0) {
                console.log('📁 Файлів для видалення не знайдено');
                return { success: true, deletedCount: 0 };
            }

            const filesToDelete = [];

            // Аналізуємо кожен файл
            for (const file of files) {
                const fileInfo = this.extractFileInfo(file.name);
                if (fileInfo && fileInfo.timestamp < cutoffDate.getTime()) {
                    filesToDelete.push({
                        path: `cutting-reports/${file.name}`,
                        name: file.name,
                        created: new Date(fileInfo.timestamp),
                        jobId: fileInfo.jobId
                    });
                }
            }

            console.log(`📋 Знайдено файлів для видалення: ${filesToDelete.length}`);

            // Видаляємо файли
            if (filesToDelete.length > 0) {
                const pathsToDelete = filesToDelete.map(file => file.path);

                const { data, error: deleteError } = await supabase.storage
                    .from('reports')
                    .remove(pathsToDelete);

                if (deleteError) {
                    console.error('❌ Помилка видалення файлів:', deleteError);
                    return { success: false, error: deleteError.message };
                } else {
                    console.log('✅ Видалено старих файлів:', filesToDelete.length);
                    filesToDelete.forEach(file => {
                        console.log(`   - ${file.name} (${file.created.toLocaleDateString()})`);
                    });

                    return {
                        success: true,
                        deletedCount: filesToDelete.length,
                        deletedFiles: filesToDelete
                    };
                }
            }

            return { success: true, deletedCount: 0 };

        } catch (error) {
            console.error('❌ Помилка видалення старих файлів:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Оновлює записи в базі даних, видаляючи посилання на старі звіти
     * @param {number} monthsAgo - Кількість місяців (за замовчуванням 1)
     */
    async deleteOldReportRecords(monthsAgo = 3) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setMonth(cutoffDate.getMonth() - monthsAgo);

            console.log('🗑️ Пошук записів звітів старших за:', cutoffDate.toLocaleDateString());

            // Знаходимо записи зі звітами старіші за вказаний період
            const { data: oldLogs, error } = await supabase
                .from('cutting_log')
                .select('log_entry_id, report_url, end_time')
                .not('report_url', 'is', null)
                .lt('end_time', cutoffDate.toISOString());

            if (error) {
                console.error('❌ Помилка пошуку старих записів:', error);
                return { success: false, error: error.message };
            }

            if (!oldLogs || oldLogs.length === 0) {
                console.log('📁 Старих записів звітів не знайдено');
                return { success: true, updatedCount: 0 };
            }

            console.log(`📋 Знайдено записів для оновлення: ${oldLogs.length}`);

            // Оновлюємо записи, видаляючи посилання на звіт
            const updates = oldLogs.map(log => ({
                log_entry_id: log.log_entry_id,
                report_url: null
            }));

            const { error: updateError } = await supabase
                .from('cutting_log')
                .upsert(updates);

            if (updateError) {
                console.error('❌ Помилка оновлення записів:', updateError);
                return { success: false, error: updateError.message };
            } else {
                console.log('✅ Оновлено записів:', oldLogs.length);
                return {
                    success: true,
                    updatedCount: oldLogs.length,
                    updatedRecords: oldLogs
                };
            }

        } catch (error) {
            console.error('❌ Помилка видалення старих записів:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Комплексне очищення - видаляє і файли, і оновлює записи
     * @param {number} monthsAgo - Кількість місяців (за замовчуванням 1)
     */
    async cleanupOldReports(monthsAgo = 3) {
        try {
            console.log('🧹 Запуск комплексного очищення старих звітів...');

            const fileResult = await this.deleteOldReportFiles(monthsAgo);
            const recordResult = await this.deleteOldReportRecords(monthsAgo);

            const result = {
                files: fileResult,
                records: recordResult,
                timestamp: new Date().toISOString()
            };

            console.log('✅ Очищення старих звітів завершено');
            return result;

        } catch (error) {
            console.error('❌ Помилка комплексного очищення:', error);
            return {
                success: false,
                error: error.message,
                files: { success: false },
                records: { success: false }
            };
        }
    },

    /**
     * Безпечне очищення з додатковими перевірками
     * @param {number} monthsAgo - Кількість місяців
     */
    async safeCleanup(monthsAgo = 3) {
        try {
            // Перевіряємо, чи не зараз початок місяця (щоб не видалити щойно створені)
            const today = new Date();
            if (today.getDate() <= 3) { // Перші 3 дні місяця - не видаляємо
                console.log('⏸️ Очищення призупинено - початок місяця');
                return {
                    success: true,
                    skipped: true,
                    reason: 'Початок місяця - очищення призупинено'
                };
            }

            // Перевіряємо, чи не вихідний день
            if (today.getDay() === 0 || today.getDay() === 6) {
                console.log('⏸️ Очищення призупинено - вихідний день');
                return {
                    success: true,
                    skipped: true,
                    reason: 'Вихідний день - очищення призупинено'
                };
            }

            return await this.cleanupOldReports(monthsAgo);

        } catch (error) {
            console.error('❌ Помилка безпечного очищення:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Отримує інформацію про старі файли без їх видалення
     * @param {number} monthsAgo - Кількість місяців
     */
    async getOldReportsInfo(monthsAgo = 3) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setMonth(cutoffDate.getMonth() - monthsAgo);

            // Отримуємо файли з storage
            const { data: files, error: filesError } = await supabase.storage
                .from('reports')
                .list('cutting-reports');

            if (filesError) {
                return { success: false, error: filesError.message };
            }

            const oldFiles = files
                .map(file => {
                    const info = this.extractFileInfo(file.name);
                    return info ? { ...file, ...info, created: new Date(info.timestamp) } : null;
                })
                .filter(file => file && file.timestamp < cutoffDate.getTime())
                .sort((a, b) => a.timestamp - b.timestamp);

            // Отримуємо записи з бази даних
            const { data: oldRecords, error: recordsError } = await supabase
                .from('cutting_log')
                .select('log_entry_id, report_url, end_time, program_id')
                .not('report_url', 'is', null)
                .lt('end_time', cutoffDate.toISOString());

            return {
                success: true,
                oldFiles,
                oldRecords: oldRecords || [],
                cutoffDate: cutoffDate.toISOString(),
                totalFiles: oldFiles.length,
                totalRecords: oldRecords?.length || 0
            };

        } catch (error) {
            console.error('❌ Помилка отримання інформації про старі звіти:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Виділяє інформацію з імені файлу
     * @param {string} filename - Ім'я файлу
     */
    extractFileInfo(filename) {
        const match = filename.match(/job_(\d+)_report_(\d+)\.(\w+)/);
        if (match) {
            return {
                jobId: match[1],
                timestamp: parseInt(match[2]),
                extension: match[3]
            };
        }
        return null;
    },

    /**
     * Видаляє файл звіту та оновлює запис в базі даних
     * @param {string} reportUrl - URL файлу для видалення
     * @param {number} logEntryId - ID запису в cutting_log
     * @returns {Promise<Object>} - Результат операції
     */
    async deleteReportFile(reportUrl, logEntryId) {
        try {
            console.log('🗑️ Видалення файлу звіту:', reportUrl);

            // Отримуємо шлях до файлу з URL
            const filePath = this.extractFilePathFromUrl(reportUrl);

            if (!filePath) {
                throw new Error('Не вдалося визначити шлях до файлу');
            }

            // Видаляємо файл з Storage
            const { data: storageData, error: storageError } = await supabase.storage
                .from('reports')
                .remove([filePath]);

            if (storageError) {
                console.error('❌ Помилка видалення файлу з Storage:', storageError);
                throw new Error(`Помилка видалення файлу: ${storageError.message}`);
            }

            // Оновлюємо запис в базі даних (видаляємо report_url)
            const { error: dbError } = await supabase
                .from('cutting_log')
                .update({ report_url: null })
                .eq('log_entry_id', logEntryId);

            if (dbError) {
                console.error('❌ Помилка оновлення запису в базі:', dbError);
                throw new Error(`Помилка оновлення бази даних: ${dbError.message}`);
            }

            console.log('✅ Файл успішно видалено з Storage та бази даних');

            return {
                success: true,
                deletedFilePath: filePath,
                logEntryId: logEntryId,
                message: 'Файл успішно видалено'
            };

        } catch (error) {
            console.error('❌ Помилка видалення файлу звіту:', error);
            return {
                success: false,
                error: error.message
            };
        }
    },

    /**
     * Виділяє шлях до файлу з URL
     * @param {string} reportUrl - Повний URL файлу
     * @returns {string} - Шлях до файлу в Storage
     */
    extractFilePathFromUrl(reportUrl) {
        try {
            // URL має вигляд: https://xxx.supabase.co/storage/v1/object/public/reports/cutting-reports/filename.pdf
            const url = new URL(reportUrl);
            const pathSegments = url.pathname.split('/');

            // Шукаємо сегменти після /reports/
            const reportsIndex = pathSegments.indexOf('reports');
            if (reportsIndex !== -1 && pathSegments.length > reportsIndex + 1) {
                // Повертаємо шлях відносно бакета reports
                return pathSegments.slice(reportsIndex + 1).join('/');
            }

            return null;
        } catch (error) {
            console.error('Помилка парсингу URL:', error);
            return null;
        }
    },

    /**
     * Видаляє файл за jobId (альтернативний метод)
     * @param {number} jobId - ID завдання
     * @returns {Promise<Object>} - Результат операції
     */
    async deleteReportByJobId(jobId) {
        try {
            // Знаходимо запис з файлом для цього jobId
            const { data: logEntry, error: findError } = await supabase
                .from('cutting_log')
                .select('log_entry_id, report_url')
                .eq('program_id',
                    supabase.from('cutting_programs')
                        .select('program_id')
                        .eq('job_id', jobId)
                )
                .not('report_url', 'is', null)
                .single();

            if (findError || !logEntry) {
                return { success: false, error: 'Файл звіту не знайдено' };
            }

            return await this.deleteReportFile(logEntry.report_url, logEntry.log_entry_id);

        } catch (error) {
            console.error('❌ Помилка видалення файлу за jobId:', error);
            return { success: false, error: error.message };
        }
    },
    /**
     * Перевіряє, чи існує файл в Storage
     */
    async checkFileExists(reportUrl) {
        try {
            const filePath = this.extractFilePathFromUrl(reportUrl);
            if (!filePath) return false;

            const { data, error } = await supabase.storage
                .from('reports')
                .list('cutting-reports', {
                    search: filePath.split('/').pop()
                });

            return !error && data && data.length > 0;
        } catch (error) {
            console.error('Помилка перевірки існування файлу:', error);
            return false;
        }
    },

    /**
     * Отримує інформацію про файл
     */
    async getFileInfo(reportUrl) {
        try {
            const filePath = this.extractFilePathFromUrl(reportUrl);
            if (!filePath) return null;

            const { data, error } = await supabase.storage
                .from('reports')
                .list('cutting-reports', {
                    search: filePath.split('/').pop()
                });

            if (error || !data || data.length === 0) return null;

            return data[0];
        } catch (error) {
            console.error('Помилка отримання інформації про файл:', error);
            return null;
        }
    }
};

export default ReportCleanupService;