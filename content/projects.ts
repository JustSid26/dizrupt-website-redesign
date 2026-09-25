// Every client and the particle model that stands for them. Edit here; the spiral, the case pages
// and the solutions all read from this list.
export type Result = { value: number; suffix: string; label: string };
export type Project = {
  title: string;
  client: string; // the solution line under the title
  tags: string;
  shape: string; // a key of SHAPES in lib/engine/shapes.ts
  colors: [string, string];
  spin?: boolean;
  summary?: string;
  places?: string[];
  mapView?: string;
  caseStudy?: { ask: string; solution: string; dizruption: string };
  results?: Result[];
  cta?: { label: string; panel: string };
};

export const PROJECTS: Project[] = [
  {
    title: 'Dizrupt',
    places: ['mumbai', 'london', 'newYork', 'bangkok', 'antwerp', 'dubai', 'hongKong', 'johannesburg'],
    mapView: 'world',
    client: 'The solutions designed for what’s next',
    tags: 'Full stack digital marketing agency · Mumbai',
    shape: 'wordmark', colors: ['#5b7cff', '#d4b8ff'],
    cta: { label: 'Explore solutions', panel: 'solutions' },
  },
  {
    title: 'SlickFix',
    summary: 'Slickfix, a fashion accessory brand established in India, provides products that act as a fashion solution, helping women and men overcome their daily dressing dilemmas.',
    places: ['mumbai'],
    client: 'Social & Paid Media Management · Production',
    tags: 'Fashion accessories · India',
    shape: 'hanger', colors: ['#ff3d8b', '#ffc2da'],
    caseStudy: {
      ask: 'Slickfix, a fashion accessory brand established in India, provides products that act as a fashion solution, helping women and men overcome their daily dressing dilemmas. Facing a creative block on their social media, they sought out Dizrupt to provide a unique and fresh approach.',
      solution: 'Our team provided Slickfix with social media, SEO and paid media management solutions, which includes thorough industry research, competitive analysis, brand and communication strategy, monthly content plans and boosting strategy.',
      dizruption: 'With our strategic social solutions, the brand experienced a revitalised online presence, with over 300% increase in sales, 80% increase in following, an expansion of their online community by almost 2x, and a notable uptick in product visibility. This also helped position Slickfix as a dynamic and influential presence in the fashion accessory landscape.',
    },
    results: [
      { value: 300, suffix: '%', label: 'increase in sales' },
      { value: 80, suffix: '%', label: 'increase in following' },
      { value: 2, suffix: '×', label: 'online community' },
    ],
  },
  {
    title: 'Alwrite',
    summary: 'Alwrite is a one of a kind, B2B insurtech start-up in India that aims to transform the commercial insurance industry by redefining the placement and underwriting process via innovative technology.',
    places: ['mumbai'],
    client: 'Branding Solutions',
    tags: 'B2B insurtech · India',
    shape: 'shield', colors: ['#3d6bff', '#b8c8ff'],
    caseStudy: {
      ask: 'Alwrite is a one of a kind, B2B insurtech start-up in India that aims to transform the commercial insurance industry by redefining the placement and underwriting process via innovative technology. Their ask was straightforward - Alwrite needed an identity that captured the modern, tech-driven approach of the brand while resonating with the traditional roots inherent to the insurance sector.',
      solution: 'Our team dived into exhaustive research of the insurance industry, to gain a deep understanding of the sector and uncover valuable insights. From conceptualising the brand name, to creating the overall identity and meticulously designing the logo, we brought the brand to life.',
      dizruption: 'Alwrite - a combination of ‘all (one-stop-shop)’ and ‘underwriting’, presents a contemporary twist to the insurance industry. It signifies a fresh perspective injected into the insurance sector, by leveraging technological capabilities to streamline processes, thus making it accessible to all. The logo also encapsulates the innovative essence of the brand. With Alwrite, everything is set to be truly “alright.”',
    },
  },
  {
    title: 'Nykonos Entertainment',
    summary: 'Based in New York, Nykonos is an entertainment company that thrives on curating events across various electronic genres, featuring a diverse array of artists.',
    places: ['newYork'],
    client: 'Digital Content Creation',
    tags: 'Electronic music events · New York',
    shape: 'vinyl', colors: ['#8a5bff', '#ff4fd8'],
    caseStudy: {
      ask: 'Based in New York, Nykonos is an entertainment company that thrives on curating events across various electronic genres, featuring a diverse array of artists. Craving content as upbeat as their events, they reached out to Dizrupt for a creative spark.',
      solution: 'Our team executed a set of promotional videos that focused on their NYC Launch Party, including artist reveals, location reveals, save the dates, etc. The creatives transported the audience to the pulse of electrifying techno beats mixed with the upbeat spirit of New York.',
      dizruption: 'The promotional videos were able to capture the true essence of the brand and were instrumental in an uplift of the ticket sales for their events. We also got a mandate to create videos for every event ever since.',
    },
  },
  {
    title: 'Mae Mae Industrial',
    summary: 'With a legacy spanning over 40 years and catering to 500+ customers, Mae Mae Industrial stands as the one-stop packaging solution provider based in Thailand.',
    places: ['bangkok'],
    client: 'Website Development',
    tags: 'Packaging solutions · Thailand',
    shape: 'openBox', colors: ['#1fd6b8', '#2a6bff'],
    caseStudy: {
      ask: 'With a legacy spanning over 40 years and catering to 500+ customers, Mae Mae Industrial stands as the one-stop packaging solution provider based in Thailand. In the pursuit of a more modern and professional online representation, Mae Mae Industrial turned to Dizrupt for a website transformation.',
      solution: 'Recognizing the limitations of their old website, which was outdated and not user-friendly, we undertook a comprehensive 360-degree UX-UI revamp to elevate them by meeting the highest industry standards. Our approach resulted in a modern and intuitive user interface with a seamless user experience. We prioritised displaying their extensive clientele, enhancing the customer viewing experience and elevating the overall aesthetic of the website.',
      dizruption: 'The website transformation resulted in a seamless digital experience that not only aligns with modern design principles but also reinforces Mae Mae Industrial’s position as a leading packaging solution provider.',
    },
  },
  {
    title: 'Kiaash',
    summary: 'Kiaash, a UK-based fine jewellery brand, believes in elevating your every day to celebrating special moments.',
    places: ['london'],
    client: 'Social & Paid Media Management',
    tags: 'Fine jewellery · UK',
    shape: 'gemRing', colors: ['#ffb84d', '#fff1d6'],
  },
  {
    title: 'Furnfetch',
    summary: 'FurnFetch, a furniture fetching company in India, redefines furniture sourcing by offering a comprehensive and seamless process that caters to all sourcing needs.',
    places: ['mumbai'],
    client: 'Website Development',
    tags: 'Furniture sourcing · India',
    shape: 'armchair', colors: ['#ff6a3d', '#ffd9a8'],
  },
  {
    title: 'KP Packaging',
    summary: 'For over 30 years, KP Packaging has earned a great reputation as a trusted name in the packaging industry, partnering with brands like Godrej, Amul, and Cipla.',
    places: ['mumbai'],
    client: 'Branding Solutions · SEO',
    tags: 'Packaging · 30+ years · India',
    shape: 'pallet', colors: ['#3fe08a', '#d2ffe2'],
  },
  {
    title: 'AVG Windscreens',
    summary: 'AVG Windscreens, a windscreen repair and replacement company based in the UK, brings over 25 years of experience to the road.',
    places: ['london'],
    client: 'Search Engine Optimization',
    tags: 'Windscreen repair · UK',
    shape: 'windscreen', colors: ['#2ad4ff', '#dff6ff'],
  },
  {
    title: 'Samir Gems',
    summary: 'Samir Gems, an Indian-based legacy diamond manufacturing company with a global footprint across Antwerp, Hong Kong, Dubai, Johannesburg, Mumbai, New York, among others, has emerged as one of the top rough trading and manufacturing companies.',
    places: ['mumbai', 'antwerp', 'hongKong', 'dubai', 'johannesburg', 'newYork'],
    client: 'Digital Content Creation',
    tags: 'Diamond manufacturing · Global',
    shape: 'diamond', colors: ['#9fd8ff', '#ffffff'], spin: true,
  },
  {
    title: 'Maverick Realtors',
    summary: 'Maverick Realtors, a Mumbai-based real estate company with a legacy of over 30 years, is dedicated to the belief that they’re not just constructing houses; they’re building homes.',
    places: ['mumbai'],
    client: 'Digital Content Creation',
    tags: 'Real estate · Mumbai',
    shape: 'house', colors: ['#c9a36b', '#f5f1e6'],
  },
  {
    title: 'Crossline',
    summary: 'Crossline, an Indian B2B eyewear brand, provides premium, trendy and affordable eyewear for all.',
    places: ['mumbai'],
    client: 'Production Solutions',
    tags: 'B2B eyewear · India',
    shape: 'glasses', colors: ['#ff5b5b', '#ffc9b8'],
  },
];


// The clients with an overview: these are the spiral's cards and the case pages.
export const clients = PROJECTS.filter((p) => p.summary);
export const slugOf = (p: Project) => p.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const bySlug = (slug: string) => clients.find((p) => slugOf(p) === slug);
