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
  }
];

export function sourcePackForTopic(_topic: TopicPlan) {
  return officialSources;
}

export function referencesForSourceIds(sourceIds: string[]) {
  const selected = new Set(sourceIds);
  return officialSources.filter((source) => selected.has(source.id));
}

export function defaultSourceReferences() {
  return officialSources.slice(0, 2);
}
