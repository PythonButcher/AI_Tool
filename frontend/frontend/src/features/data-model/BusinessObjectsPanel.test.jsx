import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import SourceModelCanvas from './SourceModelCanvas';
import BusinessObjectsPanel from './BusinessObjectsPanel';
import { DataContext } from '../../context/DataContext';

jest.mock('@xyflow/react', () => ({
  ReactFlow: ({ children }) => <div data-testid="react-flow">{children}</div>,
  Controls: () => <div data-testid="rf-controls" />,
  Background: () => <div data-testid="rf-background" />,
  Handle: () => <div />,
  MarkerType: { ArrowClosed: 'arrowclosed' },
  Position: { Left: 'left', Right: 'right' },
  ConnectionMode: { Loose: 'loose' },
  useNodesState: (initial) => [initial, jest.fn(), jest.fn()],
  useEdgesState: (initial) => [initial, jest.fn(), jest.fn()],
}));

const createDeferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const jsonResponse = (body, status = 200) =>
  Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });

const WS_DEMO = {
  workspace_id: 'ws_demo',
  name: 'Operations Model',
  version: 1,
  sources: [
    { workspace_id: 'ws_demo', source_id: 'src_customer', alias: 'Customers', role: 'primary' },
    { workspace_id: 'ws_demo', source_id: 'src_orders', alias: 'Orders', role: 'lookup' },
    { workspace_id: 'ws_demo', source_id: 'src_equipment', alias: 'Equipment Assets', role: 'context' },
    { workspace_id: 'ws_demo', source_id: 'src_maintenance', alias: 'Maintenance', role: 'lookup' },
  ],
};

const CATALOG_BY_ID = {
  src_customer: {
    source_id: 'src_customer',
    name: 'customers.csv',
    schema: [{ name: 'customer_id', data_type: 'string' }, { name: 'name', data_type: 'string' }],
  },
  src_orders: {
    source_id: 'src_orders',
    name: 'orders.csv',
    schema: [{ name: 'buyer', data_type: 'string' }, { name: 'total', data_type: 'number' }],
  },
  src_equipment: {
    source_id: 'src_equipment',
    name: 'equipment.csv',
    schema: [{ name: 'asset_tag', data_type: 'string' }, { name: 'title', data_type: 'string' }],
  },
  src_maintenance: {
    source_id: 'src_maintenance',
    name: 'maintenance.csv',
    schema: [{ name: 'equipment_ref', data_type: 'string' }, { name: 'work', data_type: 'string' }],
  },
};

const DEMO_RELATIONSHIPS = [
  {
    workspace_id: 'ws_demo',
    relationship_id: 'rel_orders',
    left_source_id: 'src_customer',
    right_source_id: 'src_orders',
    field_pairs: [{ left_field: 'customer_id', right_field: 'buyer' }],
    cardinality: 'one_to_many',
  },
  {
    workspace_id: 'ws_demo',
    relationship_id: 'rel_maintenance',
    left_source_id: 'src_maintenance',
    right_source_id: 'src_equipment',
    field_pairs: [{ left_field: 'equipment_ref', right_field: 'asset_tag' }],
    cardinality: 'one_to_many',
  },
];

const HYDRATED_SOURCES = WS_DEMO.sources.map((s) => ({ ...CATALOG_BY_ID[s.source_id], ...s }));

const CUSTOMER_OBJ = {
  contract_version: 'business_object_definition_v1',
  object_id: 'obj_customer',
  workspace_id: 'ws_demo',
  display_name: 'Customer',
  source_id: 'src_customer',
  record_key_field: 'customer_id',
  display_field: 'name',
  relationship_ids: ['rel_orders'],
  created_at: '2026-11-22T15:00:00Z',
  configuration_error: null,
};

const EQUIPMENT_OBJ = {
  contract_version: 'business_object_definition_v1',
  object_id: 'obj_equipment',
  workspace_id: 'ws_demo',
  display_name: 'Equipment',
  source_id: 'src_equipment',
  record_key_field: 'asset_tag',
  display_field: 'title',
  relationship_ids: ['rel_maintenance'],
  created_at: '2026-11-22T15:05:00Z',
  configuration_error: null,
};

describe('BusinessObjectsPanel and SourceModelCanvas integration', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('saves two distinct configurations, reloads saved definitions with configuration_error on reopen, and preserves canvas controls', async () => {
    let savedList = [];
    global.fetch.mockImplementation((url, options = {}) => {
      if (url.endsWith('/api/data-sources')) {
        return jsonResponse({ sources: [] });
      }
      if (url.includes('/api/data-sources/')) {
        const id = url.split('/api/data-sources/')[1];
        return jsonResponse({ source: CATALOG_BY_ID[id] });
      }
      if (url.endsWith('/api/data-workspaces/ws_demo/relationships')) {
        return jsonResponse({ relationships: DEMO_RELATIONSHIPS });
      }
      if (url.endsWith('/api/data-workspaces/ws_demo/business-objects')) {
        if (options.method === 'POST') {
          const body = JSON.parse(options.body);
          const created = body.source_id === 'src_customer' ? CUSTOMER_OBJ : EQUIPMENT_OBJ;
          savedList = [...savedList, created];
          return jsonResponse({ business_object: created }, 201);
        }
        return jsonResponse({ business_objects: savedList });
      }
      return jsonResponse({});
    });

    const contextValue = {
      activeWorkspace: WS_DEMO,
      refreshWorkspace: jest.fn().mockResolvedValue({ workspace: WS_DEMO }),
      setWorkspaceEnvelope: jest.fn(),
      recordWorkspaceMutationConflict: jest.fn(),
    };

    render(
      <DataContext.Provider value={contextValue}>
        <SourceModelCanvas workspaceId="ws_demo" />
      </DataContext.Provider>
    );

    const openBtn = await screen.findByRole('button', { name: 'Business Objects' });
    fireEvent.click(openBtn);

    expect(await screen.findByText('No Business Objects saved in this workspace yet.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Display Name'), { target: { value: 'Customer' } });
    fireEvent.change(screen.getByLabelText('Member Source'), { target: { value: 'src_customer' } });
    fireEvent.change(screen.getByLabelText('Record Key Field'), { target: { value: 'customer_id' } });
    fireEvent.change(screen.getByLabelText('Label Field (optional)'), { target: { value: 'name' } });
    fireEvent.click(screen.getByLabelText('Orders (customer_id = buyer)'));
    fireEvent.click(screen.getByRole('button', { name: 'Save Business Object' }));

    expect(await screen.findByText('Customer')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Display Name'), { target: { value: 'Equipment' } });
    fireEvent.change(screen.getByLabelText('Member Source'), { target: { value: 'src_equipment' } });
    expect(screen.getByLabelText('Record Key Field')).toHaveValue('');
    fireEvent.change(screen.getByLabelText('Record Key Field'), { target: { value: 'asset_tag' } });
    fireEvent.change(screen.getByLabelText('Label Field (optional)'), { target: { value: 'title' } });
    fireEvent.click(screen.getByLabelText('Maintenance (equipment_ref = asset_tag)'));
    fireEvent.click(screen.getByRole('button', { name: 'Save Business Object' }));

    expect(await screen.findByText('Equipment')).toBeInTheDocument();

    const postCalls = global.fetch.mock.calls.filter(([, opts]) => opts?.method === 'POST');
    expect(postCalls).toHaveLength(2);
    expect(JSON.parse(postCalls[0][1].body)).toEqual({
      display_name: 'Customer',
      source_id: 'src_customer',
      record_key_field: 'customer_id',
      display_field: 'name',
      relationship_ids: ['rel_orders'],
    });
    expect(JSON.parse(postCalls[1][1].body)).toEqual({
      display_name: 'Equipment',
      source_id: 'src_equipment',
      record_key_field: 'asset_tag',
      display_field: 'title',
      relationship_ids: ['rel_maintenance'],
    });

    savedList = [
      {
        ...CUSTOMER_OBJ,
        configuration_error: {
          code: 'source_field_not_found',
          message: "Field 'name' is missing from the object source.",
        },
      },
      EQUIPMENT_OBJ,
    ];

    fireEvent.click(screen.getByRole('button', { name: 'Close Business Objects' }));
    expect(openBtn).toHaveFocus();

    fireEvent.click(openBtn);
    expect(await screen.findByText("Field 'name' is missing from the object source.")).toBeInTheDocument();
    expect(screen.getByText('Equipment')).toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Business Objects' }), { key: 'Escape' });
    expect(openBtn).toHaveFocus();

    fireEvent.click(screen.getByRole('button', { name: 'Create Relationship' }));
    expect(await screen.findByRole('heading', { name: 'Create Relationship' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    fireEvent.click(screen.getByRole('button', { name: 'Add Source' }));
    expect(await screen.findByRole('dialog', { name: 'Add Source to Workspace' })).toBeInTheDocument();
    expect( await screen.findByText('No available catalog sources to add.')).toBeInTheDocument();
  });

  test('In-Flight Navigation: closing during deferred POST prevents late completion from mutating reopened list', async () => {
    const deferredPost = createDeferred();
    global.fetch.mockImplementation((url, options = {}) => {
      if (options.method === 'POST') return deferredPost.promise;
      return jsonResponse({ business_objects: [] });
    });

    const { unmount } = render(
      <BusinessObjectsPanel
        workspaceId="ws_demo"
        sources={HYDRATED_SOURCES}
        relationships={DEMO_RELATIONSHIPS}
        onClose={jest.fn()}
      />
    );

    await screen.findByText('No Business Objects saved in this workspace yet.');
    fireEvent.change(screen.getByLabelText('Display Name'), { target: { value: 'Customer' } });
    fireEvent.change(screen.getByLabelText('Member Source'), { target: { value: 'src_customer' } });
    fireEvent.change(screen.getByLabelText('Record Key Field'), { target: { value: 'customer_id' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Business Object' }));

    unmount();

    render(
      <BusinessObjectsPanel
        workspaceId="ws_demo"
        sources={HYDRATED_SOURCES}
        relationships={DEMO_RELATIONSHIPS}
        onClose={jest.fn()}
      />
    );

    await screen.findByText('No Business Objects saved in this workspace yet.');
    deferredPost.resolve({
      ok: true,
      status: 201,
      json: () => Promise.resolve({ business_object: CUSTOMER_OBJ }),
    });

    await waitFor(() => {
      expect(screen.queryByText('Customer')).not.toBeInTheDocument();
    });
  });

  test('Concurrent Edits: disables form controls during deferred save and submits only original payload', async () => {
    const deferredPost = createDeferred();
    global.fetch.mockImplementation((url, options = {}) => {
      if (options.method === 'POST') return deferredPost.promise;
      return jsonResponse({ business_objects: [] });
    });

    render(
      <BusinessObjectsPanel
        workspaceId="ws_demo"
        sources={HYDRATED_SOURCES}
        relationships={DEMO_RELATIONSHIPS}
        onClose={jest.fn()}
      />
    );

    await screen.findByText('No Business Objects saved in this workspace yet.');
    const nameInput = screen.getByLabelText('Display Name');
    fireEvent.change(nameInput, { target: { value: 'Customer' } });
    fireEvent.change(screen.getByLabelText('Member Source'), { target: { value: 'src_customer' } });
    fireEvent.change(screen.getByLabelText('Record Key Field'), { target: { value: 'customer_id' } });

    const saveBtn = screen.getByRole('button', { name: 'Save Business Object' });
    fireEvent.click(saveBtn);

    expect(nameInput).toBeDisabled();
    expect(screen.getByLabelText('Member Source')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled();

    fireEvent.change(nameInput, { target: { value: 'Edited While Saving' } });
    fireEvent.submit(nameInput.closest('form'));

    const postCalls = global.fetch.mock.calls.filter(([, opts]) => opts?.method === 'POST');
    expect(postCalls).toHaveLength(1);
    expect(JSON.parse(postCalls[0][1].body).display_name).toBe('Customer');

    deferredPost.resolve({
      ok: true,
      status: 201,
      json: () => Promise.resolve({ business_object: CUSTOMER_OBJ }),
    });
    expect(await screen.findByText('Customer')).toBeInTheDocument();
  });

  test('keeps a confirmed save when an older list request resolves last', async () => {
    const deferredGet = createDeferred();
    const deferredPost = createDeferred();
    global.fetch.mockImplementation((url, options = {}) => {
      if (options.method === 'POST') return deferredPost.promise;
      return deferredGet.promise;
    });

    render(
      <BusinessObjectsPanel
        workspaceId="ws_demo"
        sources={HYDRATED_SOURCES}
        relationships={DEMO_RELATIONSHIPS}
        onClose={jest.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText('Display Name'), { target: { value: 'Customer' } });
    fireEvent.change(screen.getByLabelText('Member Source'), { target: { value: 'src_customer' } });
    fireEvent.change(screen.getByLabelText('Record Key Field'), { target: { value: 'customer_id' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Business Object' }));

    deferredPost.resolve({
      ok: true,
      status: 201,
      json: () => Promise.resolve({ business_object: CUSTOMER_OBJ }),
    });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save Business Object' })).not.toBeDisabled());

    deferredGet.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ business_objects: [] }),
    });

    const savedSection = screen.getByRole('region', { name: 'Saved Business Objects' });
    expect(await within(savedSection).findAllByText('Customer')).toHaveLength(1);
    expect(screen.queryByText('No Business Objects saved in this workspace yet.')).not.toBeInTheDocument();
  });

  test('Failure Retry and Conflict Or Duplicate: retries list failure, preserves draft on network failure and 409, refreshes model choices to replace removed key and relationships before retry', async () => {
    const deferredFail = createDeferred();
    const deferredConflict = createDeferred();
    let getCount = 0;
    let postCount = 0;
    let modelRefreshed = false;

    global.fetch.mockImplementation((url, options = {}) => {
      if (url.includes('/api/data-sources/src_customer')) {
        return jsonResponse({
          source: {
            source_id: 'src_customer',
            name: 'customers.csv',
            schema: modelRefreshed
              ? [{ name: 'customer_uuid', data_type: 'string' }, { name: 'name', data_type: 'string' }]
              : CATALOG_BY_ID.src_customer.schema,
          },
        });
      }
      if (url.includes('/api/data-sources/')) {
        const id = url.split('/api/data-sources/')[1];
        return jsonResponse({ source: CATALOG_BY_ID[id] });
      }
      if (url.endsWith('/api/data-workspaces/ws_demo/relationships')) {
        return jsonResponse({
          relationships: modelRefreshed ? [] : DEMO_RELATIONSHIPS,
        });
      }
      if (options.method === 'POST') {
        postCount += 1;
        if (postCount === 1) return deferredFail.promise;
        if (postCount === 2) return deferredConflict.promise;
        const body = JSON.parse(options.body);
        return jsonResponse({ business_object: { ...CUSTOMER_OBJ, ...body } }, 201);
      }
      getCount += 1;
      if (getCount === 1) {
        return jsonResponse(
          { error: { code: 'business_object_storage_error', message: 'Business Object storage is unavailable.' } },
          500
        );
      }
      return jsonResponse({ business_objects: [] });
    });

    const contextValue = {
      activeWorkspace: WS_DEMO,
      refreshWorkspace: jest.fn().mockResolvedValue({ workspace: WS_DEMO }),
      setWorkspaceEnvelope: jest.fn(),
      recordWorkspaceMutationConflict: jest.fn(),
    };

    render(
      <DataContext.Provider value={contextValue}>
        <SourceModelCanvas workspaceId="ws_demo" />
      </DataContext.Provider>
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Business Objects' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Business Object storage is unavailable.');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await screen.findByText('No Business Objects saved in this workspace yet.');

    const nameInput = screen.getByLabelText('Display Name');
    fireEvent.change(nameInput, { target: { value: 'Customer' } });
    fireEvent.change(screen.getByLabelText('Member Source'), { target: { value: 'src_customer' } });
    fireEvent.change(screen.getByLabelText('Record Key Field'), { target: { value: 'customer_id' } });
    fireEvent.change(screen.getByLabelText('Label Field (optional)'), { target: { value: 'name' } });
    fireEvent.click(screen.getByLabelText('Orders (customer_id = buyer)'));

    fireEvent.click(screen.getByRole('button', { name: 'Save Business Object' }));
    deferredFail.reject(new Error('Network connection lost'));

    expect(await screen.findByRole('alert')).toHaveTextContent('Network connection lost');
    expect(nameInput).toHaveValue('Customer');

    fireEvent.click(screen.getByRole('button', { name: 'Refresh Saved List' }));
    await waitFor(() => expect(getCount).toBe(3));
    expect(postCount).toBe(1);

    fireEvent.click(screen.getByRole('button', { name: 'Save Business Object' }));
    fireEvent.submit(nameInput.closest('form'));
    expect(postCount).toBe(2);

    deferredConflict.resolve({
      ok: false,
      status: 409,
      json: () =>
        Promise.resolve({
          error: {
            code: 'source_field_not_found',
            message: "Field 'customer_id' is missing from the object source.",
          },
        }),
    });

    expect(await screen.findByRole('alert')).toHaveTextContent("Field 'customer_id' is missing from the object source.");
    expect(nameInput).toHaveValue('Customer');

    modelRefreshed = true;
    fireEvent.click(screen.getByRole('button', { name: 'Refresh Model Choices' }));

    await waitFor(() => {
      const keyOptions = within(screen.getByLabelText('Record Key Field')).getAllByRole('option').map((o) => o.value);
      expect(keyOptions).toContain('customer_uuid');
      expect(keyOptions).not.toContain('customer_id');
    });
    expect(screen.getByLabelText('Record Key Field')).toHaveValue('');
    expect(screen.getByLabelText('Label Field (optional)')).toHaveValue('name');
    expect(screen.queryByLabelText('Orders (customer_id = buyer)')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Record Key Field'), { target: { value: 'customer_uuid' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Business Object' }));

    expect(await screen.findByText('Customer')).toBeInTheDocument();
    const postCalls = global.fetch.mock.calls.filter(([, opts]) => opts?.method === 'POST');
    expect(postCalls).toHaveLength(3);
    expect(JSON.parse(postCalls[2][1].body)).toEqual({
      display_name: 'Customer',
      source_id: 'src_customer',
      record_key_field: 'customer_uuid',
      display_field: 'name',
      relationship_ids: [],
    });
  });

  test('Identity And Unmount: switching workspace clears local selection and blocks late responses, deferred model refresh, and foreign sources', async () => {
    const deferredWs1 = createDeferred();
    const deferredRefresh = createDeferred();
    global.fetch.mockImplementation((url, options = {}) => {
      if (options.method === 'POST') {
        return jsonResponse(
          { error: { code: 'source_field_not_found', message: "Field 'customer_id' is missing from the object source." } },
          409
        );
      }
      if (url.includes('/ws_demo/business-objects')) return deferredWs1.promise;
      return jsonResponse({ business_objects: [] });
    });

    const otherSources = [
      ...HYDRATED_SOURCES,
      {
        workspace_id: 'ws_other',
        source_id: 'src_other',
        alias: 'Invoices',
        schema: [{ name: 'invoice_id', data_type: 'string' }],
      },
    ];

    const onRefreshModel = jest.fn(() => deferredRefresh.promise);

    const { rerender } = render(
      <BusinessObjectsPanel
        workspaceId="ws_demo"
        sources={otherSources}
        relationships={DEMO_RELATIONSHIPS}
        onRefreshModel={onRefreshModel}
        onClose={jest.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText('Display Name'), { target: { value: 'Draft In Old Workspace' } });
    fireEvent.change(screen.getByLabelText('Member Source'), { target: { value: 'src_customer' } });
    fireEvent.change(screen.getByLabelText('Record Key Field'), { target: { value: 'customer_id' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Business Object' }));
    expect(await screen.findByRole('button', { name: 'Refresh Model Choices' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh Model Choices' }));
    expect(onRefreshModel).toHaveBeenCalledTimes(1);

    rerender(
      <BusinessObjectsPanel
        workspaceId="ws_other"
        sources={otherSources}
        relationships={DEMO_RELATIONSHIPS}
        onRefreshModel={onRefreshModel}
        onClose={jest.fn()}
      />
    );

    expect(screen.getByLabelText('Display Name')).toHaveValue('');
    expect(screen.getByLabelText('Member Source')).toHaveValue('');
    const sourceOptions = within(screen.getByLabelText('Member Source')).getAllByRole('option');
    expect(sourceOptions.map((o) => o.textContent)).toEqual(['Select source...', 'Invoices']);

    deferredRefresh.resolve({
      sources: HYDRATED_SOURCES,
      relationships: DEMO_RELATIONSHIPS,
    });
    deferredWs1.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ business_objects: [CUSTOMER_OBJ] }),
    });

    await screen.findByText('No Business Objects saved in this workspace yet.');
    expect(screen.queryByText('Customer')).not.toBeInTheDocument();
    expect(within(screen.getByLabelText('Member Source')).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Select source...',
      'Invoices',
    ]);
  });

  const READY_GOV = { status: 'ready', severity: 'none', operation: 'business_object_records', next_action: '', reasons: [], policy: {}, row_count: 3, column_count: 2 };
  const WARN_GOV = { ...READY_GOV, status: 'warning', severity: 'warning', next_action: 'Review null values in Orders.' };
  const BLOCKED_GOV = { ...READY_GOV, status: 'blocked', severity: 'critical', next_action: 'Add required field approval to Orders.', reasons: [{ code: 'missing_required_field', severity: 'critical', message: 'Required field approval is missing.', next_action: 'Add required field approval to Orders.' }], policy: { required_fields: ['approval'] } };
  const [ACME_KEY, LIN_KEY, PUMP_KEY] = [{ type: 'integer', value: '1' }, { type: 'integer', value: '2' }, { type: 'string', value: 'A-1' }];
  const ACME_DETAIL = { object_id: 'obj_customer', record: { key: ACME_KEY, label: 'Acme', fields: { customer_id: 1, name: 'Acme' } }, relationships: [{ relationship_id: 'rel_orders', source_id: 'src_orders', status: 'ready', rows: [{ buyer: 1, total: 12 }, { buyer: 1, total: 8 }], total_count: 2, has_more: false, governance_readiness: WARN_GOV }], governance_readiness: READY_GOV };
  const LIN_DETAIL = { object_id: 'obj_customer', record: { key: LIN_KEY, label: 'Lin', fields: { customer_id: 2, name: 'Lin' } }, relationships: [{ relationship_id: 'rel_orders', source_id: 'src_orders', status: 'ready', rows: [{ buyer: 2, total: 55 }], total_count: 1, has_more: false, governance_readiness: READY_GOV }], governance_readiness: READY_GOV };
  const PUMP_DETAIL = { object_id: 'obj_equipment', record: { key: PUMP_KEY, label: 'Pump', fields: { asset_tag: 'A-1', title: 'Pump' } }, relationships: [{ relationship_id: 'rel_maintenance', source_id: 'src_maintenance', status: 'ready', rows: [{ equipment_ref: 'A-1', work: 'Inspect' }, { equipment_ref: 'A-1', work: 'Test' }], total_count: 2, has_more: false, governance_readiness: READY_GOV }], governance_readiness: READY_GOV };
  const recPage = (object_id, records, has_more = false) => ({ object_id, records, has_more, governance_readiness: READY_GOV });
  const okPayload = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) });

  test('browses Customer (Acme by name and ID) and Equipment (Pump), sends exact typed keys, and renders empty, unavailable, truncated, warning, and blocked states', async () => {
    let mode = 'acme';
    global.fetch.mockImplementation((url, options = {}) => {
      if (url.endsWith('/ws_demo/business-objects')) return jsonResponse({ business_objects: [CUSTOMER_OBJ, EQUIPMENT_OBJ] });
      if (url.includes('/obj_customer/records/detail') && options.method === 'POST') {
        if (mode === 'states') return jsonResponse({ ...ACME_DETAIL, relationships: [
          { relationship_id: 'rel_orders', source_id: 'src_orders', status: 'ready', rows: [], total_count: 0, has_more: false, governance_readiness: READY_GOV },
          { relationship_id: 'rel_stale', source_id: 'src_unknown', status: 'unavailable', error: { code: 'record_relationship_unavailable', message: 'Validate, confirm, and activate this relationship to view its records.' } },
          { relationship_id: 'rel_trunc', source_id: 'src_orders', status: 'ready', rows: [{ buyer: 1, total: 12 }], total_count: 55, has_more: true, governance_readiness: READY_GOV },
        ] });
        if (mode === 'blocked') return jsonResponse({ error: { code: 'record_access_denied', message: BLOCKED_GOV.next_action }, governance_readiness: BLOCKED_GOV }, 422);
        return jsonResponse(ACME_DETAIL);
      }
      if (url.includes('/obj_customer/records')) {
        if (url.includes('q=Nobody')) return jsonResponse(recPage('obj_customer', []));
        if (url.includes('q=Acme') || url.includes('q=1')) return jsonResponse(recPage('obj_customer', [{ key: ACME_KEY, label: 'Acme' }]));
        return jsonResponse(recPage('obj_customer', [{ key: ACME_KEY, label: 'Acme' }], true));
      }
      if (url.includes('/obj_equipment/records/detail') && options.method === 'POST') return jsonResponse(PUMP_DETAIL);
      if (url.includes('/obj_equipment/records')) return jsonResponse(recPage('obj_equipment', [{ key: PUMP_KEY, label: 'Pump' }]));
      return jsonResponse({});
    });
    render(<BusinessObjectsPanel workspaceId="ws_demo" sources={HYDRATED_SOURCES} relationships={DEMO_RELATIONSHIPS} onClose={jest.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: /Customer/i }));
    const browser = await screen.findByRole('region', { name: 'Record Browser' });
    expect(await within(browser).findByText(/Showing first 1 matching records/i)).toBeInTheDocument();
    const searchInput = within(browser).getByLabelText('Search Customer records');
    const submitSearch = (q) => { fireEvent.change(searchInput, { target: { value: q } }); fireEvent.click(within(browser).getByRole('button', { name: /^Search/i })); };
    submitSearch('Nobody'); expect(await within(browser).findByText('No matching records found.')).toBeInTheDocument();
    submitSearch('Acme'); expect(await within(browser).findByRole('button', { name: /Acme\s*1/ })).toBeInTheDocument();
    submitSearch('1'); fireEvent.click(await within(browser).findByRole('button', { name: /Acme\s*1/ }));
    const detail = await screen.findByRole('region', { name: 'Record Detail' });
    expect(await within(detail).findByText('12')).toBeInTheDocument();
    expect(within(detail).getByText('8')).toBeInTheDocument();
    expect(within(detail).getByText(WARN_GOV.next_action)).toBeInTheDocument();
    expect(within(detail).queryByText('55')).not.toBeInTheDocument();
    expect(JSON.parse(global.fetch.mock.calls.find(([u, o]) => u.endsWith('/records/detail') && o?.method === 'POST')[1].body)).toEqual({ key: ACME_KEY });
    mode = 'states'; fireEvent.click(within(browser).getByRole('button', { name: /Acme\s*1/ }));
    expect(await within(detail).findByText('No related rows for this record.')).toBeInTheDocument();
    expect(within(detail).getByText('Validate, confirm, and activate this relationship to view its records.')).toBeInTheDocument();
    expect(within(detail).getByRole('region', { name: 'Related src_unknown' })).toBeInTheDocument();
    expect(within(detail).getByText('Showing first 1 of 55 related rows.')).toBeInTheDocument();
    mode = 'blocked'; fireEvent.click(within(browser).getByRole('button', { name: /Acme\s*1/ }));
    expect(await within(detail).findByText('Access Blocked')).toBeInTheDocument();
    expect(within(detail).getByText(BLOCKED_GOV.next_action)).toBeInTheDocument();
    expect(within(detail).queryByText('12')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Equipment/i }));
    await within(browser).findByRole('button', { name: /Pump\s*A-1/ });
    fireEvent.change(within(browser).getByLabelText('Search Equipment records'), { target: { value: 'Pump' } });
    fireEvent.click(within(browser).getByRole('button', { name: /^Search/i }));
    fireEvent.click(await within(browser).findByRole('button', { name: /Pump\s*A-1/ }));
    expect(await within(screen.getByRole('region', { name: 'Record Detail' })).findByText('Inspect')).toBeInTheDocument();
    expect(screen.getByText('Test')).toBeInTheDocument();
    expect(JSON.parse(global.fetch.mock.calls.find(([u]) => u.includes('/obj_equipment/records/detail'))[1].body)).toEqual({ key: PUMP_KEY });
  });

  test('Record Browser Async Mutations: In-Flight Navigation, Concurrent Edits, Failure Retry, Conflict Or Duplicate, and Identity And Unmount', async () => {
    const [defCustDetail, defSearch1, defSearch2, defDetail1, defDetail2, defConflict, defWsSwitch, defClose] = Array.from({ length: 8 }, createDeferred);
    let failSearchOnce = true; let failDetailOnce = true;
    global.fetch.mockImplementation((url, options = {}) => {
      if (url.endsWith('/ws_demo/business-objects')) return jsonResponse({ business_objects: [CUSTOMER_OBJ, EQUIPMENT_OBJ] });
      if (url.endsWith('/ws_other/business-objects')) return jsonResponse({ business_objects: [] });
      if (url.includes('/obj_customer/records/detail') && options.method === 'POST') {
        const val = JSON.parse(options.body).key.value;
        if (val === '1' && defCustDetail.active) return defCustDetail.promise;
        if (val === '1' && defDetail1.active) return defDetail1.promise;
        if (val === '2' && defDetail2.active) return defDetail2.promise;
        if (val === '2' && defConflict.active) return defConflict.promise;
        if (val === '1' && failDetailOnce) { failDetailOnce = false; return jsonResponse({ error: { code: 'business_object_storage_error', message: 'Temporary detail error.' } }, 500); }
        return jsonResponse(ACME_DETAIL);
      }
      if (url.includes('/obj_customer/records')) {
        if (url.includes('q=First')) return defSearch1.promise;
        if (url.includes('q=Second')) return defSearch2.promise;
        if (url.includes('q=RetryMe') && failSearchOnce) { failSearchOnce = false; return jsonResponse({ error: { code: 'business_object_storage_error', message: 'Temporary search error.' } }, 500); }
        if (url.includes('q=WsRace')) return defWsSwitch.promise;
        if (url.includes('q=CloseRace')) return defClose.promise;
        return jsonResponse(recPage('obj_customer', [{ key: ACME_KEY, label: 'Acme' }, { key: LIN_KEY, label: 'Lin' }]));
      }
      if (url.includes('/obj_equipment/records')) return jsonResponse(recPage('obj_equipment', [{ key: PUMP_KEY, label: 'Pump' }]));
      return jsonResponse({});
    });
    const { rerender, unmount } = render(<BusinessObjectsPanel workspaceId="ws_demo" sources={HYDRATED_SOURCES} relationships={DEMO_RELATIONSHIPS} onClose={jest.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: /Customer/i }));
    const browser = await screen.findByRole('region', { name: 'Record Browser' });
    await within(browser).findByRole('button', { name: /Acme\s*1/ });
    // In-Flight Navigation
    defCustDetail.active = true; fireEvent.click(within(browser).getByRole('button', { name: /Acme\s*1/ }));
    fireEvent.click(screen.getByRole('button', { name: /Equipment/i }));
    expect(await within(browser).findByRole('button', { name: /Pump\s*A-1/ })).toBeInTheDocument();
    defCustDetail.active = false; defCustDetail.resolve(okPayload(ACME_DETAIL));
    await waitFor(() => expect(within(browser).queryByText('12')).not.toBeInTheDocument());
    // Concurrent Edits (search & detail out-of-order)
    fireEvent.click(screen.getByRole('button', { name: /Customer/i }));
    await within(browser).findByRole('button', { name: /Acme\s*1/ });
    const searchInput = within(browser).getByLabelText('Search Customer records');
    const runSearch = (q) => { fireEvent.change(searchInput, { target: { value: q } }); fireEvent.click(within(browser).getByRole('button', { name: /^Search/i })); };
    runSearch('First'); runSearch('Second');
    defSearch2.resolve(okPayload(recPage('obj_customer', [{ key: ACME_KEY, label: 'Acme' }, { key: LIN_KEY, label: 'Lin' }])));
    expect(await within(browser).findByRole('button', { name: /Lin\s*2/ })).toBeInTheDocument();
    defSearch1.resolve(okPayload(recPage('obj_customer', [{ key: { type: 'integer', value: '9' }, label: 'StaleRecord' }])));
    await waitFor(() => expect(within(browser).queryByText('StaleRecord')).not.toBeInTheDocument());
    defDetail1.active = true; defDetail2.active = true;
    fireEvent.click(within(browser).getByRole('button', { name: /Acme\s*1/ }));
    fireEvent.click(within(browser).getByRole('button', { name: /Lin\s*2/ }));
    defDetail1.active = false; defDetail2.active = false; defDetail2.resolve(okPayload(LIN_DETAIL));
    const detail = screen.getByRole('region', { name: 'Record Detail' });
    expect(await within(detail).findByText('55')).toBeInTheDocument();
    defDetail1.resolve(okPayload(ACME_DETAIL));
    await waitFor(() => expect(within(detail).queryByText('12')).not.toBeInTheDocument());
    // Failure Retry (search & detail)
    runSearch('RetryMe'); expect(await within(browser).findByText('Temporary search error.')).toBeInTheDocument();
    expect(searchInput).toHaveValue('RetryMe');
    fireEvent.click(within(browser).getByRole('button', { name: 'Retry Search' }));
    await within(browser).findByRole('button', { name: /Acme\s*1/ });
    expect(global.fetch.mock.calls.filter(([u]) => u.endsWith('/ws_demo/business-objects/obj_customer/records?q=RetryMe'))).toHaveLength(2);
    const countKeyCalls = (val) => global.fetch.mock.calls.filter(([u, o]) => u.endsWith('/ws_demo/business-objects/obj_customer/records/detail') && JSON.parse(o.body).key.value === val).length;
    const beforeRetry = countKeyCalls('1'); fireEvent.click(within(browser).getByRole('button', { name: /Acme\s*1/ }));
    expect(await within(screen.getByRole('region', { name: 'Record Detail' })).findByText('Temporary detail error.')).toBeInTheDocument();
    fireEvent.click(within(browser).getByRole('button', { name: 'Retry Record' }));
    expect(await within(screen.getByRole('region', { name: 'Record Detail' })).findByText('12')).toBeInTheDocument();
    expect(countKeyCalls('1') - beforeRetry).toBe(2);
    // Conflict Or Duplicate (double-click pending record, return 409)
    defConflict.active = true; const beforeConflict = countKeyCalls('2');
    const linBtn = within(browser).getByRole('button', { name: /Lin\s*2/ });
    fireEvent.click(linBtn); fireEvent.click(linBtn); defConflict.active = false;
    expect(countKeyCalls('2') - beforeConflict).toBe(1);
    defConflict.resolve(okPayload({ error: { code: 'record_key_duplicate', message: 'The record key field contains duplicate values.' } }, 409));
    expect(await within(screen.getByRole('region', { name: 'Record Detail' })).findByText('The record key field contains duplicate values.')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Record Detail' })).queryByText('12')).not.toBeInTheDocument();
    // Identity And Unmount (workspace switch + unmount/reopen)
    runSearch('WsRace'); rerender(<BusinessObjectsPanel workspaceId="ws_other" sources={HYDRATED_SOURCES} relationships={DEMO_RELATIONSHIPS} onClose={jest.fn()} />);
    defWsSwitch.resolve(okPayload(recPage('obj_customer', [{ key: ACME_KEY, label: 'ForeignAcme' }])));
    await screen.findByText('No Business Objects saved in this workspace yet.'); expect(screen.queryByText('ForeignAcme')).not.toBeInTheDocument();
    rerender(<BusinessObjectsPanel workspaceId="ws_demo" sources={HYDRATED_SOURCES} relationships={DEMO_RELATIONSHIPS} onClose={jest.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: /Customer/i }));
    const reopened = await screen.findByRole('region', { name: 'Record Browser' });
    fireEvent.change(within(reopened).getByLabelText('Search Customer records'), { target: { value: 'CloseRace' } });
    fireEvent.click(within(reopened).getByRole('button', { name: /^Search/i })); unmount();
    render(<BusinessObjectsPanel workspaceId="ws_demo" sources={HYDRATED_SOURCES} relationships={DEMO_RELATIONSHIPS} onClose={jest.fn()} />);
    defClose.resolve(okPayload(recPage('obj_customer', [{ key: ACME_KEY, label: 'ClosedAcme' }])));
    await screen.findByRole('button', { name: /Customer/i }); expect(screen.queryByText('ClosedAcme')).not.toBeInTheDocument();
  });

  test('opens a labeled record with a 512-character ID', async () => {
    const fs = require('fs');
    const path = require('path');
    const longId = 'K'.repeat(512);
    const longKey = { type: 'string', value: longId };
    global.fetch.mockImplementation((url, options = {}) => {
      if (url.endsWith('/ws_demo/business-objects')) return jsonResponse({ business_objects: [CUSTOMER_OBJ] });
      if (url.includes('/obj_customer/records/detail') && options.method === 'POST') {
        return jsonResponse({ object_id: 'obj_customer', record: { key: longKey, label: 'Acme Long Key', fields: { customer_id: longId, name: 'Acme Long Key' } }, relationships: [], governance_readiness: READY_GOV });
      }
      if (url.includes('/obj_customer/records')) return jsonResponse(recPage('obj_customer', [{ key: longKey, label: 'Acme Long Key' }]));
      return jsonResponse({});
    });
    render(<BusinessObjectsPanel workspaceId="ws_demo" sources={HYDRATED_SOURCES} relationships={DEMO_RELATIONSHIPS} onClose={jest.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: /Customer/i }));
    const browser = await screen.findByRole('region', { name: 'Record Browser' });
    const recordBtn = await within(browser).findByRole('button', { name: /Acme Long Key/ });
    expect(within(recordBtn).getByText('Acme Long Key')).toBeInTheDocument();
    const keyNode = within(recordBtn).getByText(longId);
    expect(keyNode).toHaveAttribute('title', longId);
    fireEvent.click(recordBtn);
    const detail = await screen.findByRole('region', { name: 'Record Detail' });
    expect(await within(detail).findByRole('heading', { name: 'Acme Long Key' })).toBeInTheDocument();
    expect(within(detail).getByText(`customer_id: ${longId}`)).toBeInTheDocument();
    expect(JSON.parse(global.fetch.mock.calls.find(([u, o]) => u.endsWith('/records/detail') && o?.method === 'POST')[1].body)).toEqual({ key: longKey });
    const css = fs.readFileSync(path.join(__dirname, 'BusinessObjectsPanel.css'), 'utf8');
    expect(css).toMatch(/\.bo-record-btn\s*\{[^}]*flex-direction:\s*column/);
    expect(css).not.toMatch(/\.bo-record-key\s*\{[^}]*flex-shrink:\s*0/);
    expect(css).toMatch(/\.bo-detail-id\s*\{[^}]*overflow-wrap:\s*anywhere/);
  });
});
