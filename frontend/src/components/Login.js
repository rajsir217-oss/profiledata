// frontend/src/components/Login.js
import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api";
import socketService from "../services/socketService";

const Login = () => {
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  // Hide topbar and remove body padding on login page
  useEffect(() => {
    const topbar = document.querySelector('.top-bar');
    if (topbar) {
      topbar.style.display = 'none';
    }
    
    // Remove any body padding/margin
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.body.style.overflow = 'hidden';
    
    // Show topbar and restore body styles when leaving login page
    return () => {
      const topbar = document.querySelector('.top-bar');
      if (topbar) {
        topbar.style.display = 'flex';
      }
      document.body.style.overflow = 'auto';
    };
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    
    try {
      // Trim whitespace from credentials
      const credentials = {
        username: form.username.trim(),
        password: form.password.trim()
      };
      const res = await api.post("/login", credentials);
      
      // Save login credentials to localStorage
      localStorage.setItem('username', res.data.user.username);
      localStorage.setItem('token', res.data.access_token);
      
      // Save user status for menu access control
      const userStatus = res.data.user.status?.status || res.data.user.status || 'active';
      localStorage.setItem('userStatus', userStatus);
      
      // Save user role for admin access control
      const userRole = res.data.user.role_name || 'free_user';
      localStorage.setItem('userRole', userRole);
      console.log('👤 User role saved:', userRole);
      
      // Connect to WebSocket (automatically marks user as online)
      console.log('🔌 Connecting to WebSocket');
      socketService.connect(res.data.user.username);
      
      // Clear any cached theme from previous user
      localStorage.removeItem('appTheme');
      
      // Dispatch custom event to notify other components
      window.dispatchEvent(new Event('loginStatusChanged'));
      
      // Dispatch theme reload event
      window.dispatchEvent(new Event('userLoggedIn'));
      
      navigate('/dashboard', { state: { user: res.data.user } });
    } catch (err) {
      console.error("Login error:", err);
      setError(err.response?.data?.detail || err.response?.data?.error || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page-wrapper" style={{
      minHeight: '100vh',
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: `
        linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5)),
        url('/images/wedding-bg.jpg') center/cover no-repeat fixed
      `,
      padding: '20px',
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      overflow: 'auto'
    }}>
      {/* Dark overlay for better readability */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.4)',
        zIndex: 0
      }}></div>
      
      <div className="login-container" style={{
        width: '100%',
        maxWidth: '440px',
        background: 'rgba(255, 255, 255, 0.98)',
        borderRadius: '24px',
        padding: '48px 40px',
        boxShadow: '0 24px 48px rgba(0, 0, 0, 0.4), 0 8px 16px rgba(0, 0, 0, 0.3)',
        backdropFilter: 'blur(10px)',
        position: 'relative',
        zIndex: 10
      }}>
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column',
          alignItems: 'center', 
          gap: '8px',
          marginBottom: '16px' 
        }}>
          <div style={{ fontSize: '48px', lineHeight: '1' }}>🦋</div>
          <div style={{ 
            fontSize: '32px', 
            fontWeight: '800',
            background: 'linear-gradient(135deg, #ec4899 0%, #a78bfa 50%, #6366f1 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            letterSpacing: '2px',
            fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif'
          }}>
            L3V3L
          </div>
        </div>
        <h2 className="text-center" style={{ 
          color: '#1a1a1a',
          fontWeight: '700',
          fontSize: '28px',
          marginBottom: '8px',
          letterSpacing: '-0.5px'
        }}>Welcome Back!</h2>
        <p className="text-center" style={{
          color: '#6b7280',
          fontSize: '15px',
          marginBottom: '32px'
        }}>Sign in to continue to your account</p>
      {error && <div className="alert alert-danger">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="form-label" style={{
            fontWeight: '500',
            fontSize: '14px',
            color: '#374151',
            marginBottom: '8px',
            display: 'block'
          }}>Username</label>
          <div style={{ position: 'relative' }}>
            <span style={{
              position: 'absolute',
              left: '16px',
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: '18px',
              color: '#9ca3af',
              pointerEvents: 'none'
            }}>👤</span>
            <input
              type="text"
              name="username"
              value={form.username}
              onChange={handleChange}
              placeholder="Enter your username"
              style={{
                width: '100%',
                padding: '14px 16px 14px 48px',
                border: '2px solid #e5e7eb',
                borderRadius: '12px',
                fontSize: '15px',
                outline: 'none',
                minHeight: '52px',
                backgroundColor: '#f9fafb',
                color: '#1f2937'
              }}
              onFocus={(e) => e.target.style.borderColor = '#667eea'}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
              required
            />
          </div>
        </div>
        <div className="mb-4">
          <label className="form-label" style={{
            fontWeight: '500',
            fontSize: '14px',
            color: '#374151',
            marginBottom: '8px',
            display: 'block'
          }}>Password</label>
          <div style={{ position: 'relative' }}>
            <span style={{
              position: 'absolute',
              left: '16px',
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: '18px',
              color: '#9ca3af',
              pointerEvents: 'none'
            }}>🔒</span>
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="Enter your password"
              style={{
                width: '100%',
                padding: '14px 56px 14px 48px',
                border: '2px solid #e5e7eb',
                borderRadius: '12px',
                fontSize: '15px',
                outline: 'none',
                minHeight: '52px',
                backgroundColor: '#f9fafb',
                color: '#1f2937',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => e.target.style.borderColor = '#667eea'}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: '20px',
                padding: '10px',
                minWidth: '44px',
                minHeight: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#6b7280',
                borderRadius: '8px'
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#f3f4f6'}
              onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
            >
              {showPassword ? '👁️' : '👁️‍🗨️'}
            </button>
          </div>
        </div>
        <button 
          type="submit" 
          disabled={loading}
          style={{
            width: '100%',
            minHeight: '52px',
            fontSize: '16px',
            fontWeight: '600',
            padding: '14px',
            background: loading ? '#9ca3af' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: '#ffffff',
            border: 'none',
            borderRadius: '12px',
            cursor: loading ? 'not-allowed' : 'pointer',
            boxShadow: loading ? 'none' : '0 4px 12px rgba(102, 126, 234, 0.4)',
            marginTop: '8px'
          }}
          onMouseEnter={(e) => !loading && (e.target.style.transform = 'translateY(-1px)', e.target.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.5)')}
          onMouseLeave={(e) => !loading && (e.target.style.transform = 'translateY(0)', e.target.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)')}
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>
      <div style={{
        marginTop: '24px',
        paddingTop: '24px',
        borderTop: '1px solid #e5e7eb',
        textAlign: 'center'
      }}>
        <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '0' }}>
          Don't have an account?{' '}
          <Link to="/register2" style={{
            color: '#667eea',
            textDecoration: 'none',
            fontWeight: '600'
          }}
          onMouseEnter={(e) => e.target.style.textDecoration = 'underline'}
          onMouseLeave={(e) => e.target.style.textDecoration = 'none'}
          >Create Account</Link>
        </p>
      </div>
      </div>
    </div>
  );
};

export default Login;
