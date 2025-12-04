import React from 'react';
import Tooltip from './Tooltip';
import './TooltipDemo.css';

/**
 * Tooltip Demo Page
 * 
 * View at: http://localhost:3000/tooltip-demo
 * 
 * Shows all tooltip variations and use cases
 */
const TooltipDemo = () => {
  return (
    <div className="tooltip-demo-page">
      <div className="tooltip-demo-header">
        <h1>🎯 Tooltip Component Demo</h1>
        <p>Hover or tap on icons to see tooltips in action</p>
      </div>

      {/* Section 1: Info Icons */}
      <section className="demo-section">
        <h2>1. Info Icon Tooltips</h2>
        <p className="section-desc">Most common use case - small info icon with help text</p>
        
        <div className="demo-examples">
          <div className="demo-item">
            <label>
              Email Address
              <Tooltip text="We'll never share your email with anyone" icon />
            </label>
            <input type="email" placeholder="you@example.com" />
          </div>

          <div className="demo-item">
            <label>
              Birth Year
              <Tooltip 
                text="Used to calculate your age. Visible only to matched users." 
                position="right"
                icon 
              />
            </label>
            <input type="number" placeholder="1995" />
          </div>

          <div className="demo-item">
            <label>
              L3V3L Score
              <Tooltip 
                text="Compatibility score based on your preferences, values, and personality traits. Higher scores indicate better matches."
                maxWidth="300px"
                icon 
              />
            </label>
            <div className="score-display">85/100</div>
          </div>
        </div>
      </section>

      {/* Section 2: Positions */}
      <section className="demo-section">
        <h2>2. Tooltip Positions</h2>
        <p className="section-desc">Control where tooltips appear</p>
        
        <div className="position-demo">
          <div className="position-center">
            <div className="position-item">
              <Tooltip text="I appear on TOP" position="top" icon />
              <span>Top</span>
            </div>
            
            <div className="position-item">
              <Tooltip text="I appear on the RIGHT" position="right" icon />
              <span>Right</span>
            </div>
            
            <div className="position-item">
              <Tooltip text="I appear on BOTTOM" position="bottom" icon />
              <span>Bottom</span>
            </div>
            
            <div className="position-item">
              <Tooltip text="I appear on the LEFT" position="left" icon />
              <span>Left</span>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: Wrapped Elements */}
      <section className="demo-section">
        <h2>3. Wrapping Existing Elements</h2>
        <p className="section-desc">Add tooltips to any element</p>
        
        <div className="demo-examples">
          <div className="demo-item">
            <Tooltip text="This is your unique identifier in the system">
              <strong style={{ textDecoration: 'underline', cursor: 'help' }}>
                Username
              </strong>
            </Tooltip>
            : john_doe_123
          </div>

          <div className="demo-item">
            Status: 
            <Tooltip text="Your profile is visible and active">
              <span className="status-badge active">Active</span>
            </Tooltip>
          </div>

          <div className="demo-item">
            <Tooltip text="Click to enable premium features" position="bottom">
              <button className="btn-upgrade">Upgrade to Premium</button>
            </Tooltip>
          </div>
        </div>
      </section>

      {/* Section 4: Real-World Examples */}
      <section className="demo-section">
        <h2>4. Real-World Use Cases</h2>
        <p className="section-desc">How tooltips help in actual features</p>
        
        <div className="demo-examples">
          {/* Admin Dashboard Table Header */}
          <div className="demo-item-wide">
            <h4>Admin Dashboard - Table Headers</h4>
            <table className="demo-table">
              <thead>
                <tr>
                  <th>
                    Username
                    <Tooltip text="User's unique login identifier" icon />
                  </th>
                  <th>
                    Days Active
                    <Tooltip text="Number of days since registration" icon />
                  </th>
                  <th>
                    Messages Sent
                    <Tooltip 
                      text="Total messages sent by this user. Spam threshold is 100/day."
                      maxWidth="280px"
                      icon 
                    />
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>john_doe</td>
                  <td>42</td>
                  <td>156</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Search Filters */}
          <div className="demo-item-wide">
            <h4>Search Page - Advanced Filters</h4>
            <div className="filter-group">
              <label>
                Age Range
                <Tooltip 
                  text="Set minimum and maximum age. Leave blank for no restriction."
                  position="right"
                  maxWidth="280px"
                  icon 
                />
              </label>
              <div className="range-inputs">
                <input type="number" placeholder="Min" />
                <span>to</span>
                <input type="number" placeholder="Max" />
              </div>
            </div>

            <div className="filter-group">
              <label>
                L3V3L Compatibility
                <Tooltip 
                  text="Filter by compatibility score. Premium feature that ranks matches based on shared values and preferences."
                  position="right"
                  maxWidth="320px"
                  icon 
                />
              </label>
              <select>
                <option>Any Score</option>
                <option>80+ (High)</option>
                <option>90+ (Very High)</option>
              </select>
            </div>
          </div>

          {/* Privacy Settings */}
          <div className="demo-item-wide">
            <h4>Profile Settings - Privacy Controls</h4>
            <div className="privacy-setting">
              <label>
                <input type="checkbox" defaultChecked />
                Show Contact Info to Matches
                <Tooltip 
                  text="Only users you've mutually matched with can see your phone number and email"
                  position="right"
                  maxWidth="300px"
                  icon 
                />
              </label>
            </div>

            <div className="privacy-setting">
              <label>
                <input type="checkbox" />
                Pause Profile
                <Tooltip 
                  text="Hide your profile from search results temporarily. You can reactivate anytime."
                  position="right"
                  maxWidth="300px"
                  icon 
                />
              </label>
            </div>
          </div>
        </div>
      </section>

      {/* Section 5: Disabled Elements */}
      <section className="demo-section">
        <h2>5. Explaining Disabled Actions</h2>
        <p className="section-desc">Tell users why something is disabled</p>
        
        <div className="demo-examples">
          <div className="demo-item">
            <button disabled className="btn-disabled">
              Send Message
              <Tooltip 
                text="Complete your profile to send messages"
                position="top"
                icon 
              />
            </button>
          </div>

          <div className="demo-item">
            <button disabled className="btn-disabled">
              Delete Account
              <Tooltip 
                text="You have 3 pending conversations. Close them before deleting."
                maxWidth="280px"
                position="top"
                icon 
              />
            </button>
          </div>
        </div>
      </section>

      {/* Section 6: Theme Compatibility */}
      <section className="demo-section">
        <h2>6. Theme Compatibility</h2>
        <p className="section-desc">Tooltips automatically adapt to your theme</p>
        
        <div className="theme-demo">
          <div className="theme-card">
            <p>Switch themes using the theme selector in the navigation to see tooltips adapt!</p>
            <Tooltip 
              text="This tooltip changes colors based on your selected theme"
              maxWidth="250px"
              icon 
            />
          </div>
        </div>
      </section>

      {/* Usage Instructions */}
      <section className="demo-section demo-usage">
        <h2>💡 How to Use in Your Code</h2>
        <div className="code-example">
          <h4>Basic Usage:</h4>
          <pre>{`import Tooltip from './components/Tooltip';

// Info icon
<label>
  Email
  <Tooltip text="Help text here" icon />
</label>

// Wrap element
<Tooltip text="Help text">
  <span>Hover me</span>
</Tooltip>

// Custom position & width
<Tooltip 
  text="Long help text..." 
  position="right"
  maxWidth="300px"
  icon 
/>`}</pre>
        </div>
        
        <div className="demo-note">
          <strong>📖 Full Documentation:</strong> See <code>TOOLTIP_USAGE_GUIDE.md</code> for detailed examples
        </div>
      </section>
    </div>
  );
};

export default TooltipDemo;
