import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { Plus, Trash2, Loader2 } from 'lucide-react';

interface ClarificationItem {
  document_type: string;
  reason: string;
  details?: string;
}

interface ClarificationRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (items: ClarificationItem[]) => void;
}

const DOCUMENT_TYPES = [
  'fdr_certificate',
  'bank_confirmation',
  'board_resolution',
  'kyc_documents',
  'financial_statements',
  'sanction_letter',
  'insurance_policy',
  'other',
];

export function ClarificationRequestModal({
  isOpen,
  onClose,
  onSubmit,
}: ClarificationRequestModalProps) {
  const [items, setItems] = useState<ClarificationItem[]>([{ document_type: '', reason: '', details: '' }]);
  const [loading, setLoading] = useState(false);

  const addItem = () => {
    setItems([...items, { document_type: '', reason: '', details: '' }]);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof ClarificationItem, value: string) => {
    setItems(items.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validItems = items.filter((item) => item.document_type && item.reason);
    if (validItems.length === 0) {
      alert('At least one clarification item with document type and reason is required');
      return;
    }
    setLoading(true);
    try {
      await onSubmit(validItems);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal.Root open={isOpen} onOpenChange={onClose}>
      <Modal.Content className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <Modal.Header>
          <Modal.Title>Request Clarification</Modal.Title>
          <Modal.Description>
            Add clarification items for documents that need additional information from the institution.
          </Modal.Description>
        </Modal.Header>
        <form onSubmit={handleSubmit}>
          <Modal.Body className="space-y-4">
            <div className="space-y-4">
              {items.map((item, index) => (
                <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="flex items-start justify-between mb-3">
                    <h4 className="font-medium text-gray-900">Clarification Item {index + 1}</h4>
                    {items.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select
                      label="Document Type"
                      value={item.document_type}
                      onChange={(e) => updateItem(index, 'document_type', e.target.value)}
                      options={DOCUMENT_TYPES.map((t) => ({ value: t, label: t.replace(/_/g, ' ') }))}
                      placeholder="Select document type"
                      required
                    />
                    <Input
                      label="Reason"
                      value={item.reason}
                      onChange={(e) => updateItem(index, 'reason', e.target.value)}
                      placeholder="Why is clarification needed?"
                      required
                    />
                  </div>
                  <Textarea
                    label="Details (optional)"
                    value={item.details}
                    onChange={(e) => updateItem(index, 'details', e.target.value)}
                    placeholder="Additional details about what information is needed"
                    rows={2}
                  />
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={addItem}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Another Item
            </Button>
          </Modal.Body>
          <Modal.Footer>
            <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Request Clarification'}
            </Button>
          </Modal.Footer>
        </form>
      </Modal.Content>
    </Modal.Root>
  );
}
