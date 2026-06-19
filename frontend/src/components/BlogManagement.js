import React, { useState, useEffect } from 'react';
import { createApiInstance } from '../api';
import { getBackendUrl } from '../config/apiConfig';
import useToast from '../hooks/useToast';
import DeleteButton from './DeleteButton';
import RichTextEditor from './shared/RichTextEditor';
import logger from '../utils/logger';
import './BlogManagement.css';

const blogApi = createApiInstance(`${getBackendUrl()}/api/blog`);

const BlogManagement = () => {
  const toast = useToast();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    excerpt: '',
    content: '',
    coverImage: '',
    tags: '',
    status: 'draft',
    metaDescription: ''
  });

  const loadPosts = async () => {
    try {
      setLoading(true);
      const res = await blogApi.get('/admin/all?limit=200');
      setPosts(res.data || []);
    } catch (err) {
      logger.error('Failed to load blog posts', err);
      toast.error('Failed to load blog posts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPosts(); }, []);

  const resetForm = () => {
    setFormData({ title: '', slug: '', excerpt: '', content: '', coverImage: '', tags: '', status: 'draft', metaDescription: '' });
    setEditingId(null);
    setShowForm(false);
  };

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (post) => {
    setFormData({
      title: post.title || '',
      slug: post.slug || '',
      excerpt: post.excerpt || '',
      content: post.content || '',
      coverImage: post.coverImage || '',
      tags: (post.tags || []).join(', '),
      status: post.status || 'draft',
      metaDescription: post.metaDescription || ''
    });
    setEditingId(post.id);
    setShowForm(true);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.content.trim()) {
      toast.error('Title and content are required');
      return;
    }

    const payload = {
      ...formData,
      tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
      slug: formData.slug.trim() || undefined
    };

    try {
      if (editingId) {
        await blogApi.put(`/admin/${editingId}`, payload);
        toast.success('Blog post updated');
      } else {
        await blogApi.post('/admin/create', payload);
        toast.success('Blog post created');
      }
      resetForm();
      loadPosts();
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to save blog post';
      toast.error(msg);
    }
  };

  const handleDelete = async (postId) => {
    try {
      await blogApi.delete(`/admin/${postId}`);
      toast.success('Blog post deleted');
      loadPosts();
    } catch (err) {
      toast.error('Failed to delete blog post');
    }
  };

  const statusBadge = (status) => {
    const map = { draft: '📝 Draft', published: '✅ Published', archived: '📦 Archived' };
    return map[status] || status;
  };

  return (
    <div className="blog-management">
      <div className="blog-mgmt-header">
        <h1>📝 Blog Management</h1>
        <button className="btn-primary" onClick={openCreate}>+ New Post</button>
      </div>

      {showForm && (
        <div className="blog-form-overlay" onClick={(e) => { if (e.target === e.currentTarget) resetForm(); }}>
          <div className="blog-form-card">
            <div className="blog-form-header">
              <h2>{editingId ? 'Edit Post' : 'New Post'}</h2>
              <button className="btn-close" onClick={resetForm}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group flex-1">
                  <label>Title *</label>
                  <input name="title" value={formData.title} onChange={handleChange} placeholder="Post title" required />
                </div>
                <div className="form-group" style={{ width: 200 }}>
                  <label>Status</label>
                  <select name="status" value={formData.status} onChange={handleChange}>
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group flex-1">
                  <label>Slug</label>
                  <input name="slug" value={formData.slug} onChange={handleChange} placeholder="Auto-generated from title if empty" />
                </div>
                <div className="form-group flex-1">
                  <label>Cover Image URL</label>
                  <input name="coverImage" value={formData.coverImage} onChange={handleChange} placeholder="/images/blog/example.jpg" />
                </div>
              </div>
              <div className="form-group">
                <label>Excerpt</label>
                <input name="excerpt" value={formData.excerpt} onChange={handleChange} placeholder="Short summary for previews" maxLength={500} />
              </div>
              <div className="form-group">
                <label>Content *</label>
                <RichTextEditor
                  value={formData.content}
                  onChange={(val) => setFormData(prev => ({ ...prev, content: val }))}
                  placeholder="Write your blog content..."
                />
              </div>
              <div className="form-row">
                <div className="form-group flex-1">
                  <label>Tags (comma-separated)</label>
                  <input name="tags" value={formData.tags} onChange={handleChange} placeholder="ai, matching, tips" />
                </div>
                <div className="form-group flex-1">
                  <label>Meta Description (SEO)</label>
                  <input name="metaDescription" value={formData.metaDescription} onChange={handleChange} placeholder="SEO description" maxLength={300} />
                </div>
              </div>
              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={resetForm}>Cancel</button>
                <button type="submit" className="btn-primary">{editingId ? 'Update' : 'Create'} Post</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="blog-loading">Loading posts...</div>
      ) : posts.length === 0 ? (
        <div className="blog-empty">No blog posts yet. Click "+ New Post" to create one.</div>
      ) : (
        <div className="blog-table-wrap">
          <table className="blog-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Status</th>
                <th>Tags</th>
                <th>Views</th>
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {posts.map(post => (
                <tr key={post.id}>
                  <td className="blog-title-cell">
                    <strong>{post.title}</strong>
                    {post.excerpt && <span className="blog-excerpt-preview">{post.excerpt.substring(0, 80)}...</span>}
                  </td>
                  <td><span className={`blog-status-badge status-${post.status}`}>{statusBadge(post.status)}</span></td>
                  <td>{(post.tags || []).map(t => <span key={t} className="blog-tag">{t}</span>)}</td>
                  <td>{post.viewCount || 0}</td>
                  <td>{new Date(post.updatedAt).toLocaleDateString()}</td>
                  <td className="blog-actions">
                    <button className="btn-sm" onClick={() => openEdit(post)}>✏️</button>
                    <DeleteButton
                      onConfirm={() => handleDelete(post.id)}
                      confirmMessage={`Delete "${post.title}"?`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default BlogManagement;
