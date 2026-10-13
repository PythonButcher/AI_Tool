"""Forecast journeys and temporal isolation using regular multi-series data."""

from copy import deepcopy
from io import BytesIO
import os
from pathlib import Path
import subprocess
import sys
import unittest

import joblib
import numpy as np
import pandas as pd

from backend.ml_studio.artifacts import ManagedArtifactStore
from backend.ml_studio.forecasting import train_forecasting
from backend.ml_studio.training import TrainingFailure
from tests import test_ml_studio_api as api_tests
from tests import test_ml_studio_workflow_execution as execution_tests
from tests import test_ml_studio_review as review_tests


class ForecastTests(unittest.TestCase):
    tearDown = api_tests.MLStudioApiTests.tearDown
    submit = execution_tests.WorkflowExecutionTests.submit
    execute = execution_tests.WorkflowExecutionTests.execute
    nominate = review_tests.ReviewTests.nominate
    final = review_tests.ReviewTests.final
    selection = review_tests.ReviewTests.selection

    def setUp(self):
        api_tests.MLStudioApiTests.setUp(self)
        times = pd.date_range('2025-01-01', periods=60, freq='D', tz='UTC')
        self.data = pd.concat([pd.DataFrame({'time': times, 'series': key, 'target': offset + np.arange(60) * .2 + np.sin(np.arange(60) * 2 * np.pi / 7), 'promotion': np.arange(60) % 2}) for key, offset in [('A', 20), ('B', 50)]], ignore_index=True)
        self.truth['row_count'] = len(self.data)
        self.truth['column_profile'] = [{'name': name, 'logical_type': kind, 'null_count': 0, 'distinct_count': int(self.data[name].nunique())} for name, kind in [('time', 'datetime'), ('series', 'text'), ('target', 'numeric'), ('promotion', 'numeric')]]
        self.store = ManagedArtifactStore(self.root / 'artifacts')
        self.service._artifact_store = self.store
        self.service._run_data_resolver = lambda snapshot: (self.data.copy(), 3, {item['source_id']: (item['content_fingerprint'], item['schema_version']) for item in self.truth['source_fingerprints']})
        snapshot = self.service.create_snapshot(api_tests.snapshot_request())
        self.draft = self.service.create_draft({'workspace_id': 'workspace-1', 'snapshot_id': snapshot['snapshot_id'], 'task_type': 'forecasting', 'active_stage': 'Configure',
            'roles': {'target': 'target', 'numeric': ['promotion'], 'categorical': [], 'time': ['time'], 'group': ['series'], 'ignored': []},
            'validation': {'strategy': 'rolling_origin', 'horizon': 3, 'frequency': 'D', 'folds': 2, 'lags': 3, 'season_length': 7, 'seed': 42, 'future_features_known': True},
            'candidate': {'families': ['lagged_ridge']}})['draft']
        self.ready = self.service.assess_draft(self.draft['experiment_id'], 'workspace-1', self.draft['etag'], {})
        self.assertEqual(self.ready['assessment']['state'], 'ready', self.ready['assessment']['issues'])
        self.config = self.ready['assessment']['configuration']
        self.base = '/api/ml-studio/v1/drafts/' + self.draft['experiment_id']
        self.runs_url = self.base + '/runs?workspace_id=workspace-1'

    def test_complete_forecast_cycle_and_portable_horizon_predictions(self):
        development = self.execute()
        evidence = development['evaluation_result']
        self.assertEqual(evidence['split']['strategy'], 'rolling_origin')
        self.assertEqual(evidence['split']['holdout_rows'], 6)
        self.assertEqual(evidence['candidates'][0]['evidence']['kind'], 'forecast')
        self.assertTrue(evidence['baseline']['alternatives'])
        nomination_response = self.nominate(development, family='lagged_ridge')
        self.assertEqual(nomination_response.status_code, 200, nomination_response.get_json())
        nomination = nomination_response.get_json()['nomination']
        final = self.final(nomination).get_json()['run']
        self.service.execute_run(final['run_id'])
        final = self.service.get_run(final['run_id'])
        self.assertEqual(final['status'], 'completed', final.get('failure'))
        selected_response = self.selection(nomination)
        self.assertEqual(selected_response.status_code, 200, selected_response.get_json())
        selection = selected_response.get_json()['selection']
        self.assertEqual(selection['artifact']['run_id'], final['run_id'])
        output_base = self.base + '/selections/' + selection['selection_id']
        details = self.client.get(output_base + '?workspace_id=workspace-1').get_json()
        schema = details['inference_schema']
        future = pd.read_csv(BytesIO(schema['template_csv'].encode()))
        future['promotion'] = [0, 1, 0, 0, 1, 0]
        self.assertEqual(len(future), 6)
        prediction = self.client.post(output_base + '/batch-predictions?workspace_id=workspace-1', json={'input_schema_version': schema['schema_id'], 'csv_text': future.to_csv(index=False)}, headers={'Idempotency-Key': 'future-1'})
        self.assertEqual(prediction.status_code, 200, prediction.get_json())
        receipt = prediction.get_json()['prediction']
        self.assertEqual([item['horizon'] for item in receipt['preview']], [1, 2, 3, 1, 2, 3])
        self.assertEqual({item['series'] for item in receipt['preview']}, {'A', 'B'})
        exported = self.client.post(output_base + '/exports?workspace_id=workspace-1', json={})
        self.assertEqual(exported.status_code, 200, exported.get_json())
        self.assertEqual(len(exported.get_json()['exports']), 9)
        for descriptor in exported.get_json()['exports']:
            response = self.client.get(output_base + '/exports/' + descriptor['kind'] + '?workspace_id=workspace-1')
            self.assertEqual(response.status_code, 200)
            (self.root / descriptor['filename']).write_bytes(response.data)
        (self.root / 'future.csv').write_bytes(future.to_csv(index=False).encode())
        env = {**os.environ, 'PYTHONPATH': os.pathsep.join(str(Path(value).resolve()) for value in os.environ.get('PYTHONPATH', '').split(os.pathsep) if value)}
        process = subprocess.run([sys.executable, 'inference-example.py', 'future.csv', 'predictions.csv'], cwd=self.root, env=env, capture_output=True, text=True, timeout=30)
        self.assertEqual(process.returncode, 0, process.stderr)
        np.testing.assert_allclose(pd.read_csv(self.root / 'predictions.csv')['prediction'], [item['prediction'] for item in receipt['preview']])
        wrong = future.copy()
        wrong.loc[0, 'time'] = '2030-01-01'
        rejected = self.client.post(output_base + '/batch-predictions?workspace_id=workspace-1', json={'input_schema_version': schema['schema_id'], 'csv_text': wrong.to_csv(index=False)}, headers={'Idempotency-Key': 'wrong-horizon'})
        self.assertEqual(rejected.status_code, 400)
        self.assertEqual(rejected.get_json()['error']['code'], 'forecast_input_invalid')

    def test_holdout_values_cannot_change_development_fits_or_evidence(self):
        self.config['candidate']['families'] = ['lagged_ridge', 'lagged_forest']
        original = train_forecasting(self.data, self.config, lambda _: None)
        changed = self.data.copy()
        changed.loc[changed.groupby('series').tail(3).index, 'target'] += 10000
        other = train_forecasting(changed, self.config, lambda _: None)
        self.assertEqual(original['candidates'], other['candidates'])
        self.assertEqual(original['baseline'], other['baseline'])
        bundle = joblib.load(BytesIO(original['bundles']['lagged_ridge']))
        self.assertFalse(set(bundle['development_indices']) & set(bundle['holdout_indices']))
        for split in original['split']['folds']:
            for origin in split['origins']:
                self.assertLess(pd.Timestamp(origin['last_training_time']), self.data['time'].max() - pd.Timedelta(days=3))

    def test_irregular_duplicate_short_history_and_unknown_future_features_block(self):
        for variant in ('duplicate', 'gap', 'short'):
            changed = self.data.copy()
            if variant == 'duplicate': changed.loc[1, 'time'] = changed.loc[0, 'time']
            elif variant == 'gap': changed.loc[1, 'time'] += pd.Timedelta(hours=1)
            else: changed = changed.groupby('series').head(12)
            with self.assertRaises(TrainingFailure):
                train_forecasting(changed, self.config, lambda _: None)
        changed = self.service.update_draft(self.draft['experiment_id'], 'workspace-1', self.ready['draft']['etag'], {'validation': {**self.config['validation'], 'future_features_known': False}})
        assessment = self.service.assess_draft(self.draft['experiment_id'], 'workspace-1', changed['draft']['etag'], {})['assessment']
        self.assertEqual(assessment['state'], 'blocked')
        self.assertIn('future_features_required', [item['code'] for item in assessment['issues']])

    def test_single_step_forecasts_have_finite_metrics_without_undefined_r_squared(self):
        config = deepcopy(self.config)
        config['validation']['horizon'] = 1
        config['roles']['group'] = []
        result = train_forecasting(self.data[self.data.series == 'A'], config, lambda _: None)
        self.assertEqual(set(result['candidates'][0]['metrics']), {'rmse', 'mae'})
        self.assertTrue(all(np.isfinite(value) for value in result['candidates'][0]['metrics'].values()))


if __name__ == '__main__':
    unittest.main()
