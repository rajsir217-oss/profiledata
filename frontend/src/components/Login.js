// frontend/src/components/Login.js
import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api";
import socketService from "../services/socketService";
import Logo from "./Logo";

const Login = () => {
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    
    try {
      const res = await api.post("/login", form);
      
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
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 25%, #f093fb 50%, #f5576c 75%, #4facfe 100%)',
      backgroundSize: '400% 400%',
      animation: 'gradientShift 15s ease infinite',
      padding: '20px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Animated floating hearts */}
      <div style={{
        position: 'absolute',
        top: '10%',
        left: '15%',
        fontSize: '2rem',
        opacity: 0.1,
        animation: 'float 6s ease-in-out infinite'
      }}>💕</div>
      <div style={{
        position: 'absolute',
        top: '70%',
        right: '20%',
        fontSize: '2.5rem',
        opacity: 0.1,
        animation: 'float 8s ease-in-out infinite 1s'
      }}>💖</div>
      <div style={{
        position: 'absolute',
        bottom: '15%',
        left: '25%',
        fontSize: '1.8rem',
        opacity: 0.1,
        animation: 'float 7s ease-in-out infinite 2s'
      }}>❤️</div>
      
      <style>{`
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(10deg); }
        }
      `}</style>
      
      <div className="login-container" style={{
        width: '100%',
        maxWidth: '400px',
        background: 'rgba(255, 255, 255, 0.95)',
        borderRadius: '20px',
        padding: '32px 24px',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        backdropFilter: 'blur(10px)',
        position: 'relative',
        zIndex: 1
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
          <Logo variant="modern" size="medium" showText={true} theme="light" />
        </div>
        <h3 className="text-center mb-4" style={{ 
          color: '#667eea',
          fontWeight: '600',
          textShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>Welcome Back!</h3>
      {error && <div className="alert alert-danger">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label className="form-label">Username</label>
          <input
            type="text"
            name="username"
            value={form.username}
            onChange={handleChange}
            style={{
              width: '100%',
              padding: '14px',
              border: '2px solid #e0e0e0',
              borderRadius: '8px',
              fontSize: '16px',
              transition: 'border-color 0.3s',
              outline: 'none',
              minHeight: '44px'
            }}
            required
          />
        </div>
        <div className="mb-3">
          <label className="form-label">Password</label>
          <div style={{ position: 'relative' }}>
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              value={form.password}
              onChange={handleChange}
              style={{
                width: '100%',
                padding: '14px',
                paddingRight: '50px',
                border: '2px solid #e0e0e0',
                borderRadius: '8px',
                fontSize: '16px',
                transition: 'border-color 0.3s',
                outline: 'none',
                minHeight: '44px',
                boxSizing: 'border-box'
              }}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute',
                right: '4px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: '20px',
                padding: '8px',
                minWidth: '44px',
                minHeight: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {showPassword ? '👁️' : '👁️‍🗨️'}
            </button>
          </div>
        </div>
        <button 
          type="submit" 
          className="btn btn-primary w-100" 
          disabled={loading}
          style={{
            minHeight: '44px',
            fontSize: '16px',
            fontWeight: '600',
            padding: '12px'
          }}
        >
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>
      <div className="text-center mt-3">
        <Link to="/register">Don't have an account? Register</Link>
      </div>
      <div className="text-center mt-2">
        <small className="text-muted">
          Forgot password? Change it from <Link to="/preferences">Settings</Link> after logging in.
        </small>
      </div>
      </div>
    </div>
  );
};

export default Login;
