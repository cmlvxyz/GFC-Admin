import React, { useState } from 'react';
import type { Attendee } from '../types';
import { MapPin, Phone, Mail, Facebook, UserCheck, Send, ExternalLink, CheckCircle2 } from 'lucide-react';
import { AdminPreviewHero, ManagePill } from './AdminPreviewHero';

interface AdminContactPreviewProps {
  onCreate: (attendee: Attendee) => void;
  onNavigate: (page: string) => void;
}

export const AdminContactPreview: React.FC<AdminContactPreviewProps> = ({ onCreate, onNavigate }) => {
  const [name, setName] = useState('');
  const [facebookName, setFacebookName] = useState('');
  const [contact, setContact] = useState('');
  const [age, setAge] = useState('');
  const [registered, setRegistered] = useState(false);

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newAtt: Attendee = {
      id: Date.now().toString(),
      name,
      facebookName: facebookName || undefined,
      contact: contact || undefined,
      age: age || undefined,
      registeredAt: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    };

    onCreate(newAtt);
    setRegistered(true);
    setName('');
    setFacebookName('');
    setContact('');
    setAge('');
  };

  const infoRows = [
    {
      icon: <MapPin className="w-5 h-5" />,
      label: 'Address',
      value: '008 National Road SF. 2 Purok 1, Limay, Bataan'
    },
    {
      icon: <Phone className="w-5 h-5" />,
      label: 'Phone / Hotline',
      value: '123-456-7890 / 0912-345-6789'
    },
    {
      icon: <Mail className="w-5 h-5" />,
      label: 'Email Address',
      value: 'gospelfellowshipchurch0923@gmail.com'
    }
  ];

  return (
    <>
      <ManagePill label="Contact" onManage={() => onNavigate('contactManage')} />

      <AdminPreviewHero
        eyebrow="Contact & Location"
        title={<>We'd love to <span className="italic text-indigo-400">welcome you.</span></>}
        subtitle="Reach out, get directions, or register your family for the next Sunday service."
      />

      <section id="contactSection" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-14">
        {/* ============ HEADER ============ */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <span className="text-[11px] font-bold uppercase tracking-[0.35em] text-indigo-600">
            Contact & Location
          </span>
          <h2 className="text-4xl sm:text-5xl font-serif text-[#0f172a] tracking-tight leading-tight">
            Visit Us in Limay, Bataan
          </h2>
          <p className="text-sm sm:text-base text-slate-600">
            We are ready to welcome you and your whole family to our next gathering.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* ============ CHURCH INFO + MAP ============ */}
          <div className="bg-white rounded-3xl p-6 sm:p-9 border border-slate-200 shadow-[0_20px_60px_-20px_rgba(15,23,42,0.12)] space-y-7 flex flex-col">
            <h3 className="text-2xl font-serif text-[#0f172a]">Church Information</h3>

            <div className="divide-y divide-slate-100">
              {infoRows.map(row => (
                <div key={row.label} className="flex items-start gap-4 py-4">
                  <div className="w-10 h-10 rounded-xl bg-[#0f172a] text-indigo-400 flex items-center justify-center flex-shrink-0">
                    {row.icon}
                  </div>
                  <div>
                    <div className="font-bold text-[#0f172a] uppercase tracking-wider text-[11px]">
                      {row.label}
                    </div>
                    <div className="text-sm text-slate-600 mt-0.5 leading-relaxed">{row.value}</div>
                  </div>
                </div>
              ))}
              <div className="flex items-start gap-4 py-4">
                <div className="w-10 h-10 rounded-xl bg-[#0f172a] text-indigo-400 flex items-center justify-center flex-shrink-0">
                  <Facebook className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-[#0f172a] uppercase tracking-wider text-[11px]">
                    Official Facebook Page
                  </div>
                  <a
                    href="https://www.facebook.com/profile.php?id=61590579395623"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-indigo-600 hover:underline font-semibold flex items-center gap-1 mt-0.5"
                  >
                    <span>Gospel Fellowship Church Facebook</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </div>

            {/* Street View */}
            <div className="mt-auto rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 h-52 sm:h-60 relative flex items-center justify-center">
              <iframe
                title="The GOSPEL FELLOWSHIP CHURCH - Limay, Bataan"
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3853.97!2d120.5938904!3d14.5704469!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x33963c3c526760cd%3A0x94fbb15c37673676!2sThe%20GOSPEL%20FELLOWSHIP%20CHURCH!5e0!3m2!1sen!2sph!4v1700000000000!5m2!1sen!2sph"
                className="w-full h-full border-0"
                loading="lazy"
                allowFullScreen
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>

          {/* ============ ATTENDANCE REGISTRATION ============ */}
          <div className="bg-white rounded-3xl p-6 sm:p-9 border border-slate-200 shadow-[0_20px_60px_-20px_rgba(15,23,42,0.12)] space-y-5">
            <div className="space-y-2">
              <span className="inline-flex items-center gap-2 text-[11px] font-bold text-indigo-600 uppercase tracking-widest">
                <UserCheck className="w-4 h-4" />
                Sunday Service Registration
              </span>
              <h3 className="text-2xl font-serif text-[#0f172a]">Register Your Attendance</h3>
              <p className="text-sm text-slate-500">
                Register your name and family for the upcoming Sunday service.
              </p>
            </div>

            {registered ? (
              <div className="p-8 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-4 animate-fadeIn">
                <div className="w-14 h-14 bg-[#0f172a] text-indigo-400 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h4 className="font-serif text-[#0f172a] text-xl">Thank You for Registering!</h4>
                <p className="text-sm text-slate-600">
                  We look forward to seeing you at Gospel Fellowship Church this Sunday, 8:30 AM!
                </p>
                <button
                  onClick={() => setRegistered(false)}
                  className="px-5 py-2.5 bg-[#0f172a] hover:bg-[#1e293b] text-white uppercase tracking-wider font-bold rounded-xl text-xs transition-all"
                >
                  Register Another
                </button>
              </div>
            ) : (
              <form onSubmit={handleRegister} className="space-y-4 text-sm">
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1.5 text-xs">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Juan Dela Cruz"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-[#0f172a] placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1.5 text-xs">
                    Facebook Account Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={facebookName}
                    onChange={e => setFacebookName(e.target.value)}
                    placeholder="For announcements and follow-ups"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-[#0f172a] placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1.5 text-xs">
                      Contact No.
                    </label>
                    <input
                      type="text"
                      value={contact}
                      onChange={e => setContact(e.target.value)}
                      placeholder="0912-345-6789"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-[#0f172a] placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1.5 text-xs">
                      Age
                    </label>
                    <input
                      type="number"
                      value={age}
                      onChange={e => setAge(e.target.value)}
                      placeholder="e.g. 35"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-[#0f172a] placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-4 bg-[#0f172a] hover:bg-[#1e293b] text-white font-bold uppercase tracking-wider text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  <span>Confirm Attendance</span>
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    </>
  );
};