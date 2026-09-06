import { useEffect, useState } from 'react';
import { WeeklyScheduleDay } from '../types';
import { X, Tv, RefreshCw, AlertCircle } from 'lucide-react';

interface WeeklyScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function formatDayLabel(dateKey: string): string {
  const d = new Date(`${dateKey}T00:00:00`);
  return d.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Jerusalem',
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jerusalem',
  });
}

export function WeeklyScheduleModal({ isOpen, onClose }: WeeklyScheduleModalProps) {
  const [days, setDays] = useState<WeeklyScheduleDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeDayIdx, setActiveDayIdx] = useState(0);

  const load = (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    fetch(`/api/schedule/weekly${forceRefresh ? '?refresh=true' : ''}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.days) {
          setDays(data.days);
          setActiveDayIdx(0);
        } else {
          setError('No schedule data returned');
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError('Could not load the weekly schedule right now');
        setLoading(false);
      });
  };

  useEffect(() => {
    if (!isOpen) return;
    load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const activeDay = days[activeDayIdx];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-[#1E293B] border border-slate-700 rounded-2xl shadow-2xl overflow-hidden my-8 max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-700 bg-slate-900/90">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
                <Tv className="w-4 h-4" />
              </div>
              <h2 className="text-lg font-bold text-white">Full Weekly TV Schedule</h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Live from Yes's broadcast schedule — every tracked sport channel, next 7 days
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => load(true)}
              title="Refresh"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Day tabs */}
        {days.length > 0 && (
          <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-700 bg-slate-900/40 overflow-x-auto">
            {days.map((day, idx) => (
              <button
                key={day.dateKey}
                onClick={() => setActiveDayIdx(idx)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                  idx === activeDayIdx
                    ? 'bg-blue-600 text-white shadow'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700'
                }`}
              >
                {formatDayLabel(day.dateKey)}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {loading ? (
            <div className="text-center py-10 text-slate-400 text-sm">Loading weekly schedule...</div>
          ) : error ? (
            <div className="flex flex-col items-center gap-2 py-10 text-slate-400 text-sm">
              <AlertCircle className="w-6 h-6 text-amber-400" />
              <span>{error}</span>
            </div>
          ) : !activeDay || activeDay.channels.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-sm">
              No listings found for this day yet.
            </div>
          ) : (
            <div className="space-y-4">
              {activeDay.channels.map((channel) => (
                <div
                  key={channel.channelId}
                  className="p-4 rounded-xl bg-slate-900/90 border border-slate-700 shadow-md"
                >
                  <h3 className="text-sm font-bold text-slate-200 mb-2">{channel.title}</h3>
                  <div className="space-y-1.5">
                    {channel.items.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-3 text-xs py-1 border-b border-slate-800 last:border-0"
                      >
                        <span className="font-mono text-slate-400 w-12 shrink-0">
                          {formatTime(item.startsUtc)}
                        </span>
                        <span className="text-slate-200">{item.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700 bg-slate-900/90 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
