// Employers worth watching in Bahrain and Saudi Arabia, plus the Gulf-adjacent
// tech companies that hire remotely into the region.
//
// `node src/discover.js` probes each of these against six ATS platforms and
// records the ones with a public job board. Add any company you would work for
// — the probe is cheap and a miss costs nothing.
//
// Skewed towards the employers that actually run Angular and .NET: banks,
// telcos, government technology arms, ERP and systems integrators. That is
// where an enterprise Microsoft stack lives, and it is exactly the segment the
// startup job boards do not cover.

export const BAHRAIN = [
  // Banking and finance — the largest Microsoft-stack employers in the country
  'National Bank of Bahrain', 'NBB', 'BBK', 'Ahli United Bank', 'Al Salam Bank',
  'Bahrain Islamic Bank', 'Bank ABC', 'Arab Banking Corporation', 'GFH Financial Group',
  'Investcorp', 'Kuwait Finance House Bahrain', 'Bahrain Development Bank',
  'Eskan Bank', 'Khaleeji Commercial Bank', 'Seef Properties',

  // Telecom and infrastructure
  'Batelco', 'Beyon', 'Beyon Solutions', 'Beyon Cyber', 'stc Bahrain', 'Zain Bahrain',

  // Technology and security
  'CTM360', 'Silah Gulf', 'BENEFIT Company', 'Bahrain Internet Exchange',
  'Gulf Business Machines', 'GBM', 'Almoayyed Computers', 'Intertec Systems',
  'Fakhro Electronics', 'Nass Corporation',

  // Industry, aviation, energy
  'Gulf Air', 'Bapco', 'Bapco Energies', 'Alba', 'Aluminium Bahrain',
  'Bahrain Airport Company', 'APM Terminals Bahrain', 'Electricity and Water Authority',

  // Government and quasi-government
  'Tamkeen', 'Bahrain Economic Development Board', 'Information e-Government Authority',
  'Labour Fund', 'Social Insurance Organisation',
];

export const SAUDI = [
  // Banking
  'Saudi National Bank', 'Al Rajhi Bank', 'Riyad Bank', 'Saudi Awwal Bank',
  'Alinma Bank', 'Bank Albilad', 'Banque Saudi Fransi', 'Arab National Bank',

  // Telecom
  'stc', 'stc pay', 'Mobily', 'Zain KSA', 'Solutions by stc',

  // Government technology — big Microsoft-stack employers
  'Elm', 'Thiqah', 'Tahakom', 'SDAIA', 'Saudi Data and AI Authority',
  'Digital Government Authority', 'NEOM', 'Tonomus', 'Saudi Aramco', 'Aramco Digital',

  // Fintech and startups — these are the ones most likely on a modern ATS
  'Tabby', 'Tamara', 'Foodics', 'Lean Technologies', 'Hala', 'Rasan', 'Unifonic',
  'Mozn', 'Quant', 'Sary', 'Salla', 'Zid', 'Jahez', 'Nana', 'Noon', 'Nupco',
  'Manafa', 'Malaa', 'Tweeq', 'Geidea', 'PayTabs', 'HyperPay', 'Moyasar',

  // Consulting and systems integration
  'Saudi Business Machines', 'Ejada', 'Innovative Solutions', 'AlJammaz Technologies',
];

// Gulf-adjacent: UAE and Qatar employers that hire Bahrain-based engineers, and
// international firms with Gulf delivery centres.
export const GULF_ADJACENT = [
  'Careem', 'Talabat', 'Property Finder', 'Bayut', 'Dubizzle', 'Emirates NBD',
  'First Abu Dhabi Bank', 'e& enterprise', 'Etisalat', 'G42', 'Presight',
  'Ooredoo', 'Qatar Airways', 'Aramex', 'Chalhoub Group', 'Majid Al Futtaim',
];

export const COMPANIES = [...BAHRAIN, ...SAUDI, ...GULF_ADJACENT];
export default COMPANIES;
