/**
 * SEO Utility Functions
 * Helper functions for SEO optimization
 */

import { SEO_KEYWORD_UNIVERSE, createKeywordString } from '../config/seoBrandKit';

const DEFAULT_SITE_URL = 'https://l3v3lmatches.com';

const normalizeSiteUrl = (value) => {
  if (!value || typeof value !== 'string') {
    return DEFAULT_SITE_URL;
  }
  return value.trim().replace(/\/+$/, '');
};

const getSiteUrl = () => {
  if (process.env.REACT_APP_SITE_URL) {
    return normalizeSiteUrl(process.env.REACT_APP_SITE_URL);
  }

  if (typeof window !== 'undefined' && window.RUNTIME_CONFIG?.FRONTEND_URL) {
    return normalizeSiteUrl(window.RUNTIME_CONFIG.FRONTEND_URL);
  }

  return DEFAULT_SITE_URL;
};

const BASE_URL = getSiteUrl();
const DEFAULT_OG_IMAGE = `${BASE_URL}/android-chrome-512x512.png`;
const KEYWORD_GROUPS = {
  brand: SEO_KEYWORD_UNIVERSE.coreBrandKeywords,
  coreServices: SEO_KEYWORD_UNIVERSE.matrimonyAndMatchmakingKeywords,
  diaspora: SEO_KEYWORD_UNIVERSE.indianOriginAndCulturalKeywords,
  usEligibility: SEO_KEYWORD_UNIVERSE.usBasedEligibilityKeywords,
  trust: SEO_KEYWORD_UNIVERSE.safetyTrustVerificationKeywords,
  compatibility: SEO_KEYWORD_UNIVERSE.lifestyleCompatibilityKeywords,
  premium: SEO_KEYWORD_UNIVERSE.premiumPositioningKeywords,
  discovery: SEO_KEYWORD_UNIVERSE.searchAndDiscoveryKeywords,
  community: SEO_KEYWORD_UNIVERSE.eventAndCommunityKeywords,
  marketing: SEO_KEYWORD_UNIVERSE.marketingAndMessagingKeywords,
  longTail: SEO_KEYWORD_UNIVERSE.longTailKeywords,
  registration: ['register matrimony profile', 'free matrimony registration', 'join indian matrimony'],
  algorithm: ['l3v3l algorithm', 'ai compatibility scoring', 'level compatibility score', 'level match engine', 'indian matrimony compatibility'],
  support: ['help center', 'matrimony support', 'matchmaking faq']
};

const createKeywords = (...keywordGroups) => {
  return createKeywordString(...keywordGroups);
};
// eslint-disable-next-line no-unused-vars
const SITE_NAME = '🦋 L3V3L Matches'; // Reserved for future SEO enhancements

/**
 * Generate structured data (JSON-LD) for organization
 * @returns {Object} JSON-LD object
 */
export const getOrganizationSchema = () => {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "L3V3L Matches",
    "url": BASE_URL,
    "logo": `${BASE_URL}/logo512.png`,
    "description": "Modern matchmaking platform connecting people for meaningful relationships",
    "address": {
      "@type": "PostalAddress",
      "addressCountry": "US"
    },
    "contactPoint": {
      "@type": "ContactPoint",
      "contactType": "Customer Service",
      "email": "support@l3v3lmatches.com"
    },
    "sameAs": [
      "https://www.facebook.com/l3v3lmatrimony",
      "https://twitter.com/l3v3lmatrimony",
      "https://www.instagram.com/l3v3lmatrimony"
    ]
  };
};

/**
 * Generate structured data for website
 * @returns {Object} JSON-LD object
 */
export const getWebsiteSchema = () => {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "L3V3L Matches",
    "url": BASE_URL,
    "potentialAction": {
      "@type": "SearchAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": `${BASE_URL}/search?q={search_term_string}`
      },
      "query-input": "required name=search_term_string"
    }
  };
};

/**
 * Generate breadcrumb structured data
 * @param {Array} items - Breadcrumb items [{name, url}]
 * @returns {Object} JSON-LD object
 */
export const getBreadcrumbSchema = (items) => {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items.map((item, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": item.name,
      "item": `${BASE_URL}${item.url}`
    }))
  };
};

/**
 * Generate FAQ structured data
 * @param {Array} faqs - FAQ items [{question, answer}]
 * @returns {Object} JSON-LD object
 */
export const getFAQSchema = (faqs) => {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map(faq => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer
      }
    }))
  };
};

/**
 * Generate article structured data
 * @param {Object} article - Article data
 * @returns {Object} JSON-LD object
 */
export const getArticleSchema = (article) => {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": article.title,
    "description": article.description,
    "image": article.image || DEFAULT_OG_IMAGE,
    "author": {
      "@type": "Person",
      "name": article.author || "L3V3L Matches"
    },
    "publisher": {
      "@type": "Organization",
      "name": "L3V3L Matches",
      "logo": {
        "@type": "ImageObject",
        "url": `${BASE_URL}/logo512.png`
      }
    },
    "datePublished": article.publishedDate,
    "dateModified": article.modifiedDate || article.publishedDate
  };
};

/**
 * Get page-specific SEO metadata
 * @param {string} pageName - Page identifier
 * @returns {Object} SEO metadata
 */
export const getPageSEO = (pageName) => {
  const seoData = {
    home: {
      title: '🦋 L3V3L Matches - Find Your Perfect Life Partner',
      description: 'L3V3L Matches is a premium, verified matrimonial platform for US-based Indian-origin families and professionals seeking meaningful, marriage-ready connections.',
      keywords: createKeywords(
        KEYWORD_GROUPS.brand.slice(0, 8),
        KEYWORD_GROUPS.coreServices.slice(0, 10),
        KEYWORD_GROUPS.diaspora.slice(0, 8),
        KEYWORD_GROUPS.usEligibility.slice(0, 6),
        KEYWORD_GROUPS.trust.slice(0, 6),
        KEYWORD_GROUPS.marketing.slice(0, 6)
      ),
      url: BASE_URL,
      type: 'website'
    },
    login: {
      title: '🦋 Login | L3V3L Matches',
      description: 'Login to L3V3L Matches to access your dashboard, messages, and matches.',
      keywords: 'login, sign in, matrimony login, member login',
      url: `${BASE_URL}/login`,
      type: 'website',
      noindex: true
    },
    register: {
      title: '🦋 Create Your Free Profile | L3V3L Matches',
      description: 'Create your L3V3L Matches profile and connect with verified Indian-origin matches in the USA through premium, trust-first matrimonial discovery.',
      keywords: createKeywords(
        KEYWORD_GROUPS.brand.slice(0, 8),
        KEYWORD_GROUPS.coreServices.slice(0, 8),
        KEYWORD_GROUPS.registration,
        KEYWORD_GROUPS.diaspora.slice(0, 6),
        KEYWORD_GROUPS.usEligibility.slice(0, 5),
        KEYWORD_GROUPS.premium.slice(0, 5)
      ),
      url: `${BASE_URL}/register3`,
      type: 'website'
    },
    'l3v3l-info': {
      title: '🦋 About L3V3L Matchmaking Algorithm | L3V3L Matches',
      description: 'Learn about the L3V3L algorithm - our advanced 3-level matching system that finds you the most compatible life partner.',
      keywords: createKeywords(
        KEYWORD_GROUPS.brand.slice(0, 6),
        KEYWORD_GROUPS.algorithm,
        KEYWORD_GROUPS.compatibility.slice(0, 8),
        KEYWORD_GROUPS.discovery.slice(0, 6)
      ),
      url: `${BASE_URL}/l3v3l-info`,
      type: 'article'
    },
    contact: {
      title: '🦋 Contact Us | L3V3L Matches',
      description: 'Have questions? Contact L3V3L Matches support team. We\'re here to help you find your perfect match',
      keywords: 'contact, support, help, customer service, get in touch',
      url: `${BASE_URL}/support?tab=contact-us`,
      type: 'website',
      noindex: true
    },
    'privacy-policy': {
      title: '🦋 Privacy Policy | L3V3L Matches',
      description: 'Read our privacy policy to understand how L3V3L Matches protects your personal information and data',
      keywords: createKeywords(KEYWORD_GROUPS.brand, ['privacy policy', 'data protection', 'privacy', 'security', 'gdpr']),
      url: `${BASE_URL}/privacy`,
      type: 'article'
    },
    'terms-of-service': {
      title: '🦋 Terms of Service | L3V3L Matches',
      description: 'L3V3L Matches terms of service. Read our user agreement and community guidelines',
      keywords: createKeywords(KEYWORD_GROUPS.brand, ['terms of service', 'user agreement', 'terms and conditions', 'legal']),
      url: `${BASE_URL}/terms`,
      type: 'article'
    },
    'refund-policy': {
      title: '🦋 Refund Policy | L3V3L Matches',
      description: 'Learn about subscription cancellations, trial terms, and refund eligibility for L3V3L Matches.',
      keywords: createKeywords(KEYWORD_GROUPS.brand, ['refund policy', 'cancellations', 'subscription refunds', 'billing policy']),
      url: `${BASE_URL}/refund`,
      type: 'article'
    },
    'community-guidelines': {
      title: '🦋 Community Guidelines | L3V3L Matches',
      description: 'Our community guidelines ensure a safe, respectful environment for all L3V3L Matches members',
      keywords: createKeywords(KEYWORD_GROUPS.brand, ['community guidelines', 'safety', 'respect', 'code of conduct']),
      url: `${BASE_URL}/community-guidelines`,
      type: 'article'
    },
    'cookie-policy': {
      title: '🦋 Cookie Policy | L3V3L Matches',
      description: 'Learn about how L3V3L Matches uses cookies to improve your experience',
      keywords: createKeywords(KEYWORD_GROUPS.brand, ['cookie policy', 'cookies', 'tracking', 'privacy']),
      url: `${BASE_URL}/cookie-policy`,
      type: 'article'
    },
    help: {
      title: '🦋 Help Center | L3V3L Matches',
      description: 'Find answers to common questions and get support for your L3V3L Matches account.',
      keywords: createKeywords(
        KEYWORD_GROUPS.brand.slice(0, 5),
        KEYWORD_GROUPS.support,
        KEYWORD_GROUPS.trust.slice(0, 6),
        KEYWORD_GROUPS.community.slice(0, 4)
      ),
      url: `${BASE_URL}/help`,
      type: 'website'
    },
    // Private pages (noindex)
    dashboard: {
      title: '🦋 Dashboard | L3V3L Matches',
      description: 'Your L3V3L Matches dashboard',
      keywords: '',
      url: `${BASE_URL}/dashboard`,
      noindex: true
    },
    profile: {
      title: '🦋 Profile | L3V3L Matches',
      description: 'View profile',
      keywords: '',
      noindex: true
    },
    messages: {
      title: '🦋 Messages | L3V3L Matches',
      description: 'Your conversations',
      keywords: '',
      noindex: true
    },
    search: {
      title: '🦋 Search | L3V3L Matches',
      description: 'Search for matches',
      keywords: '',
      noindex: true
    },
    invitations: {
      title: '📧 Invitation Manager | 🦋 L3V3L Matches',
      description: 'Manage user invitations and track registration conversions',
      keywords: '',
      noindex: true
    }
  };

  return seoData[pageName] || seoData.home;
};

/**
 * Generate meta keywords from array
 * @param {Array} keywords - Array of keywords
 * @returns {string} Comma-separated keywords
 */
export const generateKeywords = (keywords) => {
  return keywords.join(', ');
};

/**
 * Truncate description to SEO-friendly length
 * @param {string} text - Description text
 * @param {number} maxLength - Maximum length (default 160)
 * @returns {string} Truncated description
 */
export const truncateDescription = (text, maxLength = 160) => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
};

/**
 * Generate canonical URL
 * @param {string} path - Page path
 * @returns {string} Full canonical URL
 */
export const getCanonicalUrl = (path) => {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${BASE_URL}${cleanPath}`;
};

/**
 * Check if page should be indexed
 * @param {string} path - Page path
 * @returns {boolean} True if should be indexed
 */
export const shouldIndex = (path) => {
  const privateRoutes = [
    '/dashboard',
    '/profile',
    '/messages',
    '/favorites',
    '/shortlist',
    '/not-interested',
    '/search',
    '/matches',
    '/preferences',
    '/admin',
    '/pii-management',
    '/edit-profile'
  ];

  return !privateRoutes.some(route => path.startsWith(route));
};

/**
 * Inject structured data script into page
 * @param {Object|Array} schema - Schema.org JSON-LD data
 */
export const injectStructuredData = (schema) => {
  const scriptId = 'structured-data';
  
  // Remove existing script if present
  const existing = document.getElementById(scriptId);
  if (existing) {
    existing.remove();
  }

  // Create new script element
  const script = document.createElement('script');
  script.id = scriptId;
  script.type = 'application/ld+json';
  script.text = JSON.stringify(schema);
  
  // Append to head
  document.head.appendChild(script);
};

const seoUtils = {
  getOrganizationSchema,
  getWebsiteSchema,
  getBreadcrumbSchema,
  getFAQSchema,
  getArticleSchema,
  getPageSEO,
  generateKeywords,
  truncateDescription,
  getCanonicalUrl,
  shouldIndex,
  injectStructuredData
};

export default seoUtils;
