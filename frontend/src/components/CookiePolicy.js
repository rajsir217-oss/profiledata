import React from 'react';
import SEO from './SEO';
import { getPageSEO } from '../utils/seo';
import './LegalPages.css';

const CookiePolicy = () => {
  const pageSEO = getPageSEO('cookie-policy');
  return (
    <>
      <SEO title={pageSEO.title} description={pageSEO.description} keywords={pageSEO.keywords} url={pageSEO.url} type={pageSEO.type} />
    <div className="legal-page-container">
      <div className="legal-content">
        <h1>Cookie Policy</h1>
        <p className="last-updated">Last Updated: October 11, 2025</p>

        <section>
          <h2>1. What Are Cookies?</h2>
          <p>
            Cookies are small text files that are stored on your device (computer, tablet, or mobile phone) when you visit websites. They help websites remember your preferences and provide a better user experience.
          </p>
        </section>

        <section>
          <h2>2. How We Use Cookies</h2>
          <p>
            We use cookies and similar tracking technologies to:
          </p>
          <ul>
            <li>Keep you logged in to your account</li>
            <li>Remember your preferences and settings</li>
            <li>Analyze how our platform is used</li>
            <li>Improve platform performance and user experience</li>
            <li>Provide personalized content and recommendations</li>
            <li>Measure the effectiveness of our features</li>
          </ul>
        </section>

        <section>
          <h2>3. Types of Cookies We Use</h2>

          <h3>3.1 Essential Cookies (Required)</h3>
          <p>
            These cookies are necessary for the platform to function. You cannot disable these without affecting core functionality.
          </p>
          <ul>
            <li><strong>Authentication Cookies:</strong> Keep you logged in</li>
            <li><strong>Session Cookies:</strong> Maintain your session state</li>
            <li><strong>Security Cookies:</strong> Detect authentication abuse and protect your account</li>
          </ul>

          <h3>3.2 Functional Cookies (Optional)</h3>
          <p>
            These cookies enhance functionality and personalization but are not strictly necessary.
          </p>
          <ul>
            <li><strong>Preference Cookies:</strong> Remember your settings (theme, language, etc.)</li>
            <li><strong>Feature Cookies:</strong> Remember your choices within features</li>
          </ul>

          <h3>3.3 Analytics Cookies (Optional)</h3>
          <p>
            These cookies help us understand how users interact with our platform.
          </p>
          <ul>
            <li><strong>Google Analytics:</strong> Track page views, user flow, and engagement</li>
            <li><strong>Performance Cookies:</strong> Monitor load times and errors</li>
            <li><strong>Heatmap Tools:</strong> Understand how users navigate pages</li>
          </ul>

          <h3>3.4 Marketing Cookies (Optional)</h3>
          <p>
            These cookies track your activity to provide relevant advertisements and promotions.
          </p>
          <ul>
            <li><strong>Advertising Cookies:</strong> Show relevant ads on other platforms</li>
            <li><strong>Retargeting Cookies:</strong> Remind you about our platform when browsing elsewhere</li>
          </ul>
        </section>

        <section>
          <h2>4. Third-Party Cookies</h2>
          <p>
            We may use third-party services that set their own cookies:
          </p>
          <ul>
            <li><strong>Google Analytics:</strong> Website analytics and user behavior tracking</li>
            <li><strong>Social Media Plugins:</strong> Facebook, Twitter, Instagram sharing buttons</li>
            <li><strong>Payment Processors:</strong> If you purchase premium features</li>
            <li><strong>CDN Providers:</strong> Content delivery and performance optimization</li>
          </ul>
          <p>
            These third parties have their own privacy policies. We recommend reviewing them:
          </p>
          <ul>
            <li><a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google Privacy Policy</a></li>
            <li><a href="https://www.facebook.com/privacy/explanation" target="_blank" rel="noopener noreferrer">Facebook Privacy Policy</a></li>
          </ul>
        </section>

        <section>
          <h2>5. Specific Cookies We Use</h2>
          <table className="cookie-table">
            <thead>
              <tr>
                <th>Cookie Name</th>
                <th>Purpose</th>
                <th>Type</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>session_token</td>
                <td>Keeps you logged in</td>
                <td>Essential</td>
                <td>30 days</td>
              </tr>
              <tr>
                <td>user_preferences</td>
                <td>Remembers your settings</td>
                <td>Functional</td>
                <td>1 year</td>
              </tr>
              <tr>
                <td>theme_preference</td>
                <td>Stores your chosen theme</td>
                <td>Functional</td>
                <td>1 year</td>
              </tr>
              <tr>
                <td>_ga</td>
                <td>Google Analytics tracking</td>
                <td>Analytics</td>
                <td>2 years</td>
              </tr>
              <tr>
                <td>_gid</td>
                <td>Google Analytics session</td>
                <td>Analytics</td>
                <td>24 hours</td>
              </tr>
              <tr>
                <td>csrf_token</td>
                <td>Security protection</td>
                <td>Essential</td>
                <td>Session</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section>
          <h2>6. How to Control Cookies</h2>

          <h3>6.1 Browser Settings</h3>
          <p>
            Most web browsers allow you to control cookies through settings. Here's how:
          </p>
          <ul>
            <li><strong>Chrome:</strong> Settings → Privacy and security → Cookies and other site data</li>
            <li><strong>Firefox:</strong> Settings → Privacy & Security → Cookies and Site Data</li>
            <li><strong>Safari:</strong> Preferences → Privacy → Manage Website Data</li>
            <li><strong>Edge:</strong> Settings → Privacy, search, and services → Cookies</li>
          </ul>

          <h3>6.2 Our Cookie Consent Tool</h3>
          <p>
            When you first visit our platform, you can choose which types of cookies to accept. You can change your preferences at any time through:
          </p>
          <ul>
            <li>Account Settings → Privacy Settings → Cookie Preferences</li>
            <li>Footer link: "Cookie Preferences"</li>
          </ul>

          <h3>6.3 Do Not Track Signals</h3>
          <p>
            Some browsers offer a "Do Not Track" (DNT) signal. We respect DNT signals and will not track users who have enabled it.
          </p>
        </section>

        <section>
          <h2>7. Impact of Disabling Cookies</h2>
          <p>
            If you disable cookies, some features may not work properly:
          </p>
          <ul>
            <li>❌ You may not be able to stay logged in</li>
            <li>❌ Your preferences won't be saved</li>
            <li>❌ Some features may be unavailable</li>
            <li>❌ You may see less relevant content</li>
          </ul>
          <p>
            <strong>Essential cookies cannot be disabled</strong> as they are required for basic functionality.
          </p>
        </section>

        <section>
          <h2>8. Other Tracking Technologies</h2>
          <p>
            In addition to cookies, we may use:
          </p>

          <h3>8.1 Local Storage</h3>
          <p>
            HTML5 local storage allows us to store data locally in your browser for improved performance and offline functionality.
          </p>

          <h3>8.2 Web Beacons (Pixels)</h3>
          <p>
            Small transparent images that help us track email opens and understand user engagement.
          </p>

          <h3>8.3 Device Fingerprinting</h3>
          <p>
            Collection of device information (browser type, screen resolution, etc.) to detect fraud and improve security.
          </p>
        </section>

        <section>
          <h2>9. Mobile App Tracking</h2>
          <p>
            If you use our mobile app, we may collect:
          </p>
          <ul>
            <li>Device identifiers (Advertising ID, Device ID)</li>
            <li>App usage data</li>
            <li>Crash reports and diagnostics</li>
            <li>Location data (if you grant permission)</li>
          </ul>
          <p>
            You can control mobile tracking through your device settings:
          </p>
          <ul>
            <li><strong>iOS:</strong> Settings → Privacy → Tracking</li>
            <li><strong>Android:</strong> Settings → Google → Ads → Opt out of Ads Personalization</li>
          </ul>
        </section>

        <section>
          <h2>10. Updates to This Cookie Policy</h2>
          <p>
            We may update this Cookie Policy from time to time. We will notify you of significant changes by:
          </p>
          <ul>
            <li>Updating the "Last Updated" date</li>
            <li>Displaying a notice on the platform</li>
            <li>Sending an email notification (for material changes)</li>
          </ul>
        </section>

        <section>
          <h2>11. Contact Us</h2>
          <p>
            If you have questions about our use of cookies or this Cookie Policy, please contact:
          </p>
          <p className="contact-info">
            <strong>Privacy Team</strong><br />
            <strong>Email:</strong> privacy@matrimonialapp.com<br />
            <strong>Address:</strong> [Your Business Address]
          </p>
        </section>

        <div className="acceptance-notice">
          <p>
            <strong>By continuing to use our platform, you consent to our use of cookies as described in this Cookie Policy.</strong>
          </p>
          <p>
            You can manage your cookie preferences at any time through your account settings.
          </p>
        </div>
      </div>
    </div>
  );
};

export default CookiePolicy;
