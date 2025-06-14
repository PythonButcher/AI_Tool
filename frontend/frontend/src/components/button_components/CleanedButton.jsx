import React from 'react';
import '../css/button_css/CleanedButton.css';


console.log("CleanedButton rendered");
const CleanedButton = ({ uploadedData, setCleanedData, closeForm }) => {
    const handleClick = () => {
        if (!uploadedData) {
            alert("No valid uploaded data available.");
            return;
        }
    
        console.log("Setting cleanedData to uploadedData:", uploadedData);
        setCleanedData(uploadedData); // Directly set uploadedData as cleanedData
        
    };
    
    return (
        <button className="clean-button" onClick={handleClick}>
            Data is Clean
        </button>
    );
};

export default CleanedButton;
