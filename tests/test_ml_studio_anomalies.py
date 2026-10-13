"""Detector workflows: labels never fit models, thresholds never use final rows."""

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

from backend.ml_studio.anomalies import train_anomalies, evaluation_labels
from backend.ml_studio.anomaly_runtime import predict_anomalies
from backend.ml_studio.artifacts import ManagedArtifactStore
from backend.ml_studio.configuration import assess_configuration
from backend.ml_studio.training import TrainingFailure
from tests import test_ml_studio_api as api_tests
from tests import test_ml_studio_workflow_execution as execution_tests
from tests import test_ml_studio_review as review_tests


class AnomalyTests(unittest.TestCase):
    tearDown = api_tests.MLStudioApiTests.tearDown
    submit = execution_tests.WorkflowExecutionTests.submit
    execute = execution_tests.WorkflowExecutionTests.execute
    nominate = review_tests.ReviewTests.nominate
    final = review_tests.ReviewTests.final
    selection = review_tests.ReviewTests.selection

    def setUp(self):
        api_tests.MLStudioApiTests.setUp(self)
        rng = np.random.default_rng(34)
        self.data = pd.DataFrame({'x': np.r_[rng.normal(0, 1, 135), rng.normal(12, 1, 15)], 'y': rng.normal(0, 1, 150), 'label': [0] * 135 + [1] * 15})
        self.truth['row_count'] = len(self.data)
        self.truth['column_profile'] = [{'name': name, 'logical_type': 'numeric', 'null_count': 0, 'distinct_count': int(self.data[name].nunique())} for name in self.data]
        self.store = ManagedArtifactStore(self.root / 'artifacts')
        self.service._artifact_store = self.store
        self.service._run_data_resolver = lambda snapshot: (self.data.copy(), 3, {item['source_id']: (item['content_fingerprint'], item['schema_version']) for item in self.truth['source_fingerprints']})
        self.snapshot = self.service.create_snapshot(api_tests.snapshot_request())
        self.draft = self.service.create_draft({'workspace_id': 'workspace-1', 'snapshot_id': self.snapshot['snapshot_id'], 'task_type': 'anomaly_detection', 'active_stage': 'Configure',
            'roles': {'target': 'label', 'numeric': ['x', 'y'], 'categorical': [], 'time': [], 'group': [], 'ignored': []},
            'validation': {'strategy': 'random', 'holdout_fraction': .2, 'folds': 2, 'seed': 42},
            'candidate': {'families': ['isolation_forest', 'local_outlier_factor'], 'contamination': .1, 'neighbors': 10}})['draft']
        self.ready = self.service.assess_draft(self.draft['experiment_id'], 'workspace-1', self.draft['etag'], {})
        self.assertEqual(self.ready['assessment']['state'], 'ready', self.ready['assessment']['issues'])
        self.config = self.ready['assessment']['configuration']
        self.base = '/api/ml-studio/v1/drafts/' + self.draft['experiment_id']
        self.runs_url = self.base + '/runs?workspace_id=workspace-1'

    def test_detector_journey_threshold_selection_exports_and_portable_scores(self):
        development = self.execute()
        evidence = development['evaluation_result']
        self.assertEqual(evidence['primary_metric'], 'score_stability')
        for candidate in evidence['candidates']:
            self.assertEqual(candidate['evidence']['kind'], 'anomaly_scores')
            self.assertIn('roc_auc', candidate['metrics'])
            self.assertGreater(candidate['metrics']['roc_auc'], .5)
        nomination = self.nominate(development, family='isolation_forest').get_json()['nomination']
        final = self.final(nomination).get_json()['run']
        self.service.execute_run(final['run_id'])
        final = self.service.get_run(final['run_id'])
        self.assertEqual(final['status'], 'completed', final.get('failure'))
        selected_response = self.selection(nomination)
        self.assertEqual(selected_response.status_code, 200, selected_response.get_json())
        selected = selected_response.get_json()['selection']
        output_base = self.base + '/selections/' + selected['selection_id']
        schema = self.client.get(output_base + '?workspace_id=workspace-1').get_json()['inference_schema']
        self.assertEqual([field['name'] for field in schema['fields']], ['x', 'y'])
        self.assertEqual(schema['detector']['threshold'], final['evaluation_result']['evidence']['selected_threshold'])
        rows = [{'x': 0, 'y': .1}, {'x': 25, 'y': 10}]
        response = self.client.post(output_base + '/batch-predictions?workspace_id=workspace-1', json={'input_schema_version': schema['schema_id'], 'rows': rows}, headers={'Idempotency-Key': 'scores-1'})
        self.assertEqual(response.status_code, 200, response.get_json())
        receipt = response.get_json()['prediction']
        self.assertEqual(receipt['output_columns'], ['input_row', 'score', 'is_unusual'])
        self.assertEqual([item['is_unusual'] for item in receipt['preview']], [False, True])
        exports = self.client.post(output_base + '/exports?workspace_id=workspace-1', json={})
        self.assertEqual(exports.status_code, 200, exports.get_json())
        self.assertEqual(len(exports.get_json()['exports']), 9)
        for descriptor in exports.get_json()['exports']:
            response = self.client.get(output_base + '/exports/' + descriptor['kind'] + '?workspace_id=workspace-1')
            self.assertEqual(response.status_code, 200)
            (self.root / descriptor['filename']).write_bytes(response.data)
        (self.root / 'rows.csv').write_bytes(pd.DataFrame(rows).to_csv(index=False).encode())
        env = {**os.environ, 'PYTHONPATH': os.pathsep.join(str(Path(value).resolve()) for value in os.environ.get('PYTHONPATH', '').split(os.pathsep) if value)}
        process = subprocess.run([sys.executable, 'inference-example.py', 'rows.csv', 'predictions.csv'], cwd=self.root, env=env, capture_output=True, text=True, timeout=30)
        self.assertEqual(process.returncode, 0, process.stderr)
        exported = pd.read_csv(self.root / 'predictions.csv')
        np.testing.assert_allclose(exported['score'], [item['score'] for item in receipt['preview']])
        self.assertEqual(exported['is_unusual'].tolist(), [False, True])

    def test_labels_and_reserved_features_cannot_change_detector_or_threshold(self):
        result = train_anomalies(self.data, self.config, lambda _: None)
        first = joblib.load(BytesIO(result['bundles']['isolation_forest']))
        changed = self.data.copy()
        changed['label'] = 1 - changed['label']
        changed.loc[first['holdout_indices'], 'x'] = 100000
        other = train_anomalies(changed, self.config, lambda _: None)
        for family in self.config['candidate']['families']:
            original_model = joblib.load(BytesIO(result['bundles'][family]))['pipeline']
            changed_model = joblib.load(BytesIO(other['bundles'][family]))['pipeline']
            self.assertEqual(original_model['threshold'], changed_model['threshold'])
            np.testing.assert_allclose(predict_anomalies(original_model, self.data)[0], predict_anomalies(changed_model, self.data)[0])
        for original, modified in zip(result['candidates'], other['candidates']):
            for metric in ('score_stability', 'flag_agreement', 'flagged_fraction'):
                self.assertEqual(original['metrics'][metric], modified['metrics'][metric])

    def test_unlabeled_evidence_does_not_invent_accuracy_and_invalid_labels_block(self):
        config = deepcopy(self.config)
        config['roles']['target'] = None
        result = train_anomalies(self.data, config, lambda _: None)
        for candidate in result['candidates']:
            self.assertNotIn('roc_auc', candidate['metrics'])
            self.assertNotIn('precision', candidate['metrics'])
            self.assertEqual(candidate['evidence']['labeled_rows'], 0)
        draft = deepcopy(self.draft)
        draft['roles']['target'] = None
        draft['metric'] = {'primary': 'roc_auc'}
        draft['candidate']['contamination'] = .9
        issues = assess_configuration(draft, self.snapshot)['issues']
        self.assertTrue({'anomaly_labels_required', 'anomaly_threshold_invalid'}.issubset({item['code'] for item in issues}))
        with self.assertRaises(TrainingFailure):
            evaluation_labels(self.data.assign(label=2), self.config)


if __name__ == '__main__':
    unittest.main()
