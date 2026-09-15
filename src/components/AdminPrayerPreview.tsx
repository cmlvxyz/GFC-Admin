import React, { useState } from 'react';
import type { PrayerRequest } from '../types';
import { Heart, Send, CheckCircle2, ShieldCheck, MessageSquare, Users } from 'lucide-react';
import { AdminPreviewHero, ManagePill } from './AdminPreviewHero';

interface AdminPrayerPreviewProps {
  prayers: PrayerRequest[];
  onCreate: (prayer: PrayerRequest) => void;
  onNavigate: (page: string) => void;
}

export const AdminPrayerPreview: React.FC<AdminPrayerPreviewProps> = ({ prayers, onCreate, onNavigate }) => {
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [category, setCategory] = useState('Health & Healing');
  const [request, setRequest] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!request.trim()) return;

    const newP: PrayerRequest = {
      id: Date.now().toString(),
      name: isAnonymous || !name.trim() ? 'Anonymous / A Brother or Sister' : name,
      contact: contact || undefined,
      request,
      createdAt: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      status: 'approved',
      category
    };

    onCreate(newP);
    setIsSubmitted(true);
    setName('');
    setContact('');
    setRequest('');
    setIsAnonymous(false);
  };

  return (
    <>
      <ManagePill label="Prayers" onManage={() => onNavigate('prayersManage')} />

      <AdminPreviewHero
        eyebrow="Prayer Request"
        title={<>Cast your cares on <span className="italic text-indigo-400">Him.</span></>}
        subtitle="Our prayer team is ready to pray with you. No request is too small or too big for our Lord."
      />

      <section id="prayerSection" className="py-20 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto space-y-12">
        {/* ============ HEADER ============ */}
        <div className="text-center space-y-4">
          <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.35em] text-indigo-600">
            <Heart className="w-4 h-4 fill-current" />
            Prayer Request
          </span>
          <h2 className="text-4xl sm:text-5xl font-serif text-[#0f172a] tracking-tight leading-tight">
            Do You Have a Prayer Request?
          </h2>
          <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto leading-relaxed">
            The Gospel Fellowship Church Prayer Team is ready to pray with you. No request
            is too small or too big for our Lord.
          </p>
        </div>

        {/* ============ FORM ============ */}
        <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200 shadow-[0_20px_60px_-20px_rgba(15,23,42,0.12)] space-y-6">
          {isSubmitted ? (
            <div className="text-center py-8 space-y-4 animate-fadeIn">
              <div className="w-16 h-16 bg-[#0f172a] text-indigo-400 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <h3 className="text-2xl font-serif text-[#0f172a]">
                Your Prayer Request Has Been Recorded!
              </h3>

              <p className="text-sm sm:text-base text-slate-600 max-w-md mx-auto">
                Thank you! Your request has been added to the Prayer Wall and the entire
                pastorate and prayer team will pray for you.
              </p>

              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 text-sm italic text-slate-700 max-w-lg mx-auto">
                "Do not be anxious about anything, but in every situation, by prayer and
                petition, with thanksgiving, present your requests to God."
                <span className="block font-bold not-italic mt-2 text-right text-indigo-600">
                  — Philippians 4:6
                </span>
              </div>

              <button
                onClick={() => setIsSubmitted(false)}
                className="px-7 py-3 bg-[#0f172a] hover:bg-[#1e293b] text-white font-bold text-sm rounded-xl transition-all"
              >
                Submit Another Prayer
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-7">
              <div className="flex items-start gap-3 text-sm text-slate-600 border border-slate-200 bg-slate-50/70 p-4 rounded-2xl">
                <ShieldCheck className="w-5 h-5 text-indigo-500 flex-shrink-0 mt-0.5" />
                <span>
                  <strong className="text-[#0f172a]">Safe & Easy to Use:</strong> You can
                  provide your name or choose to remain confidential / anonymous.
                </span>
              </div>

              {/* Category Selector */}
              <div>
                <label className="block text-xs uppercase tracking-wider font-bold text-slate-700 mb-3">
                  Select Prayer Category
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    'Health & Healing',
                    'Family & Home',
                    'Financial & Work',
                    'Protection & Guidance',
                    'Spiritual Growth',
                    'Thanksgiving & Praise'
                  ].map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategory(cat)}
                      className={`p-3 rounded-xl text-xs font-bold border transition-all text-left flex items-center justify-between min-h-[44px] ${
                        category === cat
                          ? 'bg-[#0f172a] text-white border-[#0f172a] shadow-lg'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300'
                      }`}
                    >
                      <span>{cat}</span>
                      {category === cat && <span>✓</span>}
                    </button>
                  ))}
                </div>
              </div>

              {/* Prayer Details Textarea */}
              <div>
                <label className="block text-xs uppercase tracking-wider font-bold text-slate-700 mb-2">
                  Write Your Prayer Request Here *
                </label>
                <textarea
                  rows={4}
                  required
                  value={request}
                  onChange={e => setRequest(e.target.value)}
                  placeholder="Example: Please pray for the health of my mother and for peace in our home..."
                  className="w-full p-4 rounded-xl border border-slate-200 bg-white text-sm sm:text-base text-[#0f172a] placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 focus:outline-none"
                />
              </div>

              {/* Name & Contact */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase tracking-wider font-bold text-slate-700 mb-1">
                    Name (Optional)
                  </label>
                  <input
                    type="text"
                    disabled={isAnonymous}
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Your Name"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm text-[#0f172a] placeholder:text-slate-400 disabled:opacity-30 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider font-bold text-slate-700 mb-1">
                    Contact No. / Facebook (Optional)
                  </label>
                  <input
                    type="text"
                    disabled={isAnonymous}
                    value={contact}
                    onChange={e => setContact(e.target.value)}
                    placeholder="e.g. 0912-345-6789"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm text-[#0f172a] placeholder:text-slate-400 disabled:opacity-30 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 focus:outline-none"
                  />
                </div>
              </div>

              {/* Anonymous Switch */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="anonymousCheck"
                  checked={isAnonymous}
                  onChange={e => setIsAnonymous(e.target.checked)}
                  className="w-5 h-5 accent-indigo-500 rounded cursor-pointer"
                />
                <label htmlFor="anonymousCheck" className="text-xs sm:text-sm font-semibold text-slate-600 cursor-pointer">
                  I prefer to remain Anonymous (Hide my name)
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="w-full py-4 bg-[#0f172a] hover:bg-[#1e293b] text-white font-bold uppercase tracking-widest text-xs sm:text-sm rounded-xl shadow-lg transition-all transform active:scale-[0.98] flex items-center justify-center gap-2 min-h-[52px]"
              >
                <Send className="w-5 h-5" />
                <span>Submit Prayer Request</span>
              </button>
            </form>
          )}
        </div>

        {/* ============ COMMUNITY PRAYER WALL ============ */}
        <div className="space-y-8 pt-2">
          <div className="text-center space-y-2">
            <h3 className="text-2xl sm:text-3xl font-serif text-[#0f172a] flex items-center justify-center gap-2">
              <Users className="w-6 h-6 text-indigo-500" />
              Community Prayer Wall
            </h3>
            <p className="text-sm text-slate-600">
              Let us also pray for the requests of our brothers and sisters in faith.
            </p>
          </div>

          {prayers.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-slate-200">
              <MessageSquare className="w-8 h-8 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500">No prayer requests yet. Be the first to lift one up.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {prayers.map(p => (
                <div
                  key={p.id}
                  className="bg-white p-6 rounded-2xl border border-slate-200 hover:border-indigo-300 transition-colors duration-300 space-y-4 flex flex-col justify-between"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="inline-flex items-center gap-1.5 font-bold text-indigo-600">
                        <Heart className="w-3.5 h-3.5 fill-current" />
                        {p.category || 'Prayer'}
                      </span>
                      <span className="text-slate-400">{p.createdAt}</span>
                    </div>
                    <p className="text-sm text-slate-800 italic font-medium leading-relaxed">
                      "{p.request}"
                    </p>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-600">— {p.name}</span>
                    <span className="text-emerald-600 font-semibold flex items-center gap-1">
                      ✓ Being Prayed For
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
};