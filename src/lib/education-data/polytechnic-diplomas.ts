// The 5 Singapore polytechnics and their full-time diploma courses, grouped
// by school, for the onboarding form's Polytechnic -> Diploma dropdown.
// Confidence varies by source (see commit message for details): Ngee Ann
// and Nanyang were sourced from each polytechnic's own current course
// listings; Singapore, Temasek and Republic Polytechnic's course pages are
// JS-rendered single-page apps that resist scraping, so those three were
// pieced together from each polytechnic's own official prospectus/combined
// guide PDFs instead - worth a spot-check against their live course pages
// if a listed diploma or school grouping looks off.

export type PolytechnicSchool = {
  school: string;
  diplomas: string[];
};

export type Polytechnic = {
  name: string;
  schools: PolytechnicSchool[];
};

export const polytechnics: Polytechnic[] = [
  {
    name: "Ngee Ann Polytechnic",
    schools: [
      {
        school: "School of Business & Accountancy",
        diplomas: [
          "Diploma in Accountancy",
          "Diploma in Banking & Finance",
          "Diploma in Business Studies",
          "Common Business Programme",
          "Diploma in International Trade & Business",
          "Diploma in Tourism & Resort Management",
        ],
      },
      {
        school: "School of Design & Environment",
        diplomas: [
          "Diploma in Design",
          "Diploma in Hotel & Leisure Facilities Management",
          "Diploma in Real Estate Business",
        ],
      },
      {
        school: "School of Engineering",
        diplomas: [
          "Diploma in Aerospace Engineering",
          "Diploma in Mechatronics & Robotics",
          "Diploma in Biomedical Engineering",
          "Common Engineering Programme",
          "Diploma in Electrical Engineering",
          "Diploma in Electronic & Computer Engineering",
          "Diploma in Engineering Science",
          "Diploma in Offshore & Sustainable Engineering",
          "Diploma in Mechanical Engineering",
        ],
      },
      {
        school: "School of Film & Media Studies",
        diplomas: [
          "Common Media Programme",
          "Diploma in Film, Sound & Video",
          "Diploma in Mass Communication",
          "Diploma in Media Post-Production",
        ],
      },
      {
        school: "School of Health Sciences",
        diplomas: ["Diploma in Nursing", "Diploma in Optometry"],
      },
      {
        school: "School of Humanities & Interdisciplinary Studies",
        diplomas: [
          "Diploma in Arts Business Management",
          "Diploma in Chinese Media & Communication",
          "Diploma in Chinese Studies",
          "Diploma in Psychology & Community Development",
          "Diploma in Early Childhood Development & Education",
          "Diploma in Tamil Studies with Early Education",
        ],
      },
      {
        school: "School of InfoComm Technology",
        diplomas: [
          "Common ICT Programme",
          "Diploma in Applied AI & Analytics",
          "Diploma in Computing with Law",
          "Diploma in Cybersecurity & Digital Forensics",
          "Diploma in Information Technology",
        ],
      },
      {
        school: "School of Life Sciences & Chemical Technology",
        diplomas: [
          "Common Science Programme",
          "Diploma in Biomedical Science",
          "Diploma in Chemical & Biomolecular Engineering",
          "Diploma in Environmental Science & Sustainability",
          "Diploma in Landscape Design & Horticulture",
          "Diploma in Pharmaceutical Science",
        ],
      },
    ],
  },
  {
    name: "Nanyang Polytechnic",
    schools: [
      {
        school: "School of Design & Media",
        diplomas: [
          "Diploma in Experience Design",
          "Diploma in Animation, Games & Visual Effects",
          "Diploma in Architecture",
          "Diploma in Communication & Motion Design",
          "Diploma in Game Development & Technology",
          "Common Design & Media Programme",
        ],
      },
      {
        school: "School of Applied Science",
        diplomas: [
          "Diploma in Applied Chemistry",
          "Diploma in Biomedical Science with Analytics",
          "Diploma in Food Science & Nutrition",
          "Diploma in Pharmaceutical Science",
          "Diploma in Biopharmaceutical & Chemical Engineering",
          "Common Science Programme",
        ],
      },
      {
        school: "School of Business Management",
        diplomas: [
          "Diploma in Accountancy & Finance",
          "Diploma in Banking & Finance",
          "Diploma in Business Management",
          "Diploma in Food & Beverage Business",
          "Diploma in Hospitality & Tourism Management",
          "Diploma in Media & Communication Management",
          "Diploma in Sport & Wellness Management",
          "Common Business Programme",
        ],
      },
      {
        school: "School of Engineering",
        diplomas: [
          "Diploma in Advanced & Digital Manufacturing",
          "Diploma in Aerospace Engineering",
          "Diploma in AI & Data Engineering",
          "Diploma in Biomedical Engineering",
          "Diploma in Cloud Engineering",
          "Diploma in Electronic & Computer Engineering",
          "Diploma in Sustainability in Engineering with Business",
          "Diploma in AI Robotics",
          "Common Engineering Programme",
        ],
      },
      {
        school: "School of Health & Social Sciences",
        diplomas: [
          "Diploma in Nursing",
          "Diploma in Oral Health Therapy",
          "Diploma in Social Work",
        ],
      },
      {
        school: "School of Information Technology",
        diplomas: [
          "Diploma in Applied AI & Analytics",
          "Diploma in Business & Financial Technology",
          "Diploma in Cybersecurity & Digital Forensics",
          "Diploma in Computing",
          "Common ICT Programme",
        ],
      },
      {
        school: "Common Programmes",
        diplomas: ["Common Business & Technology Programme"],
      },
    ],
  },
  {
    name: "Singapore Polytechnic",
    schools: [
      {
        school: "School of Architecture & the Built Environment",
        diplomas: [
          "Diploma in Architecture",
          "Diploma in Civil Engineering",
          "Diploma in Facilities Management",
          "Diploma in Interior Design",
          "Diploma in Integrated Events & Project Management",
          "Diploma in Landscape Architecture",
        ],
      },
      {
        school: "School of Business",
        diplomas: [
          "Diploma in Accountancy",
          "Diploma in Banking & Finance",
          "Diploma in Business Administration",
          "Common Business Programme",
          "Diploma in Human Resource Management with Psychology",
        ],
      },
      {
        school: "School of Chemical & Life Sciences",
        diplomas: [
          "Diploma in Applied Chemistry",
          "Diploma in Biomedical Science",
          "Diploma in Chemical Engineering",
          "Common Science Programme",
          "Diploma in Food Science & Technology",
          "Diploma in Optometry",
          "Diploma in Perfumery & Cosmetic Science",
        ],
      },
      {
        school: "School of Computing",
        diplomas: [
          "Diploma in Applied AI & Analytics",
          "Common ICT Programme",
          "Diploma in Cybersecurity & Digital Forensics",
          "Diploma in Information Technology",
        ],
      },
      {
        school: "Media, Arts & Design School",
        diplomas: ["Diploma in Media, Arts & Design"],
      },
      {
        school: "SP Engineering (EEE / MAE)",
        diplomas: [
          "Diploma in Aeronautical Engineering",
          "Diploma in Aerospace Electronics",
          "Common Engineering Programme",
          "Diploma in Computer Engineering",
          "Diploma in Engineering with Business",
          "Diploma in Electrical & Electronic Engineering",
          "Diploma in Mechanical Engineering",
          "Diploma in Mechatronics & Robotics",
        ],
      },
      {
        school: "Singapore Maritime Academy",
        diplomas: [
          "Diploma in Marine Engineering",
          "Diploma in Maritime Business",
          "Diploma in Nautical Studies",
        ],
      },
    ],
  },
  {
    name: "Temasek Polytechnic",
    schools: [
      {
        school: "School of Applied Science",
        diplomas: [
          "Diploma in Chemical Engineering",
          "Diploma in Food, Nutrition & Culinary Science",
          "Diploma in Medical Biotechnology",
          "Diploma in Pharmaceutical Science",
          "Diploma in Veterinary Technology",
        ],
      },
      {
        school: "School of Business",
        diplomas: [
          "Diploma in Accountancy & Finance",
          "Diploma in Business",
          "Diploma in Communications & Media Management",
          "Diploma in Culinary Arts & Management",
          "Diploma in Hospitality & Tourism Management",
          "Diploma in International Trade & Logistics",
          "Diploma in Law & Management",
          "Diploma in Marketing",
        ],
      },
      {
        school: "School of Design",
        diplomas: [
          "Diploma in Communication Design",
          "Diploma in Digital Film & Television",
          "Diploma in Fashion Management & Design",
          "Diploma in Interior Architecture & Design",
          "Diploma in Product Experience & Design",
        ],
      },
      {
        school: "School of Engineering",
        diplomas: [
          "Diploma in Aerospace Electronics",
          "Diploma in Aerospace Engineering",
          "Diploma in Architectural Technology & Building Services",
          "Diploma in Aviation Management",
          "Diploma in Biomedical Engineering",
          "Diploma in Business Process & Systems Engineering",
          "Diploma in Computer Engineering",
          "Diploma in Electronics",
          "Diploma in Integrated Facility Management",
          "Diploma in Mechatronics",
        ],
      },
      {
        school: "School of Humanities & Social Sciences",
        diplomas: [
          "Diploma in Early Childhood Development & Education",
          "Diploma in Psychology Studies",
          "Diploma in Social Sciences in Gerontology",
        ],
      },
      {
        school: "School of Informatics & IT",
        diplomas: [
          "Diploma in Applied Artificial Intelligence",
          "Diploma in Big Data & Analytics",
          "Diploma in Cybersecurity & Digital Forensics",
          "Diploma in Immersive Media & Game Development",
          "Diploma in Information Technology",
        ],
      },
      {
        school: "Common Programmes",
        diplomas: [
          "Common Science Programme",
          "Common Business Programme",
          "Common Design Programme",
        ],
      },
    ],
  },
  {
    name: "Republic Polytechnic",
    schools: [
      {
        school: "School of Applied Science",
        diplomas: [
          "Diploma in Applied Chemistry",
          "Diploma in Biomedical Science",
          "Diploma in Biotechnology",
          "Diploma in Environmental & Marine Science",
          "Diploma in Pharmaceutical Science",
        ],
      },
      {
        school: "School of Engineering",
        diplomas: [
          "Diploma in Aerospace Engineering",
          "Diploma in Aviation Management",
          "Diploma in Electrical & Electronic Engineering",
          "Diploma in Engineering Design with Business",
          "Diploma in Engineering Systems & Management",
          "Diploma in Industrial & Operations Management",
          "Diploma in Supply Chain Management",
          "Diploma in Sustainable Built Environment",
        ],
      },
      {
        school: "School of Hospitality",
        diplomas: [
          "Diploma in Customer Experience Management with Business",
          "Diploma in Hotel & Hospitality Management",
          "Diploma in Integrated Events Management",
          "Diploma in Restaurant & Culinary Operations",
          "Diploma in Tourism Management with Technology",
        ],
      },
      {
        school: "School of Infocomm",
        diplomas: [
          "Diploma in Business Information Systems",
          "Diploma in Digital Design & Development",
          "Diploma in Financial Technology",
          "Diploma in Infocomm Security Management",
          "Diploma in Information Technology",
        ],
      },
      {
        school: "School of Business",
        diplomas: [
          "Diploma in Business",
          "Diploma in Consumer Behaviour & Research",
          "Diploma in Human Resource Management with Psychology",
          "Diploma in Mass Communication",
        ],
      },
      {
        school: "School of Sports and Health",
        diplomas: [
          "Diploma in Health Management & Promotion",
          "Diploma in Health Services Management",
          "Diploma in Outdoor & Adventure Learning",
          "Diploma in Sport Coaching",
          "Diploma in Sport & Exercise Science",
        ],
      },
      {
        school: "School of Technology for Arts, Media and Design",
        diplomas: [
          "Diploma in Arts & Theatre Management",
          "Diploma in Design for Games & Gamification",
          "Diploma in Design for User Experience",
          "Diploma in Media Production & Design",
          "Diploma in Sonic Arts",
        ],
      },
    ],
  },
];
