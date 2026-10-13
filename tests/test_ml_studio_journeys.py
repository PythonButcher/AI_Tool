"""All five workflows against real catalog data, preparation and ML persistence."""

from io import BytesIO
from pathlib import Path
import hashlib
import unittest

import numpy as np
import pandas as pd
from flask import Flask

from backend.ml_studio.artifacts import ManagedArtifactStore
from backend.ml_studio.repository import MLStudioRepository
from backend.ml_studio.service import MLStudioService
from backend.repositories.source_workspace_repository import get_workspace
from backend.routes.ml_studio import ml_studio_bp, _resolve_snapshot_truth, _resolve_run_data
from backend.routes.upload import upload_bp
from tests import test_workspace_cleaning as cleaning_tests


class IntegratedJourneys(unittest.TestCase):
    upload = cleaning_tests.WorkspaceCleaningTests.upload
    tearDown = cleaning_tests.WorkspaceCleaningTests.tearDown

    def setUp(self):
        cleaning_tests.WorkspaceCleaningTests.setUp(self)
        self.root = Path(self.temp.name)
        self.repository = MLStudioRepository(self.root / 'ml.db')
        self.store = ManagedArtifactStore(self.root / 'artifacts')
        self.service = self.make_service()
        self.app = Flask(__name__)
        self.app.register_blueprint(upload_bp)
        self.app.register_blueprint(ml_studio_bp)
        self.app.config.update(TESTING=True, ML_STUDIO_SERVICE=self.service)
        self.client = self.app.test_client()

    def make_service(self):
        return MLStudioService(self.repository, _resolve_snapshot_truth, lambda metadata: self.store.read_verified(metadata),
            workspace_resolver=get_workspace, run_data_resolver=_resolve_run_data, artifact_store=self.store)

    def success(self, response):
        self.assertIn(response.status_code, (200, 201), response.get_json())
        return response.get_json()

    def test_five_real_prepared_task_cycles_and_reopened_outputs(self):
        rng = np.random.default_rng(71)
        size = 120
        x = rng.normal(0, 1, size)
        frame = pd.DataFrame({'date': pd.date_range('2025-01-01', periods=size).astype(str), 'x': x,
            'y': rng.normal(0, 1, size), 'value': 4 * x + rng.normal(0, .8, size),
            'forecast_value': 30 + np.arange(size) * .1 + np.sin(np.arange(size)),
            'class_label': np.where(x + rng.normal(0, .5, size) > 0, 'yes', 'no'),
            'anomaly_label': (np.arange(size) >= 108).astype(int), 'unused': 'discard during preparation'})
        frame.loc[108:, 'y'] += 15
        cases = [('regression', 'regularized_linear', 'value'), ('classification', 'logistic', 'class_label'),
                 ('forecasting', 'lagged_ridge', 'forecast_value'), ('clustering', 'mini_batch_kmeans', None),
                 ('anomaly_detection', 'local_outlier_factor', 'anomaly_label')]
        for task, family, target in cases:
            with self.subTest(task=task):
                upload = self.success(self.client.post('/api/upload', data={'file': (BytesIO(frame.to_csv(index=False).encode()), f'{task}.csv')}, content_type='multipart/form-data'))
                workspace = upload['workspace']['workspace_id']
                scope = '?workspace_id=' + workspace
                truth = _resolve_snapshot_truth(workspace)
                snapshot = self.success(self.client.post('/api/ml-studio/v1/snapshots', json={key: truth[key] for key in ('workspace_id', 'workspace_version', 'source_ids', 'relationship_ids')}))['snapshot']
                draft = self.success(self.client.post('/api/ml-studio/v1/drafts', json={'workspace_id': workspace, 'snapshot_id': snapshot['snapshot_id'], 'task_type': task,
                    'name': f'{task} integration', 'goal': 'Review evidence for the original local question', 'active_stage': 'Prepare Data'}))['draft']
                base = '/api/ml-studio/v1/drafts/' + draft['experiment_id']
                prep = {'snapshot_id': snapshot['snapshot_id'], 'steps': [{'type': 'remove_columns', 'params': {'columns': ['unused']}}], 'issue_id': None, 'fix_id': None, 'return_stage': 'Prepare Data'}
                operation = self.success(self.client.post(base + '/preparation' + scope, json=prep, headers={'If-Match': draft['etag'], 'Idempotency-Key': 'prepare-cancel'}))['preparation']
                operation_url = base + '/preparation/' + operation['operation_id'] + scope
                preview = self.success(self.client.post(operation_url, json={'action': 'preview'}))['preview']
                self.assertEqual(preview['row_count'], size)
                self.assertFalse(preview['committed'])
                cancelled = self.success(self.client.post(operation_url, json={'action': 'cancel'}, headers={'If-Match': draft['etag']}))
                self.assertEqual(cancelled['draft'], draft)
                operation = self.success(self.client.post(base + '/preparation' + scope, json=prep, headers={'If-Match': draft['etag'], 'Idempotency-Key': 'prepare-apply'}))['preparation']
                applied = self.success(self.client.post(base + '/preparation/' + operation['operation_id'] + scope, json={'action': 'apply'}, headers={'If-Match': draft['etag']}))
                draft = applied['draft']
                self.assertNotEqual(draft['snapshot_id'], snapshot['snapshot_id'])
                self.assertEqual(get_workspace(workspace)['version'], 2)
                roles = {'target': target, 'numeric': [] if task == 'forecasting' else ['x', 'y'], 'categorical': [], 'time': ['date'] if task == 'forecasting' else [], 'group': [], 'ignored': []}
                validation = {'strategy': 'stratified' if task == 'classification' else 'random', 'holdout_fraction': .2, 'folds': 2, 'seed': 42}
                candidates = {'families': [family]}
                if task == 'forecasting':
                    validation = {'strategy': 'rolling_origin', 'horizon': 3, 'lags': 3, 'frequency': 'D', 'folds': 2, 'season_length': 7, 'seed': 42, 'future_features_known': False}
                if task == 'clustering': candidates['cluster_count'] = 2
                if task == 'anomaly_detection': candidates.update({'contamination': .1, 'neighbors': 10})
                draft = self.success(self.client.patch(base + scope, json={'roles': roles, 'validation': validation, 'candidate': candidates, 'active_stage': 'Configure'}, headers={'If-Match': draft['etag']}))['draft']
                ready = self.success(self.client.post(base + '/assessment' + scope, json={}, headers={'If-Match': draft['etag']}))
                self.assertEqual(ready['assessment']['state'], 'ready', ready['assessment']['issues'])
                draft, config = ready['draft'], ready['assessment']['configuration']
                def submit(key):
                    return self.success(self.client.post(base + '/runs' + scope, json={'configuration_id': config['configuration_id']}, headers={'If-Match': draft['etag'], 'Idempotency-Key': f'{task}-{key}'}))['run']
                queued = submit('cancel-run')
                stopped = self.success(self.client.post(base + '/runs/' + queued['run_id'] + scope, json={'action': 'cancel'}))['run']
                self.assertEqual(stopped['status'], 'cancelled')
                interrupted = submit('restart-run')
                self.repository.recover_incomplete_runs()
                self.assertEqual(self.service.get_run(interrupted['run_id'])['status'], 'interrupted')
                run = submit('complete-run')
                self.assertEqual(submit('complete-run')['run_id'], run['run_id'])
                self.service.execute_run(run['run_id'])
                run = self.service.get_run(run['run_id'])
                self.assertEqual(run['status'], 'completed', run.get('failure'))
                nomination = self.success(self.client.post(base + '/nominations' + scope, json={'run_id': run['run_id'], 'family': family, 'nominator': 'Analyst', 'intended_use': 'Local review'}, headers={'If-Match': draft['etag']}))['nomination']
                final_url = base + '/nominations/' + nomination['nomination_id'] + '/final-evaluation' + scope
                final = self.success(self.client.post(final_url, json={}))['run']
                self.service.execute_run(final['run_id'])
                final = self.service.get_run(final['run_id'])
                self.assertEqual(final['status'], 'completed', final.get('failure'))
                self.assertEqual(self.success(self.client.post(final_url, json={}))['run']['evaluation_result'], final['evaluation_result'])
                selection = self.success(self.client.post(base + '/selections' + scope, json={'nomination_id': nomination['nomination_id'], 'reviewed_by': 'Analyst', 'intended_use': 'Local review', 'prohibited_use': 'Automatic consequential decisions'}, headers={'If-Match': draft['etag']}))['selection']
                selected_base = base + '/selections/' + selection['selection_id']
                # Reopen the service and repository before outputs: no browser or
                # worker memory may be necessary to recover the selected model.
                self.repository = MLStudioRepository(self.root / 'ml.db')
                self.service = self.make_service()
                self.app.config['ML_STUDIO_SERVICE'] = self.service
                restored = self.success(self.client.get(base + scope))
                self.assertTrue(restored['workflow_state']['experiment_complete'])
                details = self.success(self.client.get(selected_base + scope))
                self.assertEqual(details['summary']['problem_statement'], 'Review evidence for the original local question')
                self.assertEqual(details['summary']['configuration']['recipe_id'], operation['recipe']['recipe_id'])
                exports = self.success(self.client.post(selected_base + '/exports' + scope, json={}))['exports']
                self.assertEqual(len(exports), 9 if task in ('forecasting', 'anomaly_detection') else 8)
                for item in exports:
                    response = self.client.get(selected_base + '/exports/' + item['kind'] + scope)
                    self.assertEqual(response.status_code, 200)
                    self.assertEqual('sha256:' + hashlib.sha256(response.data).hexdigest(), item['artifact']['sha256'])
                schema = details['inference_schema']
                payload = {'input_schema_version': schema['schema_id']}
                payload.update({'csv_text': schema['template_csv']} if task == 'forecasting' else {'rows': [{'x': .5, 'y': .2}, {'x': -.5, 'y': 15}]})
                prediction = self.success(self.client.post(selected_base + '/batch-predictions' + scope, json=payload, headers={'Idempotency-Key': 'prediction'}))['prediction']
                self.assertEqual(prediction['row_count'], 3 if task == 'forecasting' else 2)
                self.assertTrue(self.client.get(selected_base + '/batch-predictions/' + prediction['prediction_id'] + '/download' + scope).data)
                self.assertEqual(self.success(self.client.get(selected_base + scope))['predictions'][0], prediction)
                changed = self.success(self.client.patch(base + scope, json={'validation': {**validation, 'seed': 43}}, headers={'If-Match': draft['etag']}))
                self.assertFalse(changed['workflow_state']['experiment_complete'])
                rejected = self.client.post(selected_base + '/batch-predictions' + scope, json=payload, headers={'Idempotency-Key': 'stale-prediction'})
                self.assertEqual(rejected.status_code, 409)


if __name__ == '__main__':
    unittest.main()
