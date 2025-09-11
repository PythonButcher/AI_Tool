// useLoadRawData.js
import { useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export default function useLoadRawData(showRawViewer, rawUploadFile, setFullData) {
  useEffect(() => {
    if (!showRawViewer || !rawUploadFile) return;

    const loadRawData = async () => {
      const formData = new FormData();
      formData.append('file', rawUploadFile);

      try {
        const response = await axios.post(`${API_URL}/api/raw_upload`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        if (Array.isArray(response.data?.raw_data)) {
          setFullData(response.data.raw_data);
          console.log("✅ fullData loaded for Raw Viewer:", response.data.raw_data.length);
        } else {
          console.error("❌ raw_data missing or malformed:", response.data);
        }

      } catch (error) {
        console.error("❌ Failed to fetch raw data:", error);
      }
    };

    loadRawData();
  }, [showRawViewer, rawUploadFile, setFullData]);
}
