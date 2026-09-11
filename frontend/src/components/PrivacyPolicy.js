import React from 'react';
import SEO from './SEO';
import { getPageSEO } from '../utils/seo';
import './LegalPages.css';

const PrivacyPolicy = () => {
  const pageSEO = getPageSEO('privacy-policy');

  return (
    <>
      <SEO
        title={pageSEO.title}
        description={pageSEO.description}
        keywords={pageSEO.keywords}
        url={pageSEO.url}
        type={pageSEO.type}
      />
    <div className="legal-page-container">
      <div className="legal-content">
        <h1>Privacy Policy</h1>
        <p className="last-updated">Effective Date: September 11, 2026</p>

        <section>
          <p className="contact-info">
            <strong>L3V3L Matches</strong><br />
            NIMBLE DATA SOLUTIONS<br />
            12811 EVANSTON WAY<br />
            RANCHO CORDOVA, CA 95742<br />
            United States<br />
            Website: <a href="https://l3v3lmatches.com/" target="_blank" rel="noopener noreferrer">https://l3v3lmatches.com/</a><br />
            Email: <a href="mailto:raj@nimbledata.us">raj@nimbledata.us</a>
          </p>
        </section>

        <section>
          <h2>1. Introduction</h2>
          <p>
            L3V3L Matches, operated by <strong>NIMBLE DATA SOLUTIONS</strong> ("L3V3L Matches," "we," "us," or "our"), provides online dating and matchmaking services.
          </p>
          <p>
            This Privacy Policy explains what personal information we collect, how we use that information, and the choices available to members regarding their information.
          </p>
          <p>
            By using L3V3L Matches, you acknowledge the practices described in this Privacy Policy.
          </p>
        </section>

        <section>
          <h2>2. Information We Collect</h2>
          <p>
            L3V3L Matches collects the personal information necessary to provide its dating and matchmaking services.
          </p>
          <p>The personal information collected from members may include:</p>
          <ul>
            <li>Name</li>
            <li>Telephone number</li>
            <li>Email address</li>
          </ul>
          <p>
            L3V3L Matches <strong>does not require or collect a member's physical or mailing address</strong> as part of the matchmaking membership service.
          </p>
          <p>
            We collect information that members provide when creating or maintaining their account and when communicating with us in connection with the service.
          </p>
        </section>

        <section>
          <h2>3. Technical Information</h2>
          <p>
            When you use the L3V3L Matches website, our systems may automatically record certain technical information associated with your use of the service.
          </p>
          <p>This may include:</p>
          <ul>
            <li>IP address</li>
            <li>Browser information</li>
            <li>Operating-system information</li>
            <li>Technical information necessary to operate, maintain, secure, and troubleshoot the website</li>
          </ul>
          <p>
            This technical information may be associated with activity on the service when necessary for legitimate operational, security, or technical purposes.
          </p>
        </section>

        <section>
          <h2>4. Information We Do Not Routinely Collect</h2>
          <p>
            L3V3L Matches does not require access to or routinely collect personal information from a member's:
          </p>
          <ul>
            <li>Phone book or contacts</li>
            <li>Calendar</li>
            <li>Text messages or private messages stored on the member's device</li>
            <li>Facebook account or other social-media accounts</li>
            <li>Physical or mailing address</li>
            <li>Precise real-time device location</li>
          </ul>
          <p>
            L3V3L Matches does not require access to these types of information in order to provide its matchmaking service.
          </p>
        </section>

        <section>
          <h2>5. How We Use Information</h2>
          <p>
            We use member information for purposes associated with operating and providing the L3V3L Matches service, including:
          </p>
          <ul>
            <li>Creating and maintaining member accounts</li>
            <li>Providing access to member profiles and matchmaking services</li>
            <li>Communicating with members</li>
            <li>Responding to member questions and requests</li>
            <li>Performing administrative and member-verification activities</li>
            <li>Operating, maintaining, and improving the website</li>
            <li>Protecting the security and integrity of the service</li>
            <li>Investigating reported issues relating to accounts or profiles</li>
            <li>Complying with applicable legal or regulatory requirements</li>
          </ul>
          <p>
            We do not collect personal information for purposes unrelated to providing, administering, securing, or supporting the L3V3L Matches service.
          </p>
        </section>

        <section>
          <h2>6. Member and Profile Verification</h2>
          <p>
            L3V3L Matches uses a <strong>member-reference and administrative verification process</strong>.
          </p>
          <p>
            Profiles are subject to member-reference and administrative verification. As part of this process, our team may contact members by telephone to assist with verification.
          </p>
          <p>
            Where applicable, we may review publicly available professional information, such as a LinkedIn profile, to assist in verifying the identity or authenticity of a member.
          </p>
          <p>
            Profiles are reviewed by administrators before activation.
          </p>
          <p>
            These procedures are intended to help maintain the quality and authenticity of profiles available through the service.
          </p>
        </section>

        <section>
          <h2>7. Profile Images and Content</h2>
          <p>
            Members may upload photographs to their profile, subject to the limits and requirements established by L3V3L Matches.
          </p>
          <p>
            A member may upload up to five profile images.
          </p>
          <p>
            L3V3L Matches prohibits sexually explicit, pornographic, or otherwise inappropriate images.
          </p>
          <p>
            Profile images are subject to administrative review for appropriateness, and profiles are reviewed and approved by administrators before activation.
          </p>
          <p>
            L3V3L Matches does not provide or sell erotic or pornographic image downloads.
          </p>
        </section>

        <section>
          <h2>8. Adult Service</h2>
          <p>
            L3V3L Matches is intended for individuals <strong>18 years of age or older</strong>.
          </p>
          <p>
            Membership and participation in the matchmaking service are restricted to adults.
          </p>
          <p>
            We do not knowingly permit individuals under 18 years of age to maintain an active profile or use the matchmaking service.
          </p>
          <p>
            L3V3L Matches does not provide services intended for children.
          </p>
        </section>

        <section>
          <h2>9. Dating and Matchmaking Services</h2>
          <p>
            L3V3L Matches is strictly a dating and matchmaking service.
          </p>
          <p>
            Members purchase memberships to obtain access to profiles and matchmaking-related services.
          </p>
          <p>
            In some cases, parents or family members may assist their adult children in the matchmaking process. Such involvement does not change the nature of the service, which is intended for adult members.
          </p>
          <p>
            L3V3L Matches does not operate as an escort service, adult-content service, or sexual-services marketplace.
          </p>
        </section>

        <section>
          <h2>10. No Sexual Services</h2>
          <p>
            L3V3L Matches does not facilitate, arrange, advertise, or accept payment for the procurement of sex or sexual services.
          </p>
          <p>
            Payments made to L3V3L Matches are for legitimate dating and matchmaking membership services and access to the service.
          </p>
          <p>
            Members are not permitted to use L3V3L Matches to arrange or facilitate sexual services.
          </p>
        </section>

        <section>
          <h2>11. Account Access and Deletion</h2>
          <p>
            Members can manage their account information through the <strong>User Settings</strong> area of the L3V3L Matches service.
          </p>
          <p>
            L3V3L Matches provides a deletion function within User Settings that allows a member to delete their account and associated personal information.
          </p>
          <p>
            When a member uses the account-deletion function, the associated personal information is deleted from the L3V3L Matches system.
          </p>
          <p>
            L3V3L Matches does not maintain another separate copy of the deleted personal information for continued use of the service.
          </p>
          <p>
            Certain limited information may nevertheless be retained where retention is required for legitimate legal, security, fraud-prevention, accounting, or regulatory purposes, if applicable.
          </p>
        </section>

        <section>
          <h2>12. Communications</h2>
          <p>
            We may use a member's telephone number and email address to communicate with the member regarding their account, membership, matchmaking services, customer support, administrative matters, or other service-related communications.
          </p>
          <p>
            Members should ensure that their contact information remains accurate so that important service-related communications can be received.
          </p>
        </section>

        <section>
          <h2>13. Information Security</h2>
          <p>
            L3V3L Matches takes reasonable administrative and technical measures designed to protect information maintained in connection with the service.
          </p>
          <p>
            These measures are intended to protect information against unauthorized access, misuse, alteration, or loss.
          </p>
          <p>
            However, no internet-based service or electronic storage system can be guaranteed to be completely secure.
          </p>
        </section>

        <section>
          <h2>14. Third-Party Services</h2>
          <p>
            L3V3L Matches may rely on third-party service providers as necessary to operate the website, process payments, provide hosting or infrastructure, communicate with members, or provide other operational services.
          </p>
          <p>
            Where third-party providers process information on our behalf, their access is limited to the information reasonably necessary to perform the applicable service or function.
          </p>
          <p>
            Members should also review the privacy practices of third-party services they may use in connection with L3V3L Matches.
          </p>
        </section>

        <section>
          <h2>15. Payment Information</h2>
          <p>
            Payments for L3V3L Matches memberships may be processed through third-party payment service providers.
          </p>
          <p>
            L3V3L Matches does not need to collect or maintain a member's physical mailing address as part of the matchmaking membership service.
          </p>
          <p>
            Payment information may be handled directly by the applicable payment processor in accordance with that provider's privacy and security practices.
          </p>
        </section>

        <section>
          <h2>16. Cookies and Similar Technologies</h2>
          <p>
            L3V3L Matches may use cookies, session technologies, or similar technical mechanisms as necessary for the operation, security, functionality, and improvement of the website.
          </p>
          <p>
            These technologies may be used to maintain sessions, support account functionality, understand technical usage, or improve the service.
          </p>
        </section>

        <section>
          <h2>17. Member Responsibilities</h2>
          <p>
            Members are responsible for providing accurate information when creating and maintaining their account.
          </p>
          <p>
            Members should not provide false, misleading, fraudulent, sexually explicit, or otherwise prohibited information or content.
          </p>
          <p>
            Members should also protect the confidentiality of their account credentials and promptly notify L3V3L Matches if they believe their account has been accessed without authorization.
          </p>
        </section>

        <section>
          <h2>18. Changes to This Privacy Policy</h2>
          <p>
            L3V3L Matches may update this Privacy Policy from time to time to reflect changes to the service, applicable requirements, or our information practices.
          </p>
          <p>
            When the policy is updated, the revised version will be made available through the L3V3L Matches website.
          </p>
          <p>
            The "Effective Date" at the beginning of this Privacy Policy indicates when the current version became effective.
          </p>
        </section>

        <section>
          <h2>19. Contact Us</h2>
          <p>
            If you have questions about this Privacy Policy, your personal information, or your account, you may contact us using the information below.
          </p>
          <p className="contact-info">
            <strong>NIMBLE DATA SOLUTIONS</strong><br />
            <strong>L3V3L Matches</strong><br />
            12811 EVANSTON WAY<br />
            RANCHO CORDOVA, CA 95742<br />
            United States<br />
            Email: <a href="mailto:raj@nimbledata.us">raj@nimbledata.us</a><br />
            Phone: <a href="tel:203-216-5623">203-216-5623</a><br />
            Website: <a href="https://l3v3lmatches.com/" target="_blank" rel="noopener noreferrer">https://l3v3lmatches.com/</a>
          </p>
        </section>

        <section>
          <h2>20. Your Privacy Choices</h2>
          <p>
            Members may review and manage their account information through the L3V3L Matches <strong>User Settings</strong> area.
          </p>
          <p>
            Members may use the account-deletion function provided in User Settings to delete their account and associated personal information from the system.
          </p>
          <p>
            For questions or requests concerning personal information that cannot be handled through User Settings, members may contact us using the contact information provided above.
          </p>
        </section>

        <section>
          <h2>21. Consent</h2>
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
    </>
  );
};

export default PrivacyPolicy;
