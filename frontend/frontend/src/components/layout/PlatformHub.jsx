import React from 'react';
import { FaArrowRight, FaChartBar, FaLayerGroup, FaRegFileAlt } from 'react-icons/fa';
import './PlatformHub.css';

const APPLICATIONS = [
  {
    id: 'datastream',
    name: 'Datastream',
    description: 'Prepare and analyze data, explore it with AI Chat, and build models in ML Studio.',
    Icon: FaChartBar,
  },
  {
    id: 'slipstream',
    name: 'Slipstream',
    description: 'Work with documents and trace extracted information back to source evidence.',
    Icon: FaRegFileAlt,
  },
  {
    id: 'context-ledger',
    name: 'Context Ledger',
    description: 'Find governed business context and the evidence behind it.',
    Icon: FaLayerGroup,
  },
];

export default function PlatformHub({ links, headingRef }) {
  return (
    <main className="platform-hub" aria-labelledby="platform-hub-title">
      <div className="platform-hub__content">
        <h1 id="platform-hub-title" ref={headingRef} tabIndex={-1}>Data platform</h1>
        <div className="platform-hub__apps">
          {APPLICATIONS.map(({ id, name, description, Icon }) => {
            const link = links[id];

            return (
              <article key={id} aria-labelledby={`platform-app-${id}`} className="platform-hub__app"
                data-featured={id === 'datastream' ? '' : undefined}>
                <div className="platform-hub__card-header">
                  <span className="platform-hub__icon"><Icon aria-hidden="true" /></span>
                  <span className="platform-hub__status" data-available={link ? '' : undefined}>
                    {link ? 'Available' : 'Planned'}
                  </span>
                </div>
                <div className="platform-hub__details">
                  <h2 id={`platform-app-${id}`}>{name}</h2>
                  <p>{description}</p>
                </div>
                {link && (
                  <a className="platform-hub__launch" {...link}>
                    Open {name} <FaArrowRight aria-hidden="true" />
                  </a>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </main>
  );
}
