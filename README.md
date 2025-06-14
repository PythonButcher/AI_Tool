AI Data Visualization & Cleaning Tool

Overview

This project is a data visualization and cleaning tool built with React (frontend) and Flask (backend). It allows users to upload, clean, preview, analyze, visualize, and export datasets with an interactive UI and multiple charting options.

Features

File Upload: Supports CSV, Excel, JSON, and PDF file formats.

Data Cleaning: Remove null values, fill missing data, and standardize datasets.

Data Preview: View a snapshot of raw and cleaned data.

AI-Powered Insights: Uses OpenAI for dataset summaries and recommendations.

Drag-and-Drop Chart Builder: Users can assign fields to axes for chart generation.

Multiple Chart Types: Supports Bar, Line, Pie, Scatter, and Doughnut charts.

Export Options: Save cleaned data in CSV, Excel, or PDF formats.

Project Structure

Frontend (React)

The frontend is built with React and Material-UI. Key components include:

MenuBar.jsx: Handles file uploads, statistics, and navigation.

SideBar.jsx: Provides buttons for data cleaning, visualization, and exporting.

CanvasContainer.jsx: Manages the layout for data preview, AI-generated charts, and manual chart creation.

DataVisualization.jsx: Displays available chart types for selection.

DatasetInfo.jsx: Fetches and displays dataset statistics.

FileUpload.jsx: Handles the file selection and upload process.

DragDrop.jsx: Enables drag-and-drop file upload.

DropZone.jsx: Drag-and-drop zones for selecting X and Y axes for charts.

FieldsPanel.jsx: Lists available dataset fields for chart configuration.

ChartComponent.jsx: Renders charts based on selected fields and AI recommendations.

AIChat.jsx: AI assistant for dataset insights and recommendations.

Backend (Flask)

The backend processes data uploads, cleaning, and AI interactions. Key routes include:

/api/upload (POST): Uploads datasets and processes them into Pandas DataFrames.

/api/numbers (GET): Provides dataset summary statistics.

/api/cleaning (POST): Performs data cleaning operations and returns a cleaned dataset.

/api/export (GET): Exports cleaned data in CSV, Excel, or PDF formats.

/ai (POST): AI chat assistant for analyzing and summarizing datasets.

/ai_cmd (POST): AI-powered command execution for generating chart recommendations and dataset insights.

State Management

Managed via React’s useState and useContext with DataContext.jsx. Key states:

uploadedData: Stores the raw uploaded dataset.

cleanedData: Holds the cleaned dataset for export and visualization.

xAxis & yAxis: Stores selected fields for charting.

AI Integration

Uses OpenAI GPT-4 for AI-generated dataset insights and chart suggestions.

ai_logic.py handles AI commands such as:

/summary: Generates dataset summaries.

/insights: Extracts key trends from the dataset.

/charts: Recommends the best chart type based on dataset structure.

Installation

Backend Setup (Flask)

cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
flask run

Frontend Setup (React)

cd frontend
npm install
npm start

Usage

Upload a dataset via drag-and-drop or file selection.

Preview and clean data using the SideBar tools.

Generate charts manually or let AI recommend the best type.

Download cleaned data in CSV, Excel, or PDF formats.

Roadmap

Improve AI-generated insights.

Custom styling options for charts.

Database integration for large-scale data processing.

Contributors

Project Lead: PythonButcher

Technologies Used: React, Flask, Pandas, Chart.js, Material-UI, OpenAI API.

License

This project is licensed under the MIT License.

