'use client';
import { useEffect, useState } from 'react';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { apiClient } from '../utils/api';
import { useToast } from '../components/ToastContext';
import { useAuth } from '../components/AuthProvider';
import { Unit } from '../types';
export default function UnitsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [units, setUnits] = useState<Unit[]>([]);
  const [newUnit, setNewUnit] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const canManage = user && (user.role === 'admin' || user.role === 'superadmin');
  const load = async () => {
    const res = await apiClient.get<Unit[]>('/units');
    if (res.success && res.data) setUnits(res.data);
  };
  useEffect(() => { load(); }, []);
  const addUnit = async () => {
    if (!canManage) return;
    const name = newUnit.trim();
    if (!name) return;
    const res = await apiClient.post<Unit>('/units', { name });
    if (res.success) {
      setNewUnit('');
      load();
      toast.showSuccess('Unit added');
    } else {
      toast.showError('Error', res.error || 'Could not add unit');
    }
  };
  const saveUnit = async (id: number) => {
    if (!canManage) return;
    const name = editName.trim();
    if (!name) return;
    const res = await apiClient.put<Unit>(`/units/${id}`, { name });
    if (res.success) {
      setEditingId(null);
      setEditName('');
      load();
      toast.showSuccess('Unit updated');
    } else {
      toast.showError('Error', res.error || 'Could not update unit');
    }
  };
  const deleteUnit = async (id: number) => {
    if (!canManage) return;
    const res = await apiClient.delete(`/units/${id}`);
    if (res.success) {
      load();
      toast.showSuccess('Unit deleted');
    } else {
      toast.showError('Error', res.error || 'Unit may be in use');
    }
  };
  return (
    <Card>
      <h1 className="text-2xl font-semibold text-gray-900 mb-4">Units</h1>
      {canManage && (
        <div className="flex gap-2 mb-4">
          <Input label="New Unit" value={newUnit} onChange={(e) => setNewUnit(e.target.value)} placeholder="e.g., pcs" />
          <Button onClick={addUnit}>Add</Button>
        </div>
      )}
      <div className="space-y-2">
        {units.map(u => (
          <div key={u.id} className="flex items-center justify-between p-2 border rounded">
            {editingId === u.id ? (
              <div className="flex-1 mr-2">
                <Input label="" value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>
            ) : (
              <div className="text-gray-800">{u.name}</div>
            )}
            {canManage && (
              <div className="flex gap-2">
                {editingId === u.id ? (
                  <>
                    <Button size="sm" onClick={() => saveUnit(u.id)}>Save</Button>
                    <Button size="sm" variant="outline" onClick={() => { setEditingId(null); setEditName(''); }}>Cancel</Button>
                  </>
                ) : (
                  <>
                    <Button size="sm" variant="outline" onClick={() => { setEditingId(u.id); setEditName(u.name); }}>Edit</Button>
                    <Button size="sm" variant="outline" onClick={() => deleteUnit(u.id)}>Delete</Button>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
        {units.length === 0 && (
          <div className="text-sm text-gray-500">No units yet.</div>
        )}
      </div>
    </Card>
  );
}
