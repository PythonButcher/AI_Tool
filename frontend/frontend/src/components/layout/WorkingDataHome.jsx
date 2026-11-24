import React, { useId } from 'react';
import { FaArrowRight, FaColumns, FaDatabase, FaEye, FaFilter, FaProjectDiagram, FaTable, FaUpload } from 'react-icons/fa';
import './WorkingDataHome.css';

function DatasetDetails({ dataset }) {
  return (
    <div className="working-data__dataset">
      <div>
        <strong>{dataset.name}</strong>
        {dataset.savedName && <span>Data Hub entry: {dataset.savedName}</span>}
      </div>
      <dl aria-label="Working dataset details">
        <div><dt>Rows</dt><dd>{dataset.rowCount.toLocaleString()}</dd></div>
        <div><dt>Fields</dt><dd>{dataset.fieldCount.toLocaleString()}</dd></div>
      </dl>
    </div>
  );
}

function ToolButton({ icon: Icon, name, description, onClick, disabled = false, primary = false }) {
  const descriptionId = useId();
  return (
    <button type="button" className={`working-data__tool${primary ? ' working-data__tool--primary' : ''}`} aria-label={name} aria-describedby={descriptionId} onClick={onClick} disabled={disabled}>
      <Icon aria-hidden="true" />
      <span><strong>{name}</strong><span id={descriptionId}>{description}</span></span>
      <FaArrowRight className="working-data__arrow" aria-hidden="true" />
    </button>
  );
}

export default function WorkingDataHome({ tools, dataset, canRefine, refineUnavailableReason, actions }) {
  const { openTools, upload, openSources, openHub, openRefine, inspectRows, filterRows, preview, openFields, connectApi, connectDatabase, openModel } = actions;

  if (!tools) {
    return (
      <section className={`working-data working-data--workspace${dataset ? '' : ' working-data--empty'}`} aria-labelledby="workspace-heading">
        <div className="working-data__inner">
          <div className="working-data__heading">
            <h1 id="workspace-heading">Workspace</h1>
            <p>{dataset ? (
              <>
                Inspect and prepare your current dataset.{dataset.canSave && ' Use Save Dataset to keep a version in Data Hub.'}
              </>
            ) : 'Upload a file, connect a source, or open a saved dataset to begin working.'}</p>
          </div>
          {dataset && <DatasetDetails dataset={dataset} />}
          <div className="working-data__actions">
            {dataset ? (
              <>
                <button type="button" className="working-data__button working-data__button--primary" onClick={openRefine} disabled={!canRefine} aria-describedby={!canRefine ? 'workspace-refine-reason' : undefined}>Refine data</button>
                <button type="button" className="working-data__button" onClick={inspectRows}>Inspect rows</button>
                <button type="button" className="working-data__button" onClick={openTools}>Browse data tools <FaArrowRight aria-hidden="true" /></button>
              </>
            ) : (
              <>
                <button type="button" className="working-data__button working-data__button--primary" onClick={upload}><FaUpload aria-hidden="true" /> Upload data</button>
                <button type="button" className="working-data__button" onClick={openSources}>Connect a source</button>
                <button type="button" className="working-data__button" onClick={openHub}>Data Hub</button>
                <button type="button" className="working-data__button" onClick={openTools}>Browse data tools <FaArrowRight aria-hidden="true" /></button>
              </>
            )}
          </div>
          {dataset && !canRefine && <p className="working-data__notice" id="workspace-refine-reason">{refineUnavailableReason}</p>}
        </div>
      </section>
    );
  }

  return (
    <section className="working-data working-data--tools" aria-labelledby="data-tools-heading">
      <div className="working-data__inner">
        <div className="working-data__heading">
          <h1 id="data-tools-heading">Data Tools</h1>
          <p>Inspect rows, prepare data, and manage the fields and sources in your workspace.</p>
        </div>
        {dataset ? <DatasetDetails dataset={dataset} /> : (
          <div className="working-data__empty-state">
            <p>Open a dataset to use the preparation and inspection tools.</p>
            <button type="button" className="working-data__button working-data__button--primary" onClick={upload}>Upload data</button>
            <button type="button" className="working-data__button" onClick={openHub}>Open Data Hub</button>
          </div>
        )}
        <div className="working-data__section" aria-labelledby="data-tools-preparation">
          <h2 id="data-tools-preparation">Prepare and inspect</h2>
          <div className="working-data__grid">
            <ToolButton icon={FaTable} name="Refine data" description={dataset && !canRefine ? refineUnavailableReason : 'Clean and reshape rows and columns in Power Query.'} onClick={openRefine} disabled={!canRefine} primary />
            <ToolButton icon={FaFilter} name="Filter rows" description="Open the Workspace preview with temporary filters." onClick={filterRows} disabled={!dataset} />
            <ToolButton icon={FaEye} name="Inspect rows" description="Browse all rows and detect outliers." onClick={inspectRows} disabled={!dataset} />
            <ToolButton icon={FaTable} name="Data Preview" description="Review a row sample and dataset profile." onClick={preview} disabled={!dataset} />
          </div>
        </div>
        <div className="working-data__section" aria-labelledby="data-tools-sources">
          <h2 id="data-tools-sources">Fields and sources</h2>
          <div className="working-data__grid">
            <ToolButton icon={FaColumns} name="Fields and metrics" description="Browse the field catalog and measure definitions." onClick={openFields} disabled={!dataset} />
            <ToolButton
              icon={FaProjectDiagram}
              name="Data Model"
              description={dataset && !dataset.canModel ? 'Upload a file or open a saved dataset to edit its model.' : 'Manage sources, relationships, and Business Objects.'}
              onClick={openModel}
              disabled={!dataset?.canModel}
            />
            <ToolButton icon={FaDatabase} name="Connect API" description="Load data from a REST endpoint." onClick={connectApi} />
            <ToolButton icon={FaDatabase} name="Connect database" description="Query a SQL warehouse." onClick={connectDatabase} />
          </div>
        </div>
      </div>
    </section>
  );
}
