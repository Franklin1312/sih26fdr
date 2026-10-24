import { useState, useEffect } from 'react';
import { institutionsApi } from '../../api/institutions';
import type { Institution, InstitutionFormData } from '../../types/institution';
import { formatDate } from '../../utils/helpers';
import { Plus, Loader2, MoreVertical, Edit, Trash2, Eye, Building2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { DropdownMenu } from '../../components/ui/DropdownMenu';

export function InstitutionsPage() {
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingInstitution, setEditingInstitution] = useState<Institution | null>(null);
  const [formData, setFormData] = useState<InstitutionFormData>({ name: '', code: '', address: '', contact_email: '', is_active: true });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { fetchInstitutions(); }, []);

  const fetchInstitutions = async () => {
    try { setLoading(true); const res = await institutionsApi.list({ page: 1, page_size: 100 }); setInstitutions(res.items || []); } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const filtered = institutions.filter(i => i.name.toLowerCase().includes(search.toLowerCase()) || i.code.toLowerCase().includes(search.toLowerCase()));

  const openCreateModal = () => { setEditingInstitution(null); setFormData({ name: '', code: '', address: '', contact_email: '', is_active: true }); setModalOpen(true); };
  const openEditModal = (inst: Institution) => { setEditingInstitution(inst); setFormData({ name: inst.name, code: inst.code, address: inst.address || '', contact_email: inst.contact_email || '', is_active: inst.is_active }); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditingInstitution(null); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingInstitution) { await institutionsApi.update(editingInstitution.id, formData); }
      else { await institutionsApi.create(formData); }
      fetchInstitutions(); closeModal();
    } catch (err: any) { alert(err.message || 'Failed to save institution'); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (inst: Institution) => {
    if (!window.confirm(`Delete ${inst.name}?`)) return;
    try { await institutionsApi.delete(inst.id); fetchInstitutions(); } catch (err: any) { alert(err.message || 'Failed to delete'); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary-600" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Building2 className="h-6 w-6" /> Institutions</h1>
          <p className="text-gray-500">Manage financial institutions</p>
        </div>
        <Button onClick={openCreateModal}><Plus className="h-4 w-4 mr-2" /> Add Institution</Button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl">
        <div className="p-4 border-b border-gray-200 flex gap-4">
          <div className="flex-1 max-w-md"><Input placeholder="Search institutions..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50"><tr><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Address</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th><th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th></tr></thead>
            <tbody className="divide-y divide-gray-200">
              {filtered.length === 0 ? <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-500">No institutions found</td></tr> : filtered.map(inst => <tr key={inst.id} className="hover:bg-gray-50"><td className="px-4 py-3"><p className="font-medium text-gray-900">{inst.name}</p></td><td className="px-4 py-3"><span className="font-mono text-sm text-gray-700">{inst.code}</span></td><td className="px-4 py-3 text-sm text-gray-600">{inst.address || '�'}</td><td className="px-4 py-3"><Badge variant={inst.is_active ? 'success' : 'secondary'}>{inst.is_active ? 'Active' : 'Inactive'}</Badge></td><td className="px-4 py-3 text-sm text-gray-600">{inst.contact_email || '—'}</td><td className="px-4 py-3 text-sm text-gray-500">{formatDate(inst.created_at, 'short')}</td><td className="px-4 py-3 text-right"><DropdownMenu trigger={<Button variant="ghost" size="sm"><MoreVertical className="h-4 w-4" /></Button>} items={[{ label: 'View', icon: <Eye className="h-4 w-4" />, onClick: () => openEditModal(inst) }, { label: 'Edit', icon: <Edit className="h-4 w-4" />, onClick: () => openEditModal(inst) }, { label: 'Delete', icon: <Trash2 className="h-4 w-4 text-red-500" />, onClick: () => handleDelete(inst), className: 'text-red-500' }]} /></td></tr>)}
            </tbody>
          </table>
        </div>
      </div>

      <Modal.Root open={modalOpen} onOpenChange={setModalOpen}>
        <Modal.Content className="max-w-md">
          <Modal.Header><Modal.Title>{editingInstitution ? 'Edit Institution' : 'Add Institution'}</Modal.Title></Modal.Header>
          <form onSubmit={handleSubmit}>
            <Modal.Body className="space-y-4">
              <div className="grid grid-cols-2 gap-4"><Input label="Name" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required /><Input label="Code" value={formData.code} onChange={(e) => setFormData({...formData, code: e.target.value})} required /></div>
              <Input label="Address" value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} />
              <Input label="Contact Email" type="email" value={formData.contact_email} onChange={(e) => setFormData({...formData, contact_email: e.target.value})} required />
              <label className="flex items-center gap-2"><input type="checkbox" checked={formData.is_active} onChange={(e) => setFormData({...formData, is_active: e.target.checked})} className="rounded border-gray-300" /><span className="text-sm text-gray-700">Active</span></label>
            </Modal.Body>
            <Modal.Footer><Button type="button" variant="secondary" onClick={closeModal} disabled={submitting}>Cancel</Button><Button type="submit" disabled={submitting}>{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}</Button></Modal.Footer>
          </form>
        </Modal.Content>
      </Modal.Root>
    </div>
  );
}
