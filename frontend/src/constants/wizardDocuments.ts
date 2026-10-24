// Document type definitions for wizard steps
// Based on backend rules.yaml and deposit type requirements

export interface DocumentTypeDef {
  type: string;
  label: string;
  description: string;
  required: boolean;
  conditional?: string;
  accept?: string;
  maxSizeMB?: number;
}

export interface DepositDocumentConfig {
  depositType: string;
  depositMethod?: string;
  mandatory: DocumentTypeDef[];
  conditional: DocumentTypeDef[];
}

// Document type definitions by deposit type and method
export const WIZARD_DOCUMENT_CONFIGS: DepositDocumentConfig[] = [
  {
    depositType: 'fdr',
    depositMethod: 'fdr_rpgf',
    mandatory: [
      { type: 'fdr_original', label: 'Original FDR Document', description: 'Original FDR certificate or bank-issued duplicate', required: true, accept: '.pdf,.jpg,.jpeg,.png', maxSizeMB: 10 },
      { type: 'payment_proof', label: 'Payment Proof', description: 'Original deposit payment proof', required: true, accept: '.pdf,.jpg,.jpeg,.png', maxSizeMB: 5 },
      { type: 'loa_eoa', label: 'Latest LoA/EoA', description: 'Current AICTE Letter of Approval or Extension of Approval', required: true, accept: '.pdf', maxSizeMB: 5 },
    ],
    conditional: [
      { type: 'pan_card', label: 'PAN Card', description: 'PAN card of authorized signatory', required: false, conditional: 'If amount >= 50,000 INR', accept: '.pdf,.jpg,.jpeg,.png', maxSizeMB: 2 },
    ],
  },
  {
    depositType: 'rpgf',
    depositMethod: 'fdr_rpgf',
    mandatory: [
      { type: 'fdr_original', label: 'FDR/RPGF Evidence', description: 'FDR certificate or RPGF corpus-fund evidence', required: true, accept: '.pdf,.jpg,.jpeg,.png', maxSizeMB: 10 },
      { type: 'payment_proof', label: 'Payment Proof', description: 'RPGF payment or online-payment proof', required: true, accept: '.pdf', maxSizeMB: 10 },
      { type: 'loa_eoa', label: 'Latest LoA/EoA', description: 'Current AICTE Letter of Approval or Extension of Approval', required: true, accept: '.pdf', maxSizeMB: 5 },
    ],
    conditional: [
      { type: 'financial_statement', label: 'Audited Financial Statement', description: 'Latest audited financial statements', required: false, conditional: 'If amount >= 1 Crore INR', accept: '.pdf', maxSizeMB: 20 },
    ],
  },
  {
    depositType: 'security_deposit',
    depositMethod: 'security_deposit_refund',
    mandatory: [
      { type: 'verification_certificate', label: 'Term Completion Verification', description: 'Verification that the security-deposit term is complete', required: true, accept: '.pdf', maxSizeMB: 10 },
      { type: 'no_dues_certificate', label: 'No Dues Certificate', description: 'Certificate confirming no outstanding dues', required: true, accept: '.pdf', maxSizeMB: 5 },
      { type: 'loa_eoa', label: 'Latest LoA/EoA', description: 'Current AICTE Letter of Approval or Extension of Approval', required: true, accept: '.pdf,.jpg,.jpeg,.png', maxSizeMB: 5 },
    ],
    conditional: [
      { type: 'no_dues_certificate', label: 'No Dues Certificate', description: 'Certificate from department confirming no outstanding dues', required: false, conditional: 'Required for government contracts', accept: '.pdf', maxSizeMB: 5 },
      { type: 'performance_bank_guarantee', label: 'Performance Bank Guarantee', description: 'PBG submitted during contract', required: false, conditional: 'If PBG was submitted instead of cash deposit', accept: '.pdf', maxSizeMB: 10 },
    ],
  },
  {
    depositType: 'bank_guarantee',
    depositMethod: 'rtgs',
    mandatory: [
      { type: 'bank_guarantee_original', label: 'Original Bank Guarantee', description: 'Original bank guarantee document', required: true, accept: '.pdf', maxSizeMB: 10 },
      { type: 'rtgs_confirmation', label: 'RTGS Confirmation', description: 'RTGS transaction confirmation receipt', required: true, accept: '.pdf,.jpg,.jpeg,.png', maxSizeMB: 5 },
      { type: 'board_resolution', label: 'Board Resolution', description: 'Board resolution authorizing bank guarantee', required: true, accept: '.pdf', maxSizeMB: 5 },
    ],
    conditional: [
      { type: 'counter_guarantee', label: 'Counter Guarantee', description: 'Counter guarantee from applicant', required: false, conditional: 'If required by issuing bank', accept: '.pdf', maxSizeMB: 10 },
    ],
  },
];

// Helper function to get document config for a deposit type/method
export function getDocumentConfig(depositType: string, depositMethod?: string): DepositDocumentConfig | undefined {
  return WIZARD_DOCUMENT_CONFIGS.find(
    (config) => config.depositType === depositType && (!depositMethod || config.depositMethod === depositMethod)
  );
}

// Get all unique document types across all configs
export function getAllDocumentTypes(): DocumentTypeDef[] {
  const seen = new Set<string>();
  const all: DocumentTypeDef[] = [];
  
  for (const config of WIZARD_DOCUMENT_CONFIGS) {
    for (const doc of [...config.mandatory, ...config.conditional]) {
      if (!seen.has(doc.type)) {
        seen.add(doc.type);
        all.push(doc);
      }
    }
  }
  return all;
}

// Document type labels for display
export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  fdr_certificate: 'FDR Certificate',
  bank_confirmation: 'Bank Confirmation Letter',
  board_resolution: 'Board Resolution',
  pan_card: 'PAN Card',
  rpgf_certificate: 'RPGF Certificate',
  bank_guarantee: 'Bank Guarantee',
  financial_statement: 'Audited Financial Statement',
  security_deposit_agreement: 'Security Deposit Agreement',
  refund_request: 'Refund Request Letter',
  completion_certificate: 'Work Completion Certificate',
  no_dues_certificate: 'No Dues Certificate',
  performance_bank_guarantee: 'Performance Bank Guarantee',
  bank_guarantee_original: 'Original Bank Guarantee',
  rtgs_confirmation: 'RTGS Confirmation',
  counter_guarantee: 'Counter Guarantee',
};
