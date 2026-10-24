import { useState, useEffect } from 'react';
import { usersApi } from '../../api/auth';
import type { User, UserRole } from '../../types/auth';
import { formatDate } from '../../utils/helpers';
import { Plus, Loader2, MoreVertical, Edit, Trash2, Eye, Users } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Select } from '../../components/ui/Select';
import { DropdownMenu } from '../../components/ui/DropdownMenu';

const ROLES: UserRole[] = ['institution_rep', 'scrutiny_officer', 'clearance_officer', 'competent_authority', 'system_admin'];

interface UserFormData {
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  password: string;
}

export function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<UserFormData>({ email: '', full_name: '', role: 'scrutiny_officer', is_active: true, password: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    try { setLoading(true); const res = await usersApi.list({ page: 1, page_size: 100 }); setUsers(res.items || []); } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const filtered = users.filter(u => u.full_name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()));

  const openCreateModal = () => { setEditingUser(null); setFormData({ email: '', full_name: '', role: 'scrutiny_officer', is_active: true, password: '' }); setModalOpen(true); };
  const openEditModal = (user: User) => { setEditingUser(user); setFormData({ email: user.email, full_name: user.full_name, role: user.role, is_active: user.is_active, password: '' }); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditingUser(null); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingUser) { await usersApi.update(editingUser.id, { full_name: formData.full_name, role: formData.role, is_active: formData.is_active, ...(formData.password ? { password: formData.password } : {}) }); }
      else { await usersApi.create(formData); }
      fetchUsers(); closeModal();
    } catch (err: any) { alert(err.message || 'Failed to save user'); }
    finally { setSubmitting(false); }
  };

  const handleDeactivate = async (user: User) => {
    if (!window.confirm(`Deactivate ${user.full_name}?`)) return;
    try { await usersApi.update(user.id, { is_active: false }); fetchUsers(); } catch (err: any) { alert(err.message || 'Failed to deactivate'); }
  };

  const roleBadge = (role: string) => {
    const variants: Record<string, 'primary' | 'secondary' | 'success' | 'danger' | 'default'> = { system_admin: 'danger', scrutiny_officer: 'primary', clearance_officer: 'secondary', competent_authority: 'success', institution_rep: 'default' };
    return <Badge variant={variants[role] || 'default'}>{role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</Badge>;
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary-600" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Users className="h-6 w-6" /> User Management</h1>
          <p className="text-gray-500">Manage system users and roles</p>
        </div>
        <Button onClick={openCreateModal}><Plus className="h-4 w-4 mr-2" /> Add User</Button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl">
        <div className="p-4 border-b border-gray-200 flex gap-4">
          <div className="flex-1 max-w-md"><Input placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50"><tr><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th><th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th></tr></thead>
            <tbody className="divide-y divide-gray-200">
              {filtered.length === 0 ? <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-500">No users found</td></tr> : filtered.map(user => <tr key={user.id} className="hover:bg-gray-50"><td className="px-4 py-3"><p className="font-medium text-gray-900">{user.full_name}</p></td><td className="px-4 py-3 text-sm text-gray-600">{user.email}</td><td className="px-4 py-3">{roleBadge(user.role)}</td><td className="px-4 py-3"><Badge variant={user.is_active ? 'success' : 'secondary'}>{user.is_active ? 'Active' : 'Inactive'}</Badge></td><td className="px-4 py-3 text-sm text-gray-500">{formatDate(user.created_at, 'short')}</td><td className="px-4 py-3 text-right"><DropdownMenu trigger={<Button variant="ghost" size="sm"><MoreVertical className="h-4 w-4" /></Button>} items={[{ label: 'View', icon: <Eye className="h-4 w-4" />, onClick: () => openEditModal(user) }, { label: 'Edit', icon: <Edit className="h-4 w-4" />, onClick: () => openEditModal(user) }, { label: 'Deactivate', icon: <Trash2 className="h-4 w-4 text-red-500" />, onClick: () => handleDeactivate(user), className: 'text-red-500' }]} /></td></tr>)}
            </tbody>
          </table>
        </div>
      </div>

      <Modal.Root open={modalOpen} onOpenChange={setModalOpen}>
        <Modal.Content className="max-w-md">
          <Modal.Header><Modal.Title>{editingUser ? 'Edit User' : 'Add User'}</Modal.Title></Modal.Header>
          <form onSubmit={handleSubmit}>
            <Modal.Body className="space-y-4">
              <Input label="Email" type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} required />
              <Input label="Full Name" value={formData.full_name} onChange={(e) => setFormData({...formData, full_name: e.target.value})} required />
              <Select label="Role" value={formData.role} onChange={(e) => setFormData({...formData, role: e.target.value as UserRole})} options={ROLES.map(r => ({ value: r, label: r.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) }))} required />
              {!editingUser && <Input label="Temporary Password" type="password" minLength={8} value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} required />}
              <label className="flex items-center gap-2"><input type="checkbox" checked={formData.is_active} onChange={(e) => setFormData({...formData, is_active: e.target.checked})} className="rounded border-gray-300" /><span className="text-sm text-gray-700">Active</span></label>
            </Modal.Body>
            <Modal.Footer><Button type="button" variant="secondary" onClick={closeModal} disabled={submitting}>Cancel</Button><Button type="submit" disabled={submitting}>{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}</Button></Modal.Footer>
          </form>
        </Modal.Content>
      </Modal.Root>
    </div>
  );
}
