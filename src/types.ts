export interface DateEntry {
  date: string;
  photos: string[];
  verse?: string;
  verseRef?: string;
}

export interface ChurchEvent {
  id: string;
  title: string;
  date: string;
  tag: string;
  description: string;
  location?: string;
  defaultVerse?: string;
  defaultVerseRef?: string;
  image?: string;
  dateEntries?: DateEntry[];
}

export interface Sermon {
  id: string;
  title: string;
  sermonDate: string;
  speaker?: string;
  verse: string;
  verseRef?: string;
  videoUrl?: string;
  audioUrl?: string;
  audioDuration?: string;
  image?: string;
  description?: string;
}

export interface PrayerRequest {
  id: string;
  name: string;
  contact?: string;
  request: string;
  createdAt: string;
  status: 'approved' | 'pending' | 'answered';
  category?: string;
  prayerCount?: number;
  answeredTestimony?: string;
}

export interface Testimonial {
  id: string;
  name: string;
  role?: string;
  text: string;
  createdAt: string;
}

export interface Attendee {
  id: string;
  name: string;
  facebookName?: string;
  contact?: string;
  age?: string;
  registeredAt?: string;
}

export interface Announcement {
  id: string;
  title: string;
  details: string;
  date?: string;
  category?: string;
  image?: string;
  isPinned?: boolean;
}

export interface Member {
  id: string;
  fullName: string;
  role: string;
  ministry: string;
  contactNumber?: string;
  facebookName?: string;
  birthMonth: string;
  isBaptized: boolean;
  joinDate?: string;
  avatar?: string;
}

export interface Activity {
  id: string;
  type: string;
  action: string;
  message: string;
  icon: string;
  actor: 'public' | 'admin' | 'system';
  createdAt: string;
}

export interface AllPhotoAlbum {
  month: number;
  year: number;
  date: string;
  photos: string[];
}

export interface RemoteContent {
  initialized: boolean;
  events: ChurchEvent[];
  sermons: Sermon[];
  prayers: PrayerRequest[];
  attendees: Attendee[];
  members: Member[];
  announcements: Announcement[];
  testimonials: Testimonial[];
  allPhotos: AllPhotoAlbum[];
}

export type RecordMap = {
  events: ChurchEvent[];
  sermons: Sermon[];
  prayers: PrayerRequest[];
  attendees: Attendee[];
  members: Member[];
  announcements: Announcement[];
  testimonials: Testimonial[];
  allPhotos: AllPhotoAlbum[];
};

export type Collection = keyof RecordMap;