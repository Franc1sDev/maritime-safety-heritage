/* =====================================================================
   Maritime Safety Heritage Archive - PROTOTYPE SEED DATA
   All records below are SAMPLE / PLACEHOLDER content written for the
   demonstration only. They are not real testimonies or real incidents.
   In the full build this data comes from the database through the API.
   ===================================================================== */

window.MSH_SEED = {
  version: 3,

  types: {
    oral:      { label: "Oral history",      icon: "🎙️", color: "#0f766e" },
    photo:     { label: "Photograph",        icon: "📷", color: "#b45309" },
    record:    { label: "Record / report",   icon: "📄", color: "#1d4ed8" },
    testimony: { label: "Testimony",         icon: "💬", color: "#9333ea" }
  },

  waterBodies: ["Indian Ocean coast", "Lake Victoria", "Lake Turkana", "Lake Naivasha", "Lake Baringo", "Rivers"],

  records: [
    {
      id: "MSH-0001", type: "oral", format: "audio", duration: 214,
      title: "Night crossings on the Likoni channel",
      summary: "A retired ferry deckhand recalls how crews managed crowding, life-jacket storage and passenger flow during the busiest evening crossings.",
      year: 1987, waterBody: "Indian Ocean coast", county: "Mombasa", place: "Likoni crossing",
      lat: -4.0730, lng: 39.6600,
      tags: ["ferry", "crowd management", "life jackets", "crew training"],
      creator: "Remembering the Waters field team", interviewer: "Field researcher (sample)", narrator: "Retired deckhand (anonymised)",
      language: "Kiswahili, English transcript", rights: "CC BY-NC 4.0", consent: "Signed consent form on file",
      status: "published", views: 412, added: "2026-03-14",
      transcript: [
        [0,   "We used to count heads at the ramp. Not exactly, but enough to know when to stop people."],
        [28,  "The life jackets were in the boxes under the benches. Many passengers never knew they were there."],
        [61,  "So we started telling them. Every crossing, one sentence: the jackets are under your seat."],
        [97,  "In the evenings the crowd pushed hard. The rope at the gate mattered more than any rule on paper."],
        [140, "What I want young people to know is this: the water does not care how late you are."],
        [182, "Wait for the next ferry. That is the whole lesson."]
      ]
    },
    {
      id: "MSH-0002", type: "photo", format: "image",
      title: "Fishing fleet at Mbita beach before dawn",
      summary: "Sample photograph of wooden fishing boats preparing to launch, showing the absence of buoyancy aids that was common at the time.",
      year: 1974, waterBody: "Lake Victoria", county: "Homa Bay", place: "Mbita beach",
      lat: -0.4320, lng: 34.2050,
      tags: ["fishing", "boats", "buoyancy aids", "beach management"],
      creator: "Family collection (donated, sample)", photographer: "Unknown",
      language: "—", rights: "© Lender, used with permission", consent: "Loan agreement on file",
      status: "published", views: 268, added: "2026-03-20",
      scene: "dawn"
    },
    {
      id: "MSH-0003", type: "record", format: "document",
      title: "Boat registration and safety equipment checklist",
      summary: "Sample scan of a typed checklist issued to boat owners, listing required equipment: bailer, paddles, a lamp and one buoyancy aid per crew member.",
      year: 1992, waterBody: "Lake Victoria", county: "Kisumu", place: "Kisumu port, Winam Gulf",
      lat: -0.1000, lng: 34.7500,
      tags: ["regulation", "boat registration", "equipment", "checklist"],
      creator: "Fisheries office (sample)", language: "English", rights: "Public record",
      consent: "Not applicable (public record)", status: "published", views: 351, added: "2026-04-02",
      pages: [
        "SAFETY EQUIPMENT REQUIRED ON EVERY REGISTERED VESSEL",
        "1. One approved buoyancy aid for each person on board.",
        "2. A bailer secured to the hull.",
        "3. Two paddles, whether or not an engine is fitted.",
        "4. A lamp or torch for travel after sunset.",
        "5. The registration number painted clearly on both sides.",
        "Vessels found without the above may be detained until equipment is fitted."
      ]
    },
    {
      id: "MSH-0004", type: "testimony", format: "text",
      title: "The afternoon wind on Lake Turkana",
      summary: "A fisherwoman from Kalokol describes reading the sudden afternoon winds and the community rule of returning to shore before they rise.",
      year: 2003, waterBody: "Lake Turkana", county: "Turkana", place: "Kalokol, Ferguson's Gulf",
      lat: 3.5500, lng: 35.8700,
      tags: ["weather", "wind", "traditional knowledge", "women in fishing"],
      creator: "Remembering the Waters field team", narrator: "Fisherwoman (anonymised)",
      language: "Ng'aturkana, English translation", rights: "CC BY-NC 4.0", consent: "Verbal consent recorded",
      status: "published", views: 197, added: "2026-04-11",
      body: "My grandmother taught us to watch the hills to the east. When the dust lifts there, the wind will reach the water before you can finish mending a net. We had a rule: when the sun passes the top of the sky, the boats turn home. Nobody wrote it down, but everybody knew it. Some of the young men who came from outside did not know, and that is when people were lost. Now we tell every newcomer on the first day."
    },
    {
      id: "MSH-0005", type: "oral", format: "video", duration: 305,
      title: "Rescue swimmers of Lamu",
      summary: "Sample video interview with a member of a volunteer rescue group describing how dhow crews organised informal search and rescue.",
      year: 2011, waterBody: "Indian Ocean coast", county: "Lamu", place: "Lamu channel",
      lat: -2.2717, lng: 40.9020,
      tags: ["search and rescue", "dhow", "volunteers", "community response"],
      creator: "Remembering the Waters field team", interviewer: "Field researcher (sample)", narrator: "Volunteer rescuer (anonymised)",
      language: "Kiswahili, English subtitles", rights: "CC BY-NC 4.0", consent: "Signed consent form on file",
      status: "published", views: 529, added: "2026-04-18",
      transcript: [
        [0,   "When a boat was late, the whole jetty knew within minutes."],
        [45,  "We did not have radios at first. We had the strongest swimmers and the fastest dhow."],
        [102, "Later we learned to keep a list: who left, when, and where they were going."],
        [170, "That list saved more lives than any of us swimming."],
        [240, "Today every boat should tell someone on shore. It costs nothing."]
      ]
    },
    {
      id: "MSH-0006", type: "photo", format: "image",
      title: "Passenger boat at Mfangano Island jetty",
      summary: "Sample photograph of a passenger boat loading at the island jetty, with goods and passengers sharing limited deck space.",
      year: 1998, waterBody: "Lake Victoria", county: "Homa Bay", place: "Mfangano Island",
      lat: -0.4650, lng: 34.0100,
      tags: ["passenger transport", "overloading", "jetty", "island communities"],
      creator: "Researcher's field photograph (sample)", photographer: "Field team",
      language: "—", rights: "CC BY-NC 4.0", consent: "Not applicable",
      status: "published", views: 183, added: "2026-05-02",
      scene: "jetty"
    },
    {
      id: "MSH-0007", type: "record", format: "document",
      title: "Lake Naivasha boating incident summary (sample)",
      summary: "Sample typed incident summary describing a capsized tourist boat, the causes identified and recommendations for life-jacket use by visitors.",
      year: 2008, waterBody: "Lake Naivasha", county: "Nakuru", place: "Lake Naivasha",
      lat: -0.7700, lng: 36.3500,
      tags: ["incident report", "tourism", "recommendations", "life jackets"],
      creator: "Local safety committee (sample)", language: "English", rights: "Used with permission",
      consent: "Permission letter on file", status: "published", views: 276, added: "2026-05-09",
      pages: [
        "INCIDENT SUMMARY - FOR COMMITTEE USE",
        "A small boat carrying visitors capsized in rough water during the late afternoon.",
        "All passengers were recovered by nearby boats. Two required hospital care.",
        "Findings: life jackets were on board but not worn; boat exceeded its seating capacity.",
        "Recommendation: operators to ensure every visitor wears a life jacket before departure.",
        "Recommendation: a visible capacity plate to be fixed on every hire boat."
      ]
    },
    {
      id: "MSH-0008", type: "oral", format: "audio", duration: 188,
      title: "Crossing the Tana River in flood season",
      summary: "A farmer from Garsen recounts canoe crossings during the long rains, and how villages agreed on safe crossing points.",
      year: 1997, waterBody: "Rivers", county: "Tana River", place: "Garsen",
      lat: -2.2700, lng: 40.1200,
      tags: ["floods", "canoe", "river crossing", "community rules"],
      creator: "Remembering the Waters field team", interviewer: "Field researcher (sample)", narrator: "Farmer (anonymised)",
      language: "Kipokomo, English transcript", rights: "CC BY-NC 4.0", consent: "Signed consent form on file",
      status: "published", views: 144, added: "2026-05-21",
      transcript: [
        [0,   "In the long rains the river becomes another animal."],
        [35,  "We chose one crossing place for everybody, where the bank was firm and the current slower."],
        [80,  "Children never crossed alone. An elder always held the rope at the bow."],
        [130, "When the water was brown and fast, we waited. Even one day."],
        [165, "Patience was our life jacket."]
      ]
    },
    {
      id: "MSH-0009", type: "testimony", format: "text",
      title: "Learning to swim at Shimoni",
      summary: "A teacher describes starting free swimming lessons for children in a fishing village after a near-drowning on the reef flats.",
      year: 2015, waterBody: "Indian Ocean coast", county: "Kwale", place: "Shimoni",
      lat: -4.6470, lng: 39.3800,
      tags: ["swimming lessons", "children", "education", "prevention"],
      creator: "Submitted by community member (sample)", narrator: "Primary school teacher (anonymised)",
      language: "English", rights: "CC BY-NC 4.0", consent: "Online consent given at submission",
      status: "published", views: 221, added: "2026-06-03",
      body: "Most of the children in our village live beside the sea, yet very few could swim. After one of my pupils was pulled from the water at low tide, we asked the fishermen to help us. On Saturday mornings they stood in the shallows while the children practised floating. In three years more than two hundred children learned. The fishermen say the lessons taught them something too: to wear the jackets they were asking the children to respect."
    },
    {
      id: "MSH-0010", type: "photo", format: "image",
      title: "Harbour pilot boat, Kilindini",
      summary: "Sample photograph of a pilot launch guiding a cargo vessel into the harbour, illustrating professional maritime safety practice.",
      year: 1983, waterBody: "Indian Ocean coast", county: "Mombasa", place: "Kilindini harbour",
      lat: -4.0600, lng: 39.6450,
      tags: ["harbour", "pilotage", "shipping", "professional practice"],
      creator: "Port collection (sample)", photographer: "Unknown",
      language: "—", rights: "Used with permission", consent: "Permission letter on file",
      status: "published", views: 162, added: "2026-06-12",
      scene: "harbour"
    },
    {
      id: "MSH-0011", type: "oral", format: "audio", duration: 176,
      title: "Hippos, reeds and night fishing on Lake Baringo",
      summary: "A fisherman explains how hippo movements shaped where and when canoes went out, and the signals used between boats at night.",
      year: 1989, waterBody: "Lake Baringo", county: "Baringo", place: "Kampi ya Samaki",
      lat: 0.6300, lng: 36.0800,
      tags: ["wildlife", "night fishing", "signals", "traditional knowledge"],
      creator: "Remembering the Waters field team", interviewer: "Field researcher (sample)", narrator: "Fisherman (anonymised)",
      language: "Il Chamus, English transcript", rights: "CC BY-NC 4.0", consent: "Signed consent form on file",
      status: "published", views: 139, added: "2026-06-25",
      transcript: [
        [0,   "The hippo is the master of this lake. We are only visitors."],
        [40,  "At night we kept to the open water and away from the reeds where they rest."],
        [88,  "Two knocks on the hull meant 'I am here'. Three knocks meant 'come quickly'."],
        [140, "Those knocks were older than any telephone."]
      ]
    },
    {
      id: "MSH-0012", type: "record", format: "document",
      title: "Community beach safety notice, Usenge",
      summary: "Sample transcription of a hand-painted notice board at a landing beach, setting out local rules agreed by the beach management unit.",
      year: 2012, waterBody: "Lake Victoria", county: "Siaya", place: "Usenge beach",
      lat: -0.0700, lng: 34.0500,
      tags: ["beach management unit", "community rules", "notice", "regulation"],
      creator: "Beach management unit (sample)", language: "Dholuo, English translation", rights: "Public notice",
      consent: "Not applicable (public notice)", status: "published", views: 118, added: "2026-07-08",
      pages: [
        "BEACH RULES - AGREED BY ALL MEMBERS",
        "No boat leaves without telling the beach office its crew and destination.",
        "Every crew member wears a jacket from the beach store.",
        "No fishing when the warning flag is raised.",
        "Boats return before the evening storm bell."
      ]
    },
    {
      id: "MSH-0013", type: "testimony", format: "text",
      title: "Malindi glass-bottom boat operators",
      summary: "Draft testimony from a tour boat operator about briefing visitors on reef safety. Awaiting metadata review before publication.",
      year: 2019, waterBody: "Indian Ocean coast", county: "Kilifi", place: "Malindi",
      lat: -3.2192, lng: 40.1169,
      tags: ["tourism", "reef", "briefing", "operators"],
      creator: "Remembering the Waters field team", narrator: "Tour operator (anonymised)",
      language: "English", rights: "CC BY-NC 4.0", consent: "Signed consent form on file",
      status: "draft", views: 0, added: "2026-07-19",
      body: "Before any visitor steps on the boat we explain three things: where the jackets are, what to do if they fall in, and why they must not stand on the coral. The briefing takes two minutes. It used to feel like a delay. Now visitors thank us for it."
    }
  ],

  users: [
    { id: "U1", name: "Grace Wanjiru",  email: "admin@demo.ke",      password: "admin1234", role: "admin", status: "active",    joined: "2026-01-10", org: "Remembering the Waters" },
    { id: "U2", name: "Peter Otieno",   email: "researcher@demo.ke", password: "demo1234",  role: "user",  status: "active",    joined: "2026-02-03", org: "University researcher" },
    { id: "U3", name: "Amina Hassan",   email: "amina@demo.ke",      password: "demo1234",  role: "user",  status: "active",    joined: "2026-03-17", org: "Community member, Lamu" },
    { id: "U4", name: "John Kiprotich", email: "john@demo.ke",       password: "demo1234",  role: "admin", status: "active",    joined: "2026-01-12", org: "Remembering the Waters" },
    { id: "U5", name: "Mary Achieng",   email: "mary@demo.ke",       password: "demo1234",  role: "user",  status: "suspended", joined: "2026-04-22", org: "Teacher, Kisumu" }
  ],

  submissions: [
    {
      id: "SUB-101", by: "U3", date: "2026-10-28", status: "pending",
      title: "My father's dhow and the 1960s monsoon season",
      type: "oral", waterBody: "Indian Ocean coast", county: "Lamu", place: "Lamu old town", year: 1964,
      description: "Audio recording (12 min) of my father describing how dhow captains decided when it was safe to sail during the monsoon change.",
      file: "baba_dhow_story.m4a", consent: true
    },
    {
      id: "SUB-102", by: "U2", date: "2026-11-02", status: "pending",
      title: "Scanned fishing licence with safety conditions",
      type: "record", waterBody: "Lake Victoria", county: "Migori", place: "Muhuru Bay", year: 1979,
      description: "A licence from my grandfather's papers. The back lists conditions including carrying a lamp and a bailer.",
      file: "licence_scan.pdf", consent: true
    },
    {
      id: "SUB-103", by: "U2", date: "2026-11-09", status: "pending",
      title: "Photo: life-jacket store at Dunga beach",
      type: "photo", waterBody: "Lake Victoria", county: "Kisumu", place: "Dunga beach", year: 2021,
      description: "Photo I took of the beach's shared life-jacket store and sign-out board.",
      file: "dunga_store.jpg", consent: true
    }
  ],

  messages: [
    { id: "M1", name: "School headteacher, Kisumu", email: "head@example.ke", date: "2026-11-05", subject: "Using the archive in lessons", body: "Can our pupils use the oral histories in a water-safety lesson? We would credit the archive.", read: false },
    { id: "M2", name: "Journalist", email: "desk@example.ke", date: "2026-11-08", subject: "Interview request", body: "We are preparing a feature on community rescue groups and would like to speak with the research team.", read: false }
  ],

  activity: [
    { t: "2026-11-09 16:22", who: "Peter Otieno",  what: "submitted 'Photo: life-jacket store at Dunga beach' for review" },
    { t: "2026-11-08 10:05", who: "Grace Wanjiru", what: "published MSH-0012 'Community beach safety notice, Usenge'" },
    { t: "2026-11-05 09:41", who: "Grace Wanjiru", what: "suspended account mary@demo.ke" },
    { t: "2026-11-02 14:10", who: "Peter Otieno",  what: "submitted 'Scanned fishing licence with safety conditions' for review" },
    { t: "2026-10-28 18:33", who: "Amina Hassan",  what: "submitted 'My father's dhow and the 1960s monsoon season' for review" }
  ],

  visitsByMonth: [
    ["Jun", 640], ["Jul", 910], ["Aug", 1180], ["Sep", 1420], ["Oct", 1975], ["Nov", 1310]
  ]
};
