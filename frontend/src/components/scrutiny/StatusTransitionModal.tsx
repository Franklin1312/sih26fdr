import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { Loader2 } from 'lucide-react';

interface StatusTransitionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTransition: (newStatus: string, reason?: string, details?: Record<string, unknown>) => void;
  currentStatus: string;
}

const STATUS_TRANSITIONS: Record<string, string[]> = {
  submitted: ['under_scrutiny', 'rejected'],
  under_scrutiny: ['clarification_pending', 'clearance_queue', 'rejected'],
  clarification_pending: ['under_scrutiny', 'rejected'],
};

export function StatusTransitionModal({
  isOpen,
  onClose,
  onTransition,
  currentStatus,
}: StatusTransitionModalProps) {
  const [newStatus, setNewStatus] = useState('');
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);

  const availableTransitions = STATUS_TRANSITIONS[currentStatus] || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStatus) return;
    setLoading(true);
    try {
      await onTransition(newStatus, reason, details ? JSON.parse(details) : undefined);
    } catch {
      alert('Invalid JSON in details field');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal.Root open={isOpen} onOpenChange={onClose}>
      <Modal.Content className="max-w-md">
        <Modal.Header>
          <Modal.Title>Transition Case Status</Modal.Title>
          <Modal.Description>
            Current status: <strong>{currentStatus.replace(/_/g, ' ')}</strong>
          </Modal.Description>
        </Modal.Header>
        <form onSubmit={handleSubmit}>
          <Modal.Body className="space-y-4">
            <Select
              label="New Status"
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
              options={availableTransitions.map((s) => ({ value: s, label: s.replace(/_/g, ' ') }))}
              placeholder="Select new status"
              required
            />
            <Input
              label="Reason (optional)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason for transition"
            />
            <Textarea
              label="Details (JSON, optional)"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder='{"key": "value"}'
              rows={3}
            />
          </Modal.Body>
          <Modal.Footer>
            <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !newStatus}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Transition'}
            </Button>
          </Modal.Footer>
        </form>
      </Modal.Content>
    </Modal.Root>
  );
}
