import type { AboutImage, AboutInfo, Announcement, Attendee, ChurchEvent, GiveInfo, Member, Ministry, Pastor, PrayerRequest, Sermon, Song, Testimonial, Verse } from './types';
import type { ReactNode } from 'react';
import type { Accent, Column, Field } from './components/ManagePage';

const thumbnail = (src: string, alt = ''): ReactNode => (
  <img
    src={src}
    alt={alt}
    loading="lazy"
    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
    className="w-14 h-14 rounded-xl object-cover border border-gray-100 dark:border-white/10 shadow-sm bg-gray-50 dark:bg-white/5"
  />
);

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
      { name: 'location', label: 'Location', placeholder: 'Gospel Fellowship Church, Limay, Bataan' },
      { name: 'image', label: 'Image URL', placeholder: 'https://... or blank for default' }
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
  },
  {
    key: 'aboutImages',
    title: 'About Image',
    icon: '🖼️',
    accent: 'indigo',
    fields: [
      { name: 'image', label: 'Image URL', required: true, placeholder: 'https://... or /uploads/photo.jpg or Facebook link' },
      { name: 'caption', label: 'Caption (optional)', placeholder: 'e.g. Sunday Worship at the sanctuary' }
    ],
    columns: [
      { key: 'image', label: 'Preview', render: (a: AboutImage) => thumbnail(a.image, a.caption) },
      { key: 'imageURL', label: 'Image', render: (a: AboutImage) => <span className="text-xs text-gray-500 dark:text-gray-400 break-all max-w-[220px] inline-block">{a.image}</span> },
      { key: 'caption', label: 'Caption', render: (a: AboutImage) => a.caption || '-' }
    ]
  },
  {
    key: 'ministries',
    title: 'Ministry',
    icon: '⛪',
    accent: 'purple',
    fields: [
      { name: 'title', label: 'Ministry Title', required: true, placeholder: 'e.g. Worship Ministry' },
      { name: 'description', label: 'Description', type: 'textarea', full: true, required: true, placeholder: 'What this ministry does...' },
      { name: 'icon', label: 'Icon Key', placeholder: 'children / youth / worship / ushering / media / prayer' },
      { name: 'leader', label: 'Overseer / Leader', placeholder: 'e.g. Vianca Hernandez' },
      { name: 'meetingTime', label: 'Meeting Time', placeholder: 'e.g. Every Saturday • 9:00 AM' },
      { name: 'location', label: 'Location', placeholder: 'e.g. Main Sanctuary' },
      { name: 'details', label: 'Focus / Details', type: 'textarea', full: true, placeholder: 'One item per line, e.g.\nPrepare worship setlist\nPractice every Saturday' },
      { name: 'photo', label: 'Photo URL (optional)', placeholder: 'https://... or /uploads/photo.jpg' }
    ],
    columns: [
      { key: 'photo', label: 'Photo', render: (m: Ministry) => m.photo ? thumbnail(m.photo, m.title) : <span className="text-gray-300 dark:text-gray-600">—</span> },
      { key: 'title', label: 'Ministry', render: (m: Ministry) => <span className="font-medium text-black dark:text-white">{m.title}</span> },
      { key: 'leader', label: 'Overseer', render: (m: Ministry) => m.leader || '-' },
      { key: 'description', label: 'Description', render: (m: Ministry) => m.description.length > 50 ? m.description.substring(0, 50) + '...' : m.description }
    ]
  },
  {
    key: 'pastors',
    title: 'Leader',
    icon: '🕊️',
    accent: 'amber',
    fields: [
      { name: 'name', label: 'Full Name', required: true, placeholder: 'Full Name' },
      { name: 'role', label: 'Role', required: true, placeholder: 'e.g. Pastor / Worship Leader / Drummer' },
      { name: 'facebook', label: 'Facebook Link', placeholder: 'https://www.facebook.com/...' },
      { name: 'image', label: 'Photo URL', required: true, placeholder: 'https://... or /leaders/pastor1.jpg' }
    ],
    columns: [
      { key: 'image', label: 'Photo', render: (p: Pastor) => thumbnail(p.image, p.name) },
      { key: 'name', label: 'Name', render: (p: Pastor) => <span className="font-medium text-black dark:text-white">{p.name}</span> },
      { key: 'role', label: 'Role', render: (p: Pastor) => <span className="text-amber-600 dark:text-amber-400">{p.role}</span> }
    ]
  },
  {
    key: 'songs',
    title: 'Worship Song',
    icon: '🎵',
    accent: 'cyan',
    fields: [
      { name: 'name', label: 'Song Title', required: true, placeholder: 'e.g. Way Maker' },
      { name: 'link', label: 'YouTube Link', required: true, placeholder: 'https://www.youtube.com/watch?v=...' }
    ],
    columns: [
      { key: 'name', label: 'Song', render: (s: Song) => <span className="font-medium text-black dark:text-white">{s.name}</span> },
      { key: 'link', label: 'Link', render: (s: Song) => <a href={s.link} target="_blank" rel="noopener noreferrer" className="text-cyan-600 dark:text-cyan-400 hover:underline text-xs">{s.link}</a> }
    ]
  },
  {
    key: 'aboutInfo',
    title: 'About Page Text',
    icon: '📝',
    accent: 'rose',
    fields: [
      { name: 'introHeading', label: 'Intro Heading', required: true, placeholder: "e.g. We're a family of faith in Limay, Bataan." },
      { name: 'introParagraph', label: 'Intro Paragraph', type: 'textarea', full: true, placeholder: 'Introductory paragraph...' },
      { name: 'stats', label: 'Stats (one per line: Value|Label)', type: 'textarea', full: true, placeholder: '8:30 AM|Sunday Worship\n6+|Active Ministries\n7 Days|A Week of Prayer' },
      { name: 'scheduleLabel', label: 'Floating Card Label', placeholder: 'e.g. Sunday Celebration' },
      { name: 'scheduleTime', label: 'Floating Card Time', placeholder: 'e.g. Every Sunday · 8:30 AM' },
      { name: 'slogan', label: 'Mission/Vision Heading', type: 'textarea', full: true, placeholder: 'Rooted in the Word, formed by worship, sent in love.' },
      { name: 'missionQuote', label: 'Mission Quote', type: 'textarea', full: true, placeholder: 'Go therefore and make disciples...' },
      { name: 'visionTitle', label: 'Vision Title', placeholder: 'e.g. Be Multiplied.' },
      { name: 'visionText', label: 'Vision Text', type: 'textarea', full: true, placeholder: 'To grow and multiply true disciples...' },
      { name: 'communityText', label: 'Community Text', type: 'textarea', full: true, placeholder: 'We reflect the love of Jesus...' }
    ],
    columns: [
      { key: 'introHeading', label: 'Intro Heading', render: (i: AboutInfo) => <span className="font-medium text-black dark:text-white">{i.introHeading || '-'}</span> },
      { key: 'id', label: 'Record', render: () => <span className="text-xs text-gray-400 dark:text-gray-500">About page content</span> }
    ]
  },
  {
    key: 'verses',
    title: 'Verse of the Day',
    icon: '📖',
    accent: 'emerald',
    fields: [
      { name: 'text', label: 'Verse Text', type: 'textarea', full: true, required: true, placeholder: 'The scripture text, e.g. "For I know the plans I have for you..."' },
      { name: 'ref', label: 'Verse Reference', required: true, placeholder: 'e.g. Jeremiah 29:11' }
    ],
    columns: [
      { key: 'text', label: 'Verse', render: (v: Verse) => <span className="font-medium text-black dark:text-white">"{v.text}"</span> },
      { key: 'ref', label: 'Reference', render: (v: Verse) => <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{v.ref}</span> }
    ]
  },
  {
    key: 'giveInfo',
    title: 'Giving Info',
    icon: '💝',
    accent: 'rose',
    fields: [
      { name: 'gcashNumber', label: 'GCash Number', placeholder: '0912-345-6789' },
      { name: 'gcashName', label: 'GCash Account Name', placeholder: 'Gospel Fellowship Church / Pastor Zaldy B.' },
      { name: 'bdoNumber', label: 'BDO Account Number', placeholder: '0012-3456-7890' },
      { name: 'bdoName', label: 'BDO Account Name', placeholder: 'Gospel Fellowship Church Limay' }
    ],
    columns: [
      { key: 'gcashNumber', label: 'GCash', render: (g: GiveInfo) => <span className="font-mono font-semibold text-black dark:text-white">{g.gcashNumber || '-'}</span> },
      { key: 'bdoNumber', label: 'BDO', render: (g: GiveInfo) => <span className="font-mono font-semibold text-black dark:text-white">{g.bdoNumber || '-'}</span> },
      { key: 'gcashName', label: 'Account Name', render: (g: GiveInfo) => g.gcashName || '-' }
    ]
  }
];