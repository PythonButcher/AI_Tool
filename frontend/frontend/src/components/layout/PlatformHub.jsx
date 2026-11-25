import React, { useContext, useEffect, useId, useRef, useState } from 'react';
import {
  FaArrowRight,
  FaBell,
  FaBookOpen,
  FaBrain,
  FaChartBar,
  FaCheck,
  FaCompass,
  FaCubes,
  FaExternalLinkSquareAlt,
  FaLayerGroup,
  FaLightbulb,
  FaLock,
  FaMoon,
  FaProjectDiagram,
  FaRegFileAlt,
  FaShieldAlt,
  FaSun,
  FaTimes,
  FaUserCircle,
} from 'react-icons/fa';
import { ThemeContext } from '../../context/ThemeContext';
import {
  ACCOUNT_PREVIEW,
  CONTEXT_TOPICS,
  FUTURE_CAPABILITIES,
  GUIDANCE_PLAYBOOKS,
  HUB_COLOR_THEMES,
  HUB_PALETTE_STORAGE_KEY,
  PLATFORM_APPLICATIONS,
  PLATFORM_VISUALS,
} from './platformHubData';
import './PlatformHub.css';

const APP_ICONS = {
  devstream: FaChartBar,
  slipstream: FaRegFileAlt,
  'context-ledger': FaLayerGroup,
  'publishing-portal': FaExternalLinkSquareAlt,
};

const ROADMAP_ICONS = {
  identity: FaLock,
  memory: FaBrain,
  entities: FaProjectDiagram,
  products: FaCubes,
  investigations: FaCompass,
  monitoring: FaBell,
};

const VALID_PALETTES = new Set(HUB_COLOR_THEMES.map(item => item.id));

const DOCK_TABS = [
  { id: 'context', label: 'Topic Context' },
  { id: 'guides', label: 'How-To Guides' },
  { id: 'roadmap', label: 'Planned Roadmap' },
];

function readStoredPalette() {
  try {
    const saved = localStorage.getItem(HUB_PALETTE_STORAGE_KEY);
    return VALID_PALETTES.has(saved) ? saved : 'mineral';
  } catch {
    return 'mineral';
  }
}

function readFallbackTheme() {
  try {
    const attr = document.documentElement.getAttribute('data-theme');
    if (attr === 'light' || attr === 'dark') return attr;
    return localStorage.getItem('theme') === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export default function PlatformHub({ links = {}, headingRef }) {
  const themeContext = useContext(ThemeContext);
  const [fallbackTheme, setFallbackTheme] = useState(readFallbackTheme);
  const [palette, setPalette] = useState(readStoredPalette);
  const [activeVisualId, setActiveVisualId] = useState(PLATFORM_VISUALS[0].id);
  const [activeDockTab, setActiveDockTab] = useState('context');
  const [activeTopicId, setActiveTopicId] = useState(CONTEXT_TOPICS[0].id);
  const [activeGuideId, setActiveGuideId] = useState(GUIDANCE_PLAYBOOKS[0].id);
  const [accountOpen, setAccountOpen] = useState(false);

  const hubId = useId();
  const accountPanelRef = useRef(null);
  const accountTriggerRef = useRef(null);
  const dockTabRefs = useRef({});

  const currentTheme = themeContext?.theme ?? fallbackTheme;
  const isDark = currentTheme === 'dark';

  const handleToggleTheme = () => {
    if (themeContext?.toggleTheme) {
      themeContext.toggleTheme();
      return;
    }
    const next = currentTheme === 'dark' ? 'light' : 'dark';
    setFallbackTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem('theme', next);
    } catch {
      // Ignore storage errors in restricted environments.
    }
  };

  const handleSelectPalette = (nextPalette) => {
    if (!VALID_PALETTES.has(nextPalette)) return;
    setPalette(nextPalette);
    try {
      localStorage.setItem(HUB_PALETTE_STORAGE_KEY, nextPalette);
    } catch {
      // Ignore storage errors in restricted environments.
    }
  };

  useEffect(() => {
    if (!accountOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setAccountOpen(false);
        accountTriggerRef.current?.focus();
      }
    };

    const handlePointerDown = (event) => {
      if (
        accountPanelRef.current
        && !accountPanelRef.current.contains(event.target)
        && accountTriggerRef.current
        && !accountTriggerRef.current.contains(event.target)
      ) {
        setAccountOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [accountOpen]);

  const openTopic = (topicId) => {
    setActiveTopicId(topicId);
    setActiveDockTab('context');
    setAccountOpen(false);
  };

  const openGuide = (guideId) => {
    setActiveGuideId(guideId);
    setActiveDockTab('guides');
  };

  const activeVisual = PLATFORM_VISUALS.find(item => item.id === activeVisualId) || PLATFORM_VISUALS[0];
  const activeTopic = CONTEXT_TOPICS.find(item => item.id === activeTopicId) || CONTEXT_TOPICS[0];
  const activeGuide = GUIDANCE_PLAYBOOKS.find(item => item.id === activeGuideId) || GUIDANCE_PLAYBOOKS[0];
  const featuredApp = PLATFORM_APPLICATIONS.find(item => item.featured);
  const companionApps = PLATFORM_APPLICATIONS.filter(item => !item.featured);
  const devstreamLink = links.devstream;

  return (
    <main
      className="platform-hub"
      data-hub-palette={palette}
      aria-labelledby="platform-hub-title"
    >
      {/* Full-Bleed Borderless Top Bar */}
      <header className="platform-hub__topbar" aria-label="Platform controls">
        <div className="platform-hub__brand">
          <img className="platform-hub__brand-mark" src={`${process.env.PUBLIC_URL || ''}/stream-mark.png`} alt="" />
          <span className="platform-hub__brand-name">Datastream</span>
          <span className="platform-hub__session-note">
            <span className="platform-hub__session-dot" aria-hidden="true" />
            Local workspace
          </span>
        </div>

        <div className="platform-hub__controls">
          <div className="platform-hub__palette-group" role="group" aria-label="Color theme">
            {HUB_COLOR_THEMES.map(themeOption => {
              const selected = palette === themeOption.id;
              return (
                <button
                  key={themeOption.id}
                  type="button"
                  className={`platform-hub__swatch ${selected ? 'is-selected' : ''}`}
                  aria-pressed={selected}
                  aria-label={`${themeOption.label} color theme`}
                  title={themeOption.label}
                  onClick={() => handleSelectPalette(themeOption.id)}
                >
                  <span
                    className="platform-hub__swatch-dot"
                    style={{
                      background: `linear-gradient(135deg, ${themeOption.swatches[0]} 50%, ${themeOption.swatches[1]} 50%)`,
                    }}
                    aria-hidden="true"
                  />
                </button>
              );
            })}
          </div>

          <span className="platform-hub__control-sep" aria-hidden="true" />

          <button
            type="button"
            className="platform-hub__mode-toggle"
            onClick={handleToggleTheme}
            aria-pressed={!isDark}
            aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
            title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
          >
            {isDark ? <FaSun aria-hidden="true" /> : <FaMoon aria-hidden="true" />}
            <span>{isDark ? 'Light' : 'Dark'}</span>
          </button>

          <div className="platform-hub__account-wrap">
            <button
              ref={accountTriggerRef}
              type="button"
              className={`platform-hub__account-btn ${accountOpen ? 'is-open' : ''}`}
              aria-expanded={accountOpen}
              aria-controls={`${hubId}-account-panel`}
              onClick={() => setAccountOpen(open => !open)}
            >
              <FaUserCircle aria-hidden="true" />
              <span>Sign-in preview</span>
              <span className="platform-hub__mini-tag">Planned</span>
            </button>

            {accountOpen && (
              <div
                id={`${hubId}-account-panel`}
                ref={accountPanelRef}
                className="platform-hub__account-panel"
                role="region"
                aria-label="Account and identity preview"
              >
                <div className="platform-hub__account-head">
                  <div>
                    <span className="platform-hub__kicker-inline">Identity roadmap</span>
                    <h2>Sign-in &amp; Identity</h2>
                  </div>
                  <button
                    type="button"
                    className="platform-hub__icon-close"
                    aria-label="Close sign-in preview"
                    onClick={() => {
                      setAccountOpen(false);
                      accountTriggerRef.current?.focus();
                    }}
                  >
                    <FaTimes aria-hidden="true" />
                  </button>
                </div>

                <div className="platform-hub__account-current">
                  <span className="platform-hub__status" data-available="">
                    {ACCOUNT_PREVIEW.currentMode}
                  </span>
                  <p>{ACCOUNT_PREVIEW.currentDescription}</p>
                </div>

                <ul className="platform-hub__account-list">
                  {ACCOUNT_PREVIEW.plannedItems.map(item => (
                    <li key={item.title}>
                      <strong>{item.title}</strong>
                      <span>{item.detail}</span>
                    </li>
                  ))}
                </ul>

                <div className="platform-hub__account-actions">
                  <button type="button" className="platform-hub__ghost-disabled" disabled>
                    <FaLock aria-hidden="true" /> Continue with Google / SSO (Planned)
                  </button>
                  <button
                    type="button"
                    className="platform-hub__text-btn"
                    onClick={() => openTopic('identity-memory')}
                  >
                    Read Login &amp; Memory context <FaArrowRight aria-hidden="true" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Full-Viewport Edge-to-Edge Split Workspace */}
      <div className="platform-hub__canvas">
        {/* Left Main Stage (~62%): Open Hero, Applications, and Borderless Knowledge Band */}
        <div className="platform-hub__stage">
          <section className="platform-hub__hero" aria-label="Platform introduction">
            <span className="platform-hub__kicker">
              <span className="platform-hub__kicker-dot" aria-hidden="true" />
              Unified Analytics &amp; Evidence Environment
            </span>
            <h1 id="platform-hub-title" ref={headingRef} tabIndex={-1}>
              Datastream
            </h1>
            <p className="platform-hub__lead">
              Prepare raw data, build governed models, explore with BI-first AI Chat, and benchmark
              local ML workflows in Devstream—designed to scale across document evidence and
              published reporting.
            </p>
          </section>

          {/* Applications Surface (Open Tonal Planes, Zero Boxy Outlines) */}
          <section className="platform-hub__apps-section" aria-label="Platform applications">
            {featuredApp && (() => {
              const Icon = APP_ICONS[featuredApp.iconKey] || FaChartBar;
              return (
                <article
                  key={featuredApp.id}
                  aria-labelledby={`platform-app-${featuredApp.id}`}
                  className="platform-hub__featured"
                  data-featured=""
                >
                  <div className="platform-hub__featured-main">
                    <div className="platform-hub__app-meta-row">
                      <span className="platform-hub__app-icon platform-hub__app-icon--accent">
                        <Icon aria-hidden="true" />
                      </span>
                      <span className="platform-hub__eyebrow-label">{featuredApp.eyebrow}</span>
                      <span className="platform-hub__status" data-available={devstreamLink ? '' : undefined}>
                        {devstreamLink ? 'Available' : 'Planned'}
                      </span>
                    </div>

                    <h2 id={`platform-app-${featuredApp.id}`}>{featuredApp.name}</h2>
                    <p className="platform-hub__featured-desc">{featuredApp.description}</p>

                    <p className="platform-hub__cap-line" aria-label="Devstream capabilities">
                      {featuredApp.capabilities.join('  ·  ')}
                    </p>
                  </div>

                  {devstreamLink && (
                    <div className="platform-hub__featured-action">
                      <a className="platform-hub__launch" {...devstreamLink}>
                        Open {featuredApp.name} <FaArrowRight aria-hidden="true" />
                      </a>
                    </div>
                  )}
                </article>
              );
            })()}

            <div className="platform-hub__companions">
              {companionApps.map(app => {
                const Icon = APP_ICONS[app.iconKey] || FaLayerGroup;
                const link = links[app.id];
                return (
                  <article
                    key={app.id}
                    aria-labelledby={`platform-app-${app.id}`}
                    className="platform-hub__companion"
                  >
                    <div className="platform-hub__companion-top">
                      <span className="platform-hub__app-icon">
                        <Icon aria-hidden="true" />
                      </span>
                      <span className="platform-hub__status" data-available={link ? '' : undefined}>
                        {link ? 'Available' : 'Planned'}
                      </span>
                    </div>
                    <h2 id={`platform-app-${app.id}`}>{app.name}</h2>
                    <p>{app.description}</p>
                  </article>
                );
              })}
            </div>
          </section>

          {/* Open, Borderless Knowledge & Roadmap Band */}
          <section className="platform-hub__knowledge" aria-label="Context, guidance, and roadmap">
            <div className="platform-hub__knowledge-bar">
              <div className="platform-hub__tabs" role="tablist" aria-label="Platform information views">
                {DOCK_TABS.map((tab, index) => {
                  const selected = activeDockTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      ref={node => { dockTabRefs.current[tab.id] = node; }}
                      type="button"
                      role="tab"
                      id={`${hubId}-tab-${tab.id}`}
                      tabIndex={selected ? 0 : -1}
                      aria-selected={selected}
                      aria-controls={`${hubId}-panel-${tab.id}`}
                      className={`platform-hub__tab ${selected ? 'is-active' : ''}`}
                      onClick={() => setActiveDockTab(tab.id)}
                      onKeyDown={event => {
                        let nextIndex = null;
                        if (event.key === 'ArrowRight') nextIndex = (index + 1) % DOCK_TABS.length;
                        else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + DOCK_TABS.length) % DOCK_TABS.length;
                        else if (event.key === 'Home') nextIndex = 0;
                        else if (event.key === 'End') nextIndex = DOCK_TABS.length - 1;
                        if (nextIndex === null) return;
                        event.preventDefault();
                        const nextTab = DOCK_TABS[nextIndex];
                        setActiveDockTab(nextTab.id);
                        dockTabRefs.current[nextTab.id]?.focus();
                      }}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tab 1: Topic Context */}
            {activeDockTab === 'context' && (
              <div
                id={`${hubId}-panel-context`}
                role="tabpanel"
                aria-labelledby={`${hubId}-tab-context`}
                className="platform-hub__tab-panel"
              >
                <div className="platform-hub__subnav" role="group" aria-label="Platform context topics">
                  {CONTEXT_TOPICS.map(topic => {
                    const selected = topic.id === activeTopic.id;
                    return (
                      <button
                        key={topic.id}
                        type="button"
                        className={`platform-hub__topic-pill ${selected ? 'is-active' : ''}`}
                        aria-pressed={selected}
                        onClick={() => setActiveTopicId(topic.id)}
                      >
                        <span
                          className={`platform-hub__topic-dot ${topic.availableNow ? 'is-live' : ''}`}
                          aria-hidden="true"
                        />
                        <span>{topic.label}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="platform-hub__context-columns">
                  <div className="platform-hub__context-lead">
                    <span
                      className="platform-hub__status"
                      data-available={activeTopic.availableNow ? '' : undefined}
                    >
                      {activeTopic.status}
                    </span>
                    <h3>{activeTopic.title}</h3>
                    <p>{activeTopic.summary}</p>
                    <button
                      type="button"
                      className="platform-hub__inline-action"
                      onClick={() => openGuide(activeTopic.relatedGuideId)}
                    >
                      <FaBookOpen aria-hidden="true" /> Open related how-to guide <FaArrowRight aria-hidden="true" />
                    </button>
                  </div>

                  <ul className="platform-hub__editorial-list">
                    {activeTopic.points.map(point => (
                      <li key={point}>
                        <FaCheck aria-hidden="true" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Tab 2: How-To Guides */}
            {activeDockTab === 'guides' && (
              <div
                id={`${hubId}-panel-guides`}
                role="tabpanel"
                aria-labelledby={`${hubId}-tab-guides`}
                className="platform-hub__tab-panel"
              >
                <div className="platform-hub__subnav" role="group" aria-label="How-to guides">
                  {GUIDANCE_PLAYBOOKS.map(guide => {
                    const selected = guide.id === activeGuide.id;
                    return (
                      <button
                        key={guide.id}
                        type="button"
                        className={`platform-hub__topic-pill ${selected ? 'is-active' : ''}`}
                        aria-pressed={selected}
                        onClick={() => setActiveGuideId(guide.id)}
                      >
                        <span>{guide.shortTitle}</span>
                        <span className="platform-hub__pill-duration">{guide.duration}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="platform-hub__guide-header">
                  <h3>{activeGuide.title}</h3>
                  <p className="platform-hub__guide-tip">
                    <FaLightbulb aria-hidden="true" /> {activeGuide.tip}
                  </p>
                </div>

                <ol className="platform-hub__steps">
                  {activeGuide.steps.map(step => (
                    <li key={step.number} className="platform-hub__step">
                      <span className="platform-hub__step-num" aria-hidden="true">{step.number}</span>
                      <h4>{step.title}</h4>
                      <p>{step.detail}</p>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Tab 3: Planned Roadmap */}
            {activeDockTab === 'roadmap' && (
              <div
                id={`${hubId}-panel-roadmap`}
                role="tabpanel"
                aria-labelledby={`${hubId}-tab-roadmap`}
                className="platform-hub__tab-panel"
              >
                <div className="platform-hub__roadmap-grid">
                  {FUTURE_CAPABILITIES.map(item => {
                    const Icon = ROADMAP_ICONS[item.iconKey] || FaShieldAlt;
                    return (
                      <div key={item.id} className="platform-hub__roadmap-item">
                        <div className="platform-hub__roadmap-head">
                          <span className="platform-hub__roadmap-icon">
                            <Icon aria-hidden="true" />
                          </span>
                          <h3>{item.title}</h3>
                          <span className="platform-hub__status">{item.stage}</span>
                        </div>
                        <p>{item.summary}</p>
                        <button
                          type="button"
                          className="platform-hub__inline-action"
                          onClick={() => openTopic(item.topicId)}
                        >
                          Context <FaArrowRight aria-hidden="true" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Right Full-Height Editorial Visual Showcase Rail (~38%) */}
        <aside className="platform-hub__showcase" aria-label="Platform visual overview">
          <figure className="platform-hub__showcase-figure">
            <div className="platform-hub__showcase-media">
              <img src={activeVisual.src} alt={activeVisual.alt} />
              <div className="platform-hub__showcase-scrim" aria-hidden="true" />
              <div className="platform-hub__showcase-overlay">
                <span className="platform-hub__showcase-index">{activeVisual.index} / 03</span>
                <span className="platform-hub__showcase-eyebrow">{activeVisual.eyebrow}</span>
              </div>
            </div>

            <div className="platform-hub__visual-switcher" role="group" aria-label="Platform visual previews">
              {PLATFORM_VISUALS.map(visual => {
                const selected = visual.id === activeVisual.id;
                return (
                  <button
                    key={visual.id}
                    type="button"
                    className={`platform-hub__visual-btn ${selected ? 'is-active' : ''}`}
                    aria-pressed={selected}
                    onClick={() => setActiveVisualId(visual.id)}
                  >
                    <span className="platform-hub__visual-idx" aria-hidden="true">{visual.index}</span>
                    <span>{visual.tabLabel}</span>
                  </button>
                );
              })}
            </div>

            <figcaption className="platform-hub__showcase-copy">
              <h2>{activeVisual.title}</h2>
              <p>{activeVisual.caption}</p>

              <ul className="platform-hub__showcase-points">
                {activeVisual.highlights.map(line => (
                  <li key={line}>{line}</li>
                ))}
              </ul>

              <button
                type="button"
                className="platform-hub__inline-action"
                onClick={() => openTopic(activeVisual.topicId)}
              >
                Explore {activeVisual.tabLabel.toLowerCase()} context <FaArrowRight aria-hidden="true" />
              </button>
            </figcaption>
          </figure>
        </aside>
      </div>
    </main>
  );
}
