// StarryBackground.jsx

import React, { useEffect } from 'react';
import './starry-background.scss';

const StarryBackground = ({ titleText }) => {
    // Перевіряємо та встановлюємо розміри при зміні вікна
    useEffect(() => {
        const setVH = () => {
            const vh = window.innerHeight * 0.01;
            document.documentElement.style.setProperty('--vh', `${vh}px`);
        };

        setVH();
        window.addEventListener('resize', setVH);

        return () => window.removeEventListener('resize', setVH);
    }, []);

    return (
        <div className="star-field-container">
            {/* Перший шар зірок */}
            <div id="stars-wrapper-1">
                <div className="stars-base-1"></div>
                <div className="stars-base-1" style={{ top: '100%' }}></div>
            </div>

            {/* Другий шар зірок */}
            <div id="stars-wrapper-2">
                <div className="stars-base-2"></div>
                <div className="stars-base-2" style={{ top: '100%' }}></div>
            </div>

            {/* Третій шар зірок */}
            <div id="stars-wrapper-3">
                <div className="stars-base-3"></div>
                <div className="stars-base-3" style={{ top: '100%' }}></div>
            </div>

            <div id="title">
                <span>{titleText || 'LASER CUTTING MAGAZINE'}</span>
            </div>
        </div>
    );
};

export default StarryBackground;