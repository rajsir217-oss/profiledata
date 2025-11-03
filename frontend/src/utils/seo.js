/**
 * SEO Utility Functions
 * Helper functions for SEO optimization
 */

// Base URL - update for production
const BASE_URL = process.env.REACT_APP_SITE_URL || 'https://l3v3l.matrimony.com';

/**
 * Generate structured data (JSON-LD) for organization
 * @returns {Object} JSON-LD object
 */
export const getOrganizationSchema = () => {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "L3V3L Matrimony",
    "url": BASE_URL,
    "logo": `${BASE_URL}/logo.png`,
    "description": "Modern matchmaking platform connecting people for meaningful relationships",
    "address": {
      "@type": "PostalAddress",
      "addressCountry": "US"
    },
    "contactPoint": {
      "@type": "ContactPoint",
      "contactType": "Customer Service",
      "email": "support@l3v3l.matrimony.com"
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
    "name": "L3V3L Matrimony",
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
    "image": article.image || `${BASE_URL}/og-image.jpg`,
    "author": {
      "@type": "Person",
      "name": article.author || "L3V3L Matrimony"
    },
    "publisher": {
      "@type": "Organization",
      "name": "L3V3L Matrimony",
      "logo": {
        "@type": "ImageObject",
        "url": `${BASE_URL}/logo.png`
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
      title: 'L3V3L Matrimony - Find Your Perfect Life Partner',
      description: 'Join L3V3L Matrimony, the modern matchmaking platform. Connect with thousands of verified profiles for meaningful relationships and marriage.',
      keywords: 'matrimony, matchmaking, marriage, wedding, life partner, shaadi, vivah, relationship, dating, love',
      url: BASE_URL,
      type: 'website'
    },
    login: {
      title: 'Login to Your Account',
      description: 'Login to L3V3L Matrimony to access your dashboard, messages, and matches.',
      keywords: 'login, sign in, matrimony login, member login',
      url: `${BASE_URL}/login`,
      type: 'website',
      noindex: true
    },
    register: {
      title: 'Create Your Free Profile',
      description: 'Join L3V3L Matrimony for free. Create your profile in minutes and start connecting with verified matches today.',
      keywords: 'register, sign up, create profile, join matrimony, free registration',
      url: `${BASE_URL}/register`,
      type: 'website'
    },
    'l3v3l-info': {
      title: 'About L3V3L Matchmaking Algorithm',
      description: 'Learn about the L3V3L algorithm - our advanced 3-level matching system that finds you the most compatible life partner.',
      keywords: 'L3V3L algorithm, matchmaking algorithm, compatibility matching, AI matching',
      url: `${BASE_URL}/l3v3l-info`,
      type: 'article'
    },
    contact: {
      title: 'Contact Us - Get in Touch',
      description: 'Have questions? Contact L3V3L Matrimony support team. We\'re here to help you find your perfect match.',
      keywords: 'contact, support, help, customer service, get in touch',
      url: `${BASE_URL}/contact`,
      type: 'website'
    },
    'privacy-policy': {
      title: 'Privacy Policy - Your Data is Safe',
      description: 'Read our privacy policy to understand how L3V3L Matrimony protects your personal information and data.',
      keywords: 'privacy policy, data protection, privacy, security, GDPR',
      url: `${BASE_URL}/privacy-policy`,
      type: 'article'
    },
    'terms-of-service': {
      title: 'Terms of Service - User Agreement',
      description: 'L3V3L Matrimony terms of service. Read our user agreement and community guidelines.',
      keywords: 'terms of service, user agreement, terms and conditions, legal',
      url: `${BASE_URL}/terms-of-service`,
      type: 'article'
    },
    'community-guidelines': {
      title: 'Community Guidelines - Safe & Respectful',
      description: 'Our community guidelines ensure a safe, respectful environment for all L3V3L Matrimony members.',
      keywords: 'community guidelines, safety, respect, code of conduct',
      url: `${BASE_URL}/community-guidelines`,
      type: 'article'
    },
    'cookie-policy': {
      title: 'Cookie Policy - How We Use Cookies',
      description: 'Learn about how L3V3L Matrimony uses cookies to improve your experience.',
      keywords: 'cookie policy, cookies, tracking, privacy',
      url: `${BASE_URL}/cookie-policy`,
      type: 'article'
    },
    // Private pages (noindex)
    dashboard: {
      title: 'Dashboard',
      description: 'Your L3V3L Matrimony dashboard',
      keywords: '',
      url: `${BASE_URL}/dashboard`,
      noindex: true
    },
    profile: {
      title: 'Profile',
      description: 'View profile',
      keywords: '',
      noindex: true
    },
    messages: {
      title: 'Messages',
      description: 'Your conversations',
      keywords: '',
      noindex: true
    },
    search: {
      title: 'Search',
      description: 'Search for matches',
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

export default {
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
