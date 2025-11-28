import React, { useState, useRef, useCallback, useEffect } from 'react';
import DxfParser from 'dxf-parser';

function Dxf2DViewer({ dxfData }) {
    const canvasRef = useRef(null);
    const [scale, setScale] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });

    // Візуалізація DXF на Canvas
    const renderDxf = useCallback(() => {
        if (!canvasRef.current || !dxfData || !Array.isArray(dxfData)) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        // Очищаємо canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Білий фон
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (dxfData.length === 0) {
            ctx.fillStyle = '#666';
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Немає об\'єктів для відображення', canvas.width / 2, canvas.height / 2);
            return;
        }

        // Зберігаємо поточний стан контексту
        ctx.save();

        // Застосовуємо трансформації
        ctx.translate(offset.x, offset.y);
        ctx.scale(scale, scale);

        // Малюємо сітку
        drawGrid(ctx, canvas);

        // Малюємо об'єкти DXF
        dxfData.forEach(entity => {
            drawEntity(ctx, entity);
        });

        // Малюємо координатні осі
        drawAxes(ctx, canvas);

        // Відновлюємо стан контексту
        ctx.restore();

    }, [dxfData, scale, offset]);

    // Малювання сітки
    const drawGrid = (ctx, canvas) => {
        ctx.strokeStyle = '#f0f0f0';
        ctx.lineWidth = 1;

        const gridSize = 50;
        const startX = -offset.x / scale;
        const startY = -offset.y / scale;
        const endX = (canvas.width - offset.x) / scale;
        const endY = (canvas.height - offset.y) / scale;

        for (let x = Math.floor(startX / gridSize) * gridSize; x <= endX; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, startY);
            ctx.lineTo(x, endY);
            ctx.stroke();
        }

        for (let y = Math.floor(startY / gridSize) * gridSize; y <= endY; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(startX, y);
            ctx.lineTo(endX, y);
            ctx.stroke();
        }
    };

    // Малювання координатних осей
    const drawAxes = (ctx, canvas) => {
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 1;

        // X вісь
        ctx.beginPath();
        ctx.moveTo(-10000, 0);
        ctx.lineTo(10000, 0);
        ctx.stroke();

        // Y вісь
        ctx.beginPath();
        ctx.moveTo(0, -10000);
        ctx.lineTo(0, 10000);
        ctx.stroke();

        // Підписи
        ctx.fillStyle = '#000000';
        ctx.font = '12px Arial';
        ctx.fillText('X', 20, -5);
        ctx.fillText('Y', 5, 20);
    };

    // Малювання об'єктів DXF
    const drawEntity = (ctx, entity) => {
        try {
            switch (entity.type) {
                case 'LINE':
                    drawLine(ctx, entity);
                    break;
                case 'CIRCLE':
                    drawCircle(ctx, entity);
                    break;
                case 'ARC':
                    drawArc(ctx, entity);
                    break;
                case 'LWPOLYLINE':
                case 'POLYLINE':
                    drawPolyline(ctx, entity);
                    break;
                case 'SPLINE':
                    drawSpline(ctx, entity);
                    break;
                case 'TEXT':
                    drawText(ctx, entity);
                    break;
                case 'MTEXT':
                    drawMText(ctx, entity);
                    break;
                case 'INSERT':
                    drawInsert(ctx, entity);
                    break;
                default:
                    console.log('Не підтримуваний тип:', entity.type);
            }
        } catch (error) {
            console.error('Помилка малювання об\'єкта:', entity.type, error);
        }
    };

    // Лінія
    const drawLine = (ctx, entity) => {
        ctx.strokeStyle = '#007bff';
        ctx.lineWidth = 1;
        ctx.beginPath();

        if (entity.start && entity.end) {
            ctx.moveTo(entity.start.x, entity.start.y);
            ctx.lineTo(entity.end.x, entity.end.y);
        } else if (entity.x !== undefined && entity.x1 !== undefined) {
            ctx.moveTo(entity.x, entity.y);
            ctx.lineTo(entity.x1, entity.y1);
        }

        ctx.stroke();
    };

    // Коло
    const drawCircle = (ctx, entity) => {
        ctx.strokeStyle = '#00aa00';
        ctx.lineWidth = 1;
        ctx.beginPath();

        if (entity.center && entity.radius) {
            ctx.arc(entity.center.x, entity.center.y, entity.radius, 0, 2 * Math.PI);
        } else if (entity.x !== undefined && entity.radius) {
            ctx.arc(entity.x, entity.y, entity.radius, 0, 2 * Math.PI);
        }

        ctx.stroke();
    };

    // Дуга
    const drawArc = (ctx, entity) => {
        ctx.strokeStyle = '#ff5500';
        ctx.lineWidth = 1;
        ctx.beginPath();

        let centerX, centerY, radius, startAngle, endAngle;

        if (entity.center && entity.radius) {
            centerX = entity.center.x;
            centerY = entity.center.y;
            radius = entity.radius;
            startAngle = (entity.startAngle || 0) * Math.PI / 180;
            endAngle = (entity.endAngle || 360) * Math.PI / 180;
        } else {
            centerX = entity.x;
            centerY = entity.y;
            radius = entity.radius;
            startAngle = (entity.startAngle || 0) * Math.PI / 180;
            endAngle = (entity.endAngle || 360) * Math.PI / 180;
        }

        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.stroke();
    };

    // Полілінія
    const drawPolyline = (ctx, entity) => {
        ctx.strokeStyle = '#aa00aa';
        ctx.lineWidth = 1;
        ctx.beginPath();

        const vertices = entity.vertices || [];
        if (vertices.length === 0) return;

        const firstVertex = vertices[0];
        ctx.moveTo(firstVertex.x, firstVertex.y);

        for (let i = 1; i < vertices.length; i++) {
            ctx.lineTo(vertices[i].x, vertices[i].y);
        }

        // Замикаємо якщо потрібно
        if (entity.closed) {
            ctx.lineTo(firstVertex.x, firstVertex.y);
        }

        ctx.stroke();
    };

    // Сплайн
    const drawSpline = (ctx, entity) => {
        ctx.strokeStyle = '#ffaa00';
        ctx.lineWidth = 1;
        ctx.beginPath();

        const points = entity.controlPoints || [];
        if (points.length < 2) return;

        const firstPoint = points[0];
        ctx.moveTo(firstPoint.x, firstPoint.y);

        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }

        ctx.stroke();
    };

    // Текст
    const drawText = (ctx, entity) => {
        if (!entity.text) return;

        ctx.fillStyle = '#000000';
        ctx.font = `${entity.textHeight || 10}px Arial`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';

        const x = entity.x || 0;
        const y = entity.y || 0;

        ctx.fillText(entity.text, x, y);
    };

    // Багаторядковий текст
    const drawMText = (ctx, entity) => {
        if (!entity.text) return;

        ctx.fillStyle = '#000000';
        ctx.font = `${entity.textHeight || 10}px Arial`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        const x = entity.x || 0;
        const y = entity.y || 0;

        // Розділяємо текст на рядки
        const lines = entity.text.split('\\P');
        lines.forEach((line, index) => {
            ctx.fillText(line, x, y + (index * (entity.textHeight || 10)));
        });
    };

    // Вставка (блок)
    const drawInsert = (ctx, entity) => {
        ctx.strokeStyle = '#555555';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 3]);

        // Малюємо рамку навколо вставки
        const x = entity.x || 0;
        const y = entity.y || 0;
        const scaleX = entity.xScale || 1;
        const scaleY = entity.yScale || 1;

        ctx.strokeRect(x - 10 * scaleX, y - 5 * scaleY, 20 * scaleX, 10 * scaleY);
        ctx.setLineDash([]);

        // Підпис
        ctx.fillStyle = '#555555';
        ctx.font = '10px Arial';
        ctx.fillText(`INSERT: ${entity.name || 'Block'}`, x + 15, y);
    };

    // Обробники миші для навігації
    const handleMouseDown = (e) => {
        setIsDragging(true);
        setLastMousePos({ x: e.clientX, y: e.clientY });
    };

    const handleMouseMove = (e) => {
        if (!isDragging) return;

        const deltaX = e.clientX - lastMousePos.x;
        const deltaY = e.clientY - lastMousePos.y;

        setOffset(prev => ({
            x: prev.x + deltaX,
            y: prev.y + deltaY
        }));

        setLastMousePos({ x: e.clientX, y: e.clientY });
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    const handleWheel = (e) => {
        e.preventDefault();
        const zoomIntensity = 0.1;
        const wheel = e.deltaY < 0 ? 1 : -1;
        const newScale = scale * (1 + wheel * zoomIntensity);

        // Обмежуємо масштаб
        setScale(Math.max(0.1, Math.min(10, newScale)));
    };

    // Реагуємо на зміни даних
    useEffect(() => {
        renderDxf();
    }, [renderDxf]);

    // Автоматичне масштабування при зміні даних
    useEffect(() => {
        if (dxfData && dxfData.length > 0) {
            // Скидаємо масштаб та позицію для нових даних
            setScale(1);
            setOffset({ x: 0, y: 0 });
        }
    }, [dxfData]);

    return (
        <div className="dxf-2d-viewer">
            <canvas
                ref={canvasRef}
                width={800}
                height={600}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
                style={{
                    border: '1px solid #ccc',
                    background: '#ffffff',
                    cursor: isDragging ? 'grabbing' : 'grab'
                }}
            />
            <div className="viewer-controls">
                <button onClick={() => setScale(1)}>📏 Скинути масштаб</button>
                <button onClick={() => setOffset({ x: 0, y: 0 })}>🎯 Центрувати</button>
                <span>Масштаб: {(scale * 100).toFixed(0)}%</span>
            </div>
        </div>
    );
}

function MyDxfViewer({ fileUrl, onFileUpload }) {
    const [showViewer, setShowViewer] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [currentFile, setCurrentFile] = useState(fileUrl);
    const [uploadedFiles, setUploadedFiles] = useState([]);
    const [dxfData, setDxfData] = useState([]);
    const fileInputRef = useRef(null);

    // Парсинг DXF файлу
    const parseDxfFile = useCallback(async (fileContent) => {
        try {
            console.log('Парсинг DXF файлу...');

            const parser = new DxfParser();
            const dxf = parser.parseSync(fileContent);

            if (!dxf || !dxf.entities) {
                console.warn('DXF файл не містить entities');
                return [];
            }

            console.log('Знайдено об\'єктів:', dxf.entities.length);

            // Фільтруємо видимі об'єкти
            const visibleEntities = dxf.entities.filter(entity =>
                entity.visible !== false
            );

            console.log('Видимі об\'єкти:', visibleEntities.length);

            return visibleEntities;

        } catch (err) {
            console.error('Помилка парсингу DXF:', err);
            throw new Error('Не вдалося розпізнати DXF файл: ' + err.message);
        }
    }, []);

    // Завантаження DXF файлу
    const loadDxfFile = useCallback(async (url) => {
        try {
            setLoading(true);
            setError(null);

            console.log('Завантаження DXF з:', url);
            const response = await fetch(url);
            if (!response.ok) throw new Error('Не вдалося завантажити файл');

            const fileContent = await response.text();
            console.log('Файл завантажено, довжина:', fileContent.length);

            const entities = await parseDxfFile(fileContent);
            console.log('Успішно розпізнано об\'єктів:', entities.length);

            setDxfData(entities);

        } catch (err) {
            console.error('Помилка завантаження DXF:', err);
            setError(err.message);
            setDxfData([]);
        } finally {
            setLoading(false);
        }
    }, [parseDxfFile]);

    // Обробка завантаження файлів
    const handleFileUpload = useCallback((event) => {
        const files = Array.from(event.target.files);
        if (files.length === 0) return;

        setLoading(true);
        setError(null);

        const processFile = (file) => {
            return new Promise((resolve) => {
                const reader = new FileReader();

                reader.onload = async (e) => {
                    try {
                        const fileContent = e.target.result;
                        console.log(`Обробка файлу: ${file.name}`);

                        const entities = await parseDxfFile(fileContent);
                        console.log(`Успішно розпізнано об'єктів: ${entities.length}`);

                        const newFile = {
                            id: Date.now() + Math.random(),
                            name: file.name,
                            size: file.size,
                            type: file.type,
                            url: URL.createObjectURL(file),
                            uploadDate: new Date().toLocaleString(),
                            entities: entities
                        };

                        resolve(newFile);
                    } catch (err) {
                        console.error(`Помилка обробки файлу ${file.name}:`, err);
                        setError(`Помилка обробки файлу ${file.name}: ${err.message}`);
                        resolve(null);
                    }
                };

                reader.onerror = () => {
                    setError(`Помилка читання файлу ${file.name}`);
                    resolve(null);
                };

                reader.readAsText(file);
            });
        };

        // Обробляємо всі файли
        const processAllFiles = async () => {
            const newFiles = [];

            for (const file of files) {
                const processedFile = await processFile(file);
                if (processedFile) {
                    newFiles.push(processedFile);
                }
            }

            setUploadedFiles(prev => [...prev, ...newFiles]);

            if (newFiles.length > 0) {
                const firstFile = newFiles[0];
                setCurrentFile(firstFile.url);
                setDxfData(firstFile.entities);
                if (onFileUpload) {
                    onFileUpload(firstFile);
                }
                setShowViewer(true);
            }

            setLoading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        };

        processAllFiles();

    }, [parseDxfFile, onFileUpload]);

    // Видалення файлу
    const handleDeleteFile = useCallback((fileId, event) => {
        event?.stopPropagation();
        setUploadedFiles(prev => {
            const fileToDelete = prev.find(f => f.id === fileId);
            if (fileToDelete) {
                URL.revokeObjectURL(fileToDelete.url);
            }

            const updatedFiles = prev.filter(file => file.id !== fileId);
            if (currentFile && fileToDelete?.url === currentFile) {
                setCurrentFile(null);
                setShowViewer(false);
                setDxfData([]);
            }
            return updatedFiles;
        });
    }, [currentFile]);

    // Вибір файлу
    const handleSelectFile = useCallback((file) => {
        setCurrentFile(file.url);
        setDxfData(file.entities);
        setShowViewer(true);
        setError(null);
    }, []);

    // Ефект для завантаження файлу з URL
    useEffect(() => {
        if (fileUrl && showViewer) {
            loadDxfFile(fileUrl);
        }
    }, [fileUrl, showViewer, loadDxfFile]);

    return (
        <div className="dxf-viewer-container">
            <div className="control-panel">
                <div className="control-buttons">
                    <button
                        className="btn btn-primary"
                        onClick={() => setShowViewer(!showViewer)}
                        disabled={!currentFile && !fileUrl}
                    >
                        {showViewer ? '✖ Сховати 2D перегляд' : '👁 2D перегляд DXF'}
                    </button>

                    <label className="btn btn-secondary">
                        📁 Завантажити DXF
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".dxf,.DXF"
                            multiple
                            onChange={handleFileUpload}
                            style={{ display: 'none' }}
                        />
                    </label>

                    {uploadedFiles.length > 0 && (
                        <button
                            className="btn btn-danger"
                            onClick={() => {
                                uploadedFiles.forEach(file => URL.revokeObjectURL(file.url));
                                setUploadedFiles([]);
                                setCurrentFile(null);
                                setShowViewer(false);
                                setDxfData([]);
                            }}
                        >
                            🗑 Очистити всі
                        </button>
                    )}
                </div>

                {loading && (
                    <div className="loading-indicator">
                        ⏳ Завантаження та обробка DXF файлу...
                    </div>
                )}

                {error && (
                    <div className="error-message">
                        ❌ {error}
                    </div>
                )}

                {dxfData.length > 0 && (
                    <div className="file-info">
                        📊 Об'єктів: {dxfData.length} |
                        Типи: {[...new Set(dxfData.map(e => e.type))].join(', ')}
                    </div>
                )}
            </div>

            {/* Список файлів */}
            {uploadedFiles.length > 0 && (
                <div className="uploaded-files">
                    <h3>Завантажені файли ({uploadedFiles.length})</h3>
                    <div className="files-list">
                        {uploadedFiles.map(file => (
                            <div
                                key={file.id}
                                className={`file-item ${currentFile === file.url ? 'active' : ''}`}
                                onClick={() => handleSelectFile(file)}
                            >
                                <div className="file-info">
                                    <div className="file-name">📄 {file.name}</div>
                                    <div className="file-details">
                                        <span>Розмір: {(file.size / 1024).toFixed(2)} KB</span>
                                        <span>Об'єктів: {file.entities?.length || 0}</span>
                                        <span>Завантажено: {file.uploadDate}</span>
                                    </div>
                                </div>
                                <div className="file-actions">
                                    <button
                                        className="btn-delete"
                                        onClick={(e) => handleDeleteFile(file.id, e)}
                                        title="Видалити"
                                    >
                                        🗑
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 2D перегляд DXF */}
            {showViewer && (
                <div className="dxf-preview">
                    <div className="preview-header">
                        <h3>
                            2D перегляд DXF - {
                            uploadedFiles.find(f => f.url === currentFile)?.name ||
                            (fileUrl ? 'Файл з URL' : 'Поточний файл')
                        }
                            {dxfData.length > 0 && ` (${dxfData.length} об'єктів)`}
                        </h3>
                        <button
                            className="btn-close"
                            onClick={() => setShowViewer(false)}
                        >
                            ✖
                        </button>
                    </div>

                    <div className="viewer-container">
                        <Dxf2DViewer dxfData={dxfData} />

                        {loading && (
                            <div className="viewer-loading">
                                ⏳ Завантаження 2D переглядача...
                            </div>
                        )}

                        {!loading && dxfData.length === 0 && (
                            <div className="viewer-empty">
                                📭 Немає об'єктів для відображення
                            </div>
                        )}
                    </div>

                    <div className="viewer-controls">
                        <div className="viewer-info">
                            <h4>Керування 2D переглядом:</h4>
                            <ul>
                                <li>🖱️ <strong>ЛКМ + перетягування</strong> - переміщення</li>
                                <li>🖱️ <strong>Колесо миші</strong> - масштабування</li>
                                <li>🎯 <strong>Кольори об'єктів:</strong></li>
                                <li>• <span style={{color: '#007bff'}}>Синій</span> - лінії</li>
                                <li>• <span style={{color: '#00aa00'}}>Зелений</span> - кола</li>
                                <li>• <span style={{color: '#ff5500'}}>Помаранчевий</span> - дуги</li>
                                <li>• <span style={{color: '#aa00aa'}}>Фіолетовий</span> - полілінії</li>
                                <li>• <span style={{color: '#ffaa00'}}>Жовтий</span> - сплайни</li>
                                <li>• <span style={{color: '#555555'}}>Сірий</span> - блоки</li>
                            </ul>
                        </div>
                    </div>
                </div>
            )}

            {/* Інструкція */}
            {uploadedFiles.length === 0 && !fileUrl && (
                <div className="instruction">
                    <h3>2D перегляд DXF файлів</h3>
                    <p>Завантажте DXF файл для інтерактивного 2D перегляду.</p>

                    <div className="features">
                        <h4>Можливості 2D переглядача:</h4>
                        <ul>
                            <li>✅ Повна підтримка DXF об'єктів</li>
                            <li>✅ Інтерактивне масштабування та панорамування</li>
                            <li>✅ Чітка 2D візуалізація</li>
                            <li>✅ Підсвічування різних типів об'єктів</li>
                            <li>✅ Координатна сітка та осі</li>
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
}

export default MyDxfViewer;