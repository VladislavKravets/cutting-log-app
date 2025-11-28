import React from 'react';
import './LeafsBackground.scss';

// Количество листьев, которые будут падать (рекомендуется 100 или более)
const NUM_LEAVES = 50;

const LeafsBackground = () => {

    // Создаем массив элементов <i>
    const leaves = Array.from({ length: NUM_LEAVES }, (_, index) => {

        // Задаем случайные стили для горизонтального положения и задержки анимации
        const style = {
            // Случайное горизонтальное положение (0% - 100% ширины)
            left: `${Math.random() * 100}vw`,

            // Случайная задержка (чтобы все не падали одновременно)
            animationDelay: `${Math.random() * 15}s`,
        };

        return (
            <i
                key={index}
                style={style}
            />
        );
    });

    return (
        <div className="leafs-background">
            <div id="leaves">
                {leaves}
            </div>
        </div>
    );
};

export default LeafsBackground;