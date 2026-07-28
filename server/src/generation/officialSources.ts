import type { SourceReference, TopicPlan } from "../types.js";

const reviewedAt = "2026-07-29";

// Keep claims narrow and stable. Time-sensitive details belong in an operator-added source.
export const officialSources: SourceReference[] = [
  {
    id: "ntu-student-life",
    title: "Student Life | NTU Singapore",
    url: "https://www.ntu.edu.sg/life-at-ntu/student-life",
    publisher: "NTU Singapore",
    accessedAt: reviewedAt,
    claims: [
      "NTU 的 One Stop @ SAC 为学术、财务、住宿、招生和校园生活事务提供集中支持。",
      "NTU 为学生提供辅导、同伴支持、学术指导和辅导等支持服务。"
    ]
  },
  {
    id: "ntu-international-students",
    title: "International Students | NTU Singapore",
    url: "https://www.ntu.edu.sg/life-at-ntu/student-life/student-activities-and-engagement/inclusion-and-integration/int-students",
    publisher: "NTU Singapore",
    accessedAt: reviewedAt,
    claims: [
      "NTU 为国际学生提供融入校园生活的活动与资源介绍。",
      "国际学生可参与社团、社区参与、体育和住宿教育等校园生活机会。"
    ]
  },
  {
    id: "ntu-academic-calendar",
    title: "Academic Calendars | NTU Singapore",
    url: "https://www.ntu.edu.sg/admissions/matriculation/academic-calendars",
    publisher: "NTU Singapore",
    accessedAt: reviewedAt,
    claims: [
      "NTU 在 Academic Calendars 页面发布学期日历和本科生关键学术活动安排。",
      "涉及具体日期、课程或学术要求时，应以该官方页面及其链接文件的最新版本为准。"
    ]
  },
  {
    id: "ntu-clubs-societies",
    title: "Clubs & Societies | NTU Singapore",
    url: "https://www.ntu.edu.sg/life-at-ntu/student-life/student-activities-and-engagement",
    publisher: "NTU Singapore",
    accessedAt: reviewedAt,
    claims: [
      "NTU 通过学生社团和组织为学生提供交流、成长和学生主导活动的平台。",
      "学校层面的学生组织包括学生会、研究生组织、兴趣社团、宿舍理事会和校队等类别。"
    ]
  },
  {
    id: "ntu-library-services",
    title: "NTU Library Services | NTU Singapore",
    url: "https://www.ntu.edu.sg/education/libraries/services",
    publisher: "NTU Singapore",
    accessedAt: reviewedAt,
    claims: [
      "NTU Library 为 NTU 社群提供学习、教学和研究支持服务。",
      "图书馆服务页面列出借阅、续借、课程保留资料、文献检索、信息素养、数据库和往年试题等资源。"
    ]
  },
  {
    id: "ntu-library-spaces",
    title: "About NTU Library | NTU Singapore",
    url: "https://www.ntu.edu.sg/education/libraries/about-ntu-library",
    publisher: "NTU Singapore",
    accessedAt: reviewedAt,
    claims: [
      "NTU Library 提供开放及可预约的学习和协作空间。",
      "李伟南图书馆、商学院图书馆和中文图书馆设有安静学习区域；具体可用性应以官方页面为准。"
    ]
  },
  {
    id: "ntu-accommodation",
    title: "Accommodation | NTU Singapore",
    url: "https://www.ntu.edu.sg/life-at-ntu/accommodation",
    publisher: "NTU Singapore",
    accessedAt: reviewedAt,
    claims: [
      "NTU Accommodation 页面提供本科生和研究生校内住宿信息、住宿常见问题和替代住宿选项入口。",
      "住宿安排和费用以 Office of Campus Housing 的最新官方说明为准。"
    ]
  },
  {
    id: "ntu-housing-application",
    title: "Undergraduate Housing Application | NTU Singapore",
    url: "https://www.ntu.edu.sg/life-at-ntu/accommodation/undergraduate-housing/application",
    publisher: "NTU Singapore",
    accessedAt: reviewedAt,
    claims: [
      "本科住宿申请页面说明校内住宿申请与常见问题，并提供 Ask Campus Housing 联系入口。",
      "住宿申请流程、截止日期和房间分配以该页面的当前学年说明为准。"
    ]
  },
  {
    id: "ntu-career-services",
    title: "Seeking Employment | NTU Singapore",
    url: "https://www.ntu.edu.sg/life-at-ntu/student-life/student-services/onestop/bond-management/seeking-employment",
    publisher: "NTU Singapore",
    accessedAt: reviewedAt,
    claims: [
      "NTU Career and Attachment Office 为学生提供职业指导服务。",
      "官方页面说明学生可通过 CareerAxis 获取 NTU 职业与实习办公室的职业服务。"
    ]
  },
  {
    id: "ntu-wellbeing-services",
    title: "Student Wellbeing Services | NTU Singapore",
    url: "https://www.ntu.edu.sg/life-at-ntu/student-life/campus-life-and-wellbeing/ntu-wellbeing/student-wellbeing-services",
    publisher: "NTU Singapore",
    accessedAt: reviewedAt,
    claims: [
      "NTU University Wellbeing Office 下设 University Counselling Centre，为学生社群提供专业辅导和心理健康支持。",
      "具体服务范围、预约方式与紧急支持信息应以官方页面的最新说明为准。"
    ]
  },
  {
    id: "ntu-residential-education",
    title: "Residential Education | NTU Singapore",
    url: "https://www.ntu.edu.sg/life-at-ntu/student-life/campus-life-and-wellbeing/residential-education",
    publisher: "NTU Singapore",
    accessedAt: reviewedAt,
    claims: [
      "NTU Residential Education 为住校本科生提供由宿舍举办的学习与活动机会。",
      "Residential Education 的活动面向宿舍住户，具体项目以官方页面更新为准。"
    ]
  },
  {
    id: "nbs-undergraduate-life",
    title: "Undergraduate Life | Nanyang Business School | NTU Singapore",
    url: "https://www.ntu.edu.sg/business/admissions/ugadmission/undergraduate-student-life",
    publisher: "Nanyang Business School, NTU Singapore",
    accessedAt: reviewedAt,
    claims: [
      "NBS Undergraduate Life 页面列出 NBS Student Clubs、NBS House Community 与学生支持等学生生活资源。",
      "NBS 学生生活页面也链接到 NTU 的住宿、社区参与、学生领导力、学生福祉与社团资源。"
    ]
  },
  {
    id: "nbs-undergraduate-programmes",
    title: "NBS Undergraduate Programmes | NTU Singapore",
    url: "https://www.ntu.edu.sg/business/admissions/ugadmission",
    publisher: "Nanyang Business School, NTU Singapore",
    accessedAt: reviewedAt,
    claims: [
      "NBS 本科项目页面介绍商科、会计及相关本科项目，并提供学生生活与职业发展资源入口。",
      "NBS ACE 为本科生提供职业规划、指导与资源；具体服务以官方页面的最新说明为准。"
    ]
  }
];

export function sourcePackForTopic(topic: TopicPlan) {
  const core = ["ntu-student-life", "ntu-international-students", "ntu-clubs-societies"];
  const nbs = ["nbs-undergraduate-life", "nbs-undergraduate-programmes"];
  const library = ["ntu-library-services", "ntu-library-spaces"];
  const housing = ["ntu-accommodation", "ntu-housing-application", "ntu-residential-education"];
  const career = ["ntu-career-services", "ntu-wellbeing-services"];
  const idPool =
    topic.style === "guide" || topic.style === "checklist"
      ? [...core, ...library]
      : topic.style === "direct"
        ? [...core, ...nbs]
        : [...core, ...nbs, ...career, ...housing];
  const wanted = new Set(idPool);
  return officialSources.filter((source) => wanted.has(source.id)).slice(0, 5);
}

export function referencesForSourceIds(sourceIds: string[]) {
  const selected = new Set(sourceIds);
  return officialSources.filter((source) => selected.has(source.id));
}

export function defaultSourceReferences() {
  return officialSources.slice(0, 2);
}
