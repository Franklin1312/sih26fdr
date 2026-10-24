import { useState } from 'react';
import { MessageSquare, ChevronUp, User, Send, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { Textarea } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { formatDate } from '../../utils/helpers';
import type { ClarificationRequestResponse } from '../../types/case';

interface ClarificationThreadProps {
  clarifications: ClarificationRequestResponse[];
  onRespond?: (clarificationId: string, response: string) => void;
  currentUserRole: 'institution_rep' | 'scrutiny_officer' | 'clearance_officer' | 'competent_authority';
  caseId: string;
}

const roleLabels: Record<string, string> = {
  institution_rep: 'Institution',
  scrutiny_officer: 'Scrutiny Officer',
  clearance_officer: 'Clearance Officer',
  competent_authority: 'Authority',
};

export function ClarificationThread({ clarifications, onRespond, currentUserRole, caseId }: ClarificationThreadProps) {
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [responseText, setResponseText] = useState('');

  if (!clarifications.length) {
    return (
      <div className="text-center py-8 text-gray-500">
        <MessageSquare className="h-12 w-12 mx-auto text-gray-300 mb-2" />
        <p>No clarifications for this case</p>
      </div>
    );
  }

  const handleSubmitResponse = (clarificationId: string) => {
    if (responseText.trim() && onRespond) {
      onRespond(clarificationId, responseText.trim());
      setResponseText('');
      setRespondingTo(null);
    }
  };

  return (
    <div className="space-y-4" data-case-id={caseId}>
      {clarifications.map((clarification) => (
        <div key={clarification.id} className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              <span className="font-medium text-gray-900">Clarification Requested</span>
              <Badge variant="outline" className="text-xs capitalize">{clarification.status}</Badge>
            </div>
            <span className="text-sm text-gray-500">{formatDate(clarification.created_at, 'full')}</span>
          </div>

          <div className="p-4 space-y-3">
            {clarification.items.map((item) => <div key={item.id} className="space-y-3">
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
                <User className="h-4 w-4 text-orange-600" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium text-gray-900">{roleLabels.institution_rep}</span>
                  <span className="text-gray-500">{formatDate(clarification.created_at)}</span>
                </div>
                <p className="text-gray-700">{item.reason}</p>
              </div>
            </div>

            {item.response && (
              <div className="flex gap-3 ml-11 border-l-2 border-green-200 pl-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium text-gray-900">Response</span>
                    <Badge variant="success" className="text-xs">Responded</Badge>
                    {item.responded_at && <span className="text-gray-500">{formatDate(item.responded_at)}</span>}
                  </div>
                  <p className="text-gray-700 bg-green-50 p-3 rounded">{item.response}</p>
                </div>
              </div>
            )}

            {!item.response &&
              (currentUserRole === 'institution_rep' || currentUserRole === 'scrutiny_officer') &&
              (
              <div className="ml-11 pt-3 border-t border-gray-200">
                {respondingTo === clarification.id ? (
                  <div className="flex gap-2">
                    <Textarea
                      value={responseText}
                      onChange={(e) => setResponseText(e.target.value)}
                      placeholder="Type your response..."
                      className="flex-1 min-h-[80px]"
                      rows={3}
                    />
                    <div className="flex flex-col gap-1">
                      <Button size="sm" onClick={() => handleSubmitResponse(clarification.id)} disabled={!responseText.trim()}>
                        <Send className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setRespondingTo(null)}>
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setRespondingTo(clarification.id)}
                    className="gap-1"
                  >
                    <MessageSquare className="h-4 w-4" />
                    Respond
                  </Button>
                )}
              </div>
            )}
            </div>)}
          </div>
        </div>
      ))}
    </div>
  );
}
