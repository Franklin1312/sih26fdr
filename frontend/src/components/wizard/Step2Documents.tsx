import { useMemo, useState } from 'react';
import { Upload, FileText } from 'lucide-react';
import { Button } from '../ui/Button';
import { getDocumentConfig } from '../../constants/wizardDocuments';
import { casesApi } from '../../api/cases';
import type { WizardStep2Request } from '../../types/wizard';

interface Step2DocumentsProps {
  caseId?: string | null;
  depositType: string;
  depositMethod?: string;
  initialDocuments?: WizardStep2Request['documents'];
  onSubmit: (data: WizardStep2Request) => Promise<void>;
  isLoading?: boolean;
}

export function Step2Documents({ caseId, depositType, depositMethod, initialDocuments = [], onSubmit, isLoading = false }: Step2DocumentsProps) {
  const config = useMemo(() => getDocumentConfig(depositType, depositMethod), [depositType, depositMethod]);
  const documentTypes = [...(config?.mandatory ?? []), ...(config?.conditional ?? [])];
  const [files, setFiles] = useState<Record<string, File>>({});
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const missing = (config?.mandatory ?? []).filter((item) => !files[item.type] && !initialDocuments.some((doc) => doc.document_type === item.type));
    if (missing.length) {
      setError(`Upload the required documents: ${missing.map((item) => item.label).join(', ')}.`);
      return;
    }
    if (Object.keys(files).length && !caseId) {
      setError('A case must be created before documents can be uploaded.');
      return;
    }
    setError(null);
    try {
      for (const [documentType, file] of Object.entries(files)) {
        await casesApi.uploadDocument(caseId!, file, documentType);
      }
      const documents = documentTypes
        .filter((item) => files[item.type] || initialDocuments.some((doc) => doc.document_type === item.type))
        .map((item) => ({ document_type: item.type, description: files[item.type]?.name }));
      await onSubmit({ documents });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to upload documents. Please try again.');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Upload supporting documents</h2>
        <p className="mt-1 text-sm text-gray-600">Add the required documents for this deposit type. PDF and image files are supported.</p>
      </div>
      {!config && <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">Select a deposit type to see its document requirements.</p>}
      <div className="space-y-4">
        {documentTypes.map((item) => (
          <label key={item.type} className="block rounded-lg border border-gray-200 p-4">
            <span className="flex items-center gap-2 font-medium text-gray-900"><FileText className="h-4 w-4" />{item.label}{item.required && <span className="text-red-600">*</span>}</span>
            <span className="mt-1 block text-sm text-gray-600">{item.description}{item.conditional ? ` · ${item.conditional}` : ''}</span>
            <input
              type="file"
              accept={item.accept}
              className="mt-3 block w-full text-sm text-gray-700"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) setFiles((current) => ({ ...current, [item.type]: file }));
              }}
            />
            {files[item.type] && <span className="mt-2 block text-sm text-green-700">Selected: {files[item.type].name}</span>}
            {!files[item.type] && initialDocuments.some((doc) => doc.document_type === item.type) && <span className="mt-2 block text-sm text-green-700">Previously added</span>}
          </label>
        ))}
      </div>
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      <div className="flex justify-end">
        <Button onClick={submit} isLoading={isLoading} disabled={!config || isLoading} className="gap-2"><Upload className="h-4 w-4" />Save and continue</Button>
      </div>
    </div>
  );
}
