import React from 'react';
import SEO from './SEO';
import { getPageSEO } from '../utils/seo';
import './LegalPages.css';

const RefundPolicy = () => {
  const pageSEO = getPageSEO('refund-policy') || {
    title: 'Refund Policy - L3V3L Matches',
    description: 'Refund and cancellation policy for L3V3L Matches premium subscriptions',
    keywords: 'refund policy, cancellation, subscription, L3V3L Matches',
    url: 'https://l3v3lmatches.com/refund',
    type: 'website'
  };

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
          <h1>Refund & Cancellation Policy</h1>
          <p className="last-updated">Last Updated: January 20, 2026</p>

          <section>
            <h2>1. Overview</h2>
            <p>
              This Refund & Cancellation Policy applies to all paid subscriptions and one-time purchases made on L3V3L Matches ("Service"). We want you to be satisfied with your purchase, and we've designed this policy to be fair and transparent.
            </p>
          </section>

          <section>
            <h2>2. Free Trial</h2>
            <p>
              All paid subscription plans include a <strong>7-day free trial</strong>. During the trial period:
            </p>
            <ul>
              <li>You have full access to premium features</li>
              <li>You will not be charged during the trial period</li>
              <li>You may cancel at any time before the trial ends without being charged</li>
              <li>If you do not cancel before the trial ends, your subscription will automatically begin and you will be charged</li>
            </ul>
          </section>

          <section>
            <h2>3. Subscription Cancellation</h2>
            <p>
              You may cancel your subscription at any time through your account settings or by contacting our support team.
            </p>
            <h3>3.1 How to Cancel</h3>
            <ul>
              <li><strong>Online:</strong> Go to Settings → Subscription → Cancel Subscription</li>
              <li><strong>Email:</strong> Send a cancellation request to support@l3v3lmatches.com</li>
              <li><strong>Stripe Portal:</strong> Manage your subscription through the Stripe customer portal</li>
            </ul>
            <h3>3.2 Effect of Cancellation</h3>
            <ul>
              <li>Your premium access will continue until the end of your current billing period</li>
              <li>You will not be charged for future billing periods</li>
              <li>Your account will revert to a free account after the current period ends</li>
              <li>Your profile and data will be retained unless you request account deletion</li>
            </ul>
          </section>

          <section>
            <h2>4. Refund Policy</h2>
            
            <h3>4.1 Eligibility for Refunds</h3>
            <p>We offer refunds under the following circumstances:</p>
            <ul>
              <li><strong>Within 14 days of first purchase:</strong> Full refund if you're not satisfied with the service</li>
              <li><strong>Technical issues:</strong> If you experience significant technical problems that prevent you from using the service</li>
              <li><strong>Duplicate charges:</strong> If you were accidentally charged multiple times</li>
              <li><strong>Unauthorized charges:</strong> If a charge was made without your authorization</li>
            </ul>

            <h3>4.2 Non-Refundable Situations</h3>
            <p>Refunds are generally NOT provided for:</p>
            <ul>
              <li>Requests made more than 14 days after purchase</li>
              <li>Partial month usage (subscriptions are billed in full)</li>
              <li>Dissatisfaction with match results (we cannot guarantee matches)</li>
              <li>Account suspension or termination due to Terms of Service violations</li>
              <li>Change of mind after the 14-day period</li>
              <li>One-time contributions (donations are non-refundable)</li>
            </ul>

            <h3>4.3 Pro-Rated Refunds</h3>
            <p>
              We do not offer pro-rated refunds for partial months. When you cancel, you retain access until the end of your current billing period.
            </p>
          </section>

          <section>
            <h2>5. How to Request a Refund</h2>
            <p>To request a refund:</p>
            <ol>
              <li>Email us at <strong>support@l3v3lmatches.com</strong> with subject line "Refund Request"</li>
              <li>Include your username and the email associated with your account</li>
              <li>Provide the reason for your refund request</li>
              <li>Include any relevant transaction IDs or receipts</li>
            </ol>
            <p>
              We will review your request and respond within <strong>3-5 business days</strong>.
            </p>
          </section>

          <section>
            <h2>6. Refund Processing</h2>
            <p>
              Approved refunds will be processed within <strong>5-10 business days</strong> and credited back to your original payment method. Please note:
            </p>
            <ul>
              <li>Credit card refunds may take an additional 5-10 days to appear on your statement</li>
              <li>Refunds are processed in the original currency of payment</li>
              <li>Any applicable fees charged by payment processors are non-refundable</li>
            </ul>
          </section>

          <section>
            <h2>7. Subscription Plans</h2>
            <p>Our current subscription plans and pricing:</p>
            <div className="pricing-summary">
              <ul>
                <li><strong>Free Plan:</strong> $0/month - Basic features, profile creation, browsing</li>
                <li><strong>Premium Plan:</strong> $29/month - Unlimited messaging, advanced search, priority support</li>
                <li><strong>Premium Plus Plan:</strong> $49/month - All Premium features plus profile boost, verified badge, dedicated support</li>
              </ul>
            </div>
            <p>
              All paid plans include a 7-day free trial. Prices are in USD and may be subject to change with notice.
            </p>
          </section>

          <section>
            <h2>8. Contributions (Donations)</h2>
            <p>
              Voluntary contributions made to support the platform are <strong>non-refundable</strong>. These are considered donations to help maintain and improve the service.
            </p>
            <p>
              If you have set up a recurring contribution and wish to cancel future payments, you may do so at any time through your account settings or by contacting support.
            </p>
          </section>

          <section>
            <h2>9. Chargebacks</h2>
            <p>
              If you believe a charge is unauthorized, please contact us first before initiating a chargeback with your bank. We are committed to resolving billing issues promptly and fairly.
            </p>
            <p>
              Initiating a chargeback without first contacting us may result in account suspension pending investigation.
            </p>
          </section>

          <section>
            <h2>10. Changes to This Policy</h2>
            <p>
              We reserve the right to modify this Refund & Cancellation Policy at any time. Changes will be posted on this page with an updated "Last Updated" date. Continued use of the Service after changes constitutes acceptance of the new policy.
            </p>
          </section>

          <section>
            <h2>11. Contact Us</h2>
            <p>
              If you have questions about this Refund & Cancellation Policy or need assistance with a refund request, please contact us:
            </p>
            <p className="contact-info">
              <strong>L3V3L Matches Support</strong><br />
              <strong>Email:</strong> support@l3v3lmatches.com<br />
              <strong>Phone:</strong> +1 (800) 555-L3V3L<br />
              <strong>Hours:</strong> Monday - Friday, 9AM - 6PM PST
            </p>
          </section>

          <div className="acceptance-notice">
            <p>
              <strong>BY PURCHASING A SUBSCRIPTION OR MAKING A CONTRIBUTION, YOU ACKNOWLEDGE THAT YOU HAVE READ AND AGREE TO THIS REFUND & CANCELLATION POLICY.</strong>
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default RefundPolicy;
