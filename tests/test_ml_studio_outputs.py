"""Export bytes, external inference and durable prediction API integration."""

import hashlib
from io import BytesIO
import json
import os
from pathlib import Path
import subprocess
import sys
import unittest
from unittest.mock import patch

import joblib
import numpy as np
import pandas as pd

from tests import test_ml_studio_review as review_tests


class OutputTests(unittest.TestCase):
    tearDown = review_tests.ReviewTests.tearDown
    assess = review_tests.ReviewTests.assess
    submit = review_tests.ReviewTests.submit
    execute = review_tests.ReviewTests.execute
    nominate = review_tests.ReviewTests.nominate
    final = review_tests.ReviewTests.final
    selection = review_tests.ReviewTests.selection

    def setUp(self):
        review_tests.ReviewTests.setUp(self)
        self.data['row_id'] = [f'group-{index % 3}' for index in range(100)]
        self.data.loc[0, 'row_id'] = None
        changed = self.service.update_draft(self.draft['experiment_id'], 'workspace-1', self.ready['draft']['etag'],
            {'roles': {'target': 'target', 'numeric': ['feature'], 'categorical': ['row_id'], 'ignored': [], 'time': [], 'group': []}})
        self.ready = self.service.assess_draft(self.draft['experiment_id'], 'workspace-1', changed['draft']['etag'], {})
        self.config = self.ready['assessment']['configuration']
        run = self.execute()
        nomination = self.nominate(run).get_json()['nomination']
        final = self.final(nomination).get_json()['run']
        self.service.execute_run(final['run_id'])
        response = self.selection(nomination)
        self.assertEqual(response.status_code, 200, response.get_json())
        self.selected = response.get_json()['selection']
        self.output_base = self.base + '/selections/' + self.selected['selection_id']
        self.schema_id = self.client.get(self.output_base + '?workspace_id=workspace-1').get_json()['inference_schema']['schema_id']

    def prediction(self, payload, key='predict-1'):
        return self.client.post(self.output_base + '/batch-predictions?workspace_id=workspace-1',
            json={'input_schema_version': self.schema_id, **payload}, headers={'Idempotency-Key': key})

    def test_exports_are_verified_reloadable_and_example_runs_without_application_code(self):
        url = self.output_base + '/exports?workspace_id=workspace-1'
        response = self.client.post(url, json={})
        self.assertEqual(response.status_code, 200, response.get_json())
        exports = response.get_json()['exports']
        self.assertEqual(len(exports), 8)
        self.assertEqual(self.client.post(url, json={}).get_json()['exports'], exports)
        files = {}
        for descriptor in exports:
            download = self.client.get(self.output_base + '/exports/' + descriptor['kind'] + '?workspace_id=workspace-1')
            self.assertEqual(download.status_code, 200)
            digest = 'sha256:' + hashlib.sha256(download.data).hexdigest()
            self.assertEqual(digest, descriptor['artifact']['sha256'])
            self.assertEqual(download.headers['X-Artifact-SHA256'], digest)
            files[descriptor['filename']] = download.data
            (self.root / descriptor['filename']).write_bytes(download.data)
        model = joblib.load(BytesIO(files['model.joblib']))
        preprocessor = joblib.load(BytesIO(files['preprocessor.joblib']))
        frame = pd.DataFrame({'feature': [1.0, np.nan], 'row_id': ['group-1', 'unseen']})
        expected = model.predict(frame)
        self.assertEqual(preprocessor.transform(frame).shape[0], 2)
        (self.root / 'input.csv').write_bytes(b'feature,row_id\n1.0,group-1\n,unseen\n')
        env = {**os.environ, 'PYTHONPATH': os.pathsep.join(str(Path(value).resolve()) for value in os.environ.get('PYTHONPATH', '').split(os.pathsep) if value)}
        completed = subprocess.run([sys.executable, 'inference-example.py', 'input.csv', 'predictions.csv'], cwd=self.root, env=env, capture_output=True, text=True, timeout=30)
        self.assertEqual(completed.returncode, 0, completed.stderr)
        np.testing.assert_allclose(pd.read_csv(self.root / 'predictions.csv')['prediction'], expected)
        summary = json.loads(files['cycle-summary.json'])
        self.assertEqual(summary['selection'], self.selected)
        self.assertEqual(summary['configuration']['configuration_id'], self.config['configuration_id'])
        self.assertEqual(summary['publication'], 'local_only')

    def test_csv_prediction_validates_reloads_and_recovers_same_receipt(self):
        payload = {'csv_text': 'feature,row_id\n1.0,group-1\n,unseen\n2.0,\n'}
        response = self.prediction(payload)
        self.assertEqual(response.status_code, 200, response.get_json())
        receipt = response.get_json()['prediction']
        self.assertEqual(receipt['row_count'], 3)
        self.assertEqual(len(receipt['preview']), 3)
        self.assertEqual(receipt['model_artifact_hash'], self.selected['artifact']['sha256'])
        with patch('backend.ml_studio.outputs.run_with_limits', side_effect=AssertionError('must recover receipt')):
            self.assertEqual(self.prediction(payload).get_json()['prediction'], receipt)
        self.assertEqual(self.prediction({'rows': [{'feature': 2, 'row_id': 'other'}]}).status_code, 409)
        download = self.client.get(self.output_base + '/batch-predictions/' + receipt['prediction_id'] + '/download?workspace_id=workspace-1')
        self.assertEqual(download.status_code, 200)
        self.assertEqual(len(pd.read_csv(BytesIO(download.data))), 3)
        details = self.client.get(self.output_base + '?workspace_id=workspace-1').get_json()
        self.assertEqual(details['predictions'], [receipt])
        self.assertFalse(details['inference_schema']['probabilities_supported'])

    def test_schema_errors_are_bounded_do_not_echo_values_and_never_run_model(self):
        with patch('backend.ml_studio.outputs.run_with_limits', side_effect=AssertionError('invalid data must not predict')):
            for rows in ([{'feature': 'sensitive-secret', 'row_id': 'group-1'}], [{'feature': True, 'row_id': 3}], [{'feature': 1}], [{'feature': 1, 'row_id': 'x', 'target': 2}]):
                response = self.prediction({'rows': rows})
                self.assertEqual(response.status_code, 400, response.get_json())
                self.assertNotIn('sensitive-secret', response.get_data(as_text=True))
                self.assertTrue(response.get_json()['validation_issues'])
            self.assertEqual(self.prediction({'rows': []}).status_code, 400)
            self.assertEqual(self.prediction({'csv_text': 'feature,feature\n1,2'}).status_code, 400)
            self.assertEqual(self.prediction({'rows': [{'feature': 1, 'row_id': 'x'}], 'input_schema_version': 'old'}).status_code, 409)

    def test_stale_selection_blocks_new_predictions_and_cross_workspace_downloads(self):
        changed = self.service.update_draft(self.draft['experiment_id'], 'workspace-1', self.ready['draft']['etag'], {'metric': {'primary': 'mae'}})
        self.assertIsNone(changed['workflow_state']['selection_id'])
        self.assertEqual(self.prediction({'rows': [{'feature': 1, 'row_id': 'x'}]}).status_code, 409)
        self.assertEqual(self.client.get(self.output_base + '?workspace_id=other').status_code, 404)
        self.assertEqual(self.client.get(self.output_base + '/exports/executable?workspace_id=workspace-1').status_code, 404)


if __name__ == '__main__':
    unittest.main()
