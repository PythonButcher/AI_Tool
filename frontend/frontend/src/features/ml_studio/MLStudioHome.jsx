import React, { useEffect, useId, useRef, useState } from 'react';
import {
  FaArrowRight, FaBookOpen, FaChartLine, FaCheck, FaChevronDown, FaCodeBranch,
  FaCubes, FaDatabase, FaExternalLinkAlt, FaFingerprint, FaFlask, FaLayerGroup,
  FaShieldAlt,
} from 'react-icons/fa';
import './MLStudioHome.css';

// Keep this learning catalog aligned with configuration.py TASK_MODELS, which
// defines the current draft workflow (the legacy API offers different models).
const TASKS = [
  {
    id: 'regression', label: 'Regression', verb: 'Predict a number', icon: FaChartLine,
    question: 'What could this be worth?', example: 'Delivery times, energy demand, or unit revenue.',
    description: 'Model how your input features drive a continuous numeric outcome, then benchmark error on unseen rows.',
    input: 'Features + numeric target', output: 'Predicted value',
    note: 'Compare error against a simple mean baseline before trusting a complex ensemble.',
    models: [
      { name: 'Regularized linear (Ridge)', tag: 'Linear baseline', text: 'Penalized linear fit that keeps feature weights stable and easy to audit.', href: 'https://scikit-learn.org/stable/modules/linear_model.html#ridge-regression-and-classification' },
      { name: 'Random forest', tag: 'Nonlinear ensemble', text: 'Decision-tree ensemble built to capture thresholds and feature interactions.', href: 'https://scikit-learn.org/stable/modules/ensemble.html#forest' },
    ],
  },
  {
    id: 'classification', label: 'Classification', verb: 'Predict a category', icon: FaLayerGroup,
    question: 'Which category fits?', example: 'Support ticket routing, tiering, or churn labels.',
    description: 'Learn decision boundaries from labeled examples to route new rows into discrete classes.',
    input: 'Features + known labels', output: 'Predicted class',
    note: 'Check class balance—high overall accuracy can mask weak recall on rare labels.',
    models: [
      { name: 'Logistic regression', tag: 'Linear classifier', text: 'Regularized linear separator for fast, transparent class boundaries.', href: 'https://scikit-learn.org/stable/modules/linear_model.html#logistic-regression' },
      { name: 'Random forest', tag: 'Tree ensemble', text: 'Combines decision trees to separate categories across complex feature spaces.', href: 'https://scikit-learn.org/stable/modules/ensemble.html#forest' },
    ],
  },
  {
    id: 'forecasting', label: 'Forecasting', verb: 'Look ahead in time', icon: FaChartLine,
    question: 'What might happen next?', example: 'Future order volume or regularly sampled telemetry.',
    description: 'Turn historical series into lagged features and evaluate predictions strictly in chronological order.',
    input: 'Time series + numeric target', output: 'Forecast horizon',
    note: 'Keep future rows out of training; Studio benchmarks against persistence and seasonal baselines.',
    models: [
      { name: 'Lagged Ridge', tag: 'Temporal linear', text: 'Ridge regression over past time windows to project upcoming steps.', href: 'https://scikit-learn.org/stable/modules/linear_model.html#ridge-regression-and-classification' },
      { name: 'Lagged random forest', tag: 'Temporal ensemble', text: 'Random forest over lagged windows to capture nonlinear seasonal patterns.', href: 'https://scikit-learn.org/stable/modules/ensemble.html#forest' },
    ],
    extra: { label: 'Explore a lagged-feature forecasting example', href: 'https://scikit-learn.org/stable/auto_examples/applications/plot_time_series_lagged_features.html', note: 'Illustrates lagged features with another estimator; Studio uses the two models above.' },
  },
  {
    id: 'clustering', label: 'Clustering', verb: 'Discover groups', icon: FaCubes,
    question: 'What belongs together?', example: 'Customer segments, product cohorts, or usage profiles.',
    description: 'Uncover natural structure and recurring cohorts across rows without needing labeled targets.',
    input: 'Features (unlabeled)', output: 'Cluster assignment',
    note: 'Clusters reflect feature scale—treat discovered groups as patterns to inspect, not ground truth.',
    models: [
      { name: 'K-means', tag: 'Centroid partition', text: 'Groups observations around k centroids by minimizing within-cluster distance.', href: 'https://scikit-learn.org/stable/modules/clustering.html#k-means' },
      { name: 'Mini-batch K-means', tag: 'Fast clustering', text: 'Updates centroids from small row batches for quicker fitting on larger tables.', href: 'https://scikit-learn.org/stable/modules/clustering.html#mini-batch-k-means' },
    ],
  },
  {
    id: 'anomaly_detection', label: 'Anomaly detection', verb: 'Spot the unusual', icon: FaFingerprint,
    question: 'What deserves a closer look?', example: 'Atypical transactions or unexpected equipment readings.',
    description: 'Score how isolated or out-of-distribution each row looks compared to the rest of your dataset.',
    input: 'Features + optional labels', output: 'Anomaly score & flag',
    note: 'Unusual does not automatically mean invalid—flagged observations need domain review.',
    models: [
      { name: 'Isolation forest', tag: 'Random isolation', text: 'Separates rare observations quickly using random feature splits.', href: 'https://scikit-learn.org/stable/modules/outlier_detection.html#isolation-forest' },
      { name: 'Local outlier factor', tag: 'Density novelty', text: 'Flags rows sitting in lower-density neighborhoods using novelty scoring.', href: 'https://scikit-learn.org/stable/modules/outlier_detection.html#local-outlier-factor' },
    ],
  },
];

const WORKFLOW_STEPS = [
  ['01', 'Prepare with purpose', 'Choose a question, inspect quality checks, and apply reproducible cleaning steps.'],
  ['02', 'Put models to the test', 'Assign column roles, configure validation splits, and benchmark candidates against baselines.'],
  ['03', 'Make an informed choice', 'Review single-use holdout evidence, select a model, and export verified Python artifacts.'],
];

function LearningLink({ href, children, className = '' }) {
  return <a className={className} href={href} target="_blank" rel="noopener noreferrer">
    {children}<FaExternalLinkAlt aria-hidden="true" /><span className="ml-welcome-sr-only"> (opens in a new tab)</span>
  </a>;
}

function PatternIllustration({ task, plotId }) {
  const grouped = ['classification', 'clustering', 'anomaly_detection'].includes(task);
  // Fixed, synthetic coordinates illustrate a concept; they are never run data.
  const groups = [
    [[64, 128], [86, 138], [100, 112], [116, 144], [78, 162], [128, 118], [104, 166]],
    [[174, 66], [202, 52], [220, 80], [190, 92], [238, 59], [222, 110], [166, 90]],
    [[260, 148], [288, 126], [316, 152], [296, 174], [330, 120], [266, 178], [322, 182]],
  ];
  const regressionPts = [
    [52, 164, 174], [74, 180, 164], [100, 134, 152], [120, 152, 143],
    [144, 118, 132], [168, 136, 121], [190, 98, 111], [215, 118, 100],
    [240, 70, 89], [259, 98, 80], [286, 58, 68], [312, 78, 56], [331, 36, 48],
  ];
  const gradId = `${plotId}-area`;

  return <svg className={`ml-welcome-plot plot-${task}`} viewBox="0 0 380 230" role="img" aria-label={`Illustration of ${task.replace('_', ' ')}; not experiment results`}>
    <defs>
      <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="var(--accent-blue)" stopOpacity="0.24" />
        <stop offset="100%" stopColor="var(--accent-blue)" stopOpacity="0.02" />
      </linearGradient>
    </defs>
    {[50, 95, 140, 185].map(y => <path key={y} className="plot-grid" d={`M28 ${y}H354`} />)}
    {[65, 125, 185, 245, 305].map(x => <path key={x} className="plot-grid" d={`M${x} 28V202`} />)}
    {grouped ? <>
      {task === 'classification' && <>
        <path className="plot-region-a" d="M28 28H132L146 115L234 202H28Z" />
        <path className="plot-region-b" d="M132 28H354V202H234L146 115Z" />
        <path className="plot-boundary" d="M132 28L146 115L234 202" />
      </>}
      {task === 'clustering' && <g className="plot-clusters">
        <ellipse cx="96" cy="138" rx="54" ry="48" />
        <ellipse cx="202" cy="79" rx="54" ry="48" />
        <ellipse cx="296" cy="152" rx="55" ry="48" />
        <path className="plot-centroid" d="M91 138H101M96 133V143 M197 79H207M202 74V84 M291 152H301M296 147V157" />
      </g>}
      {task === 'anomaly_detection' && <ellipse className="plot-normal-zone" cx="192" cy="126" rx="142" ry="72" />}
      {groups.map((points, group) => <g key={group} className={`plot-group plot-group-${group}`}>
        {points.map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="5" />)}
      </g>)}
      {task === 'anomaly_detection' && <g className="plot-outlier">
        <circle className="plot-outlier-pulse" cx="324" cy="41" r="22" />
        <circle cx="324" cy="41" r="13" />
        <circle cx="324" cy="41" r="5" />
      </g>}
    </> : <>
      {task === 'forecasting' ? <>
        <path className="plot-forecast-area" fill={`url(#${gradId})`} d="M240 84L270 60L295 77L325 32L348 46V116L325 96L295 130L270 108L240 102Z" />
        <path className="plot-history-fill" fill={`url(#${gradId})`} d="M35 174L61 155L85 167L112 128L138 146L163 99L187 119L214 78L240 95V202H35Z" />
        <path className="plot-fit" d="M35 174L61 155L85 167L112 128L138 146L163 99L187 119L214 78L240 95" />
        <path className="plot-fit plot-projection" d="M240 95L270 86L295 104L325 62L348 80" />
        <path className="plot-boundary" d="M240 28V202" />
        <circle className="plot-horizon-dot" cx="240" cy="95" r="5" />
      </> : <>
        <path className="plot-band" fill={`url(#${gradId})`} d="M35 166L344 26V60L35 198Z" />
        {regressionPts.map(([x, y, fitY]) => <line key={`r-${x}`} className="plot-residual" x1={x} y1={y} x2={x} y2={fitY} />)}
        <path className="plot-fit" d="M35 182L344 43" />
        {regressionPts.map(([x, y]) => <circle className="plot-sample" key={x} cx={x} cy={y} r="5" />)}
      </>}
    </>}
  </svg>;
}

export default function MLStudioHome({ children, onCreate, pendingAction = null, canCreate = true, savedCount = 0 }) {
  const [selectedTask, setSelectedTask] = useState('regression');
  const [activeDrawer, setActiveDrawer] = useState(null);
  const [savedExpanded, setSavedExpanded] = useState(true);
  const [explorerHighlight, setExplorerHighlight] = useState(false);
  const task = TASKS.find(item => item.id === selectedTask);
  const canvasRef = useRef(null);
  const explorerRef = useRef(null);
  const sectionId = useId();
  const Icon = task.icon;

  useEffect(() => {
    if (!explorerHighlight) return undefined;
    const timer = setTimeout(() => setExplorerHighlight(false), 900);
    return () => clearTimeout(timer);
  }, [explorerHighlight]);

  const explore = () => {
    const canvas = canvasRef.current;
    const heading = explorerRef.current;
    if (!canvas || !heading) return;
    // Scroll only the Studio pane; scrolling every ancestor can move the app header.
    canvas.scrollTo({ top: Math.max(0, canvas.scrollTop + heading.getBoundingClientRect().top - canvas.getBoundingClientRect().top - 24) });
    heading.focus({ preventScroll: true });
    setExplorerHighlight(true);
  };

  const toggleDrawer = (drawer) => {
    setActiveDrawer(current => (current === drawer ? null : drawer));
  };

  return <main ref={canvasRef} className="ml-studio-canvas ml-welcome-canvas" aria-label="Experiment Home">
    <div className="ml-welcome">
      <div className="ml-welcome-cockpit">
        <div className="ml-welcome-left">
          <section className="ml-welcome-hero" aria-labelledby={`${sectionId}-title`}>
            <div className="ml-welcome-hero-body">
              <div className="ml-welcome-hero-top">
                <span className="ml-welcome-kicker"><span /> Local ML Studio</span>
                <span className={`ml-welcome-status ${canCreate ? 'is-ready' : 'is-waiting'}`}>
                  {canCreate ? 'Dataset connected' : 'Dataset needed'}
                </span>
              </div>
              <h1 id={`${sectionId}-title`}>Your data.<br /><span>Your next discovery.</span></h1>
              <p>Turn “what if” into tested evidence. Prepare features, compare candidate models against honest baselines, and export Python pipelines—all locally.</p>
              <div className="ml-welcome-actions">
                <button className="start-run-button" onClick={onCreate} disabled={!canCreate || pendingAction !== null} aria-describedby={!canCreate ? `${sectionId}-dataset` : undefined}>
                  <FaFlask aria-hidden="true" /> {pendingAction === 'creating' ? 'Creating...' : 'New Experiment'} <FaArrowRight aria-hidden="true" />
                </button>
                <button className="ml-welcome-secondary" onClick={explore}><FaBookOpen aria-hidden="true" /> Explore algorithms</button>
              </div>
            </div>

            {!canCreate && (
              <div className="ml-welcome-dataset" id={`${sectionId}-dataset`}>
                <FaDatabase aria-hidden="true" />
                <div>
                  <h2>No Dataset Selected</h2>
                  <p>Select a dataset in the Data pane to start an experiment, or explore the five workflows on the right.</p>
                </div>
              </div>
            )}

            <div className="ml-welcome-pillars" aria-label="Studio capabilities">
              <div className="ml-welcome-pillar">
                <span className="ml-welcome-pillar-icon"><FaShieldAlt aria-hidden="true" /></span>
                <div>
                  <strong>Local training</strong>
                  <span>Runs directly on your workspace data</span>
                </div>
              </div>
              <div className="ml-welcome-pillar">
                <span className="ml-welcome-pillar-icon"><FaCheck aria-hidden="true" /></span>
                <div>
                  <strong>Saved experiments</strong>
                  <span>Versioned drafts &amp; holdout evidence</span>
                </div>
              </div>
              <div className="ml-welcome-pillar">
                <span className="ml-welcome-pillar-icon"><FaCodeBranch aria-hidden="true" /></span>
                <div>
                  <strong>Python model exports</strong>
                  <span>Joblib bundle, schema &amp; sample script</span>
                </div>
              </div>
            </div>
          </section>

          {children && (
            <section className={`ml-welcome-saved ${savedCount > 0 ? 'has-drafts' : 'is-empty'}`} aria-label="Saved experiments">
              <div className="ml-welcome-saved-header">
                <div>
                  <span className="ml-eyebrow">PICK UP WHERE YOU LEFT OFF</span>
                  <h2>Workspace Experiments</h2>
                </div>
                <div className="ml-welcome-saved-controls">
                  <span className="ml-welcome-count">{savedCount} saved</span>
                  {savedCount > 0 && (
                    <button
                      type="button"
                      className="ml-welcome-collapse-btn"
                      aria-expanded={savedExpanded}
                      aria-controls={`${sectionId}-saved-body`}
                      onClick={() => setSavedExpanded(prev => !prev)}
                    >
                      {savedExpanded ? 'Hide' : 'Show'}
                      <FaChevronDown aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>
              {savedExpanded && (
                <div id={`${sectionId}-saved-body`} className="ml-welcome-saved-body">
                  {children}
                </div>
              )}
            </section>
          )}
        </div>

        <section className={`ml-welcome-explorer ${explorerHighlight ? 'is-highlighted' : ''}`} aria-labelledby={`${sectionId}-explore`}>
          <div className="ml-welcome-explorer-head">
            <div>
              <span className="ml-eyebrow">FIVE WORKFLOWS · ONE STUDIO</span>
              <h2 ref={explorerRef} tabIndex={-1} id={`${sectionId}-explore`}>One studio. Five ways to explore.</h2>
            </div>
            <span className="ml-welcome-tag"><FaBookOpen aria-hidden="true" /> Interactive guide</span>
          </div>

          <div className="ml-welcome-task-picker" role="group" aria-label="Explore machine learning tasks">
            {TASKS.map(item => {
              const TaskIcon = item.icon;
              return <button key={item.id} aria-pressed={item.id === selectedTask} aria-controls={`${sectionId}-task`} onClick={() => setSelectedTask(item.id)}>
                <span className="ml-welcome-task-tab-top">
                  <TaskIcon aria-hidden="true" />
                  <strong>{item.label}</strong>
                </span>
                <span className="ml-welcome-task-tab-verb">{item.verb}</span>
              </button>;
            })}
          </div>

          <div className="ml-welcome-task-detail" id={`${sectionId}-task`}>
            <div className="ml-welcome-task-stage">
              <div className="ml-welcome-task-story" key={task.id}>
                <div className="ml-welcome-task-title">
                  <span className="ml-welcome-task-icon"><Icon aria-hidden="true" /></span>
                  <div>
                    <span className="ml-eyebrow">{task.label} · {task.verb}</span>
                    <h3>{task.question}</h3>
                  </div>
                </div>
                <p>{task.description}</p>
                <p className="ml-welcome-example"><strong>Try it for:</strong> {task.example}</p>
                <dl>
                  <div><dt>You bring</dt><dd>{task.input}</dd></div>
                  <div><dt>You explore</dt><dd>{task.output}</dd></div>
                </dl>
              </div>

              <div className="ml-welcome-lab" aria-label="An illustrated experiment workflow">
                <div className="ml-welcome-lab-heading">
                  <span className="ml-welcome-concept">Concept preview</span>
                  <div className="ml-welcome-lab-flow" aria-hidden="true">
                    <span><FaDatabase /> Data</span><i />
                    <span><FaCubes /> Model</span><i />
                    <span><FaChartLine /> Insight</span>
                  </div>
                </div>
                <div className="ml-welcome-plot-wrap">
                  <PatternIllustration task={selectedTask} plotId={sectionId} />
                </div>
                <div className="ml-welcome-lab-caption">
                  <span>{task.verb}</span>
                  <span>Explore · Compare · Understand</span>
                </div>
              </div>
            </div>

            <div className="ml-welcome-models">
              <div className="ml-welcome-models-heading">
                <h3>Meet the algorithms</h3>
                <span>Available in Studio</span>
              </div>
              <div className="ml-welcome-models-grid">
                {task.models.map(model => (
                  <LearningLink key={model.name} className="ml-welcome-model" href={model.href}>
                    <div className="ml-welcome-model-card">
                      <div className="ml-welcome-model-top">
                        <h4>{model.name}</h4>
                        <span className="ml-welcome-model-badge">{model.tag}</span>
                      </div>
                      <p>{model.text}</p>
                      <div className="ml-welcome-model-meta">
                        <span className="ml-welcome-source">SCIKIT-LEARN</span>
                        <span className="ml-welcome-read">Read the guide <FaArrowRight aria-hidden="true" /></span>
                      </div>
                    </div>
                  </LearningLink>
                ))}
              </div>
              <div className="ml-welcome-notes">
                <p className="ml-welcome-tip"><FaFlask aria-hidden="true" /><span><strong>Experiment wisely.</strong> {task.note}</span></p>
                {task.extra && (
                  <div className="ml-welcome-extra">
                    <LearningLink href={task.extra.href}>{task.extra.label}</LearningLink>
                    <span>{task.extra.note}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="ml-welcome-drawers" aria-label="Guides and workflow details">
        {activeDrawer === 'workflow' && (
          <div id={`${sectionId}-drawer-workflow`} className="ml-welcome-drawer-panel ml-welcome-path" aria-label="Your experiment journey">
            {WORKFLOW_STEPS.map(([number, title, description]) => (
              <div key={number} className="ml-welcome-path-step">
                <span>{number}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeDrawer === 'foundations' && (
          <div id={`${sectionId}-drawer-foundations`} className="ml-welcome-drawer-panel ml-welcome-foundations" aria-label="Machine learning foundations">
            <div className="ml-welcome-book"><FaBookOpen aria-hidden="true" /></div>
            <div>
              <span className="ml-eyebrow">BUILD YOUR INTUITION</span>
              <h2>New to machine learning? Start here.</h2>
              <p>Google’s Machine Learning Crash Course offers practical lessons and interactive exercises to help the concepts click.</p>
            </div>
            <LearningLink href="https://developers.google.com/machine-learning/crash-course">Explore the course</LearningLink>
          </div>
        )}

        <div className="ml-welcome-drawer-bar">
          <button
            type="button"
            className={`ml-welcome-drawer-trigger ${activeDrawer === 'workflow' ? 'is-open' : ''}`}
            aria-expanded={activeDrawer === 'workflow'}
            aria-controls={`${sectionId}-drawer-workflow`}
            onClick={() => toggleDrawer('workflow')}
          >
            <span className="ml-welcome-drawer-label">
              <FaCodeBranch aria-hidden="true" />
              <strong>How the 3-step workflow works</strong>
              <span className="ml-welcome-drawer-hint">01 Prepare · 02 Test · 03 Decide</span>
            </span>
            <FaChevronDown className="ml-welcome-drawer-chevron" aria-hidden="true" />
          </button>

          <button
            type="button"
            className={`ml-welcome-drawer-trigger ${activeDrawer === 'foundations' ? 'is-open' : ''}`}
            aria-expanded={activeDrawer === 'foundations'}
            aria-controls={`${sectionId}-drawer-foundations`}
            onClick={() => toggleDrawer('foundations')}
          >
            <span className="ml-welcome-drawer-label">
              <FaBookOpen aria-hidden="true" />
              <strong>New to machine learning?</strong>
              <span className="ml-welcome-drawer-hint">Google ML Crash Course</span>
            </span>
            <FaChevronDown className="ml-welcome-drawer-chevron" aria-hidden="true" />
          </button>

          <p className="ml-welcome-footer">
            <span>Built for curious developers · Grounded in your data.</span>
            <span>Learning links open in a new tab.</span>
          </p>
        </div>
      </section>
    </div>
  </main>;
}
