// SearchBar.js
import React, { useState } from 'react';
import './css/SearchBar.css';

function SearchBar({ onSearchChange }) {
    const [searchTerm, setSearchTerm] = useState('');

    // Update the search term and pass it to the parent component
    const handleInputChange = (event) => {
        const newSearchTerm = event.target.value;
        setSearchTerm(newSearchTerm);
        onSearchChange(newSearchTerm); // Send the updated term to the parent
    };

    return (
        <div className='search-bar-container'>
           <input
             type="text"
             placeholder="Search categories..."
             value={searchTerm}
             onChange={handleInputChange}
             className="search-input"
            />
        </div>
    );
}

 
export default SearchBar;