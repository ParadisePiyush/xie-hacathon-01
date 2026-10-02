import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertCircle,
  CheckCircle,
  Clock,
  Loader2,
  Lock,
  Plus,
  Shield,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { apiClient } from '../api/client';
import type { AuditLog, User, UserRole } from '../api/types';

interface AdminPanelModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminPanelModal: React.FC<AdminPanelModalProps> = ({ isOpen, onClose }) => {
  const [tab, setTab] = useState<'users' | 'audit'>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New User Form State
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('collector');
  const [newTeamId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadAdminData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [usersData, auditData] = await Promise.all([
        apiClient.getUsers(),
        apiClient.getAuditLogs(100),
      ]);
      setUsers(usersData);
      setAuditLogs(auditData);
    } catch (err: any) {
      console.error('Failed to load admin data:', err);
      setError(err.message || 'Failed to fetch admin resources');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadAdminData();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    try {
      await apiClient.updateUser(userId, { role: newRole });
      await loadAdminData();
    } catch (err: any) {
      alert(err.message || 'Failed to update user role');
    }
  };

  const handleDeactivate = async (userId: string) => {
    if (!window.confirm('Are you sure you want to deactivate this account?')) return;
    try {
      await apiClient.deactivateUser(userId);
      await loadAdminData();
    } catch (err: any) {
      alert(err.message || 'Failed to deactivate user');
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      await apiClient.createUser({
        email: newEmail,
        password: newPassword,
        full_name: newFullName,
        role: newRole,
        team_id: newTeamId || undefined,
      });
      setIsCreatingUser(false);
      setNewEmail('');
      setNewFullName('');
      setNewPassword('');
      await loadAdminData();
    } catch (err: any) {
      alert(err.message || 'Failed to create user');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content" style={{ maxWidth: '850px' }}>
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: '10px',
                background: 'var(--brand-gradient)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
              }}
            >
              <Shield size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.25rem', lineHeight: 1.2 }}>
                Admin & Operations Control Center
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                User administration, RBAC role enforcement & immutable audit logs
              </p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
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
              padding: '0.85rem 1.5rem',
              border: 'none',
              background: tab === 'users' ? 'var(--bg-card)' : 'transparent',
              color: tab === 'users' ? 'var(--primary)' : 'var(--text-muted)',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              borderBottom: tab === 'users' ? '2.5px solid var(--primary)' : 'none',
            }}
            onClick={() => setTab('users')}
          >
            <Users size={16} /> User & Team Management ({users.length})
          </button>
          <button
            type="button"
            style={{
              padding: '0.85rem 1.5rem',
              border: 'none',
              background: tab === 'audit' ? 'var(--bg-card)' : 'transparent',
              color: tab === 'audit' ? 'var(--primary)' : 'var(--text-muted)',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              borderBottom: tab === 'audit' ? '2.5px solid var(--primary)' : 'none',
            }}
            onClick={() => setTab('audit')}
          >
            <Activity size={16} /> Security Audit Trail ({auditLogs.length})
          </button>
        </div>

        {/* Content Body */}
        <div className="modal-body" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
          {error && (
            <div
              style={{
                background: 'var(--color-critical-bg)',
                color: 'var(--color-critical)',
                border: '1px solid #FCA5A5',
                padding: '0.75rem 1rem',
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

          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-light)' }}>
              <Loader2 size={32} className="spin" style={{ margin: '0 auto 0.75rem' }} />
              <p>Loading administrative telemetry...</p>
            </div>
          ) : tab === 'users' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Header Actions */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Manage authorized platform staff, assign roles, and allocate response crews.
                </p>
                <button
                  type="button"
                  className="btn-primary"
                  style={{ padding: '0.4rem 0.85rem', fontSize: '0.82rem' }}
                  onClick={() => setIsCreatingUser(!isCreatingUser)}
                >
                  <Plus size={14} /> Add Team Member
                </button>
              </div>

              {/* Create User Form Drawer */}
              {isCreatingUser && (
                <form
                  onSubmit={handleCreateUser}
                  style={{
                    background: 'var(--bg-app)',
                    border: '1.5px solid #C7D2FE',
                    borderRadius: '14px',
                    padding: '1.25rem',
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '0.85rem',
                  }}
                >
                  <div className="form-group">
                    <label className="form-label">Full Name</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Alex Turner"
                      value={newFullName}
                      onChange={(e) => setNewFullName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input
                      type="email"
                      className="form-input"
                      placeholder="alex@smartwaste.city"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Password</label>
                    <input
                      type="password"
                      className="form-input"
                      placeholder="••••••••"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Role</label>
                    <select
                      className="form-input"
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value as UserRole)}
                    >
                      <option value="reporter">Citizen Reporter</option>
                      <option value="collector">Field Collector</option>
                      <option value="dispatcher">Lead Dispatcher</option>
                      <option value="admin">System Admin</option>
                    </select>
                  </div>
                  <div
                    style={{
                      gridColumn: 'span 2',
                      display: 'flex',
                      justifyContent: 'flex-end',
                      gap: '0.5rem',
                    }}
                  >
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setIsCreatingUser(false)}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="btn-primary" disabled={isSubmitting}>
                      {isSubmitting ? 'Creating...' : 'Create Account'}
                    </button>
                  </div>
                </form>
              )}

              {/* Users Table */}
              <div style={{ overflowX: 'auto', border: '1px solid var(--border-subtle)', borderRadius: '12px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-app)', textAlign: 'left', borderBottom: '1px solid var(--border-subtle)' }}>
                      <th style={{ padding: '0.75rem 1rem' }}>User / Email</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Assigned Role</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <div style={{ fontWeight: 700 }}>{u.full_name}</div>
                          <div style={{ color: 'var(--text-light)', fontSize: '0.78rem' }}>{u.email}</div>
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <select
                            value={u.role}
                            onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                            style={{
                              padding: '0.3rem 0.6rem',
                              borderRadius: '8px',
                              border: '1px solid var(--border-subtle)',
                              fontWeight: 600,
                              fontSize: '0.8rem',
                              background:
                                u.role === 'admin'
                                  ? 'var(--primary-light)'
                                  : u.role === 'collector'
                                  ? 'var(--color-low-bg)'
                                  : u.role === 'dispatcher'
                                  ? '#F0F9FF'
                                  : 'var(--bg-subtle)',
                              color:
                                u.role === 'admin'
                                  ? 'var(--primary)'
                                  : u.role === 'collector'
                                  ? '#047857'
                                  : u.role === 'dispatcher'
                                  ? '#0369A1'
                                  : 'var(--text-main)',
                            }}
                          >
                            <option value="admin">Admin</option>
                            <option value="dispatcher">Dispatcher</option>
                            <option value="collector">Collector</option>
                            <option value="reporter">Reporter</option>
                          </select>
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              color: u.is_active ? '#059669' : '#EF4444',
                            }}
                          >
                            {u.is_active ? <CheckCircle size={12} /> : <Lock size={12} />}
                            {u.is_active ? 'Active' : 'Disabled'}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                          {u.is_active && u.role !== 'admin' && (
                            <button
                              type="button"
                              className="btn-icon"
                              style={{ color: 'var(--color-critical)' }}
                              onClick={() => handleDeactivate(u.id)}
                              title="Deactivate Account"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Audit Log View */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Immutable audit ledger recording logins, registrations, plan dispatches, and role updates.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {auditLogs.map((log) => (
                  <div
                    key={log.id}
                    style={{
                      padding: '0.75rem 1rem',
                      borderRadius: '10px',
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-card)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.82rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span
                        style={{
                          padding: '0.2rem 0.55rem',
                          borderRadius: '6px',
                          fontWeight: 800,
                          fontSize: '0.72rem',
                          background:
                            log.action.includes('LOGIN') || log.action.includes('REGISTER')
                              ? 'var(--primary-light)'
                              : log.action.includes('DEACTIVATED')
                              ? 'var(--color-critical-bg)'
                              : 'var(--color-low-bg)',
                          color:
                            log.action.includes('LOGIN') || log.action.includes('REGISTER')
                              ? 'var(--primary)'
                              : log.action.includes('DEACTIVATED')
                              ? 'var(--color-critical)'
                              : '#047857',
                        }}
                      >
                        {log.action}
                      </span>
                      <span>
                        Entity: <b>{log.entity}</b> {log.entity_id ? `(${log.entity_id.slice(0, 8)})` : ''}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-light)' }}>
                      <Clock size={12} />
                      <span>{new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
