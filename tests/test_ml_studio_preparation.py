"""Preparation lifecycle evidence across ML and catalog persistence boundaries."""

from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch
import unittest

from flask import Flask

from backend.ml_studio.preparation import DraftPreparationService
from backend.ml_studio.repository import MLStudioRepository
from backend.ml_studio.service import MLStudioService
from backend.repositories.source_workspace_repository import get_workspace, get_preparation_commit
from backend.routes.ml_studio import ml_studio_bp, _resolve_snapshot_truth
from backend.services.workspace_cleaning import clean_workspace
from tests import test_workspace_cleaning as cleaning_tests


class DraftPreparationTests(unittest.TestCase):
    upload = cleaning_tests.WorkspaceCleaningTests.upload
    tearDown = cleaning_tests.WorkspaceCleaningTests.tearDown

    def setUp(self):
        cleaning_tests.WorkspaceCleaningTests.setUp(self)
        from pathlib import Path
        self.path = Path(self.temp.name) / "ml.db"
        self.repository = MLStudioRepository(self.path)
        self.service = self.make_service(self.repository)
        self.app = Flask(__name__)
        from backend.routes.upload import upload_bp
        self.app.register_blueprint(upload_bp)
        self.app.register_blueprint(ml_studio_bp)
        self.app.config['ML_STUDIO_SERVICE'] = self.service
        self.client = self.app.test_client()
        self.workspace_id = self.first['workspace']['workspace_id']
        truth = _resolve_snapshot_truth(self.workspace_id)
        snapshot = self.service.create_snapshot({key: truth[key] for key in ('workspace_id', 'workspace_version', 'source_ids', 'relationship_ids')})
        self.draft = self.service.create_draft({
            'workspace_id': self.workspace_id, 'snapshot_id': snapshot['snapshot_id'], 'task_type': 'regression',
            'active_stage': 'Prepare Data', 'roles': {'target': 'value', 'numeric': ['row_id'], 'categorical': [], 'ignored': [], 'time': [], 'group': []},
        })['draft']
        self.url = f"/api/ml-studio/v1/drafts/{self.draft['experiment_id']}/preparation?workspace_id={self.workspace_id}"
        self.payload = {'snapshot_id': snapshot['snapshot_id'], 'steps': [{'type': 'remove_columns', 'params': {'columns': ['value']}}],
                        'issue_id': None, 'fix_id': None, 'return_stage': 'Prepare Data'}

    @staticmethod
    def make_service(repository):
        return MLStudioService(repository, _resolve_snapshot_truth, lambda metadata: None, workspace_resolver=get_workspace)

    def begin(self, **overrides):
        return self.client.post(self.url, json={**self.payload, **overrides}, headers={'If-Match': self.draft['etag'], 'Idempotency-Key': 'start-1'})

    def operation_url(self, operation):
        return self.url.split('?')[0] + '/' + operation['operation_id'] + '?' + self.url.split('?')[1]

    def action(self, operation, action, etag=None):
        return self.client.post(self.operation_url(operation), json={'action': action}, headers={'If-Match': etag or self.draft['etag']})

    def test_begin_issues_server_recipe_and_survives_restart_without_editing_draft(self):
        response = self.begin()
        self.assertEqual(response.status_code, 200, response.get_json())
        operation = response.get_json()['preparation']
        self.assertEqual(operation['base_draft_revision'], self.draft['draft_revision'])
        self.assertEqual(operation['snapshot_id'], self.draft['snapshot_id'])
        self.assertTrue(operation['recipe']['recipe_id'].startswith('recipe-'))
        self.assertTrue(operation['recipe']['canonical_recipe_hash'].startswith('sha256:'))
        self.assertEqual(self.repository.get_draft(self.draft['experiment_id'], self.workspace_id), self.draft)
        reopened = MLStudioRepository(self.path)
        self.app.config['ML_STUDIO_SERVICE'] = self.make_service(reopened)
        self.assertEqual(self.client.get(self.operation_url(operation)).get_json()['preparation'], operation)
        self.assertEqual(self.begin().get_json()['preparation'], operation)
        self.assertEqual(self.begin(return_stage='Data & Goal').status_code, 409)
        self.assertNotIn('start-1', str(operation))

    def test_preview_cancel_preserve_saved_draft_and_dataset(self):
        operation = self.begin().get_json()['preparation']
        preview = self.action(operation, 'preview')
        self.assertEqual(preview.status_code, 200, preview.get_json())
        self.assertFalse(preview.get_json()['preview']['committed'])
        self.assertEqual(len(preview.get_json()['preview']['preview']), 100)
        cancelled = self.action(operation, 'cancel')
        self.assertEqual(cancelled.status_code, 200, cancelled.get_json())
        self.assertEqual(cancelled.get_json()['draft'], self.draft)
        self.assertEqual(cancelled.get_json()['preparation']['status'], 'cancelled')
        self.assertIsNone(cancelled.get_json()['preparation_context'])
        self.assertEqual(get_workspace(self.workspace_id)['version'], 1)
        self.assertEqual(self.action(operation, 'cancel').status_code, 200)
        self.assertEqual(self.action(operation, 'apply').status_code, 409)

    def test_apply_reconciles_roles_snapshot_recipe_and_return_stage(self):
        operation = self.begin(return_stage='Data & Goal').get_json()['preparation']
        response = self.action(operation, 'apply')
        self.assertEqual(response.status_code, 200, response.get_json())
        result = response.get_json()
        draft = result['draft']
        self.assertIsNone(draft['roles']['target'])
        self.assertEqual(draft['roles']['numeric'], ['row_id'])
        self.assertEqual(draft['active_stage'], 'Data & Goal')
        self.assertNotEqual(draft['snapshot_id'], self.draft['snapshot_id'])
        self.assertEqual(draft['recipe_id'], operation['recipe']['recipe_id'])
        self.assertIsNone(draft['latest_assessment_id'])
        self.assertIsNone(draft['latest_assessment_fingerprint'])
        self.assertEqual(draft['draft_revision'], 2)
        self.assertEqual(get_workspace(self.workspace_id)['version'], 2)
        receipt = result['preparation']['result']['receipt']
        self.assertEqual(get_preparation_commit(operation['operation_id'], self.workspace_id), receipt)
        self.assertEqual(self.repository.get_snapshot(draft['snapshot_id'])['workspace_version'], receipt['workspace_version'])

    def test_open_preparation_blocks_saves_and_other_starts(self):
        operation = self.begin().get_json()['preparation']
        patch_url = self.url.split('/preparation')[0] + '?workspace_id=' + self.workspace_id
        response = self.client.patch(patch_url, json={'name': 'Concurrent change'}, headers={'If-Match': self.draft['etag']})
        self.assertEqual(response.status_code, 409, response.get_json())
        self.assertEqual(response.get_json()['error']['code'], 'draft_preparation_pending')
        response = self.client.post(self.url, json=self.payload, headers={'If-Match': self.draft['etag'], 'Idempotency-Key': 'another-start'})
        self.assertEqual(response.status_code, 409)
        self.assertEqual(self.action(operation, 'apply', etag='wrong').status_code, 409)
        self.assertEqual(get_workspace(self.workspace_id)['version'], 1)

    def test_lost_commit_response_recovers_without_second_cleaning(self):
        operation = self.begin().get_json()['preparation']
        from backend.ml_studio import repository as repository_module
        encode = repository_module._canonical_json
        def fail_draft_commit(value, **kwargs):
            if kwargs['label'] == 'prepared draft':
                raise RuntimeError('simulated lost draft commit')
            return encode(value, **kwargs)
        with patch('backend.services.workspace_cleaning.clean_workspace', wraps=clean_workspace) as cleaner:
            with patch('backend.ml_studio.repository._canonical_json', side_effect=fail_draft_commit):
                response = self.action(operation, 'apply')
            self.assertEqual(response.status_code, 500)
            self.assertEqual(get_workspace(self.workspace_id)['version'], 2)
            self.assertEqual(self.repository.get_draft(self.draft['experiment_id'], self.workspace_id), self.draft)
            self.assertEqual(self.action(operation, 'cancel').status_code, 409)
            # Reopen ML persistence to prove recovery needs no in-memory callback.
            self.app.config['ML_STUDIO_SERVICE'] = self.make_service(MLStudioRepository(self.path))
            recovered = self.action(operation, 'apply')
            self.assertEqual(recovered.status_code, 200, recovered.get_json())
            self.assertEqual(cleaner.call_count, 1)
            self.assertEqual(self.action(operation, 'apply').status_code, 200)
            self.assertEqual(cleaner.call_count, 1)
        self.assertEqual(get_workspace(self.workspace_id)['version'], 2)

    def test_replay_does_not_overwrite_newer_draft_edit(self):
        operation = self.begin().get_json()['preparation']
        applied = self.action(operation, 'apply').get_json()
        updated = self.service.update_draft(self.draft['experiment_id'], self.workspace_id, applied['draft']['etag'], {'name': 'Newer edit'})['draft']
        replay = self.action(operation, 'apply')
        self.assertEqual(replay.get_json()['draft'], updated)
        self.assertEqual(replay.get_json()['preparation']['result'], applied['preparation']['result'])

    def test_two_instances_apply_once(self):
        operation = self.begin().get_json()['preparation']
        def finish(_):
            repository = MLStudioRepository(self.path)
            prep = DraftPreparationService(self.make_service(repository), repository, clean_workspace, get_preparation_commit)
            return prep.finish(operation['operation_id'], self.draft['experiment_id'], self.workspace_id, self.draft['etag'], 'apply')['preparation']
        with ThreadPoolExecutor(max_workers=2) as executor:
            results = list(executor.map(finish, range(2)))
        self.assertEqual(results[0], results[1])
        self.assertEqual(get_workspace(self.workspace_id)['version'], 2)
        self.assertEqual(self.repository.get_draft(self.draft['experiment_id'], self.workspace_id)['draft_revision'], 2)

    def test_stale_workspace_rejects_apply_without_commit(self):
        operation = self.begin().get_json()['preparation']
        from backend.services.workspace_context import add_source_to_workspace
        add_source_to_workspace(workspace_id=self.workspace_id, source_id=self.second['source']['source_id'], version=1, alias='lookup', role='lookup')
        response = self.action(operation, 'apply')
        self.assertEqual(response.status_code, 409, response.get_json())
        self.assertIsNone(get_preparation_commit(operation['operation_id'], self.workspace_id))
        self.assertEqual(self.action(operation, 'cancel').status_code, 200)

    def test_wrong_identity_and_client_owned_fields_rejected(self):
        operation = self.begin().get_json()['preparation']
        wrong = self.operation_url(operation).replace(self.workspace_id, self.second['workspace']['workspace_id'])
        self.assertEqual(self.client.get(wrong).status_code, 404)
        for extra in ({'recipe_id': 'client'}, {'rows': []}, {'issue_id': 'invented', 'fix_id': 'invented'}):
            response = self.begin(**extra)
            self.assertIn(response.status_code, (400, 409), response.get_json())
        response = self.client.post(self.operation_url(operation), json={'action': 'apply', 'receipt': {}}, headers={'If-Match': self.draft['etag']})
        self.assertEqual(response.status_code, 400)

    def test_options_are_server_owned_and_begin_validates_issue_pair(self):
        options = self.client.get(self.url)
        self.assertEqual(options.status_code, 200, options.get_json())
        self.assertEqual(options.get_json()['snapshot_id'], self.draft['snapshot_id'])
        self.assertEqual(options.get_json()['issues'], [])
        self.assertEqual(self.begin(issue_id='fake', fix_id='fake').status_code, 400)

    def test_quality_groups_and_batch_preview_preserve_data_until_apply(self):
        from io import BytesIO
        body = b'row_id,value,label\n1,, A \n2,,B\n2,,B\n3,3,C\n4,4,D\n'
        uploaded = self.client.post('/api/upload', data={'file': (BytesIO(body), 'batch.csv')}, content_type='multipart/form-data')
        self.assertEqual(uploaded.status_code, 200, uploaded.get_json())
        self.workspace_id = uploaded.get_json()['workspace']['workspace_id']
        truth = _resolve_snapshot_truth(self.workspace_id)
        snapshot = self.service.create_snapshot({key: truth[key] for key in ('workspace_id', 'workspace_version', 'source_ids', 'relationship_ids')})
        self.draft = self.service.create_draft({'workspace_id': self.workspace_id, 'snapshot_id': snapshot['snapshot_id'], 'task_type': 'regression'})['draft']
        self.url = f"/api/ml-studio/v1/drafts/{self.draft['experiment_id']}/preparation?workspace_id={self.workspace_id}"
        self.payload['snapshot_id'] = snapshot['snapshot_id']
        options = self.client.get(self.url).get_json()
        self.assertEqual(options['row_count'], 5)
        self.assertEqual({issue['code']: issue['count'] for issue in options['issues']},
                         {'missing_values': 3, 'duplicate_rows': 1})
        self.assertIn('duplicate_rows', options['checks'])
        self.assertTrue(options['not_checked'])
        steps = [{'type': fix['action_type'], 'params': fix['parameters']} for fix in options['fixes']]
        operation = self.begin(steps=steps).get_json()['preparation']
        preview = self.action(operation, 'preview').get_json()['preview']
        self.assertEqual((preview['input_row_count'], preview['row_count'], preview['removed_row_count']), (5, 2, 3))
        self.assertEqual(get_workspace(self.workspace_id)['version'], 1)
        applied = self.action(operation, 'apply')
        self.assertEqual(applied.status_code, 200, applied.get_json())
        self.assertEqual(applied.get_json()['preparation']['result']['receipt']['row_count'], 2)
        self.assertEqual(self.client.get(self.url).get_json()['issues'], [])

    def test_quality_does_not_invent_numeric_type_or_domain_fixes(self):
        import pandas as pd
        from backend.ml_studio.preparation_quality import inspect_quality
        evidence = inspect_quality(pd.DataFrame({'amount': [1, float('inf')], 'code': [' 01 ', '02']}))
        self.assertEqual({issue['code'] for issue in evidence['findings']}, {'whitespace', 'non_finite_values'})
        self.assertEqual(evidence['data_preview'][0]['code'], ' 01 ')
        self.assertIsNone(evidence['data_preview'][1]['amount'])

    def test_missing_value_fix_is_issued_and_bound_to_current_snapshot(self):
        from io import BytesIO
        body = b'row_id,value\n' + b''.join(f'{i},{"" if i == 10 else i}\n'.encode() for i in range(150))
        uploaded = self.client.post('/api/upload', data={'file': (BytesIO(body), 'missing.csv')}, content_type='multipart/form-data')
        self.assertEqual(uploaded.status_code, 200, uploaded.get_json())
        self.workspace_id = uploaded.get_json()['workspace']['workspace_id']
        truth = _resolve_snapshot_truth(self.workspace_id)
        snapshot = self.service.create_snapshot({key: truth[key] for key in ('workspace_id', 'workspace_version', 'source_ids', 'relationship_ids')})
        self.draft = self.service.create_draft({'workspace_id': self.workspace_id, 'snapshot_id': snapshot['snapshot_id'], 'task_type': 'regression'})['draft']
        self.url = f"/api/ml-studio/v1/drafts/{self.draft['experiment_id']}/preparation?workspace_id={self.workspace_id}"
        self.payload['snapshot_id'] = snapshot['snapshot_id']
        options = self.client.get(self.url).get_json()
        self.assertEqual(len(options['issues']), 1)
        fix = options['fixes'][0]
        operation = self.begin(issue_id=fix['issue_id'], fix_id=fix['fix_id'], steps=[{'type': fix['action_type'], 'params': fix['parameters']}]).get_json()['preparation']
        self.assertEqual(operation['issue_id'], options['issues'][0]['issue_id'])
        response = self.action(operation, 'apply')
        self.assertEqual(response.status_code, 200, response.get_json())
        self.assertEqual(response.get_json()['preparation']['result']['receipt']['row_count'], 149)

    def test_newer_workspace_after_partial_commit_cannot_be_silently_reconciled(self):
        operation = self.begin().get_json()['preparation']
        clean_workspace(self.workspace_id, {'workspace_version': 1, 'source_id': operation['source_id'], 'preview_only': False, 'steps': []}, preparation_id=operation['operation_id'])
        from backend.services.workspace_context import add_source_to_workspace
        add_source_to_workspace(workspace_id=self.workspace_id, source_id=self.second['source']['source_id'], version=2, alias='later', role='lookup')
        response = self.action(operation, 'apply')
        self.assertEqual(response.status_code, 409, response.get_json())
        self.assertEqual(response.get_json()['error']['code'], 'preparation_workspace_conflict')
        self.assertEqual(self.repository.get_draft(self.draft['experiment_id'], self.workspace_id), self.draft)

    def test_stale_draft_and_unsafe_steps_cannot_start(self):
        for steps in ([{'type': 'unknown'}], [{'type': 'replace_values', 'params': {'path': 'C:/private.csv'}}]):
            self.assertEqual(self.begin(steps=steps).status_code, 400)
        self.service.update_draft(self.draft['experiment_id'], self.workspace_id, self.draft['etag'], {'name': 'Newer'})
        self.assertEqual(self.begin().status_code, 409)

    def test_apply_invalidates_existing_assessment_evidence(self):
        import json
        with self.repository._connection() as connection:
            enriched = {**self.draft, 'latest_assessment_id': 'assessment-server-issued',
                        'latest_assessment_fingerprint': 'sha256:' + 'a' * 64}
            connection.execute('UPDATE ml_experiment_drafts SET draft_json = ? WHERE experiment_id = ?',
                               (json.dumps(enriched), self.draft['experiment_id']))
        self.draft = enriched
        operation = self.begin().get_json()['preparation']
        applied = self.action(operation, 'apply').get_json()['draft']
        self.assertIsNone(applied['latest_assessment_id'])
        self.assertIsNone(applied['latest_assessment_fingerprint'])
