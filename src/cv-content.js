// What the CV says. Every regional version in src/cv.js is built from this.
//
// career-ops/cv.md is the fact source — career-ops checks every tailored CV
// against it. `npm run cv` warns when a line here no longer appears there, so
// the two cannot quietly drift apart. Change a fact in cv.md first, then here.
//
// **double asterisks** mark the phrases set in bold.

export const cv = {
  name: ['YOUSAF', 'KHAN'],
  email: 'yousaf973bh@gmail.com',
  phone: '+973 3926 0916',
  city: 'Manama, Bahrain',
  linkedin: 'linkedin.com/in/yousafkhan973',
  portfolio: 'tajeralfareej.com',
  headline: 'Full-Stack Software Engineer & Business Consultant · Angular & .NET',

  profile: 'Full-stack engineer with **3+ years** building and maintaining a large-scale '
    + '**multi-tenant ERP platform** end to end — Angular front end, ASP.NET Core APIs, SQL '
    + 'Server data layer and real-time IoT integration. Also works **client-facing as a '
    + 'business consultant**: understanding how a client operates, shaping the solution and '
    + 'leading its implementation through to go-live.',

  jobs: [
    {
      dates: 'Nov 2023 – Present',
      role: 'Software Engineer & Business Consultant',
      org: 'Amthal Group · Manama, Bahrain',
      intro: 'Build and maintain **Optimum ERP**, a multi-tenant platform covering HR, Finance, '
        + 'Procurement, Attendance, Access Control, Asset Management, Document Management and '
        + 'CRM, and consult for clients on the solutions they need.',
      bullets: [
        { id: 'modules', text: 'Deliver ERP modules **end to end** — SQL Server schema and business logic, ASP.NET Core REST APIs, server-side PDF reporting, and the Angular UI on top.' },
        { id: 'library', text: 'Built the **shared Angular component library** (Angular Material, DevExtreme, Tailwind CSS) that every module\'s interface is assembled from.' },
        { id: 'data', text: 'Designed and maintain data-access layers with **Entity Framework Core and Dapper**, choosing per case between ORM convenience and hand-tuned SQL.' },
        { id: 'rtl', text: 'Implemented **full Arabic/English localisation** with complete right-to-left layout support across the platform.' },
        { id: 'mqtt', text: 'Integrated **biometric and access-control hardware over MQTT**, keeping device events and ERP attendance records synchronised in real time.' },
        { id: 'presales', text: 'Act as **business and solutions consultant in pre-sales**: run client meetings, map their requirements to the platform and propose the solution.' },
        { id: 'bic', text: 'Implemented the **time-attendance system for Bahrain International Circuit (BIC)** end to end — requirements, biometric device setup and integration, rollout and staff training.' },
        { id: 'qatar', text: 'Currently engaged with **Sports Village Qatar**, assessing their operations and recommending technology solutions.' },
      ],
    },
    {
      dates: 'Aug 2023 – Oct 2023',
      role: 'Software Engineer Intern',
      org: 'Gulf Aviation Academy · Manama, Bahrain',
      bullets: [
        { id: 'inventory', text: 'Built an **inventory management system in PHP** that tracked academy assets and replaced manual stock handling.' },
        { id: 'support', text: 'Provided IT support and troubleshooting for academy staff.' },
      ],
    },
  ],

  projects: [
    {
      name: 'Tajer Al Fareej — e-commerce platform for GCC home businesses',
      meta: 'founder & sole engineer · live at tajeralfareej.com · Angular 22 SSR · NestJS · PostgreSQL · React Native',
      bullets: [
        { id: 'storefronts', text: 'Designed, built and launched **bilingual Arabic/English (RTL) storefronts** with ordering to the seller\'s WhatsApp, and a back office for orders, customers, inventory, costing and reports.' },
        { id: 'zatca', text: 'Built **double-entry accounting, VAT returns and Saudi ZATCA phase 2 e-invoicing** (UBL XML, ECDSA signing, tested against the official sandbox), bookings, delivery zones, staff roles with row-level security, webhooks and an API.' },
        { id: 'tests', text: 'Layered NestJS API over tested SQL migrations, **Playwright end-to-end tests** and GitHub Actions CI; companion **React Native (Expo)** app.' },
        { id: 'gtm', text: 'Lead go-to-market: seller onboarding, shop setup and outreach.' },
      ],
    },
  ],

  skills: [
    ['Languages', 'C#, TypeScript, SQL, PHP'],
    ['Frontend', 'Angular, Angular Material, Tailwind CSS, DevExtreme, RxJS, Ionic'],
    ['Backend', 'ASP.NET Core, EF Core, Dapper, NestJS, TypeORM'],
    ['Database', 'SQL Server'],
    ['Real-time', 'MQTT, MQTTnet, WebSockets'],
    ['Testing', 'Vitest, xUnit, unit testing'],
    ['Tools & practice', 'Git, Azure, Swagger, Agile, code review'],
  ],
  consulting: 'Pre-sales and client meetings, requirements gathering, solution design and proposals, end-to-end implementation, user training',
  education: { degree: 'BSc Software Engineering', school: 'University of Bahrain', dates: '2019 – 2023' },
  certification: { name: 'Microsoft Azure Administrator (AZ-104)', issuer: 'Microsoft', date: 'Aug 2023' },
  languages: [['English', 'Proficient', 88], ['Arabic', 'Intermediate', 55]],
};

export default cv;
