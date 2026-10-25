import { CaseStatusBadge } from './CaseStatusBadge';
import { formatDate } from '../../utils/helpers';
import type { CaseEventResponse } from '../../types/case';
import { cn } from '../../utils/helpers';

const eventIcons: Record<string, React.ReactNode> = {
  created: <span className="bg-blue-100 text-blue-600">+</span>,
  step_completed: <span className="bg-green-100 text-green-600">✓</span>,
  submitted: <span className="bg-blue-100 text-blue-600">→</span>,
  scrutiny_started: <span className="bg-yellow-100 text-yellow-600">🔍</span>,
  clarification_requested: <span className="bg-orange-100 text-orange-600">?</span>,
  clarification_responded: <span className="bg-blue-100 text-blue-600">↩</span>,
  clearance_started: <span className="bg-purple-100 text-purple-600">✓</span>,
  clearance_completed: <span className="bg-green-100 text-green-600">✓✓</span>,
  release_requested: <span className="bg-indigo-100 text-indigo-600">📤</span>,
  released: <span className="bg-green-100 text-green-600">✓</span>,
  rejected: <span className="bg-red-100 text-red-600">✗</span>,
};

const eventLabels: Record<string, string> = {
  created: 'Case Created',
  step_completed: 'Step Completed',
  submitted: 'Submitted for Review',
  scrutiny_started: 'Scrutiny Started',
  clarification_requested: 'Clarification Requested',
  clarification_responded: 'Clarification Responded',
  clearance_started: 'Clearance Started',
  clearance_completed: 'Clearance Completed',
  release_requested: 'Release Requested',
  released: 'Funds Released',
  rejected: 'Case Rejected',
};

interface TimelineProps {
  events: CaseEventResponse[];
  className?: string;
}

export function Timeline({ events, className }: TimelineProps) {
  if (!events.length) {
    return <div className={cn('text-center py-8 text-gray-500', className)}>No timeline events</div>;
  }

  const sortedEvents = [...events].sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <div className={cn('timeline', className)}>
      <div className="relative">
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200" />
        {sortedEvents.map((event, index) => (
          <div key={event.id || index} className="relative pb-8 last:pb-0">
            <div className="flex gap-4">
              <div className="relative flex-shrink-0 w-12 h-12">
                <div className={cn(
                  'absolute left-6 top-0 w-2 h-2 rounded-full border-4 flex items-center justify-center',
                  'bg-white border-gray-200 z-10'
                )}>
                  {eventIcons[event.event_type] || (
                    <span className="bg-gray-100 text-gray-600 text-xs">•</span>
                  )}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-medium text-gray-900">{eventLabels[event.event_type] || event.event_type}</h4>
                      {event.new_status && <CaseStatusBadge status={event.new_status as import('../../types/case').CaseStatus} className="mt-1 inline-block" />}
                    </div>
                    <span className="text-sm text-gray-500 whitespace-nowrap">
                      {formatDate(event.created_at, 'full')}
                    </span>
                  </div>
                  {event.actor && (
                    <p className="mt-1 text-sm text-gray-600">
                      By: <span className="font-medium">{event.actor.full_name}</span>
                      <span className="text-gray-500"> ({event.actor.role})</span>
                    </p>
                  )}
                  {event.details && Object.keys(event.details).length > 0 && (
                    <details className="mt-2">
                      <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                        View details
                      </summary>
                      <pre className="mt-2 text-xs bg-gray-50 p-2 rounded overflow-auto">
                        {JSON.stringify(event.details, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
