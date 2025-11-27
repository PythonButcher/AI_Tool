import unittest
import pandas as pd
import numpy as np
import sys
import os
from flask import Flask, json

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from backend.services.ml_logic import detect_anomalies
from backend.routes.analysis import analysis_bp
from backend.utils import global_state

class TestAnomalyDetection(unittest.TestCase):
    def setUp(self):
        self.app = Flask(__name__)
        self.app.register_blueprint(analysis_bp)
        self.client = self.app.test_client()

    def test_detect_anomalies_logic(self):
        # Create a dataframe with clear outliers
        data = {
            'val1': [10, 10, 10, 10, 10, 1000, 10, 10, 10, 10],
            'val2': [5, 5, 5, 5, 5, 500, 5, 5, 5, 5]
        }
        df = pd.DataFrame(data)
        
        # Expect index 5 to be an outlier
        outliers = detect_anomalies(df, contamination=0.1)
        self.assertIn(5, outliers)

    def test_api_endpoint(self):
        # Mock global state
        data = {
            'val1': [10, 10, 10, 10, 10, 1000, 10, 10, 10, 10],
            'val2': [5, 5, 5, 5, 5, 500, 5, 5, 5, 5]
        }
        df = pd.DataFrame(data)
        global_state.set_uploaded_df(df)

        # Call API
        response = self.client.post('/api/outliers', json={'contamination': 0.1})
        data = json.loads(response.data)

        self.assertEqual(response.status_code, 200)
        self.assertTrue(data['success'])
        self.assertIn(5, data['outlier_indices'])

    def test_no_numeric_columns(self):
        # Create a dataframe with no numeric columns
        data = {
            'cat1': ['a', 'b', 'c'],
            'cat2': ['x', 'y', 'z']
        }
        df = pd.DataFrame(data)
        global_state.set_uploaded_df(df)

        # Call API
        response = self.client.post('/api/outliers', json={'contamination': 0.1})
        data = json.loads(response.data)

        self.assertEqual(response.status_code, 400)
        self.assertIn('error', data)

if __name__ == '__main__':
    unittest.main()
