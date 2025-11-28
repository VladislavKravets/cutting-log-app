// hooks/useReportCleanup.js
import { useEffect } from 'react';
import ReportCleanupService from '../utils/reportCleanup';

export const useReportCleanup = (options = {}) => {
    const {
        enabled = true,
        monthsAgo = 1,
        autoCleanup = false,
        cleanupInterval = 7 * 24 * 60 * 60 * 1000 // 7 днів
    } = options;

    useEffect(() => {
        if (!enabled || !autoCleanup) return;

        const cleanup = async () => {
            console.log('🔄 Автоматичне очищення старих звітів...');
            const result = await ReportCleanupService.safeCleanup(monthsAgo);
            console.log('Результат автоматичного очищення:', result);
        };

        // Виконуємо одразу при монтуванні
        cleanup();

        // Налаштовуємо інтервал для регулярного очищення
        const intervalId = setInterval(cleanup, cleanupInterval);

        return () => clearInterval(intervalId);
    }, [enabled, monthsAgo, autoCleanup, cleanupInterval]);

    return {
        cleanupOldReports: (months = monthsAgo) => ReportCleanupService.cleanupOldReports(months),
        safeCleanup: (months = monthsAgo) => ReportCleanupService.safeCleanup(months),
        getOldReportsInfo: (months = monthsAgo) => ReportCleanupService.getOldReportsInfo(months)
    };
};

export default useReportCleanup;