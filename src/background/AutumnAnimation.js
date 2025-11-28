import React from 'react';
import './AutumnBackground.scss'; // Подключаем SCSS

const NUM_LEAVES = 10;

const leafSrcs = [
    // { src: "https://cdn.pixabay.com/photo/2016/08/20/20/57/autumn-1608537_960_720.png", className: "n1" },
    "https://purepng.com/public/uploads/large/purepng.com-yellow-leafautumnleavesleafmapleseasonfall-541521070454nw6oe.png",
    // "https://www.freepngimg.com/thumb/autumn%20leaves/3-autumn-png-leaf-thumb.png",
    "https://cdn.pixabay.com/photo/2016/08/20/20/57/autumn-1608537_960_720.png",
    "https://purepng.com/public/uploads/large/purepng.com-yellow-leafautumnleavesleafmapleseasonfall-541521070454nw6oe.png",
    // "https://www.freepngimg.com/thumb/autumn%20leaves/3-autumn-png-leaf-thumb.png",
    // Повторим, чтобы сделать листопад гуще
    // { src: "https://cdn.pixabay.com/photo/2016/08/20/20/57/autumn-1608537_960_720.png", className: "n7" },
    // { src: "https://purepng.com/public/uploads/large/purepng.com-yellow-leafautumnleavesleafmapleseasonfall-541521070454nw6oe.png", className: "n8" },
];

const AutumnBackground = () => {

    const leaves = Array.from({ length: NUM_LEAVES }, (_, index) => {

        const randomLeft = Math.random() * 100;
        // *** ИЗМЕНЕНИЕ: Увеличен диапазон задержки (например, до 15s) ***
        const randomDelay = Math.random() * 15;

        const randomSrcIndex = Math.floor(Math.random() * leafSrcs.length);

        const style = {
            left: `${randomLeft}vw`,
            animationDelay: `${randomDelay}s`,
            // Добавляем начальную прозрачность, чтобы гарантировать скрытие до старта анимации
            opacity: 0,
        };

        return (
            <div key={index} className="leaf-item i" style={style}>
                <img src={leafSrcs[randomSrcIndex]} alt="Autumn Leaf" />
            </div>
        );
    });

    return (
        <div className="autumn-background-wrapper">
            {leaves}

            <div className="autumn-label-container">
                <h1>
                    ЖУРНАЛ ЛАЗЕРНОЇ ПОРІЗКИ
                </h1>
            </div>
        </div>
    );
};

export default AutumnBackground;