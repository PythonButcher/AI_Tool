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
});
