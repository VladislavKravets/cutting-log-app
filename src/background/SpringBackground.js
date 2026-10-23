/* SpringBackground.jsx */
import React, { useState, useEffect, useMemo } from 'react';
import './SpringBackground.scss';

const NUM_BUTTERFLIES = 12;
const NUM_CLOUDS = 4;
const NUM_FLOWERS_LEFT = 5; // Зменшено до 5 квітів зліва
const NUM_FLOWERS_RIGHT = 5; // Зменшено до 5 квітів справа

const flowerSrcs = [
    "🌻",
    "🌼",
    "🌸",
    "🌺",
    "🌹",
    "🌷",
    "💐"
];

const SpringBackground = () => {
    const [timeUntilSummer, setTimeUntilSummer] = useState({
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0
    });

    // Мемоизация бабочек, которые постоянно летают
    const butterflies = useMemo(() => {
        return Array.from({ length: NUM_BUTTERFLIES }, (_, index) => {
            const randomSize = Math.random() * 15 + 25;
            const randomOpacity = Math.random() * 0.5 + 0.5;

            const startLeft = Math.random() * 100;
            const startTop = Math.random() * 80 + 10;

            const style = {
                left: `${startLeft}%`,
                top: `${startTop}%`,
                fontSize: `${randomSize}px`,
                opacity: randomOpacity
            };

            return (
                <div key={`butterfly-${index}`} className="butterfly" style={style}>
                    <span>🦋</span>
                </div>
            );
        });
    }, []);

    // Мемоизация облаков
    const clouds = useMemo(() => {
        const cloudTypes = ["☁️", "☁️", "☁️", "⛅", "🌥️"];

        return Array.from({ length: NUM_CLOUDS }, (_, index) => {
            const randomDuration = Math.random() * 40 + 50;
            const randomDelay = Math.random() * -50;
            const randomCloud = Math.floor(Math.random() * cloudTypes.length);

            const style = {
                animationDuration: `${randomDuration}s`,
                animationDelay: `${randomDelay}s`,
            };

            return (
                <div key={`cloud-${index}`} className="cloud" style={style}>
                    {cloudTypes[randomCloud]}
                </div>
            );
        });
    }, []);

    // Функція для генерації фіксованих позицій з великими проміжками
    const getFixedPositions = (count, start, end) => {
        const positions = [];
        const step = (end - start) / (count + 1);

        for (let i = 1; i <= count; i++) {
            // Фіксована позиція без рандому
            const position = start + (i * step);
            positions.push(position);
        }

        return positions;
    };

    // Ліві квіти - фіксовані позиції з великими проміжками
    const leftFlowers = useMemo(() => {
        const flowersArray = [];
        // Використовуємо фіксовані позиції, щоб квіти точно не накладалися
        const positions = [3, 7, 11, 15, 19]; // Ручний підбір позицій

        for (let i = 0; i < NUM_FLOWERS_LEFT; i++) {
            // Різна висота для кожної квітки (щоб не накладалися по вертикалі)
            const bottomOffset = Math.random() * 15; // від 0 до 15px підйому
            const randomDelay = i * 2.5 + Math.random() * 2; // Велика затримка
            const randomDuration = Math.random() * 15 + 12; // 12-27 секунд
            const randomSize = Math.random() * 20 + 35; // 35-55px
            const randomFlower = Math.floor(Math.random() * flowerSrcs.length);

            flowersArray.push(
                <div
                    key={`left-flower-${i}`}
                    className="flower"
                    style={{
                        left: `${positions[i]}%`,
                        bottom: `${bottomOffset}px`,
                        animationDelay: `${randomDelay}s`,
                        animationDuration: `${randomDuration}s`,
                        fontSize: `${randomSize}px`,
                        zIndex: i // Унікальний z-index для кожної квітки
                    }}
                >
                    {flowerSrcs[randomFlower]}
                </div>
            );
        }

        return flowersArray;
    }, []);

    // Праві квіти - фіксовані позиції з великими проміжками
    const rightFlowers = useMemo(() => {
        const flowersArray = [];
        // Використовуємо фіксовані позиції, щоб квіти точно не накладалися
        const positions = [81, 85, 89, 93, 97]; // Ручний підбір позицій

        for (let i = 0; i < NUM_FLOWERS_RIGHT; i++) {
            // Різна висота для кожної квітки
            const bottomOffset = Math.random() * 15; // від 0 до 15px підйому
            const randomDelay = i * 2.2 + Math.random() * 2;
            const randomDuration = Math.random() * 15 + 12;
            const randomSize = Math.random() * 20 + 35;
            const randomFlower = Math.floor(Math.random() * flowerSrcs.length);

            flowersArray.push(
                <div
                    key={`right-flower-${i}`}
                    className="flower"
                    style={{
                        left: `${positions[i]}%`,
                        bottom: `${bottomOffset}px`,
                        animationDelay: `${randomDelay}s`,
                        animationDuration: `${randomDuration}s`,
                        fontSize: `${randomSize}px`,
                        zIndex: i + NUM_FLOWERS_LEFT
                    }}
                >
                    {flowerSrcs[randomFlower]}
                </div>
            );
        }

        return flowersArray;
    }, []);

    useEffect(() => {
        const calculateTimeUntilSummer = () => {
            const now = new Date();
            const currentYear = now.getFullYear();
            let summerStart = new Date(currentYear, 5, 1);

            if (now > summerStart) {
                summerStart = new Date(currentYear + 1, 5, 1);
            }

            const diffTime = summerStart - now;

            const days = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diffTime % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diffTime % (1000 * 60)) / 1000);

            setTimeUntilSummer({
                days,
                hours,
                minutes,
                seconds
            });
        };

        calculateTimeUntilSummer();
        const interval = setInterval(calculateTimeUntilSummer, 1000);

        return () => clearInterval(interval);
    }, []);

    const handleSunClick = () => {
        const sun = document.querySelector('.sun');
        if (sun) {
            sun.style.transform = 'scale(1.2)';
            setTimeout(() => {
                sun.style.transform = 'scale(1)';
            }, 200);
        }
    };

    return (
        <div className="spring-background-wrapper">
            {clouds}
            {butterflies}
            {leftFlowers}
            {rightFlowers}

            <div className="sun" onClick={handleSunClick}>
                ☀️
            </div>

            <div className="spring-label-container">
                <h1>
                    ЖУРНАЛ ЛАЗЕРНОЇ ПОРІЗКИ
                </h1>
            </div>

            {timeUntilSummer.days <= 100 && (
                <div className="summer-countdown">
                    <div className="countdown-title">До літа залишилось</div>
                    <div className="countdown-grid">
                        <div className="countdown-item">
                            <div className="countdown-number">
                                {timeUntilSummer.days.toString().padStart(2, '0')}
                            </div>
                            <div className="countdown-label">
                                {timeUntilSummer.days === 1 ? 'день' :
                                    timeUntilSummer.days < 5 ? 'дні' : 'днів'}
                            </div>
                        </div>
                        <div className="countdown-item">
                            <div className="countdown-number">
                                {timeUntilSummer.hours.toString().padStart(2, '0')}
                            </div>
                            <div className="countdown-label">
                                {timeUntilSummer.hours === 1 ? 'година' :
                                    timeUntilSummer.hours < 5 ? 'години' : 'годин'}
                            </div>
                        </div>
                        <div className="countdown-item">
                            <div className="countdown-number">
                                {timeUntilSummer.minutes.toString().padStart(2, '0')}
                            </div>
                            <div className="countdown-label">хвилин</div>
                        </div>
                        <div className="countdown-item">
                            <div className="countdown-number">
                                {timeUntilSummer.seconds.toString().padStart(2, '0')}
                            </div>
                            <div className="countdown-label">секунд</div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SpringBackground;