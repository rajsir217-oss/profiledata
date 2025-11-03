import React from 'react';
import SEO from './SEO';
import { getPageSEO } from '../utils/seo';
import './LegalPages.css';

const CommunityGuidelines = () => {
  const pageSEO = getPageSEO('community-guidelines');
  return (
    <>
      <SEO title={pageSEO.title} description={pageSEO.description} keywords={pageSEO.keywords} url={pageSEO.url} type={pageSEO.type} />
    <div className="legal-page-container">
      <div className="legal-content">
        <h1>Community Guidelines</h1>
        <p className="last-updated">Last Updated: October 11, 2025</p>

        <section>
          <h2>Welcome to Our Community</h2>
          <p>
            Our matrimonial platform is built on trust, respect, and genuine connections. These Community Guidelines help ensure a safe, positive experience for everyone.
          </p>
          <p>
            <strong>By using our Service, you agree to follow these guidelines. Violations may result in account suspension or termination.</strong>
          </p>
        </section>

        <section>
          <h2>1. Be Authentic & Honest</h2>
          <ul>
            <li>✅ Use real, recent photos of yourself</li>
            <li>✅ Provide accurate information in your profile</li>
            <li>✅ Be honest about your relationship status, intentions, and background</li>
            <li>❌ Do NOT create fake profiles or impersonate others</li>
            <li>❌ Do NOT use photos of celebrities, models, or other people</li>
            <li>❌ Do NOT misrepresent your age, marital status, or other key details</li>
          </ul>
        </section>

        <section>
          <h2>2. Respect Other Users</h2>
          <ul>
            <li>✅ Treat all users with kindness and respect</li>
            <li>✅ Accept rejection gracefully</li>
            <li>✅ Respect boundaries and preferences</li>
            <li>❌ Do NOT harass, stalk, or intimidate other users</li>
            <li>❌ Do NOT send unsolicited explicit messages or images</li>
            <li>❌ Do NOT pressure users to share personal information or meet in person</li>
            <li>❌ Do NOT discriminate based on race, religion, caste, or other protected characteristics (beyond personal preferences)</li>
          </ul>
        </section>

        <section>
          <h2>3. Keep It Appropriate</h2>
          <ul>
            <li>✅ Keep conversations respectful and appropriate</li>
            <li>✅ Use profile photos that are suitable for all audiences</li>
            <li>❌ Do NOT share sexually explicit content</li>
            <li>❌ Do NOT use offensive language, slurs, or hate speech</li>
            <li>❌ Do NOT upload nudity or graphic content</li>
            <li>❌ Do NOT engage in sexually explicit conversations without mutual consent</li>
          </ul>
        </section>

        <section>
          <h2>4. Safety First</h2>
          <h3>Protect Your Personal Information</h3>
          <ul>
            <li>✅ Be cautious about sharing phone numbers, addresses, or financial information</li>
            <li>✅ Meet in public places for first meetings</li>
            <li>✅ Inform friends/family about your plans</li>
            <li>✅ Trust your instincts - if something feels wrong, it probably is</li>
          </ul>

          <h3>Red Flags to Watch For</h3>
          <ul>
            <li>🚩 Requests for money or financial assistance</li>
            <li>🚩 Profiles with only one photo or no photos</li>
            <li>🚩 Users who avoid video calls or in-person meetings</li>
            <li>🚩 Inconsistent stories or information</li>
            <li>🚩 Pressure to move conversations off-platform immediately</li>
            <li>🚩 Too-good-to-be-true profiles or claims</li>
          </ul>
        </section>

        <section>
          <h2>5. No Commercial Activity</h2>
          <ul>
            <li>❌ Do NOT use the platform for commercial solicitation</li>
            <li>❌ Do NOT promote businesses, products, or services</li>
            <li>❌ Do NOT recruit for jobs, MLM schemes, or investment opportunities</li>
            <li>❌ Do NOT send spam or bulk messages</li>
          </ul>
        </section>

        <section>
          <h2>6. Protect Privacy</h2>
          <ul>
            <li>✅ Respect the privacy of other users</li>
            <li>❌ Do NOT share screenshots of conversations without permission</li>
            <li>❌ Do NOT share another user's personal information</li>
            <li>❌ Do NOT use information obtained from the platform for purposes outside the platform</li>
          </ul>
        </section>

        <section>
          <h2>7. No Illegal Activity</h2>
          <ul>
            <li>❌ Do NOT engage in any illegal activities</li>
            <li>❌ Do NOT promote or facilitate illegal activities</li>
            <li>❌ Do NOT share illegal content</li>
            <li>❌ Do NOT use the platform for fraud, scams, or deception</li>
          </ul>
        </section>

        <section>
          <h2>8. Report Violations</h2>
          <p>
            Help us maintain a safe community by reporting violations:
          </p>
          <ul>
            <li>Use the "Report User" button on profiles or in messages</li>
            <li>Block users who violate guidelines or make you uncomfortable</li>
            <li>Contact our Trust & Safety team: <strong>safety@matrimonialapp.com</strong></li>
          </ul>
          <p>
            <strong>We take reports seriously and investigate all claims.</strong> False reports may result in account action.
          </p>
        </section>

        <section>
          <h2>9. Account Actions for Violations</h2>
          <p>Depending on the severity of the violation, we may take the following actions:</p>
          <ul>
            <li><strong>Warning:</strong> First-time minor violations</li>
            <li><strong>Temporary Suspension:</strong> Repeated minor violations or moderate violations</li>
            <li><strong>Permanent Ban:</strong> Serious violations (harassment, fraud, illegal activity)</li>
            <li><strong>Legal Action:</strong> Criminal activity will be reported to authorities</li>
          </ul>
        </section>

        <section>
          <h2>10. Content Moderation</h2>
          <p>
            We reserve the right to:
          </p>
          <ul>
            <li>Review and moderate user content</li>
            <li>Remove content that violates guidelines</li>
            <li>Suspend or terminate accounts without notice</li>
            <li>Cooperate with law enforcement investigations</li>
          </ul>
        </section>

        <section>
          <h2>11. Platform Integrity</h2>
          <ul>
            <li>❌ Do NOT use automated systems, bots, or scripts</li>
            <li>❌ Do NOT attempt to scrape or harvest data</li>
            <li>❌ Do NOT circumvent security features or access controls</li>
            <li>❌ Do NOT create multiple accounts</li>
          </ul>
        </section>

        <section>
          <h2>12. Meeting Safety Tips</h2>
          <p>
            <strong>Before Meeting in Person:</strong>
          </p>
          <ul>
            <li>✅ Have several conversations on the platform first</li>
            <li>✅ Do a video call to verify identity</li>
            <li>✅ Research the person online (social media, etc.)</li>
            <li>✅ Trust your instincts - don't meet if something feels off</li>
          </ul>

          <p>
            <strong>During the First Meeting:</strong>
          </p>
          <ul>
            <li>✅ Meet in a public, well-lit place</li>
            <li>✅ Tell a friend/family member where you're going</li>
            <li>✅ Arrange your own transportation</li>
            <li>✅ Stay sober and in control</li>
            <li>✅ Keep your phone charged and accessible</li>
            <li>❌ Do NOT go to private locations</li>
            <li>❌ Do NOT share your home address</li>
          </ul>
        </section>

        <section>
          <h2>13. Financial Safety</h2>
          <div className="disclaimer-box">
            <p>
              <strong>⚠️ NEVER SEND MONEY TO SOMEONE YOU MEET ONLINE</strong>
            </p>
            <p>
              Common scams include:
            </p>
            <ul>
              <li>Emergency financial requests</li>
              <li>Investment "opportunities"</li>
              <li>Requests to receive/transfer money</li>
              <li>Cryptocurrency schemes</li>
              <li>Gift card requests</li>
            </ul>
            <p>
              <strong>If someone asks for money, report them immediately!</strong>
            </p>
          </div>
        </section>

        <section>
          <h2>14. Respectful Communication</h2>
          <p>
            Good communication practices:
          </p>
          <ul>
            <li>✅ Respond politely, even if not interested</li>
            <li>✅ Be clear about your intentions and expectations</li>
            <li>✅ Accept "no" gracefully</li>
            <li>✅ Be patient - people have busy lives</li>
            <li>❌ Do NOT send multiple messages if someone doesn't respond</li>
            <li>❌ Do NOT become aggressive or hostile when rejected</li>
          </ul>
        </section>

        <section>
          <h2>15. Photo Guidelines</h2>
          <p>
            <strong>Photos MUST:</strong>
          </p>
          <ul>
            <li>✅ Clearly show your face</li>
            <li>✅ Be recent (within the last year)</li>
            <li>✅ Be appropriate for all audiences</li>
            <li>✅ Be of you (not friends, family, or strangers)</li>
          </ul>

          <p>
            <strong>Photos CANNOT:</strong>
          </p>
          <ul>
            <li>❌ Contain nudity or sexually explicit content</li>
            <li>❌ Be of celebrities, models, or stock photos</li>
            <li>❌ Include minors (children)</li>
            <li>❌ Promote violence, drugs, or illegal activities</li>
            <li>❌ Contain offensive symbols or gestures</li>
          </ul>
        </section>

        <section>
          <h2>16. Consent & Boundaries</h2>
          <p>
            <strong>Respect is non-negotiable:</strong>
          </p>
          <ul>
            <li>Always ask before sending photos (even non-explicit ones)</li>
            <li>Respect when someone says they're not interested</li>
            <li>Don't pressure anyone into anything they're uncomfortable with</li>
            <li>Understand that consent can be withdrawn at any time</li>
          </ul>
        </section>

        <section>
          <h2>17. Updates to Guidelines</h2>
          <p>
            We may update these Community Guidelines from time to time. We will notify users of significant changes. Continued use of the platform constitutes acceptance of updated guidelines.
          </p>
        </section>

        <section>
          <h2>18. Questions or Concerns?</h2>
          <p>
            If you have questions about these guidelines or need to report a violation:
          </p>
          <p className="contact-info">
            <strong>Trust & Safety Team</strong><br />
            <strong>Email:</strong> safety@matrimonialapp.com<br />
            <strong>Report Feature:</strong> Available on all user profiles and messages
          </p>
        </section>

        <div className="acceptance-notice">
          <p>
            <strong>Thank you for being part of our community!</strong>
          </p>
          <p>
            Together, we can create a safe, respectful environment where genuine connections can flourish.
          </p>
        </div>
      </div>
    </div>
    </>
  );
};

export default CommunityGuidelines;
