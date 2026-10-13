"""Real clustering selection, portable assignment and leakage boundaries."""

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
from backend.ml_studio.clustering import train_clustering
from backend.ml_studio.configuration import assess_configuration
from backend.ml_studio.training import TrainingFailure
from tests import test_ml_studio_api as api_tests
from tests import test_ml_studio_workflow_execution as execution_tests
from tests import test_ml_studio_review as review_tests


class ClusteringTests(unittest.TestCase):
    tearDown = api_tests.MLStudioApiTests.tearDown
    submit = execution_tests.WorkflowExecutionTests.submit
    execute = execution_tests.WorkflowExecutionTests.execute
    nominate = review_tests.ReviewTests.nominate
    final = review_tests.ReviewTests.final
    selection = review_tests.ReviewTests.selection

    def setUp(self):
        api_tests.MLStudioApiTests.setUp(self)
        rng = np.random.default_rng(19)
        self.data = pd.DataFrame({'x': np.r_[rng.normal(-5, .5, 60), rng.normal(5, .5, 60)], 'y': rng.normal(0, .3, 120), 'kind': ['a'] * 60 + ['b'] * 60})
        self.truth['row_count'] = len(self.data)
        self.truth['column_profile'] = [{'name': name, 'logical_type': 'text' if name == 'kind' else 'numeric', 'null_count': 0, 'distinct_count': int(self.data[name].nunique())} for name in self.data]
        self.store = ManagedArtifactStore(self.root / 'artifacts')
        self.service._artifact_store = self.store
        self.service._run_data_resolver = lambda snapshot: (self.data.copy(), 3, {item['source_id']: (item['content_fingerprint'], item['schema_version']) for item in self.truth['source_fingerprints']})
        snapshot = self.service.create_snapshot(api_tests.snapshot_request())
        self.snapshot = snapshot
        self.draft = self.service.create_draft({'workspace_id': 'workspace-1', 'snapshot_id': snapshot['snapshot_id'], 'task_type': 'clustering', 'active_stage': 'Configure',
            'roles': {'target': None, 'numeric': ['x', 'y'], 'categorical': ['kind'], 'time': [], 'group': [], 'ignored': []},
            'validation': {'strategy': 'random', 'holdout_fraction': .2, 'folds': 2, 'seed': 42},
            'candidate': {'families': ['kmeans', 'mini_batch_kmeans'], 'cluster_count': 2}})['draft']
        self.ready = self.service.assess_draft(self.draft['experiment_id'], 'workspace-1', self.draft['etag'], {})
        self.assertEqual(self.ready['assessment']['state'], 'ready', self.ready['assessment']['issues'])
        self.config = self.ready['assessment']['configuration']
        self.base = '/api/ml-studio/v1/drafts/' + self.draft['experiment_id']
        self.runs_url = self.base + '/runs?workspace_id=workspace-1'

    def test_complete_cluster_cycle_and_portable_assignments(self):
        development = self.execute()
        evidence = development['evaluation_result']
        self.assertEqual(evidence['metric_direction'], 'maximize')
        self.assertIsNone(evidence['baseline']['metrics']['silhouette'])
        self.assertEqual(len(evidence['candidates']), 2)
        for candidate in evidence['candidates']:
            self.assertGreater(candidate['metrics']['silhouette'], 0)
            self.assertGreater(candidate['metrics']['stability_ari'], .5)
            self.assertEqual(sum(profile['rows'] for profile in candidate['evidence']['profiles']), 96)
            self.assertLess(candidate['metrics']['distortion'], evidence['baseline']['metrics']['distortion'])
        response = self.nominate(development, family='kmeans')
        self.assertEqual(response.status_code, 200, response.get_json())
        nomination = response.get_json()['nomination']
        final = self.final(nomination).get_json()['run']
        self.service.execute_run(final['run_id'])
        final = self.service.get_run(final['run_id'])
        self.assertEqual(final['status'], 'completed', final.get('failure'))
        self.assertEqual(final['evaluation_result']['holdout_rows'], 24)
        selected = self.selection(nomination).get_json()['selection']
        output_base = self.base + '/selections/' + selected['selection_id']
        schema = self.client.get(output_base + '?workspace_id=workspace-1').get_json()['inference_schema']
        self.assertEqual(schema['outputs'], [{'name': 'cluster', 'logical_type': 'integer'}])
        rows = [{'x': -5, 'y': .1, 'kind': 'a'}, {'x': 5, 'y': -.1, 'kind': 'unseen'}]
        prediction = self.client.post(output_base + '/batch-predictions?workspace_id=workspace-1', json={'input_schema_version': schema['schema_id'], 'rows': rows}, headers={'Idempotency-Key': 'cluster-1'})
        self.assertEqual(prediction.status_code, 200, prediction.get_json())
        receipt = prediction.get_json()['prediction']
        self.assertEqual(receipt['output_columns'], ['input_row', 'cluster'])
        self.assertNotEqual(receipt['preview'][0]['cluster'], receipt['preview'][1]['cluster'])
        exports = self.client.post(output_base + '/exports?workspace_id=workspace-1', json={})
        self.assertEqual(exports.status_code, 200, exports.get_json())
        for descriptor in exports.get_json()['exports']:
            response = self.client.get(output_base + '/exports/' + descriptor['kind'] + '?workspace_id=workspace-1')
            self.assertEqual(response.status_code, 200)
            (self.root / descriptor['filename']).write_bytes(response.data)
        (self.root / 'rows.csv').write_bytes(pd.DataFrame(rows).to_csv(index=False).encode())
        env = {**os.environ, 'PYTHONPATH': os.pathsep.join(str(Path(value).resolve()) for value in os.environ.get('PYTHONPATH', '').split(os.pathsep) if value)}
        process = subprocess.run([sys.executable, 'inference-example.py', 'rows.csv', 'predictions.csv'], cwd=self.root, env=env, capture_output=True, text=True, timeout=30)
        self.assertEqual(process.returncode, 0, process.stderr)
        self.assertEqual(pd.read_csv(self.root / 'predictions.csv')['cluster'].tolist(), [item['cluster'] for item in receipt['preview']])

    def test_holdout_features_do_not_change_fits_profiles_or_development_scores(self):
        result = train_clustering(self.data, self.config, lambda _: None)
        bundle = joblib.load(BytesIO(result['bundles']['kmeans']))
        changed = self.data.copy()
        changed.loc[bundle['holdout_indices'], 'x'] = 10000
        other = train_clustering(changed, self.config, lambda _: None)
        self.assertEqual(result['candidates'], other['candidates'])
        self.assertEqual(result['baseline'], other['baseline'])
        np.testing.assert_allclose(bundle['pipeline'].named_steps['model'].cluster_centers_, joblib.load(BytesIO(other['bundles']['kmeans']))['pipeline'].named_steps['model'].cluster_centers_)

    def test_configuration_target_invalid_count_and_collapsed_geometry(self):
        draft = deepcopy(self.draft)
        draft['roles']['target'] = 'x'
        draft['roles']['numeric'] = ['y']
        draft['candidate']['cluster_count'] = 1
        issues = assess_configuration(draft, self.snapshot)['issues']
        self.assertTrue({'clustering_target', 'invalid_limit'}.issubset({item['code'] for item in issues}))
        with self.assertRaises(TrainingFailure):
            train_clustering(self.data.assign(x=1, y=1, kind='a'), self.config, lambda _: None)


if __name__ == '__main__':
    unittest.main()
