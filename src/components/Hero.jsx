import React from 'react';
import { UI_CONTENT } from '../DB';

export function Hero() {
  const { eyebrow, headline, lede, facts } = UI_CONTENT.hero;

  return (
    <section className="intro">
      <span className="eyebrow">
        <span className="dot" aria-hidden="true" />
        {eyebrow}
      </span>
      <h1 className="headline">
        Your workspace, <span className="mark">signed <span className="orange">in.</span></span>
      </h1>
      <p className="lede">
        {lede}
      </p>
      <div className="facts">
        {facts.map((f, i) => (
          <div key={i} className="fact">
            <div className="k">{f.k}</div>
            <div className="v">{f.v}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
