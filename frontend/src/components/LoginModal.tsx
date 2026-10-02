import React, { useState } from 'react';
import {
  AlertCircle,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  MapPin,
  Shield,
  Sparkles,
  Truck,
  UserCheck,
  UserPlus,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const { login, register, quickLogin } = useAuth();
  const [tab, setTab] = useState<'quick' | 'login' | 'register'>('quick');

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleQuickLogin = async (persona: 'admin' | 'dispatcher' | 'collector' | 'reporter') => {
    try {
      setIsSubmitting(true);
      setError(null);
      await quickLogin(persona);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Quick login failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleManualLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please provide both email and password.');
      return;
    }
    try {
      setIsSubmitting(true);
      setError(null);
      await login({ email, password });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Login failed. Please verify credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !fullName) {
      setError('All fields are required.');
      return;
    }
    try {
      setIsSubmitting(true);
      setError(null);
      await register({ email, password, full_name: fullName, role: 'reporter' });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Registration failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content" style={{ maxWidth: '520px' }}>
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '10px',
                background: 'var(--brand-gradient)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
              }}
            >
              <KeyRound size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.2rem', lineHeight: 1.2 }}>Sign In & RBAC Roles</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Access platform roles and permissions
              </p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'var(--bg-app)',
          }}
        >
          <button
            type="button"
            style={{
              flex: 1,
              padding: '0.75rem',
              border: 'none',
              background: tab === 'quick' ? 'var(--bg-card)' : 'transparent',
              color: tab === 'quick' ? 'var(--primary)' : 'var(--text-muted)',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              borderBottom: tab === 'quick' ? '2.5px solid var(--primary)' : 'none',
            }}
            onClick={() => setTab('quick')}
          >
            ⚡ Quick Personas
          </button>
          <button
            type="button"
            style={{
              flex: 1,
              padding: '0.75rem',
              border: 'none',
              background: tab === 'login' ? 'var(--bg-card)' : 'transparent',
              color: tab === 'login' ? 'var(--primary)' : 'var(--text-muted)',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              borderBottom: tab === 'login' ? '2.5px solid var(--primary)' : 'none',
            }}
            onClick={() => setTab('login')}
          >
            Sign In
          </button>
          <button
            type="button"
            style={{
              flex: 1,
              padding: '0.75rem',
              border: 'none',
              background: tab === 'register' ? 'var(--bg-card)' : 'transparent',
              color: tab === 'register' ? 'var(--primary)' : 'var(--text-muted)',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              borderBottom: tab === 'register' ? '2.5px solid var(--primary)' : 'none',
            }}
            onClick={() => setTab('register')}
          >
            Register
          </button>
        </div>

        {/* Body */}
        <div className="modal-body">
          {error && (
            <div
              style={{
                background: 'var(--color-critical-bg)',
                color: 'var(--color-critical)',
                border: '1px solid #FCA5A5',
                padding: '0.65rem 0.95rem',
                borderRadius: '10px',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {tab === 'quick' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Select a pre-configured persona to immediately test role permissions and workflows:
              </p>

              {/* Admin Persona */}
              <div
                onClick={() => handleQuickLogin('admin')}
                style={{
                  padding: '0.85rem 1rem',
                  borderRadius: '12px',
                  border: '1.5px solid #C7D2FE',
                  background: 'var(--primary-light)',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      background: 'var(--primary)',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Shield size={18} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--primary)' }}>
                      System Administrator
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      admin@smartwaste.city • User Admin & Audit Logs
                    </div>
                  </div>
                </div>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)' }}>
                  Switch →
                </span>
              </div>

              {/* Dispatcher Persona */}
              <div
                onClick={() => handleQuickLogin('dispatcher')}
                style={{
                  padding: '0.85rem 1rem',
                  borderRadius: '12px',
                  border: '1.5px solid #BAE6FD',
                  background: '#F0F9FF',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      background: '#0284C7',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Sparkles size={18} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#0369A1' }}>
                      Lead Dispatcher
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      dispatcher@smartwaste.city • Route Planning & VRP Optimization
                    </div>
                  </div>
                </div>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0284C7' }}>
                  Switch →
                </span>
              </div>

              {/* Collector Persona */}
              <div
                onClick={() => handleQuickLogin('collector')}
                style={{
                  padding: '0.85rem 1rem',
                  borderRadius: '12px',
                  border: '1.5px solid #A7F3D0',
                  background: 'var(--color-low-bg)',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      background: '#059669',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Truck size={18} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#047857' }}>
                      Field Collector (Crew Alpha)
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      collector@smartwaste.city • Vehicle Manifest & Stop Logging
                    </div>
                  </div>
                </div>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#059669' }}>
                  Switch →
                </span>
              </div>

              {/* Citizen Persona */}
              <div
                onClick={() => handleQuickLogin('reporter')}
                style={{
                  padding: '0.85rem 1rem',
                  borderRadius: '12px',
                  border: '1.5px solid #FDE68A',
                  background: 'var(--color-medium-bg)',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      background: '#D97706',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <MapPin size={18} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#B45309' }}>
                      Citizen Reporter
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      citizen@smartwaste.city • Report Waste Pins & View Own Requests
                    </div>
                  </div>
                </div>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#D97706' }}>
                  Switch →
                </span>
              </div>
            </div>
          )}

          {tab === 'login' && (
            <form onSubmit={handleManualLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Mail size={14} /> Email Address
                </label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Lock size={14} /> Password
                </label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <button
                type="submit"
                className="btn-primary"
                disabled={isSubmitting}
                style={{ width: '100%', marginTop: '0.5rem' }}
              >
                {isSubmitting ? <Loader2 size={16} className="spin" /> : <UserCheck size={16} />}
                Sign In
              </button>
            </form>
          )}

          {tab === 'register' && (
            <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Jane Resident"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="jane@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Password</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Minimum 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <button
                type="submit"
                className="btn-primary"
                disabled={isSubmitting}
                style={{ width: '100%', marginTop: '0.5rem' }}
              >
                {isSubmitting ? <Loader2 size={16} className="spin" /> : <UserPlus size={16} />}
                Create Citizen Account
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
