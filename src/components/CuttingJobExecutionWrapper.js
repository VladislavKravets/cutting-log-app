// components/CuttingJobExecutionWrapper.js
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import CuttingJobExecution from './CuttingJobExecution';

function CuttingJobExecutionWrapper() {
    const { jobId } = useParams();
    const navigate = useNavigate();

    const handleBackToList = () => {
        navigate('/view/jobs');
    };

    return (
        <div className="job-execution-mode">
            <button
                onClick={handleBackToList}
                className="back-button"
            >
                ← Назад до списку завдань
            </button>
            <CuttingJobExecution
                jobId={parseInt(jobId)}
                onBack={handleBackToList}
            />
        </div>
    );
}

export default CuttingJobExecutionWrapper;