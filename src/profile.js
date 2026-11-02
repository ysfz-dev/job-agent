// Yousaf Khan — derived from "Yousaf Khan - Software Engineer.pdf".
// Edit this file to retune what the agent looks for; everything downstream
// reads from here.

export const profile = {
  name: 'Yousaf Khan',
  email: 'yousaf973bh@gmail.com',
  phone: '+973-39260916',
  linkedin: 'https://linkedin.com/in/yousafkhan973/',
  basedIn: 'Manama, Bahrain',
  // Bahraini citizen, so a GCC national: no visa or sponsorship anywhere in the
  // GCC, and eligible for the "Bahraini nationals only" roles that make up a
  // real share of Bahrain's market. Only Canada and Australia need sponsorship.
  nationality: 'Bahraini',
  yearsExperience: 3,
  graduated: 2023,

  // Weighted by how central each is to his actual day job. A posting wanting
  // Angular AND .NET is the bullseye; one wanting only a loose adjacent skill
  // should not score like one.
  skills: {
    angular:            10,
    '.net':             10,
    'asp.net core':     10,
    'c#':                9,
    'entity framework':  6,
    'sql server':        7,
    typescript:          7,
    'rest api':          5,
    rxjs:                4,
    tailwind:            3,
    'angular material':  3,
    devextreme:          3,
    dapper:              3,
    mqtt:                4,
    websockets:          3,
    ionic:               2,
    azure:               4,       // AZ-104
    sql:                 4,
    'full stack':        5,
    erp:                 5,
    'multi-tenant':      4,
    microservices:       3,
    // Business consulting at Amthal (pre-sales, BIC time attendance, Sports Village Qatar)
    // and the stack of his own platform, Tajer Al Fareej (added 2026-10-20).
    consultant:          5,
    'pre-sales':         4,
    'solution consultant': 5,
    'business analyst':  3,
    nestjs:              6,
    postgresql:          4,
    'react native':      3,
  },

  // Where he can actually work, in the order he wants them.
  //
  // This list IS the ranking — reorder it and the daily picks reorder with it.
  // The points gap between tiers is deliberately wide: location outweighs a
  // perfect stack match, because a perfect Angular/.NET role in Poland is not a
  // job he can take. Anything not matched here is rejected unless the posting
  // explicitly offers relocation or sponsorship.
  locationPriority: [
    { label: 'Bahrain', points: 45, flag: 'no-visa-needed',
      match: ['bahrain', 'manama', 'riffa', 'muharraq', 'sitra', 'isa town'] },
    { label: 'Riyadh', points: 40, flag: 'no-visa-needed',
      match: ['riyadh'] },
    { label: 'Saudi Arabia', points: 36, flag: 'no-visa-needed',
      match: ['saudi', 'jeddah', 'khobar', 'dammam', 'dhahran', 'ksa'] },
    { label: 'remote, worldwide', points: 32, flag: null,
      match: ['worldwide', 'anywhere', 'global', 'remote - global'] },
    { label: 'Gulf', points: 26, flag: 'no-visa-needed',
      match: ['uae', 'dubai', 'abu dhabi', 'qatar', 'doha', 'kuwait', 'oman', 'muscat', 'gcc'] },
    { label: 'Canada', points: 20, flag: 'needs-sponsorship',
      match: ['canada', 'toronto', 'vancouver', 'montreal', 'ottawa', 'calgary', 'edmonton'] },
    { label: 'Australia', points: 12, flag: 'needs-sponsorship',
      match: ['australia', 'sydney', 'melbourne', 'brisbane', 'perth', 'adelaide', 'canberra'] },
  ],

  // Matched against a posting's location string.
  localRegions: [
    'bahrain', 'manama', 'saudi', 'riyadh', 'jeddah', 'khobar', 'dammam',
    'gcc', 'gulf', 'middle east', 'mena', 'uae', 'dubai', 'qatar', 'doha',
    'kuwait', 'oman',
  ],
  sponsorshipRegions: ['australia', 'canada', 'sydney', 'melbourne', 'brisbane',
    'perth', 'toronto', 'vancouver', 'montreal', 'ottawa', 'calgary'],

  // Needs sponsorship for AU/CA. This drives a hard penalty on postings that
  // say they will not sponsor.
  needsSponsorship: true,

  // Titles worth applying to.
  //
  // "developer", "engineer" and "programmer" are here on their own on purpose.
  // The specific list missed "Mobile Developer" and "Oracle APEX Developer" —
  // both real Manama engineering jobs — and rejected them as non-engineering.
  // The bare words are safe because badTitles is checked first, so "SALES
  // ENGINEER – WATERPROOFING CONTRACTING" is already gone before this runs.
  goodTitles: [
    'software engineer', 'software developer', 'full stack', 'fullstack',
    'full-stack', 'backend', 'back end', 'back-end', 'frontend', 'front end',
    'front-end', 'angular', '.net', 'dotnet', 'web developer',
    'application developer', 'systems engineer', 'erp',
    'developer', 'engineer', 'programmer',
    // Word-boundary matching means "developer" does not match "Web Developers
    // – Bahrain", which was rejected as not an engineering role.
    'developers', 'engineers', 'programmers',
    // He also works as a business and solutions consultant at Amthal, and has
    // a CV for it. These only score well in the Gulf, where location points
    // carry them; elsewhere they fall under the threshold on stack alone.
    'solutions consultant', 'solution consultant', 'technical consultant',
    'implementation consultant', 'erp consultant', 'pre-sales', 'presales',
    'business analyst',
  ],

  // Roles that are not his job, whatever the keyword overlap.
  badTitles: [
    'sales', 'marketing', 'recruiter', 'customer success', 'account executive',
    'account manager', 'business development', 'designer', 'copywriter',
    'data entry', 'teacher', 'tutor', 'nurse', 'driver', 'accountant',
    'intern', 'internship', 'volunteer', 'unpaid',
    // Other engineering professions. Bare "engineer" is a good title, so
    // without these "Civil Engineer" in Bahrain scored 52 on location alone.
    'civil', 'mechanical', 'electrical', 'structural', 'mep', 'hvac',
    'site engineer', 'quantity surveyor', 'chemical', 'petroleum', 'process engineer',
    'planning engineer', 'qa/qc', 'hse', 'maintenance engineer', 'biomedical',
  ],

  // 3 YOE: too junior for these, over-qualified for none of them.
  overSeniorTitles: ['principal', 'staff engineer', 'head of', 'director',
    'vp ', 'chief', 'architect', 'manager,', 'engineering manager'],

  // What the autofill bookmarklet types into application forms.
  //
  // CHECK THESE BEFORE USING IT. An empty value is skipped rather than guessed,
  // which is deliberate: a wrong notice period or salary is worse than a blank
  // field, because a screening filter rejects on it and you never hear why.
  application: {
    firstName: 'Yousaf',
    lastName: 'Khan',
    fullName: 'Yousaf Khan',
    email: 'yousaf973bh@gmail.com',
    phone: '+973 39260916',
    linkedin: 'https://linkedin.com/in/yousafkhan973/',
    github: '',
    website: '',
    addressCity: 'Manama',
    addressCountry: 'Bahrain',
    currentCompany: 'Amthal Group',
    currentTitle: 'Software Engineer',
    nationality: 'Bahraini',
    yearsExperience: '3',
    degree: 'BSc Software Engineering',
    university: 'University of Bahrain',
    graduationYear: '2023',

    // Blank on purpose — decide these yourself, then fill them in here.
    noticePeriod: '',
    salaryExpectation: '',

    // Screening answers, matched by meaning rather than exact wording.
    // null = leave the field alone; the right answer depends on the posting.
    authorizedInCountry: null,
    requiresSponsorship: null,
    willingToRelocate: 'yes',
    willingToTravel: 'yes',
  },
};

export default profile;
