// StarryBackground.jsx

import React from 'react';
import './starry-background.scss'; // Импортируем стили

const StarryBackground = ({ titleText }) => {
    return (
        <div className="star-field-container">
            {/* Первый слой звезд */}
            <div id="stars-wrapper-1">
                <div className="stars-base-1"></div>
                <div className="stars-base-1" style={{ top: '100%' }}></div> {/* Дубликат */}
            </div>

            {/* Второй слой звезд */}
            <div id="stars-wrapper-2">
                <div className="stars-base-2"></div>
                <div className="stars-base-2" style={{ top: '100%' }}></div> {/* Дубликат */}
            </div>

            {/* Третий слой звезд */}
            <div id="stars-wrapper-3">
                <div className="stars-base-3"></div>
                <div className="stars-base-3" style={{ top: '100%' }}></div> {/* Дубликат */}
            </div>

            <div id="title">
                <span>{titleText || 'LASER CUTTING MAGAZINE'}</span>
            </div>
        </div>
    );
};

export default StarryBackground;