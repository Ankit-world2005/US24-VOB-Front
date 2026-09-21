import React from 'react';

export function Hero() {
  return (
    <section className="intro">
      <span className="eyebrow">
        <span className="dot" aria-hidden="true" />
        Internal access · Employees only
      </span>
      <h1 className="headline">
        Your workspace, <span className="mark">signed <span className="orange">in.</span></span>
      </h1>
      <p className="lede">
        Sign in with your company Outlook account to reach internal tools, resources and your team dashboard.
      </p>
      <div className="facts">
        <div className="fact">
          <div className="k">Access</div>
          <div className="v">Role-based</div>
        </div>
        <div className="fact">
          <div className="k">Account</div>
          <div className="v">Outlook ID</div>
        </div>
        <div className="fact">
          <div className="k">Session</div>
          <div className="v">Per tab</div>
        </div>
      </div>
    </section>
  );
}
