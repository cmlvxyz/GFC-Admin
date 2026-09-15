import type { Ministry, Pastor, Song } from '../types';

// Fallback data (kapareho ng GFC website) na gagamitin lang kung walang
// laman ang admin collection.
export const DEFAULT_PASTORS: Pastor[] = [
  { id: '1', name: 'Zaldy Bernaldo', role: 'Pastor', facebook: 'https://www.facebook.com/zaldy.bernaldo.2025', image: 'Prayer Meeting/July21/july21-10.png' },
  { id: '2', name: 'Oliver Ricarpo', role: 'Associate Pastor', facebook: 'https://www.facebook.com/oliver.ricarpo', image: 'Prayer Meeting/July13/july13-3.png' },
  { id: '3', name: 'Jocelyn Ricarpo', role: 'Deacon', facebook: 'https://www.facebook.com/purokuno.stfrancis', image: 'Prayer Meeting/July6/july6-6.png' },
  { id: '4', name: 'Jericko Bernaldo', role: 'Guitarist', facebook: 'https://www.facebook.com/search/top?q=jericko%20bernaldo', image: '/leaders/pastor1.jpg' },
  { id: '5', name: 'Trixie Nacional', role: 'Bassist', facebook: 'https://www.facebook.com/trixie.nacional.5', image: '/leaders/pastor2.jpg' },
  { id: '6', name: 'Vianca Marie Hernandez', role: 'Worship Leader', facebook: 'https://www.facebook.com/profile.php?id=100086021530605', image: '/leaders/pastor3.jpg' },
  { id: '7', name: 'Trixie Mae Solano', role: 'Usherette', facebook: 'https://www.facebook.com/trixiemae.solano.56', image: '/leaders/pastor4.jpg' },
  { id: '8', name: 'Kirlly Pagara', role: 'Worship Leader', facebook: 'https://www.facebook.com/profile.php?id=61586061310680', image: '/leaders/pastor5.jpg' },
  { id: '9', name: 'Ramilyn Engracia', role: 'Announcer', facebook: 'https://www.facebook.com/ramramen.nissin', image: '/leaders/pastor6.jpg' },
  { id: '10', name: 'Ian Dela Cruz', role: 'Keyboardist', facebook: 'https://www.facebook.com/cmlvyannnn', image: '/leaders/pastor7.jpg' },
  { id: '11', name: 'Marvin Adlawan', role: 'Youth Leader', facebook: 'https://www.facebook.com/marvin.adlawan.48109', image: '/leaders/pastor8.jpg' },
  { id: '12', name: 'Reyman Boloso', role: 'Youth Leader', facebook: 'https://www.facebook.com/reyman.ireneaboloso', image: '/leaders/pastor13.jpg' },
  { id: '13', name: 'Reinz Baylon', role: 'Leader', facebook: 'https://www.facebook.com/reinz.baylon', image: '/leaders/pastor9.jpg' },
  { id: '14', name: 'Jeshurun Dy Ricarpo', role: 'Drummer', facebook: 'https://www.facebook.com/profile.php?id=61589678930945', image: '/leaders/pastor11.jpg' },
  { id: '15', name: 'Jedidiah Sy Ricarpo', role: 'Media', facebook: 'https://www.facebook.com/jedidiah.ricarpo', image: '/leaders/pastor12.jpg' }
];

export const DEFAULT_SONGS: Song[] = [
  { name: 'Way Maker', link: 'https://www.youtube.com/watch?v=iJCV_2H9xD0' },
  { name: 'Goodness of God', link: 'https://www.youtube.com/watch?v=-f4MUUMHh4g' },
  { name: 'What a Beautiful Name', link: 'https://www.youtube.com/watch?v=nQWFzMvCfLE' },
  { name: '10,000 Reasons (Bless the Lord)', link: 'https://www.youtube.com/watch?v=DXDGE_lRI0E' },
  { name: 'Here I Am to Worship', link: 'https://www.youtube.com/watch?v=68E6sK6dDyg' }
];

export const DEFAULT_MINISTRIES: Ministry[] = [
  {
    id: 'worship',
    icon: 'bx bx-music',
    title: 'Worship Ministry',
    description: 'Leading the congregation in spirit-filled, heartfelt worship through music.',
    leader: 'Vianca Hernandez / Kirlly Pagara',
    meetingTime: 'Every Saturday • 9:00 AM',
    location: 'Main Sanctuary',
    details: [
      '🎵 Prepare worship setlist',
      '🎵 Practice every Saturday',
      '🎵 Coordinate with musicians',
      '🎵 Lead Sunday worship'
    ]
  },
  {
    id: 'prayer',
    icon: 'bx bx-heart',
    title: 'Prayer Ministry',
    description: 'Interceding faithfully for the church, families, community, and nation.',
    leader: 'Jocelyn Ricarpo',
    meetingTime: 'Monday • 7:00 PM',
    location: 'Prayer Room',
    details: [
      '🕯️ Church growth & protection',
      '🕯️ Community outreach',
      '🕯️ Healing of the sick',
      '🕯️ Youth & children'
    ]
  },
  {
    id: 'youth',
    icon: 'bx bx-fire',
    title: 'Next Generation Youth',
    description: 'Fellowship, games, worship, and Bible discussions tailored for students and young adults.',
    leader: 'Marvin Adlawan / Reinz Baylon',
    meetingTime: 'Sunday • 7:00 PM',
    location: 'Youth Hall',
    details: [
      '🌟 Bible Study',
      '🌟 Music & Worship',
      '🌟 Outreach Programs',
      '🌟 Sports & Fellowship'
    ]
  },
  {
    id: 'ushering',
    icon: 'bx bx-hands',
    title: 'Ushering & Hospitality Ministry',
    description: 'Welcoming everyone with warm smiles, guiding attendees, and serving with joy.',
    leader: 'Trixie Mae Solano',
    meetingTime: 'Sunday • 7:30 AM',
    location: 'Church Entrance',
    details: [
      '🤝 Greeting attendees',
      '🤝 Assisting visitors',
      '🤝 Offering collection',
      '🤝 Maintaining order'
    ]
  },
  {
    id: 'media',
    icon: 'bx bx-video',
    title: 'Media & Technology Ministry',
    description: 'Spreading the Gospel through audio visual technology, photography, and online streaming.',
    leader: 'Jedidiah Sy Ricarpo',
    meetingTime: 'Saturday • 2:00 PM',
    location: 'Technical Booth',
    details: [
      '📹 Sound System',
      '📹 Projection & Slides',
      '📹 Live Streaming',
      '📹 Photography & Video'
    ]
  },
  {
    id: 'children',
    icon: 'bx bx-child',
    title: "Children's Ministry",
    description: 'Nurturing faith in our little ones with love, care, and fun Bible activities.',
    leader: 'Jocelyn Ricarpo',
    meetingTime: 'Sunday • 9:30 AM',
    location: 'Children\'s Room',
    details: [
      '📖 Bible Stories',
      '🎨 Arts & Crafts',
      '🎵 Singing & Worship',
      '📝 Memory Verses'
    ]
  }
];