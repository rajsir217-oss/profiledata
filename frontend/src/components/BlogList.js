import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { getBackendUrl } from '../config/apiConfig';
import SEO from './SEO';
import logger from '../utils/logger';
import './BlogView.css';

const BlogList = () => {
  const [searchParams] = useSearchParams();
  const activeTag = searchParams.get('tag');
  const [posts, setPosts] = useState([]);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const url = activeTag
          ? `${getBackendUrl()}/api/blog?tag=${encodeURIComponent(activeTag)}&limit=50`
          : `${getBackendUrl()}/api/blog?limit=50`;
        const [postsRes, tagsRes] = await Promise.all([
          fetch(url),
          fetch(`${getBackendUrl()}/api/blog/tags`)
        ]);
        if (postsRes.ok) setPosts(await postsRes.json());
        if (tagsRes.ok) setTags(await tagsRes.json());
      } catch (err) {
        logger.error('Failed to load blog posts', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [activeTag]);

  return (
    <div className="blog-view">
      <SEO
        title={activeTag ? `Blog - ${activeTag}` : 'Blog'}
        description="Read articles about matchmaking, compatibility, and the L3V3L platform."
        url="/blog"
      />

      <div className="bv-layout">
        <div className="bv-main">
          <h1 className="bv-title" style={{ marginBottom: 8 }}>
            {activeTag ? `Posts tagged: "${activeTag}"` : 'Blog'}
          </h1>
          {activeTag && (
            <Link to="/blog" className="bv-back-link" style={{ marginBottom: 24 }}>← Clear filter</Link>
          )}

          {loading ? (
            <div className="blog-view-loading">Loading posts...</div>
          ) : posts.length === 0 ? (
            <div className="blog-view-loading">No blog posts yet.</div>
          ) : (
            <div className="bl-grid">
              {posts.map(post => (
                <Link key={post.id} to={`/blog/${post.slug}`} className="bl-card">
                  {post.coverImage && (
                    <img src={post.coverImage} alt={post.title} className="bl-card-img" />
                  )}
                  <div className="bl-card-body">
                    <h2 className="bl-card-title">{post.title}</h2>
                    {post.excerpt && <p className="bl-card-excerpt">{post.excerpt}</p>}
                    <div className="bl-card-meta">
                      <span>{new Date(post.publishedAt || post.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                      <span>by {post.createdBy}</span>
                    </div>
                    {(post.tags || []).length > 0 && (
                      <div className="bl-card-tags">
                        {post.tags.map(t => <span key={t} className="bv-tag">{t}</span>)}
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <aside className="bv-sidebar">
          {tags.length > 0 && (
            <div className="bv-sidebar-section">
              <h3>Tags</h3>
              <div className="bv-tag-cloud">
                {tags.map(t => (
                  <Link
                    key={t}
                    to={`/blog?tag=${encodeURIComponent(t)}`}
                    className={`bv-tag ${activeTag === t ? 'bv-tag-active' : ''}`}
                  >
                    {t}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};

export default BlogList;
