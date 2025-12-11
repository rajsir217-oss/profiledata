import React from 'react';
import { Helmet } from 'react-helmet-async';

/**
 * SEO Component - Meta tags management
 * 
 * Handles dynamic meta tags for SEO and social media sharing
 * 
 * @param {Object} props
 * @param {string} props.title - Page title
 * @param {string} props.description - Page description
 * @param {string} props.keywords - SEO keywords (comma-separated)
 * @param {string} props.image - OG image URL
 * @param {string} props.url - Canonical URL
 * @param {string} props.type - OG type (website, article, profile)
 * @param {boolean} props.noindex - Prevent indexing (for private pages)
 * @param {string} props.author - Content author
 * @param {string} props.publishedTime - Article published time
 */
const SEO = ({
  title = '🦋 L3V3L Matches - Find Your Perfect Match',
  description = 'L3V3L Matches is a modern matchmaking platform connecting people for meaningful relationships. Join thousands finding love today.',
  keywords = 'matrimony, matchmaking, marriage, relationships, dating, love, partner, marriage bureau, shaadi, vivah',
  image = 'https://l3v3lmatches.com/og-image.jpg',
  url = 'https://l3v3lmatches.com',
  type = 'website',
  noindex = false,
  author = 'L3V3L Matches',
  publishedTime = null,
  twitterCard = 'summary_large_image',
  twitterSite = '@l3v3lmatches'
}) => {
  // Construct full title with site name
  const fullTitle = title.includes('L3V3L') ? title : `${title} | 🦋 L3V3L Matches`;

  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <meta name="author" content={author} />
      
      {/* Canonical URL */}
      <link rel="canonical" href={url} />
      
      {/* Robots Meta */}
      {noindex && <meta name="robots" content="noindex, nofollow" />}
      {!noindex && <meta name="robots" content="index, follow" />}
      
      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:url" content={url} />
      <meta property="og:site_name" content="L3V3L Matches" />
      <meta property="og:locale" content="en_US" />
      
      {/* Article-specific OG tags */}
      {type === 'article' && publishedTime && (
        <meta property="article:published_time" content={publishedTime} />
      )}
      {type === 'article' && (
        <meta property="article:author" content={author} />
      )}
      
      {/* Twitter Card */}
      <meta name="twitter:card" content={twitterCard} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
      {twitterSite && <meta name="twitter:site" content={twitterSite} />}
      <meta name="twitter:creator" content={twitterSite} />
      
      {/* Additional SEO Tags */}
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta httpEquiv="Content-Type" content="text/html; charset=utf-8" />
      <meta name="language" content="English" />
      <meta name="revisit-after" content="7 days" />
      
      {/* Prevent translation for proper nouns */}
      <meta name="google" content="notranslate" />
    </Helmet>
  );
};

export default SEO;
