import { useState, useEffect } from 'react';
import { BroadcastChannelGuide } from '../types';
import { X, Tv, Radio, Shield, ExternalLink, Info, CheckCircle2 } from 'lucide-react';

interface IsraeliChannelsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function IsraeliChannelsModal({ isOpen, onClose }: IsraeliChannelsModalProps) {
  const [channels, setChannels] = useState<BroadcastChannelGuide[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeGroup, setActiveGroup] = useState<string>('all');

  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/channels')
      .then((res) => res.json())
      .then((data) => {
        if (data.channels) setChannels(data.channels);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [isOpen]);

  if (!isOpen) return null;

  const groups = ['all', 'Sport 5', 'Charlton (Sport 1-4)', 'ONE', 'Public (Kan 11)', 'EuroSport'];
  const filteredChannels = activeGroup === 'all' 
    ? channels 
    : channels.filter(c => c.group === activeGroup);

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
              <h2 className="text-lg font-bold text-white">
                מדריך ערוצי הספורט בישראל (Israeli Sports TV Guide)
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Full breakdown of broadcasting rights, channel numbers across HOT, YES, Partner, Cellcom, and streaming platforms
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Group Filter Tabs */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-700 bg-slate-900/40 overflow-x-auto">
          {groups.map((grp) => (
            <button
              key={grp}
              onClick={() => setActiveGroup(grp)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                activeGroup === grp
                  ? 'bg-blue-600 text-white shadow'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700'
              }`}
            >
              {grp === 'all' ? 'כל הערוצים (All Channels)' : grp}
            </button>
          ))}
        </div>

        {/* Channels Grid */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {loading ? (
            <div className="text-center py-10 text-slate-400 text-sm">
              Loading broadcast directory...
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredChannels.map((ch) => (
                <div
                  key={ch.id}
                  className="p-4 rounded-xl bg-slate-900/90 border border-slate-700 shadow-md flex flex-col justify-between"
                >
                  <div>
                    {/* Channel Header */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="px-2.5 py-1 rounded-md text-xs font-black text-white shadow"
                          style={{ backgroundColor: ch.color }}
                        >
                          {ch.name}
                        </span>
                        <div>
                          <h3 className="text-sm font-bold text-slate-200">
                            {ch.hebrewName}
                          </h3>
                          <span className="text-[11px] text-slate-400 font-medium">
                            {ch.group}
                          </span>
                        </div>
                      </div>

                      {ch.freeToAir ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          פתוח בחינם
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
                          ערוץ פרימיום
                        </span>
                      )}
                    </div>

                    {/* Channel Numbers Matrix */}
                    <div className="grid grid-cols-4 gap-1.5 p-2 rounded-lg bg-slate-950 border border-slate-700/80 text-center my-3 text-xs">
                      <div>
                        <div className="text-[10px] text-slate-400 uppercase font-semibold">HOT</div>
                        <div className="font-bold text-slate-100">{ch.hotNumber}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400 uppercase font-semibold">YES</div>
                        <div className="font-bold text-slate-100">{ch.yesNumber}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400 uppercase font-semibold">Partner</div>
                        <div className="font-bold text-slate-100">{ch.partnerNumber}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400 uppercase font-semibold">Cellcom</div>
                        <div className="font-bold text-slate-100">{ch.cellcomNumber}</div>
                      </div>
                    </div>

                    {/* Broadcast Rights & Competitions */}
                    <div className="mt-2">
                      <div className="text-[11px] font-semibold text-slate-400 mb-1.5">
                        מפעלים וזכויות שידור (Competitions):
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {ch.competitions.map((comp, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-slate-800 border border-slate-700 text-slate-200"
                          >
                            <CheckCircle2 className="w-3 h-3 text-blue-400 shrink-0" />
                            <span>{comp}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Quick Summary of Broadcasting Rights in Israel */}
          <div className="mt-4 p-4 rounded-xl bg-slate-900/90 border border-slate-700 text-xs text-slate-300 space-y-2">
            <h4 className="font-bold text-slate-200 flex items-center gap-1.5">
              <Info className="w-4 h-4 text-blue-400" />
              <span>כללי זכויות השידור המרכזיים בישראל:</span>
            </h4>
            <ul className="list-disc list-inside space-y-1 text-slate-400">
              <li><strong>ליגת ה-NBA ויורוליג בכדורסל:</strong> משודרים בלעדית בערוצי ספורט 5 (5SPORT, 5STARS, 5LIVE).</li>
              <li><strong>ליגת העל האנגלית (פרמייר ליג) והבונדסליגה הגרמנית:</strong> משודרות בצ'רלטון (ספורט 1 עד ספורט 4).</li>
              <li><strong>ליגת האלופות (UEFA Champions League):</strong> ערוץ הספורט (5SPORT, 5STARS ו-5SPORT 4K).</li>
              <li><strong>הליגה הספרדית (La Liga) והאיטלקית (Serie A):</strong> ערוץ ONE וערוץ ONE2 (אפיקים 50 ו-66).</li>
              <li><strong>נבחרת ישראל ומשחקים לאומיים:</strong> שידור ציבורי פתוח בחינם בכאן 11.</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700 bg-slate-900/90 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition cursor-pointer"
          >
            סגור מדריך (Close)
          </button>
        </div>

      </div>
    </div>
  );
}
