import type { Announcement, Attendee, ChurchEvent, Member, PrayerRequest, Sermon, Testimonial } from './types';
import type { Accent, Column, Field } from './components/ManagePage';

export interface CollectionConfig {
  key: string;
  title: string;
  icon: string;
  accent: Accent;
  fields: Field[];
  columns: Column<any>[];
}

export const todayDisplay = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

export const collections: CollectionConfig[] = [
  {
    key: 'events',
    title: 'Event',
    icon: '📅',
    accent: 'indigo',
    fields: [
      { name: 'title', label: 'Event Title', required: true, placeholder: 'e.g. Sunday Service' },
      { name: 'date', label: 'Date / Time', required: true, placeholder: 'e.g. Every Sunday • 8:30 AM' },
      { name: 'tag', label: 'Tag', required: true, placeholder: 'e.g. ⛪ Sunday Service' },
      { name: 'description', label: 'Description', type: 'textarea', full: true, placeholder: 'Event description' },
      { name: 'location', label: 'Location', placeholder: 'Gospel Fellowship Church, Limay, Bataan' }
    ],
    columns: [
      { key: 'title', label: 'Title', render: (e: ChurchEvent) => <span className="font-medium text-black dark:text-white">{e.title}</span> },
      { key: 'date', label: 'Date' },
      { key: 'tag', label: 'Tag', render: (e: ChurchEvent) => <span className="text-indigo-500 dark:text-indigo-400">{e.tag}</span> },
      { key: 'description', label: 'Description' }
    ]
  },
  {
    key: 'sermons',
    title: 'Sermon',
    icon: '🎬',
    accent: 'purple',
    fields: [
      { name: 'title', label: 'Sermon Title', required: true, placeholder: 'e.g. Obedience Over Sacrifice' },
      { name: 'sermonDate', label: 'Date', required: true, placeholder: 'e.g. July 12, 2026' },
      { name: 'speaker', label: 'Speaker', placeholder: 'Pastor Zaldy Bernaldo' },
      { name: 'verse', label: 'Verse', required: true, placeholder: 'e.g. To obey is better than sacrifice' },
      { name: 'verseRef', label: 'Verse Reference', placeholder: 'e.g. 1 Samuel 15:22' },
      { name: 'videoUrl', label: 'Video URL', placeholder: 'https://www.youtube.com/watch?v=...' },
      { name: 'image', label: 'Image Path', placeholder: 'Sunday Service/sunday-service.jpg' }
    ],
    columns: [
      { key: 'title', label: 'Title', render: (s: Sermon) => <span className="font-medium text-black dark:text-white">{s.title}</span> },
      { key: 'sermonDate', label: 'Date' },
      { key: 'speaker', label: 'Speaker' },
      { key: 'verseRef', label: 'Verse', render: (s: Sermon) => <span className="text-purple-500 dark:text-purple-400">{s.verseRef || s.verse}</span> }
    ]
  },
  {
    key: 'announcements',
    title: 'Announcement',
    icon: '📢',
    accent: 'cyan',
    fields: [
      { name: 'title', label: 'Title', required: true, placeholder: 'e.g. Baptismal Service' },
      { name: 'details', label: 'Details', required: true, placeholder: 'e.g. July 21, 2026 • 8:30 AM' },
      { name: 'category', label: 'Category', placeholder: 'General / Urgent / Youth / Worship / Outreach' }
    ],
    columns: [
      { key: 'title', label: 'Title', render: (a: Announcement) => (
          <span className="font-medium text-black dark:text-white">
            {a.isPinned ? '📌 ' : '📢 '}{a.title}
          </span>
        ) },
      { key: 'details', label: 'Details' },
      { key: 'date', label: 'Date', render: (a: Announcement) => a.date || '-' }
    ]
  },
  {
    key: 'prayers',
    title: 'Prayer Request',
    icon: '🙏',
    accent: 'rose',
    fields: [
      { name: 'name', label: 'Name', placeholder: 'Anonymous' },
      { name: 'category', label: 'Category', placeholder: 'Health & Healing' },
      { name: 'request', label: 'Prayer Request', type: 'textarea', full: true, required: true, placeholder: 'Enter prayer request...' }
    ],
    columns: [
      { key: 'name', label: 'Name', render: (p: PrayerRequest) => <span className="font-medium text-black dark:text-white">{p.name || 'Anonymous'}</span> },
      { key: 'request', label: 'Request' },
      { key: 'createdAt', label: 'Date' },
      { key: 'status', label: 'Status', render: (p: PrayerRequest) => (
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
            p.status === 'approved'
              ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400'
              : p.status === 'answered'
              ? 'bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400'
              : 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400'
          }`}>
            {p.status === 'approved' ? '✅ Approved' : p.status === 'answered' ? '💫 Answered' : '⏳ Pending'}
          </span>
        ) }
    ]
  },
  {
    key: 'attendees',
    title: 'Attendee',
    icon: '👤',
    accent: 'emerald',
    fields: [
      { name: 'name', label: 'Full Name', required: true, placeholder: 'Full Name' },
      { name: 'facebookName', label: 'Facebook Name', placeholder: 'Facebook Account Name' },
      { name: 'contact', label: 'Contact', placeholder: '0912-345-6789' },
      { name: 'age', label: 'Age', type: 'number', placeholder: 'Age' }
    ],
    columns: [
      { key: 'name', label: 'Name', render: (a: Attendee) => <span className="font-medium text-black dark:text-white">{a.name}</span> },
      { key: 'facebookName', label: 'Facebook', render: (a: Attendee) => a.facebookName || '-' },
      { key: 'contact', label: 'Contact', render: (a: Attendee) => a.contact || '-' },
      { key: 'age', label: 'Age', render: (a: Attendee) => a.age || '-' }
    ]
  },
  {
    key: 'testimonials',
    title: 'Testimonial',
    icon: '🗣️',
    accent: 'amber',
    fields: [
      { name: 'name', label: 'Name', required: true, placeholder: 'Full Name' },
      { name: 'role', label: 'Role / Position', placeholder: 'e.g. Member since 2024' },
      { name: 'text', label: 'Testimonial', type: 'textarea', full: true, required: true, placeholder: 'Share your testimony...' }
    ],
    columns: [
      { key: 'name', label: 'Name', render: (t: Testimonial) => <span className="font-medium text-black dark:text-white">{t.name}</span> },
      { key: 'role', label: 'Role', render: (t: Testimonial) => t.role || '-' },
      { key: 'text', label: 'Testimonial', render: (t: Testimonial) => (t.text.length > 60 ? t.text.substring(0, 60) + '...' : t.text) },
      { key: 'createdAt', label: 'Date' }
    ]
  },
  {
    key: 'members',
    title: 'Member',
    icon: '🧑',
    accent: 'indigo',
    fields: [
      { name: 'fullName', label: 'Full Name', required: true, placeholder: 'Full Name' },
      { name: 'role', label: 'Role', placeholder: 'Member / Youth Leader / Deacon / Pastor' },
      { name: 'ministry', label: 'Ministry', placeholder: 'e.g. Worship Team' },
      { name: 'contactNumber', label: 'Contact Number', placeholder: '0912-345-6789' },
      { name: 'facebookName', label: 'Facebook Name', placeholder: 'Facebook Account' },
      { name: 'birthMonth', label: 'Birth Month', placeholder: 'e.g. January' },
      { name: 'joinDate', label: 'Join Date', placeholder: 'e.g. 2025-01-15' }
    ],
    columns: [
      { key: 'fullName', label: 'Full Name', render: (m: Member) => <span className="font-medium text-black dark:text-white">{m.fullName}</span> },
      { key: 'role', label: 'Role' },
      { key: 'ministry', label: 'Ministry' },
      { key: 'contactNumber', label: 'Contact', render: (m: Member) => m.contactNumber || '-' }
    ]
  }
];