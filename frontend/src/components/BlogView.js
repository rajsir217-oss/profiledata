import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getBackendUrl } from '../config/apiConfig';
import SEO from './SEO';
import logger from '../utils/logger';
import './BlogView.css';

const BlogView = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [posts, setPosts] = useState([]);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchPost = async (s) => {
    try {
      setLoading(true);
      const res = await fetch(`${getBackendUrl()}/api/blog/${s}`);
      if (!res.ok) throw new Error('Post not found');
      const data = await res.json();
      setPost(data);
      setError('');
    } catch (err) {
      logger.error('Failed to load blog post', err);
      setError('Blog post not found.');
    } finally {
      setLoading(false);
    }
  };

  const fetchSidebar = async () => {
    try {
      const [postsRes, tagsRes] = await Promise.all([
        fetch(`${getBackendUrl()}/api/blog?limit=10`),
        fetch(`${getBackendUrl()}/api/blog/tags`)
      ]);
      if (postsRes.ok) setPosts(await postsRes.json());
      if (tagsRes.ok) setTags(await tagsRes.json());
    } catch (_) {}
  };

  useEffect(() => {
    if (slug) {
      fetchPost(slug);
      fetchSidebar();
    }
  }, [slug]);

  if (loading) {
    return (
      <div className="blog-view">
        <div className="blog-view-loading">Loading...</div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="blog-view">
        <SEO title="Blog Post Not Found" />
        <div className="blog-view-error">
          <h1>Post Not Found</h1>
          <p>{error || 'The blog post you are looking for does not exist.'}</p>
          <button className="bv-back-btn" onClick={() => navigate('/blog')}>← Back to Blog</button>
        </div>
      </div>
    );
  }

  return (
    <div className="blog-view">
      <SEO
        title={post.title}
        description={post.metaDescription || post.excerpt || ''}
        url={`/blog/${post.slug}`}
        type="article"
      />

      <div className="bv-layout">
        {/* Main Content */}
        <article className="bv-main">
          <button className="bv-back-link" onClick={() => navigate('/blog')}>← Back to Blog</button>

          {post.coverImage && (
            <img src={post.coverImage} alt={post.title} className="bv-cover" />
          )}

          <div className="bv-meta">
            <span className="bv-date">{new Date(post.publishedAt || post.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
            <span className="bv-author">by {post.createdBy}</span>
          </div>

          <h1 className="bv-title">{post.title}</h1>

          {(post.tags || []).length > 0 && (
            <div className="bv-tags">
              {post.tags.map(t => (
                <Link key={t} to={`/blog?tag=${encodeURIComponent(t)}`} className="bv-tag">{t}</Link>
              ))}
            </div>
          )}

          <div className="bv-content" dangerouslySetInnerHTML={{ __html: post.content }} />
        </article>

        {/* Sidebar */}
        <aside className="bv-sidebar">
          <div className="bv-sidebar-section">
            <h3>Recent Posts</h3>
            {posts.length === 0 ? (
              <p className="bv-sidebar-empty">No posts yet.</p>
            ) : (
              <ul className="bv-recent-list">
                {posts.filter(p => p.slug !== slug).slice(0, 5).map(p => (
                  <li key={p.id}>
                    <Link to={`/blog/${p.slug}`} className="bv-recent-link">{p.title}</Link>
                    <span className="bv-recent-date">{new Date(p.publishedAt || p.createdAt).toLocaleDateString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {tags.length > 0 && (
            <div className="bv-sidebar-section">
              <h3>Tags</h3>
              <div className="bv-tag-cloud">
                {tags.map(t => (
                  <Link key={t} to={`/blog?tag=${encodeURIComponent(t)}`} className="bv-tag">{t}</Link>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};

export default BlogView;
