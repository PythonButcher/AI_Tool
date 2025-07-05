import React from 'react';
import '../css/button_css/CleanedButton.css';


console.log("CleanedButton rendered");
const CleanedButton = ({ uploadedData, setCleanedData, closeForm }) => {
    const handleClick = () => {
        if (!uploadedData) {
            alert("No valid uploaded data available.");
            return;
        }

        const data = Array.isArray(uploadedData)
            ? uploadedData
            : Array.isArray(uploadedData.data_preview)
                ? uploadedData.data_preview
                : typeof uploadedData.data_preview === 'string'
                    ? JSON.parse(uploadedData.data_preview)
                    : [];

        console.log("Setting cleanedData to uploadedData:", data);
        setCleanedData(data);
        if (closeForm) closeForm();
    };
    
    return (
        <button className="clean-button" onClick={handleClick}>
            Data is Clean
        </button>
    );
};

export default CleanedButton;
