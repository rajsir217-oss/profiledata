import React from 'react';
import './LegalPages.css';

const PrivacyPolicy = () => {
  return (
    <div className="legal-page-container">
      <div className="legal-content">
        <h1>Privacy Policy</h1>
        <p className="last-updated">Last Updated: October 11, 2025</p>

        <section>
          <h2>1. Introduction</h2>
          <p>
            This Privacy Policy explains how we collect, use, share, and protect your personal information when you use our matrimonial/dating platform. We are committed to protecting your privacy and complying with applicable data protection laws, including GDPR and CCPA.
          </p>
        </section>

        <section>
          <h2>2. Information We Collect</h2>
          
          <h3>2.1 Information You Provide</h3>
          <ul>
            <li><strong>Registration Data:</strong> Username, password, name, email, phone number, date of birth</li>
            <li><strong>Profile Information:</strong> Photos, gender, height, location, education, occupation, income, religion, caste</li>
            <li><strong>Preferences:</strong> Partner preferences, interests, lifestyle choices (smoking, drinking, etc.)</li>
            <li><strong>Additional Details:</strong> Family background, bio, hobbies, languages spoken</li>
            <li><strong>Communications:</strong> Messages sent through our platform</li>
          </ul>

          <h3>2.2 Automatically Collected Information</h3>
          <ul>
            <li><strong>Device Information:</strong> IP address, browser type, operating system</li>
            <li><strong>Usage Data:</strong> Pages visited, features used, time spent on platform</li>
            <li><strong>Cookies:</strong> Session identifiers, preferences, analytics data (see Cookie Policy)</li>
            <li><strong>Location Data:</strong> Approximate location based on IP address</li>
          </ul>
        </section>

        <section>
          <h2>3. How We Use Your Information</h2>
          <p>We use your personal information for the following purposes:</p>
          <ul>
            <li><strong>Matchmaking:</strong> To suggest potential matches based on your preferences</li>
            <li><strong>Account Management:</strong> To create and maintain your account</li>
            <li><strong>Communication:</strong> To facilitate messaging between users</li>
            <li><strong>Service Improvement:</strong> To analyze usage and improve our platform</li>
            <li><strong>Safety & Security:</strong> To detect fraud, abuse, and violations of our Terms</li>
            <li><strong>Legal Compliance:</strong> To comply with legal obligations and respond to legal requests</li>
            <li><strong>Marketing:</strong> To send updates and promotions (only if you opted in)</li>
          </ul>
        </section>

        <section>
          <h2>4. Legal Basis for Processing (GDPR)</h2>
          <p>We process your personal data based on:</p>
          <ul>
            <li><strong>Consent:</strong> You have given explicit consent for specific processing purposes</li>
            <li><strong>Contract Performance:</strong> Processing is necessary to provide our matchmaking services</li>
            <li><strong>Legitimate Interests:</strong> For security, fraud prevention, and service improvement</li>
            <li><strong>Legal Obligations:</strong> To comply with laws and regulations</li>
          </ul>
        </section>

        <section>
          <h2>5. Information Sharing & Disclosure</h2>
          
          <h3>5.1 With Other Users</h3>
          <p>
            Profile information you provide is visible to other users for matchmaking purposes. You control what information you share in your profile.
          </p>

          <h3>5.2 With Third Parties</h3>
          <p>We may share your information with:</p>
          <ul>
            <li><strong>Service Providers:</strong> Cloud hosting, email services, analytics providers (under strict confidentiality agreements)</li>
            <li><strong>Legal Authorities:</strong> When required by law or to protect rights and safety</li>
            <li><strong>Business Transfers:</strong> In the event of a merger, acquisition, or sale of assets</li>
          </ul>

          <h3>5.3 We DO NOT Sell Your Data</h3>
          <p className="highlight">
            <strong>We do not sell, rent, or trade your personal information to third parties for marketing purposes.</strong>
          </p>
        </section>

        <section>
          <h2>6. Data Security</h2>
          <p>
            We implement appropriate technical and organizational measures to protect your personal information:
          </p>
          <ul>
            <li>Encryption of data in transit (HTTPS/SSL)</li>
            <li>Secure password hashing</li>
            <li>Regular security audits and updates</li>
            <li>Access controls and authentication</li>
            <li>Monitoring for suspicious activity</li>
          </ul>
          <p>
            <strong>Note:</strong> While we take security seriously, no system is 100% secure. You are responsible for keeping your password confidential.
          </p>
        </section>

        <section>
          <h2>7. Your Privacy Rights</h2>
          
          <h3>7.1 All Users</h3>
          <ul>
            <li><strong>Access:</strong> Request a copy of your personal data</li>
            <li><strong>Correction:</strong> Update or correct inaccurate information</li>
            <li><strong>Deletion:</strong> Request deletion of your account and data</li>
            <li><strong>Opt-Out:</strong> Unsubscribe from marketing communications</li>
          </ul>

          <h3>7.2 GDPR Rights (EU Users)</h3>
          <ul>
            <li><strong>Right to Data Portability:</strong> Receive your data in a machine-readable format</li>
            <li><strong>Right to Restrict Processing:</strong> Limit how we use your data</li>
            <li><strong>Right to Object:</strong> Object to processing based on legitimate interests</li>
            <li><strong>Right to Withdraw Consent:</strong> Withdraw consent at any time</li>
            <li><strong>Right to Lodge a Complaint:</strong> File a complaint with your data protection authority</li>
          </ul>

          <h3>7.3 CCPA Rights (California Users)</h3>
          <ul>
            <li><strong>Right to Know:</strong> Know what personal information we collect and how it's used</li>
            <li><strong>Right to Delete:</strong> Request deletion of your personal information</li>
            <li><strong>Right to Opt-Out:</strong> Opt-out of sale of personal information (we don't sell data)</li>
            <li><strong>Right to Non-Discrimination:</strong> Equal service regardless of privacy rights exercise</li>
          </ul>

          <h3>7.4 How to Exercise Your Rights</h3>
          <p>
            To exercise any of these rights, contact us at <strong>privacy@matrimonialapp.com</strong> or use the settings in your account dashboard.
          </p>
        </section>

        <section>
          <h2>8. Data Retention</h2>
          <p>
            We retain your personal information for as long as:
          </p>
          <ul>
            <li>Your account is active</li>
            <li>Necessary to provide our services</li>
            <li>Required by law (e.g., tax records, legal disputes)</li>
            <li>Necessary for legitimate business purposes (e.g., fraud prevention)</li>
          </ul>
          <p>
            When you delete your account, we will delete or anonymize your personal data within 30 days, except where retention is required by law.
          </p>
        </section>

        <section>
          <h2>9. International Data Transfers</h2>
          <p>
            Your information may be transferred to and processed in countries other than your country of residence. We ensure appropriate safeguards are in place, such as:
          </p>
          <ul>
            <li>Standard Contractual Clauses (SCCs)</li>
            <li>Data Processing Agreements with service providers</li>
            <li>Compliance with GDPR and other data protection laws</li>
          </ul>
        </section>

        <section>
          <h2>10. Children's Privacy</h2>
          <p>
            <strong>Our Service is NOT intended for individuals under 18 years of age.</strong> We do not knowingly collect personal information from children. If we discover that a child has provided us with personal information, we will delete it immediately.
          </p>
          <p>
            If you believe a child has registered, please contact us immediately at <strong>privacy@matrimonialapp.com</strong>.
          </p>
        </section>

        <section>
          <h2>11. Cookies & Tracking Technologies</h2>
          <p>
            We use cookies and similar technologies to enhance your experience. For detailed information, please see our <a href="/cookie-policy">Cookie Policy</a>.
          </p>
          <p>
            You can control cookies through your browser settings. Note that disabling cookies may affect functionality.
          </p>
        </section>

        <section>
          <h2>12. Third-Party Links</h2>
          <p>
            Our platform may contain links to third-party websites or services. We are not responsible for the privacy practices of these third parties. Please review their privacy policies before providing any information.
          </p>
        </section>

        <section>
          <h2>13. Data Breach Notifications</h2>
          <p>
            In the event of a data breach that affects your personal information, we will:
          </p>
          <ul>
            <li>Notify affected users within 72 hours (as required by GDPR)</li>
            <li>Provide details about the breach and steps we're taking</li>
            <li>Offer guidance on protecting your account</li>
            <li>Report to relevant authorities as required by law</li>
          </ul>
        </section>

        <section>
          <h2>14. Changes to This Privacy Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify you of material changes by:
          </p>
          <ul>
            <li>Email notification to registered users</li>
            <li>Prominent notice on the platform</li>
            <li>Updating the "Last Updated" date at the top</li>
          </ul>
          <p>
            Continued use of the Service after changes constitutes acceptance of the updated Privacy Policy.
          </p>
        </section>

        <section>
          <h2>15. Contact Us</h2>
          <p>
            If you have questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact:
          </p>
          <p className="contact-info">
            <strong>Privacy Team</strong><br />
            <strong>Email:</strong> privacy@matrimonialapp.com<br />
            <strong>Address:</strong> [Your Business Address]<br />
            <strong>Phone:</strong> [Your Contact Number]
          </p>
          <p>
            <strong>Data Protection Officer (DPO):</strong> dpo@matrimonialapp.com (if required by GDPR)
          </p>
        </section>

        <section>
          <h2>16. Consent</h2>
          <div className="acceptance-notice">
            <p>
              <strong>BY USING OUR SERVICE, YOU CONSENT TO THE COLLECTION, USE, AND SHARING OF YOUR INFORMATION AS DESCRIBED IN THIS PRIVACY POLICY.</strong>
            </p>
            <p>
              If you do not agree with this Privacy Policy, please do not use our Service.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
