import React, { useState, useEffect, useMemo } from 'react';
import './WinterBackground.scss';

const NUM_SNOWFLAKES = 50;

const snowflakeSrcs = [
    "❄️",
    "❅",
    "❆",
    "*",
    "•"
];

const WinterBackground = () => {
    const [timeUntilNewYear, setTimeUntilNewYear] = useState({
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0
    });

    // Мемоізація сніжинок - вони створюються лише один раз
    const snowflakes = useMemo(() => {
        return Array.from({ length: NUM_SNOWFLAKES }, (_, index) => {
            const randomLeft = Math.random() * 100;
            const randomDelay = Math.random() * 15;
            const randomSize = Math.random() * 20 + 10;
            const randomDuration = Math.random() * 10 + 10;
            const randomOpacity = Math.random() * 0.7 + 0.3;
            const randomRotation = Math.random() * 360;

            const randomSrcIndex = Math.floor(Math.random() * snowflakeSrcs.length);

            const style = {
                left: `${randomLeft}vw`,
                animationDelay: `${randomDelay}s`,
                fontSize: `${randomSize}px`,
                animationDuration: `${randomDuration}s`,
                opacity: randomOpacity,
                transform: `rotate(${randomRotation}deg)`,
            };

            return (
                <div key={index} className="snowflake" style={style}>
                    {snowflakeSrcs[randomSrcIndex]}
                </div>
            );
        });
    }, []); // Порожній масив залежностей - створюється лише один раз

    useEffect(() => {
        const calculateTimeUntilNewYear = () => {
            const now = new Date();
            const currentYear = now.getFullYear();
            const nextYear = currentYear + 1;
            const newYear = new Date(nextYear, 0, 1);
            const diffTime = newYear - now;

            const days = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diffTime % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diffTime % (1000 * 60)) / 1000);

            setTimeUntilNewYear({
                days,
                hours,
                minutes,
                seconds
            });
        };

        calculateTimeUntilNewYear();
        // Оновлюємо лічильник кожну секунду
        const interval = setInterval(calculateTimeUntilNewYear, 1000);

        return () => clearInterval(interval);
    }, []);

    return (
        <div className="winter-background-wrapper">
            {snowflakes}

            <div className="winter-label-container">
                <h1>
                    ЖУРНАЛ ЛАЗЕРНОЇ ПОРІЗКИ
                </h1>
            </div>

            {/* Ёлка в правому нижнем углу */}
            <div className="christmas-tree">
                🎄
            </div>

            {/* Лічильник часу до Нового року */}
            {timeUntilNewYear.days <= 100 && (
                <div className="new-year-countdown">
                    <div className="countdown-title">До Нового року залишилось</div>
                    <div className="countdown-grid">
                        <div className="countdown-item">
                            <div className="countdown-number">
                                {timeUntilNewYear.days.toString().padStart(2, '0')}
                            </div>
                            <div className="countdown-label">
                                {timeUntilNewYear.days === 1 ? 'день' :
                                    timeUntilNewYear.days < 5 ? 'дні' : 'днів'}
                            </div>
                        </div>
                        <div className="countdown-item">
                            <div className="countdown-number">
                                {timeUntilNewYear.hours.toString().padStart(2, '0')}
                            </div>
                            <div className="countdown-label">
                                {timeUntilNewYear.hours === 1 ? 'година' :
                                    timeUntilNewYear.hours < 5 ? 'години' : 'годин'}
                            </div>
                        </div>
                        <div className="countdown-item">
                            <div className="countdown-number">
                                {timeUntilNewYear.minutes.toString().padStart(2, '0')}
                            </div>
                            <div className="countdown-label">хвилин</div>
                        </div>
                        <div className="countdown-item">
                            <div className="countdown-number">
                                {timeUntilNewYear.seconds.toString().padStart(2, '0')}
                            </div>
                            <div className="countdown-label">секунд</div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WinterBackground;