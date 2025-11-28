// utils/pdfCompressor.js
import { PDFDocument } from 'pdf-lib';

export const PDFCompressor = {
    /**
     * Стискає PDF файл
     * @param {File} pdfFile - Вхідний PDF файл
     * @param {Object} options - Налаштування стиснення
     * @returns {Promise<File>} - Стиснутий PDF файл
     */
    async compressPDF(pdfFile, options = {}) {
        try {
            const {
                quality = 'medium',
                maxSizeMB = 5,
                reduceResolution = true
            } = options;

            console.log(`📦 Стиснення PDF: ${pdfFile.name} (${(pdfFile.size / 1024 / 1024).toFixed(2)} MB)`);

            const arrayBuffer = await pdfFile.arrayBuffer();
            const pdfDoc = await PDFDocument.load(arrayBuffer);
            const pageCount = pdfDoc.getPageCount();

            console.log(`📄 Кількість сторінок: ${pageCount}`);

            const compressionOptions = this.getCompressionOptions(quality);
            const pages = pdfDoc.getPages();

            for (let i = 0; i < pages.length; i++) {
                this.compressPage(pages[i], compressionOptions, reduceResolution);
            }

            const compressedPdfBytes = await pdfDoc.save({
                useObjectStreams: true,
                addDefaultPage: false,
                objectsPerTick: 100,
                ...compressionOptions.pdfLib
            });

            // ВИПРАВЛЕННЯ: Створюємо File з правильним ім'ям та типом
            const compressedFile = new File(
                [compressedPdfBytes],
                this.generateCompressedFileName(pdfFile.name), // Використовуємо функцію для генерації імені
                {
                    type: 'application/pdf',
                    lastModified: new Date().getTime()
                }
            );

            const originalSizeMB = pdfFile.size / 1024 / 1024;
            const compressedSizeMB = compressedFile.size / 1024 / 1024;
            const compressionRatio = ((1 - compressedSizeMB / originalSizeMB) * 100).toFixed(1);

            console.log(`✅ PDF стиснуто: ${compressedSizeMB.toFixed(2)} MB (${compressionRatio}% економії)`);

            if (compressedSizeMB > maxSizeMB) {
                console.warn(`⚠️ Файл все ще завеликий: ${compressedSizeMB.toFixed(2)} MB`);
                return await this.compressPDF(compressedFile, {
                    ...options,
                    quality: 'low'
                });
            }

            return compressedFile;

        } catch (error) {
            console.error('❌ Помилка стиснення PDF:', error);
            throw new Error(`Не вдалося стиснути PDF: ${error.message}`);
        }
    },

    /**
     * Генерує коректне ім'я для стиснутого файлу
     */
    generateCompressedFileName(originalName) {
        // Видаляємо розширення .pdf
        const nameWithoutExt = originalName.replace(/\.pdf$/i, '');
        // Додаємо суфікс та розширення
        return `${nameWithoutExt}_compressed.pdf`;
    },

    /**
     * Повертає налаштування стиснення залежно від якості
     */
    getCompressionOptions(quality) {
        const options = {
            low: {
                imageQuality: 0.3,
                pdfLib: {
                    compressImages: true,
                    imageQuality: 0.3
                }
            },
            medium: {
                imageQuality: 0.6,
                pdfLib: {
                    compressImages: true,
                    imageQuality: 0.6
                }
            },
            high: {
                imageQuality: 0.8,
                pdfLib: {
                    compressImages: true,
                    imageQuality: 0.8
                }
            }
        };

        return options[quality] || options.medium;
    },

    /**
     * Стискає окрему сторінку PDF
     */
    compressPage(page, options, reduceResolution) {
        if (reduceResolution) {
            const { width, height } = page.getSize();
            // Зменшуємо роздільну здатність для великих сторінок
            if (width > 1500 || height > 1500) {
                const scale = 0.7;
                page.scale(scale, scale);
            }
        }
        // Додаткові маніпуляції зі сторінкою можна додати тут
    },

    /**
     * Перевіряє, чи потрібне стиснення (файл більше 2MB)
     */
    needsCompression(file) {
        return file.type === 'application/pdf' && file.size > 2 * 1024 * 1024;
    },

    /**
     * Оптимізує будь-який файл (PDF або зображення)
     */
    async optimizeFile(file, options = {}) {
        if (file.type === 'application/pdf') {
            return await this.compressPDF(file, options);
        }

        // Для зображень можна додати інші методи стиснення
        if (file.type.startsWith('image/')) {
            return await this.compressImage(file, options);
        }

        // Для інших типів файлів повертаємо оригінал
        return file;
    },

    /**
     * Стиснення зображень (додатково)
     */
    async compressImage(imageFile, options = {}) {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();

            img.onload = () => {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);

                canvas.toBlob((blob) => {
                    const compressedFile = new File(
                        [blob],
                        `compressed_${imageFile.name}`,
                        { type: 'image/jpeg' }
                    );
                    resolve(compressedFile);
                }, 'image/jpeg', 0.7); // 70% якості
            };

            img.src = URL.createObjectURL(imageFile);
        });
    }
};

export default PDFCompressor;