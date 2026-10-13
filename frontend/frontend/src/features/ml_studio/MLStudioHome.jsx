import React, { useId, useRef, useState } from 'react';
import {
  FaArrowRight, FaBookOpen, FaChartLine, FaCheck, FaCodeBranch,
  FaCubes, FaDatabase, FaExternalLinkAlt, FaFingerprint, FaFlask, FaLayerGroup,
} from 'react-icons/fa';
import './MLStudioHome.css';

// Keep this learning catalog aligned with configuration.py TASK_MODELS, which
// defines the current draft workflow (the legacy API offers different models).
const TASKS = [
  {
    id: 'regression', label: 'Regression', verb: 'Predict a number', icon: FaChartLine,
    question: 'What could this be worth?', example: 'Explore delivery times, energy use, or product demand.',
    description: 'Learn a relationship between your inputs and a numeric outcome, then test it on data the model has not seen.',
    input: 'Features + a numeric target', output: 'A predicted value', note: 'Compare error against a simple baseline before trusting a more complex model.',
    models: [
      { name: 'Regularized linear (Ridge)', text: 'A linear model with a penalty that keeps coefficients in check. A useful first candidate.', href: 'https://scikit-learn.org/stable/modules/linear_model.html#ridge-regression-and-classification' },
      { name: 'Random forest', text: 'An ensemble of decision trees that can capture nonlinear patterns and interactions.', href: 'https://scikit-learn.org/stable/modules/ensemble.html#forest' },
    ],
  },
  {
    id: 'classification', label: 'Classification', verb: 'Predict a category', icon: FaLayerGroup,
    question: 'Which category fits?', example: 'Explore support ticket categories or customer churn labels.',
    description: 'Use labeled examples to learn how to assign new rows to a category.',
    input: 'Features + known labels', output: 'A predicted class', note: 'Check class balance. Overall accuracy can hide poor performance on a rare class.',
    models: [
      { name: 'Logistic regression', text: 'A regularized linear classifier. Despite its name, it is used for classification.', href: 'https://scikit-learn.org/stable/modules/linear_model.html#logistic-regression' },
      { name: 'Random forest', text: 'Combines decision trees to learn category boundaries from multiple input features.', href: 'https://scikit-learn.org/stable/modules/ensemble.html#forest' },
    ],
  },
  {
    id: 'forecasting', label: 'Forecasting', verb: 'Look ahead in time', icon: FaChartLine,
    question: 'What might happen next?', example: 'Explore future sales or regularly sampled sensor readings.',
    description: 'Turn past observations into lagged inputs and evaluate predictions in time order.',
    input: 'Regular time series + numeric target', output: 'A configured forecast horizon', note: 'Keep future information out of training. Studio compares against last-observation and seasonal baselines.',
    models: [
      { name: 'Lagged Ridge', text: 'Ridge regression using past values as features to predict future values.', href: 'https://scikit-learn.org/stable/modules/linear_model.html#ridge-regression-and-classification' },
      { name: 'Lagged random forest', text: 'A random forest using lagged inputs to learn nonlinear temporal patterns.', href: 'https://scikit-learn.org/stable/modules/ensemble.html#forest' },
    ],
    extra: { label: 'Explore a lagged-feature forecasting example', href: 'https://scikit-learn.org/stable/auto_examples/applications/plot_time_series_lagged_features.html', note: 'This example teaches lagged features with a different estimator; Studio offers the two models above.' },
  },
  {
    id: 'clustering', label: 'Clustering', verb: 'Discover groups', icon: FaCubes,
    question: 'What belongs together?', example: 'Explore similar products or patterns in customer behavior.',
    description: 'Find groups of similar rows without needing a labeled target. Investigate what makes each group distinct.',
    input: 'Features, no target needed', output: 'A cluster assignment', note: 'Groups depend on your features and their scale. A cluster is a pattern to interpret, not a ground-truth label.',
    models: [
      { name: 'K-means', text: 'Groups observations around a chosen number of centers by minimizing within-cluster distance.', href: 'https://scikit-learn.org/stable/modules/clustering.html#k-means' },
      { name: 'Mini-batch K-means', text: 'Updates centers using small batches, trading some precision for faster fitting.', href: 'https://scikit-learn.org/stable/modules/clustering.html#mini-batch-k-means' },
    ],
  },
  {
    id: 'anomaly_detection', label: 'Anomaly detection', verb: 'Spot the unusual', icon: FaFingerprint,
    question: 'What deserves a closer look?', example: 'Explore unusual transactions or unexpected equipment readings.',
    description: 'Score how unusual a row looks and flag observations for further investigation.',
    input: 'Features + optional evaluation labels', output: 'An anomaly score and flag', note: 'Unusual does not mean incorrect. Scores are model-specific and flags need human review.',
    models: [
      { name: 'Isolation forest', text: 'Uses random partitions to identify observations that are easier to isolate.', href: 'https://scikit-learn.org/stable/modules/outlier_detection.html#isolation-forest' },
      { name: 'Local outlier factor', text: 'Looks for observations with lower local density than their neighbors. Studio uses novelty scoring for new rows.', href: 'https://scikit-learn.org/stable/modules/outlier_detection.html#local-outlier-factor' },
    ],
  },
];

function LearningLink({ href, children, className = '' }) {
  return <a className={className} href={href} target="_blank" rel="noopener noreferrer">
    {children}<FaExternalLinkAlt aria-hidden="true" /><span className="ml-welcome-sr-only"> (opens in a new tab)</span>
  </a>;
}

function PatternIllustration({ task }) {
  const grouped = ['classification', 'clustering', 'anomaly_detection'].includes(task);
  // Fixed, synthetic coordinates illustrate a concept; they are never run data.
  const groups = [
    [[62, 123], [84, 133], [99, 108], [114, 139], [77, 157], [126, 114], [102, 161]],
    [[171, 61], [199, 48], [217, 76], [188, 88], [236, 55], [220, 107], [163, 87]],
    [[259, 145], [287, 123], [315, 149], [294, 171], [329, 117], [264, 176], [321, 181]],
  ];
  return <svg className={`ml-welcome-plot plot-${task}`} viewBox="0 0 380 230" role="img" aria-label={`Illustration of ${task.replace('_', ' ')}; not experiment results`}>
    {[50, 95, 140, 185].map(y => <path key={y} className="plot-grid" d={`M28 ${y}H354`} />)}
    {[65, 125, 185, 245, 305].map(x => <path key={x} className="plot-grid" d={`M${x} 28V202`} />)}
    {grouped ? <>
      {task === 'clustering' && <g className="plot-clusters"><ellipse cx="95" cy="136" rx="52" ry="47" /><ellipse cx="200" cy="77" rx="54" ry="48" /><ellipse cx="295" cy="151" rx="55" ry="48" /></g>}
      {task === 'classification' && <path className="plot-boundary" d="M132 28L146 115L234 202" />}
      {groups.map((points, group) => <g key={group} className={`plot-group plot-group-${group}`}>
        {points.map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="5" />)}
      </g>)}
      {task === 'anomaly_detection' && <g className="plot-outlier"><circle cx="322" cy="39" r="15" /><circle cx="322" cy="39" r="5" /></g>}
    </> : <>
      {task === 'forecasting' ? <>
        <path className="plot-forecast-area" d="M240 86L270 62L295 79L325 32L348 46V116L325 95L295 130L270 108L240 101Z" />
        <path className="plot-fit" d="M35 174L61 155L85 167L112 128L138 146L163 99L187 119L214 78L240 95" />
        <path className="plot-fit plot-projection" d="M240 95L270 86L295 104L325 62L348 80" />
        <path className="plot-boundary" d="M240 28V202" />
      </> : <>
        <path className="plot-fit" d="M35 183L344 43" />
        {[[51, 163], [73, 181], [99, 135], [119, 152], [143, 120], [167, 136], [189, 99], [214, 118], [239, 70], [258, 98], [285, 59], [311, 79], [330, 34]].map(([x, y]) => <circle className="plot-sample" key={x} cx={x} cy={y} r="5" />)}
      </>}
    </>}
  </svg>;
}

export default function MLStudioHome({ children, onCreate, pendingAction = null, canCreate = true, savedCount = 0 }) {
  const [selectedTask, setSelectedTask] = useState('regression');
  const task = TASKS.find(item => item.id === selectedTask);
  const canvasRef = useRef(null);
  const explorerRef = useRef(null);
  const sectionId = useId();
  const Icon = task.icon;
  const explore = () => {
    const canvas = canvasRef.current;
    const heading = explorerRef.current;
    if (!canvas || !heading) return;
    // Scroll only the Studio pane; scrolling every ancestor can move the app header.
    canvas.scrollTo({ top: Math.max(0, canvas.scrollTop + heading.getBoundingClientRect().top - canvas.getBoundingClientRect().top - 24) });
    heading.focus({ preventScroll: true });
  };

  return <main ref={canvasRef} className="ml-studio-canvas ml-welcome-canvas" aria-label="Experiment Home">
    <div className="ml-welcome">
      <section className="ml-welcome-hero" aria-labelledby={`${sectionId}-title`}>
        <div className="ml-welcome-intro">
          <span className="ml-welcome-kicker"><span /> A little curiosity. A lot of possibility.</span>
          <h1 id={`${sectionId}-title`}>Your data.<br /><span>Your next discovery.</span></h1>
          <p>A place to turn “what if” into something you can test. Prepare your data, compare models, and build with evidence—all in one studio.</p>
          <div className="ml-welcome-actions">
            <button className="start-run-button" onClick={onCreate} disabled={!canCreate || pendingAction !== null} aria-describedby={!canCreate ? `${sectionId}-dataset` : undefined}>
              <FaFlask aria-hidden="true" /> {pendingAction === 'creating' ? 'Creating...' : 'New Experiment'} <FaArrowRight aria-hidden="true" />
            </button>
            <button className="ml-welcome-secondary" onClick={explore}><FaBookOpen aria-hidden="true" /> Explore algorithms</button>
          </div>
          <div className="ml-welcome-assurances"><span><FaCheck aria-hidden="true" /> Local training</span><span><FaCheck aria-hidden="true" /> Saved experiments</span><span><FaCheck aria-hidden="true" /> Python model exports</span></div>
        </div>
        <div className="ml-welcome-lab" aria-label="An illustrated experiment workflow">
          <div className="ml-welcome-lab-heading"><span><FaCodeBranch aria-hidden="true" /> THE EXPERIMENT LOOP</span><span className="ml-welcome-concept">Concept preview</span></div>
          <div className="ml-welcome-lab-flow"><span><FaDatabase aria-hidden="true" /> Data</span><i /><span><FaCubes aria-hidden="true" /> Model</span><i /><span><FaChartLine aria-hidden="true" /> Insight</span></div>
          <PatternIllustration task={selectedTask} />
          <div className="ml-welcome-lab-caption"><span>{task.verb}</span><span>Explore. Compare. Understand.</span></div>
        </div>
      </section>

      {!canCreate && <div className="ml-welcome-dataset" id={`${sectionId}-dataset`}><FaDatabase aria-hidden="true" /><div><h2>No Dataset Selected</h2><p>Select a dataset in the Data pane to start an experiment. In the meantime, explore the models below.</p></div></div>}

      {children && <section className="ml-welcome-saved" aria-label="Saved experiments">
        <div className="ml-welcome-section-heading"><div><span className="ml-eyebrow">PICK UP WHERE YOU LEFT OFF</span><h2>Workspace Experiments</h2></div><span className="ml-welcome-count">{savedCount} saved</span></div>
        {children}
      </section>}

      <section className="ml-welcome-explorer" aria-labelledby={`${sectionId}-explore`}>
        <div className="ml-welcome-section-heading"><div><span className="ml-eyebrow">FIND YOUR STARTING POINT</span><h2 ref={explorerRef} tabIndex={-1} id={`${sectionId}-explore`}>One studio. Five ways to explore.</h2><p>Start with the question. Get to know the models behind it.</p></div><span className="ml-welcome-tag"><FaBookOpen aria-hidden="true" /> Learn by exploring</span></div>
        <div className="ml-welcome-task-picker" role="group" aria-label="Explore machine learning tasks">
          {TASKS.map(item => { const TaskIcon = item.icon; return <button key={item.id} aria-pressed={item.id === selectedTask} aria-controls={`${sectionId}-task`} onClick={() => setSelectedTask(item.id)}><TaskIcon aria-hidden="true" /><strong>{item.label}</strong><span>{item.verb}</span></button>; })}
        </div>
        <div className="ml-welcome-task-detail" id={`${sectionId}-task`}>
          <div className="ml-welcome-task-story" key={task.id}>
            <span className="ml-welcome-task-icon"><Icon aria-hidden="true" /></span>
            <span className="ml-eyebrow">{task.label}</span><h3>{task.question}</h3><p>{task.description}</p>
            <p className="ml-welcome-example">{task.example}</p>
            <dl><div><dt>You bring</dt><dd>{task.input}</dd></div><div><dt>You explore</dt><dd>{task.output}</dd></div></dl>
          </div>
          <div className="ml-welcome-models">
            <div className="ml-welcome-models-heading"><h3>Meet the algorithms</h3><span>Available in Studio</span></div>
            {task.models.map(model => <LearningLink key={model.name} className="ml-welcome-model" href={model.href}><div><span className="ml-welcome-source">SCIKIT-LEARN · OFFICIAL GUIDE</span><h4>{model.name}</h4><p>{model.text}</p><span className="ml-welcome-read">Read the guide <FaArrowRight aria-hidden="true" /></span></div></LearningLink>)}
            <p className="ml-welcome-tip"><FaFlask aria-hidden="true" /><span><strong>Experiment wisely.</strong> {task.note}</span></p>
            {task.extra && <div className="ml-welcome-extra"><LearningLink href={task.extra.href}>{task.extra.label}</LearningLink><p>{task.extra.note}</p></div>}
          </div>
        </div>
      </section>

      <section className="ml-welcome-path" aria-label="Your experiment journey">
        {[['01', 'Prepare with purpose', 'Choose a question, connect your data, and address quality issues.'], ['02', 'Put models to the test', 'Configure candidates and compare them against simple baselines.'], ['03', 'Make an informed choice', 'Review held-out evidence, then export a selected model or predict new rows.']].map(([number, title, description]) => <div key={number}><span>{number}</span><h3>{title}</h3><p>{description}</p></div>)}
      </section>

      <section className="ml-welcome-foundations" aria-label="Machine learning foundations"><div className="ml-welcome-book"><FaBookOpen aria-hidden="true" /></div><div><span className="ml-eyebrow">BUILD YOUR INTUITION</span><h2>New to machine learning? Start here.</h2><p>Google’s Machine Learning Crash Course offers practical lessons and interactive exercises to help the concepts click.</p></div><LearningLink href="https://developers.google.com/machine-learning/crash-course">Explore the course</LearningLink></section>
      <p className="ml-welcome-footer">Built for curious developers. Grounded in your data.<span>Learning links open in a new tab.</span></p>
    </div>
  </main>;
}
