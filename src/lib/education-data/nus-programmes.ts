// NUS undergraduate faculties/schools and the degree programmes offered
// under each, for the onboarding form's Faculty -> Programme dropdown.
// Source: NUS Bulletin AY2026/27 (nus.edu.sg/nusbulletin/ay202627), each
// faculty's own Undergraduate Education page. College of Humanities and
// Sciences and NUS College are deliberately excluded - both are overlay
// colleges without their own standalone majors (a student under either
// still majors through FASS/Science or another faculty).

export type NusFaculty = {
  name: string;
  programmes: string[];
};

export const nusFaculties: NusFaculty[] = [
  {
    name: "Faculty of Arts and Social Sciences",
    programmes: [
      "Anthropology",
      "Chinese Language",
      "Chinese Studies",
      "Communications and New Media",
      "Economics",
      "English Language and Linguistics",
      "English Literature",
      "Geography",
      "Global Studies",
      "History",
      "Japanese Studies",
      "Malay Studies",
      "Philosophy",
      "Philosophy, Political Science and Economics",
      "Political Science",
      "Psychology",
      "Social Work",
      "Sociology",
      "South Asian Studies",
      "Southeast Asian Studies",
      "Theatre and Performance Studies",
    ],
  },
  {
    name: "NUS Business School",
    programmes: [
      "Bachelor of Business Administration (Honours) - Accountancy",
      "Bachelor of Business Administration (Honours) - Applied Business Analytics",
      "Bachelor of Business Administration (Honours) - Business Economics",
      "Bachelor of Business Administration (Honours) - Finance",
      "Bachelor of Business Administration (Honours) - Innovation and Entrepreneurship",
      "Bachelor of Business Administration (Honours) - Leadership and Human Capital Management",
      "Bachelor of Business Administration (Honours) - Marketing",
      "Bachelor of Business Administration (Honours) - Operations and Supply Chain Management",
      "Bachelor of Business Administration (Honours) - Real Estate",
      "Bachelor of Business Administration (Accountancy) with Honours",
      "Bachelor of Business Administration (Real Estate) with Honours",
    ],
  },
  {
    name: "School of Computing",
    programmes: [
      "Bachelor of Computing in Computer Science",
      "Bachelor of Computing in Information Security",
      "Bachelor of Science in Business Analytics",
      "Bachelor of Computing in Business Artificial Intelligence Systems",
      "Bachelor of Computing in Artificial Intelligence",
      "Bachelor of Engineering in Computer Engineering",
    ],
  },
  {
    name: "Faculty of Dentistry",
    programmes: ["Bachelor of Dental Surgery"],
  },
  {
    name: "College of Design and Engineering",
    programmes: [
      "Bachelor of Arts (Architecture)",
      "Bachelor of Arts (Industrial Design)",
      "Bachelor of Landscape Architecture",
      "Bachelor of Engineering (Biomedical Engineering)",
      "Bachelor of Engineering (Chemical Engineering)",
      "Bachelor of Engineering (Civil Engineering)",
      "Bachelor of Engineering (Computer Engineering)",
      "Bachelor of Engineering (Electrical Engineering)",
      "Bachelor of Engineering (Engineering Science)",
      "Bachelor of Engineering (Environmental and Sustainability Engineering)",
      "Bachelor of Engineering (Industrial and Systems Engineering)",
      "Bachelor of Engineering (Infrastructure and Project Management)",
      "Bachelor of Engineering (Materials Science and Engineering)",
      "Bachelor of Engineering (Mechanical Engineering)",
      "Bachelor of Engineering (Robotics and Machine Intelligence)",
    ],
  },
  {
    name: "Faculty of Law",
    programmes: ["Bachelor of Laws"],
  },
  {
    name: "Yong Loo Lin School of Medicine",
    programmes: [
      "Bachelor of Medicine and Bachelor of Surgery",
      "Bachelor of Science (Nursing)",
      "Bachelor of Science (Nursing) (Honours)",
    ],
  },
  {
    name: "Yong Siew Toh Conservatory of Music",
    programmes: ["Bachelor of Music (Honours)"],
  },
  {
    name: "Faculty of Science",
    programmes: [
      "Bachelor of Science (Honours) - Chemistry",
      "Bachelor of Science (Honours) - Data Science and Analytics",
      "Bachelor of Science (Honours) - Data Science and Economics",
      "Bachelor of Science (Honours) - Food Science and Technology",
      "Bachelor of Science (Honours) - Life Sciences",
      "Bachelor of Science (Honours) - Mathematics",
      "Bachelor of Science (Honours) - Pharmaceutical Science",
      "Bachelor of Science (Honours) - Physics",
      "Bachelor of Science (Honours) - Quantitative Finance",
      "Bachelor of Science (Honours) - Statistics",
      "Bachelor of Pharmacy",
      "Bachelor of Pharmacy (Honours)",
      "Bachelor of Environmental Studies (Honours)",
    ],
  },
];
