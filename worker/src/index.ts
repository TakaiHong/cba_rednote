import { buildEditorialBrief, draftSafetyNotes, selectRedditInspirationSignals } from "./inspiration.js";

export interface Env {
  DB: D1Database;
  FIREBASE_PROJECT_ID: string;
  FIREBASE_WEB_API_KEY: string;
  ALLOWED_FIREBASE_UIDS?: string;
  ALLOWED_FIREBASE_EMAILS?: string;
  ALLOWED_ORIGIN?: string;
  DEEPSEEK_API_KEY?: string;
  DEEPSEEK_MODEL?: string;
  MAX_COST_CNY_PER_POST?: string;
  REDDIT_CLIENT_ID?: string;
  REDDIT_CLIENT_SECRET?: string;
  REDDIT_USER_AGENT?: string;
  SITES_MIGRATION_TOKEN?: string;
}

type PostStatus = "draft" | "approved" | "published" | "archived";

interface SourceReference {
  id: string;
  title: string;
  url: string;
  publisher: string;
  accessedAt: string;
  claims: string[];
}

interface ResearchSignal {
  id: string;
  sourceUrl: string;
  sourceType: "xiaohongshu" | "reddit";
  collectionMethod?: "manual" | "browser-curated" | "api";
  readOnly?: boolean;
  status?: "pending_review" | "approved";
  theme: string;
  audience: string;
  insight: string;
  tags?: string[];
  interactionCount?: number;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface RedditSyncResult {
  configured: boolean;
  scanned: number;
  selected: number;
  added: number;
  skipped: number;
  retentionDays: number;
  communities: string[];
}

interface MarketingPost {
  id: string;
  title: string;
  body: string;
  tags: string[];
  imageIdeas: string[];
  imageAssets: string[];
  callToAction: string;
  status: PostStatus;
  topic: { style: string; targetSegment: string; scene: string; angle: string; hook: string; localSignals: string[] };
  review: { score: number; notes: string[]; approved: boolean };
  metrics: { views: number; likes: number; saves: number; comments: number; follows: number; inquiries: number };
  estimatedCostCny: number;
  generator: string;
  createdAt: string;
  updatedAt: string;
  publishedUrl?: string;
  revisionNotes: string[];
  sourceReferences: SourceReference[];
  factCheck: { status: "needs_review" | "verified" | "blocked"; notes: string[]; checkedAt?: string };
}

interface RunLog {
  id: string;
  action: string;
  status: "ok" | "error";
  message: string;
  metadata?: Record<string, string | number | boolean | undefined>;
  createdAt: string;
}

const reviewedAt = "2026-07-30";
const officialSources: SourceReference[] = [
  {
    id: "ntu-student-life",
    title: "Student Life | NTU Singapore",
    url: "https://www.ntu.edu.sg/life-at-ntu/student-life",
    publisher: "NTU Singapore",
    accessedAt: reviewedAt,
    claims: ["NTU provides a central Student Activity Centre support point for student life matters."]
  },
  {
    id: "ntu-international-students",
    title: "International Students | NTU Singapore",
    url: "https://www.ntu.edu.sg/life-at-ntu/student-life/student-activities-and-engagement/inclusion-and-integration/int-students",
    publisher: "NTU Singapore",
    accessedAt: reviewedAt,
    claims: ["NTU publishes activities and resources intended to help international students integrate into campus life."]
  },
  {
    id: "ntu-academic-calendar",
    title: "Academic Calendars | NTU Singapore",
    url: "https://www.ntu.edu.sg/admissions/matriculation/academic-calendars",
    publisher: "NTU Singapore",
    accessedAt: reviewedAt,
    claims: ["Academic Calendar pages are the official reference for term dates and academic arrangements."]
  },
  {
    id: "ntu-library-services",
    title: "NTU Library Services | NTU Singapore",
    url: "https://www.ntu.edu.sg/education/libraries/services",
    publisher: "NTU Singapore",
    accessedAt: reviewedAt,
    claims: ["NTU Library publishes learning and research support services for the NTU community."]
  },
  {
    id: "ntu-accommodation",
    title: "Accommodation | NTU Singapore",
    url: "https://www.ntu.edu.sg/life-at-ntu/accommodation",
    publisher: "NTU Singapore",
    accessedAt: reviewedAt,
    claims: ["NTU Accommodation publishes official accommodation information and frequently asked questions."]
  },
  {
    id: "nbs-undergraduate-life",
    title: "Undergraduate Life | Nanyang Business School",
    url: "https://www.ntu.edu.sg/business/admissions/ugadmission/undergraduate-student-life",
    publisher: "Nanyang Business School, NTU Singapore",
    accessedAt: reviewedAt,
    claims: ["NBS publishes undergraduate student-life resources including student clubs and community information."]
  },
  {
    id: "ntu-international-guide",
    title: "Our NTU - A Guide for International Students | NTU Singapore",
    url: "https://www.ntu.edu.sg/about-us/global/students/guide-for-international-students",
    publisher: "NTU Singapore",
    accessedAt: reviewedAt,
    claims: ["NTU publishes an international-student guide covering campus life, accommodation and student associations."]
  },
  {
    id: "ntu-one-stop-sac",
    title: "One Stop @ SAC | NTU Singapore",
    url: "https://www.ntu.edu.sg/life-at-ntu/student-life/student-services",
    publisher: "NTU Singapore",
    accessedAt: reviewedAt,
    claims: ["One Stop @ SAC is NTU's central student-service hub for academic, finance, housing, admissions and campus-life matters."]
  },
  {
    id: "nbs-student-clubs",
    title: "NBS Student Clubs | Nanyang Business School",
    url: "https://www.ntu.edu.sg/business/admissions/ugadmission/undergraduate-student-life/nbs-student-clubs",
    publisher: "Nanyang Business School, NTU Singapore",
    accessedAt: reviewedAt,
    claims: ["NBS publishes information about student clubs, their communities and their activities."]
  },
  {
    id: "ntu-student-housing-faq",
    title: "Accommodation FAQ | NTU Singapore",
    url: "https://www.ntu.edu.sg/life-at-ntu/accommodation/FAQ",
    publisher: "NTU Singapore",
    accessedAt: reviewedAt,
    claims: ["NTU Accommodation publishes official FAQs about student housing applications, allocations and check-in arrangements."]
  },
  {
    id: "ntu-international-freshmen-faq",
    title: "FAQ for International Freshmen | NTU Singapore",
    url: "https://www.ntu.edu.sg/admissions/undergraduate/freshmen/freshmen-info/faq-for-international-freshmen",
    publisher: "NTU Singapore",
    accessedAt: reviewedAt,
    claims: ["NTU publishes an FAQ for international freshmen covering arrival and matriculation-related matters."]
  }
];

// These are human-reviewed topic signals collected from a logged-in Reddit search
// session. They are deliberately paraphrased: no author, title, post body or
// comment is retained, and they expire before they can become stale guidance.
const browserCuratedRedditSignals: ResearchSignal[] = [
  {
    id: "browser-sample-timetable-20260731",
    sourceUrl: "https://www.reddit.com/r/NTU/comments/1v599xo/cooked_asf_timetable/",
    sourceType: "reddit",
    collectionMethod: "browser-curated",
    readOnly: true,
    theme: "课程表与日常节奏",
    audience: "在读 NTU 学生",
    insight: "近期讨论反映长课表、早晚课与生活安排的冲突。适合写读懂课表、安排通勤与复习节奏的经验；不要把个案当成所有课程的常态。",
    interactionCount: 159,
    createdAt: "2026-07-31T00:00:00.000Z",
    updatedAt: "2026-07-31T00:00:00.000Z",
    expiresAt: "2026-08-30T23:59:59.999Z"
  },
  {
    id: "browser-sample-admissions-20260731",
    sourceUrl: "https://www.reddit.com/r/SGExams/comments/1v9r5p7/international_applicant_still_waiting_for_an/",
    sourceType: "reddit",
    collectionMethod: "browser-curated",
    readOnly: true,
    theme: "国际生申请等待期",
    audience: "计划申请 NTU 的国际学生",
    insight: "申请者会在结果未出时寻找时间线和心理支持。适合写等待期能准备什么、去哪里核对状态；录取结果与时间节点只以官方邮件和页面为准。",
    interactionCount: 24,
    createdAt: "2026-07-31T00:00:00.000Z",
    updatedAt: "2026-07-31T00:00:00.000Z",
    expiresAt: "2026-08-30T23:59:59.999Z"
  },
  {
    id: "browser-sample-convocation-20260731",
    sourceUrl: "https://www.reddit.com/r/NTU/comments/1v8uma3/did_anyone_regret_not_attending_convocation/",
    sourceType: "reddit",
    collectionMethod: "browser-curated",
    readOnly: true,
    theme: "毕业与家人参与",
    audience: "即将毕业的 NTU 学生",
    insight: "毕业讨论里常见的是家人参与和留念的情感价值。适合做毕业季叙事和准备清单；典礼日期、资格和流程必须回到官方通知核验。",
    interactionCount: 54,
    createdAt: "2026-07-31T00:00:00.000Z",
    updatedAt: "2026-07-31T00:00:00.000Z",
    expiresAt: "2026-08-30T23:59:59.999Z"
  },
  {
    id: "browser-sample-expectations-20260731",
    sourceUrl: "https://www.reddit.com/r/SGExams/comments/1lllueu/i_am_starting_to_regret_accepting_ntu/",
    sourceType: "reddit",
    collectionMethod: "browser-curated",
    readOnly: true,
    theme: "入学后的期待落差",
    audience: "准新生与转学期学生",
    insight: "高讨论度内容显示，准新生会担心选择是否适合自己。适合写入学适应、建立支持网络和求助入口；不把单一经历包装成学校整体结论。",
    interactionCount: 652,
    createdAt: "2026-07-31T00:00:00.000Z",
    updatedAt: "2026-07-31T00:00:00.000Z",
    expiresAt: "2026-08-30T23:59:59.999Z"
  },
  {
    id: "browser-curated-hall-social-20260731",
    sourceUrl: "https://www.reddit.com/r/NTU/comments/1sgt7ah/hii_social_life_in_ntu/",
    sourceType: "reddit",
    collectionMethod: "browser-curated",
    readOnly: true,
    theme: "研究生社交与主动连接",
    audience: "即将入学的硕士生与国际学生",
    insight: "讨论反映出，课程紧凑的学生会关心如何主动建立社交连接。适合做低压力破冰、午餐邀约和社团活动入口的选题；不把单一学生体验概括为整个 NTU 的社交氛围。",
    interactionCount: 31,
    createdAt: "2026-07-31T00:00:00.000Z",
    updatedAt: "2026-07-31T00:00:00.000Z",
    expiresAt: "2026-08-30T23:59:59.999Z"
  },
  {
    id: "browser-curated-accommodation-planning-20260731",
    sourceUrl: "https://www.reddit.com/r/NTU/comments/1l189jm/2526_ntu_accommodation_queries/",
    sourceType: "reddit",
    collectionMethod: "browser-curated",
    readOnly: true,
    theme: "住宿申请的信息焦虑",
    audience: "即将来新加坡的国际学生",
    insight: "集中式问答中反复出现住宿、室友、申请窗口和候补等困惑。适合做来新前的资料准备清单与求助路径；任何申请资格、轮次或住宿安排必须核对 NTU Accommodation 官方页面。",
    createdAt: "2026-07-31T00:00:00.000Z",
    updatedAt: "2026-07-31T00:00:00.000Z",
    expiresAt: "2026-08-30T23:59:59.999Z"
  },
  {
    id: "browser-curated-off-campus-living-20260731",
    sourceUrl: "https://www.reddit.com/r/NTU/comments/1u9o138/off_campus_accommodation/",
    sourceType: "reddit",
    collectionMethod: "browser-curated",
    readOnly: true,
    theme: "校外居住的日常决策",
    audience: "计划校外租房的研究生与国际学生",
    insight: "校外住宿讨论聚焦通勤、预算、房型、日常采购和交通便利度。适合写租房看房时的个人决策框架；不推荐具体中介、房源、价格或区域优劣。",
    interactionCount: 1,
    createdAt: "2026-07-31T00:00:00.000Z",
    updatedAt: "2026-07-31T00:00:00.000Z",
    expiresAt: "2026-08-30T23:59:59.999Z"
  },
  {
    id: "browser-curated-campus-life-entry-20260731",
    sourceUrl: "https://www.reddit.com/r/SGExams/comments/1tlj2tf/ntu_student_life/",
    sourceType: "reddit",
    collectionMethod: "browser-curated",
    readOnly: true,
    theme: "校园生活的进入方式",
    audience: "准新生与刚入学学生",
    insight: "准新生会把住宿、社团和校园活动视为同一套适应问题。适合写新生如何用一个小行动开始接触社区；社团归属、申请和活动安排仍以官方社团与学院信息为准。",
    interactionCount: 19,
    createdAt: "2026-07-31T00:00:00.000Z",
    updatedAt: "2026-07-31T00:00:00.000Z",
    expiresAt: "2026-08-30T23:59:59.999Z"
  },
  {
    id: "browser-curated-module-onboarding-20260731",
    sourceUrl: "https://www.reddit.com/r/NTU/comments/1ush7v0/courses_and_mods/",
    sourceType: "reddit",
    collectionMethod: "browser-curated",
    readOnly: true,
    theme: "新生选课与时间表入门",
    audience: "NBS 准新生与新生",
    insight: "新生常分不清预分配课程、时间表、换班和个人规划的边界。适合用问题拆解的方式写选课前应确认什么；具体课程安排和系统操作只引用学院或 NTU 官方通知。",
    interactionCount: 3,
    createdAt: "2026-07-31T00:00:00.000Z",
    updatedAt: "2026-07-31T00:00:00.000Z",
    expiresAt: "2026-08-30T23:59:59.999Z"
  },
  {
    id: "browser-curated-timetable-planning-20260731",
    sourceUrl: "https://www.reddit.com/r/NTU/comments/1uxy25s/ntu_timetable_mapping/",
    sourceType: "reddit",
    collectionMethod: "browser-curated",
    readOnly: true,
    theme: "交换前的学业规划焦虑",
    audience: "计划交换或调整学习节奏的学生",
    insight: "时间表讨论显示，学生会把课程规划和交换等长期目标连在一起。适合写如何先画出个人学期地图、再向学院核对规则；不提供具体课程组合或学分建议。",
    interactionCount: 47,
    createdAt: "2026-07-31T00:00:00.000Z",
    updatedAt: "2026-07-31T00:00:00.000Z",
    expiresAt: "2026-08-30T23:59:59.999Z"
  },
  {
    id: "browser-curated-internship-planning-20260731",
    sourceUrl: "https://www.reddit.com/r/NTU/comments/1tq6hqa/ntu_internship/",
    sourceType: "reddit",
    collectionMethod: "browser-curated",
    readOnly: true,
    theme: "实习准备的节奏感",
    audience: "准备职业探索的本科生",
    insight: "学生在实习话题中最在意何时开始准备、如何积累经历和如何管理焦虑。适合做求职准备的故事型内容和同伴支持选题；实习要求、签证和学校流程必须回到学院与职业中心的官方渠道。",
    interactionCount: 19,
    createdAt: "2026-07-31T00:00:00.000Z",
    updatedAt: "2026-07-31T00:00:00.000Z",
    expiresAt: "2026-08-30T23:59:59.999Z"
  },
  {
    id: "browser-curated-internship-pressure-20260731",
    sourceUrl: "https://www.reddit.com/r/NTU/comments/1rjoogu/internship_hell/",
    sourceType: "reddit",
    collectionMethod: "browser-curated",
    readOnly: true,
    theme: "求职压力与同伴支持",
    audience: "正在投递实习的 NTU 学生",
    insight: "较高互动的讨论显示，投递不确定性会带来强烈的比较与挫败感。适合做拒信后的行动清单、求助边界和互相支持的内容；不依据个别分享判断就业市场或学校支持的整体状况。",
    interactionCount: 69,
    createdAt: "2026-07-31T00:00:00.000Z",
    updatedAt: "2026-07-31T00:00:00.000Z",
    expiresAt: "2026-08-30T23:59:59.999Z"
  }
];

const themes = [
  { title: "NTU新生先做这3件事", style: "checklist", scene: "刚到NTU的第一周", angle: "把不确定的事拆成可执行清单" },
  { title: "NBS同学的校园信息源", style: "guide", scene: "小组作业与社团消息同时涌来", angle: "先确认官方来源，再问同学经验" },
  { title: "留学生别把日历记错", style: "pitfall", scene: "学期节奏忽然变快的时候", angle: "关键日期只认官方Academic Calendar" },
  { title: "NTU图书馆怎么用更顺", style: "guide", scene: "想找安静学习空间的下午", angle: "先看服务页，再按自己的学习方式安排" }
];

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get("Origin");
    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders(env, origin) });

    try {
      const url = new URL(request.url);
      if (url.pathname === "/api/health") return respond({ ok: true, service: "ntu-cba-rednote-worker" }, 200, env, origin);

      await ensureSchema(env);
      if (request.method === "POST" && url.pathname === "/api/internal/migrate") {
        return migrateLocalData(request, env, origin);
      }
      const user = await requireOperator(request, env);
      return await route(request, url, env, user.uid, origin);
    } catch (error) {
      const message = error instanceof HttpError ? error.message : "Unexpected server error";
      const status = error instanceof HttpError ? error.status : 500;
      return respond({ error: message }, status, env, origin);
    }
  },

  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    try {
      if (redditStatus(env).configured) {
        try {
          const reddit = await syncRedditSignals(env);
          await appendLog(env, "scheduled-reddit-sync", "ok", `Scanned ${reddit.scanned} candidates and added ${reddit.added} trend signals.`, { scanned: reddit.scanned, added: reddit.added, skipped: reddit.skipped });
        } catch (error) {
          await appendLog(env, "scheduled-reddit-sync", "error", error instanceof Error ? error.message : String(error));
        }
      }
      const posts = await listPosts(env);
      const post = await createGeneratedPost(env, posts, posts.length);
      await savePost(env, post);
      await appendLog(env, "scheduled-generate", "ok", `Created daily draft ${post.id}`, { postId: post.id });
    } catch (error) {
      await appendLog(env, "scheduled-generate", "error", error instanceof Error ? error.message : String(error));
    }
  }
} satisfies ExportedHandler<Env>;

async function route(request: Request, url: URL, env: Env, uid: string, origin: string | null): Promise<Response> {
  const method = request.method;
  const path = url.pathname;

  if (method === "GET" && path === "/api/posts") return respond(await listPosts(env), 200, env, origin);
  if (method === "GET" && path === "/api/posts/latest") {
    const post = (await listPosts(env)).find((item) => item.status === "draft");
    if (!post) throw new HttpError(404, "No draft found");
    return respond(post, 200, env, origin);
  }
  if (method === "GET" && path === "/api/status") return respond(await status(env), 200, env, origin);
  if (method === "GET" && path === "/api/posts/calendar/plan") return respond(calendar(Number(url.searchParams.get("days") ?? 7)), 200, env, origin);
  if (method === "GET" && path === "/api/go-live") return respond(goLive(), 200, env, origin);
  if (method === "GET" && path === "/api/preflight-evidence") return respond(preflightEvidence(), 200, env, origin);
  if (method === "GET" && path === "/api/schedule/status") return respond(cloudScheduleStatus(), 200, env, origin);
  if (method === "GET" && path === "/api/knowledge-base") {
    return respond({
      officialSources,
      researchSignals: await listResearchSignals(env),
      reddit: redditStatus(env),
      policy: {
        purpose: "Use Reddit community signals for topic selection, local student pain points and presentation structure; use NTU/NBS sources only to validate factual claims.",
        restrictions: [
          "Do not store post bodies, screenshots, user handles, comments or private information.",
          "Do not treat a public community post as a factual source.",
          "Browser-curated Reddit signals are paraphrased, read-only and expire after 30 days.",
          "Every changing NTU fact in a publishable draft must still be supported by an official NTU source."
        ]
      }
    }, 200, env, origin);
  }

  if (method === "POST" && path === "/api/knowledge-base/research-signals") {
    const input = await readJson<Partial<ResearchSignal>>(request);
    const signal = await createResearchSignal(env, input);
    await appendLog(env, "knowledge-add-public-reference", "ok", `Added research signal ${signal.id}`, { signalId: signal.id, uid });
    return respond(signal, 201, env, origin);
  }

  if (method === "POST" && path === "/api/knowledge-base/research-signals/batch") {
    const input = await readJson<{ sourceUrls?: string[] }>(request);
    const result = await queueResearchSignals(env, input.sourceUrls ?? []);
    await appendLog(env, "knowledge-queue-public-references", "ok", `Queued ${result.added.length} public reference links.`, { added: result.added.length, skipped: result.skipped, uid });
    return respond(result, 201, env, origin);
  }

  if (method === "POST" && path === "/api/knowledge-base/research-signals/local-import") {
    const input = await readJson<{ signals?: Array<Partial<ResearchSignal>> }>(request);
    const result = await importLocalCorpusSignals(env, input.signals ?? []);
    await appendLog(env, "knowledge-import-local-corpus", "ok", `Imported ${result.added.length} local Reddit topic signals.`, { added: result.added.length, skipped: result.skipped, uid });
    return respond(result, 201, env, origin);
  }

  if (method === "POST" && path === "/api/knowledge-base/reddit/sync") {
    const result = await syncRedditSignals(env);
    await appendLog(env, "knowledge-reddit-sync", "ok", `Scanned ${result.scanned} Reddit posts and added ${result.added} trend signals.`, { scanned: result.scanned, added: result.added, skipped: result.skipped, uid });
    return respond(result, 200, env, origin);
  }

  const researchSignalMatch = /^\/api\/knowledge-base\/research-signals\/([^/]+)$/.exec(path);
  if (method === "PATCH" && researchSignalMatch) {
    const input = await readJson<Partial<ResearchSignal>>(request);
    const signal = await approveResearchSignal(env, researchSignalMatch[1], input);
    await appendLog(env, "knowledge-approve-public-reference", "ok", `Approved research signal ${signal.id}`, { signalId: signal.id, uid });
    return respond(signal, 200, env, origin);
  }
  if (method === "DELETE" && researchSignalMatch) {
    await env.DB.prepare("DELETE FROM knowledge_entries WHERE id = ?").bind(researchSignalMatch[1]).run();
    await appendLog(env, "knowledge-delete-public-reference", "ok", `Deleted research signal ${researchSignalMatch[1]}`, { signalId: researchSignalMatch[1], uid });
    return respond({ ok: true }, 200, env, origin);
  }

  if (method === "GET" && path === "/api/assets/image") throw new HttpError(404, "Cloud image uploads are not enabled in this no-card deployment.");

  if (method === "POST" && path === "/api/posts/generate") {
    const post = await createGeneratedPost(env, await listPosts(env), (await listPosts(env)).length);
    await savePost(env, post);
    await appendLog(env, "api-generate", "ok", `Generated post ${post.id}`, { postId: post.id, uid });
    return respond(post, 201, env, origin);
  }
  if (method === "POST" && path === "/api/posts/generate-batch") {
    const input = await readJson<{ count?: number; maxModelPosts?: number }>(request);
    const count = between(input.count ?? 7, 1, 14);
    const existing = await listPosts(env);
    const posts: MarketingPost[] = [];
    for (let index = 0; index < count; index += 1) {
      const post = await createGeneratedPost(env, [...existing, ...posts], existing.length + index, index < (input.maxModelPosts ?? 1));
      await savePost(env, post);
      posts.push(post);
    }
    await appendLog(env, "api-generate-batch", "ok", `Generated ${posts.length} posts`, { count: posts.length, uid });
    return respond({ plan: { count, modelConfigured: Boolean(env.DEEPSEEK_API_KEY), estimatedMaxCostCny: posts.reduce((sum, post) => sum + post.estimatedCostCny, 0), maxModelPosts: Math.min(input.maxModelPosts ?? 1, count) }, posts }, 201, env, origin);
  }

  const postIdMatch = /^\/api\/posts\/([^/]+)(?:\/(.+))?$/.exec(path);
  if (postIdMatch) {
    const [, postId, action] = postIdMatch;
    const post = await getPost(env, postId);
    if (!post) throw new HttpError(404, "Post not found");

    if (method === "GET" && action === "publish-package") return respond(publishPackage(post), 200, env, origin);
    if (method === "POST" && action === "regenerate") {
      const input = await readJson<{ feedback?: string }>(request);
      if (!input.feedback?.trim()) throw new HttpError(400, "Revision feedback is required.");
      const next = await regeneratePost(env, post, input.feedback.trim());
      await savePost(env, next);
      await appendLog(env, "api-regenerate-post", "ok", `Regenerated post ${post.id}`, { postId: post.id, uid });
      return respond(next, 201, env, origin);
    }
    if (method === "POST" && action === "cover-image") {
      const svg = coverSvg(post);
      const outputPath = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
      const next = { ...post, imageAssets: [...new Set([...post.imageAssets, outputPath])], updatedAt: now() };
      await savePost(env, next);
      await appendLog(env, "api-generate-cover", "ok", `Generated editable sticky-note cover for ${post.id}`, { postId: post.id, uid });
      return respond({ postId: post.id, outputPath, attached: true, post: next }, 201, env, origin);
    }
    if (method === "POST" && action === "image-upload") {
      return respond({ error: "Cloud image upload is intentionally disabled in the no-card deployment. Use the built-in sticky-note cover, or use the local tool for real images." }, 410, env, origin);
    }
    if (method === "POST" && ["assisted-publish", "preflight", "final-publish"].includes(action ?? "")) {
      return respond({ error: "Cloud workspace prepares content only. Publish manually in Xiaohongshu Creator Center and paste the URL back here." }, 410, env, origin);
    }
    if (method === "PATCH" && !action) {
      const patch = await readJson<Partial<MarketingPost>> (request);
      const next = validatePatch(post, patch);
      await savePost(env, next);
      await appendLog(env, "api-update-post", "ok", `Updated ${post.id}`, { postId: post.id, uid, status: next.status });
      return respond(next, 200, env, origin);
    }
  }

  if (method === "POST" && path === "/api/posts") {
    const input = await readJson<Partial<MarketingPost>>(request);
    const post = validatePatch(blankPost(), input);
    await savePost(env, post);
    await appendLog(env, "api-create-manual", "ok", `Created ${post.id}`, { postId: post.id, uid });
    return respond(post, 201, env, origin);
  }

  throw new HttpError(404, "Route not found");
}

async function requireOperator(request: Request, env: Env) {
  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new HttpError(401, "Sign in is required.");
  if (!env.FIREBASE_PROJECT_ID || !env.FIREBASE_WEB_API_KEY) throw new HttpError(500, "Firebase authentication is not configured.");
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(env.FIREBASE_WEB_API_KEY)}`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ idToken: token })
  });
  const data = (await response.json().catch(() => ({}))) as { users?: Array<{ localId?: string; email?: string }> };
  const user = data.users?.[0];
  if (!response.ok || !user?.localId) throw new HttpError(401, "Your Firebase session is invalid or expired.");
  const allowed = (env.ALLOWED_FIREBASE_UIDS ?? "").split(",").map((value) => value.trim()).filter(Boolean);
  if (allowed.length && !allowed.includes(user.localId)) throw new HttpError(403, "This Firebase account is not an approved operator.");
  const allowedEmails = (env.ALLOWED_FIREBASE_EMAILS ?? "").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
  if (allowedEmails.length && !allowedEmails.includes((user.email ?? "").toLowerCase())) throw new HttpError(403, "This Gmail account is not an approved operator.");
  return { uid: user.localId, email: user.email ?? "" };
}

async function listPosts(env: Env): Promise<MarketingPost[]> {
  const result = await env.DB.prepare("SELECT payload FROM posts ORDER BY updated_at DESC").all<{ payload: string }>();
  return result.results.map((row) => withDefaults(JSON.parse(row.payload) as MarketingPost));
}

async function ensureSchema(env: Env) {
  await env.DB.batch([
    env.DB.prepare("CREATE TABLE IF NOT EXISTS posts (id TEXT PRIMARY KEY, payload TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS posts_updated_at ON posts(updated_at DESC)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS run_logs (id TEXT PRIMARY KEY, action TEXT NOT NULL, status TEXT NOT NULL, message TEXT NOT NULL, metadata TEXT, created_at TEXT NOT NULL)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS run_logs_created_at ON run_logs(created_at DESC)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS knowledge_entries (id TEXT PRIMARY KEY, payload TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS knowledge_entries_updated_at ON knowledge_entries(updated_at DESC)")
  ]);
}

async function listResearchSignals(env: Env): Promise<ResearchSignal[]> {
  await pruneExpiredResearchSignals(env);
  const result = await env.DB.prepare("SELECT payload FROM knowledge_entries ORDER BY updated_at DESC LIMIT 400").all<{ payload: string }>();
  const saved = result.results.map((row) => normalizeResearchSignal(JSON.parse(row.payload) as ResearchSignal));
  const activeBrowserSignals = browserCuratedRedditSignals
    .map(normalizeResearchSignal)
    .filter((signal) => !signal.expiresAt || new Date(signal.expiresAt).getTime() > Date.now());
  const savedUrls = new Set(saved.map((signal) => signal.sourceUrl));
  return [...activeBrowserSignals.filter((signal) => !savedUrls.has(signal.sourceUrl)), ...saved].slice(0, 400);
}

async function createResearchSignal(env: Env, input: Partial<ResearchSignal>): Promise<ResearchSignal> {
  const sourceUrl = String(input.sourceUrl ?? "").trim();
  const theme = cleanResearchText(input.theme, 64, "Topic");
  const audience = cleanResearchText(input.audience, 64, "NTU students");
  const insight = cleanResearchText(input.insight, 420, "");
  const sourceType = publicSourceType(sourceUrl);
  if (!sourceType) throw new HttpError(400, "Please provide a public Xiaohongshu or Reddit URL.");
  if (insight.length < 12) throw new HttpError(400, "Write a short paraphrased observation of at least 12 characters. Do not paste the post body.");

  const timestamp = now();
  const signal: ResearchSignal = { id: crypto.randomUUID(), sourceUrl, sourceType, collectionMethod: "manual", status: "approved", theme, audience, insight, createdAt: timestamp, updatedAt: timestamp };
  await env.DB.prepare("INSERT INTO knowledge_entries (id, payload, created_at, updated_at) VALUES (?, ?, ?, ?)")
    .bind(signal.id, JSON.stringify(signal), signal.createdAt, signal.updatedAt)
    .run();
  return signal;
}

async function queueResearchSignals(env: Env, rawUrls: string[]) {
  const urls = [...new Set(rawUrls.map((value) => value.trim()).filter(Boolean))].slice(0, 100);
  if (!urls.length) throw new HttpError(400, "Paste at least one public Reddit URL.");
  const existingUrls = new Set((await listResearchSignals(env)).map((signal) => signal.sourceUrl));
  const added: ResearchSignal[] = [];
  let skipped = 0;

  for (const sourceUrl of urls) {
    if (publicSourceType(sourceUrl) !== "reddit" || existingUrls.has(sourceUrl)) {
      skipped += 1;
      continue;
    }
    const timestamp = now();
    const signal: ResearchSignal = {
      id: crypto.randomUUID(),
      sourceUrl,
      sourceType: "reddit",
      collectionMethod: "manual",
      status: "pending_review",
      theme: "Pending NTU discussion review",
      audience: "NTU Chinese students",
      insight: "Waiting for an operator to write a paraphrased topic insight. This item is excluded from copy generation until approved.",
      createdAt: timestamp,
      updatedAt: timestamp
    };
    await env.DB.prepare("INSERT INTO knowledge_entries (id, payload, created_at, updated_at) VALUES (?, ?, ?, ?)")
      .bind(signal.id, JSON.stringify(signal), signal.createdAt, signal.updatedAt)
      .run();
    existingUrls.add(sourceUrl);
    added.push(signal);
  }
  return { added, skipped };
}

async function importLocalCorpusSignals(env: Env, inputs: Array<Partial<ResearchSignal>>) {
  const candidates = inputs.slice(0, 100);
  if (!candidates.length) throw new HttpError(400, "Select at least one locally classified Reddit signal.");
  const existingUrls = new Set((await listResearchSignals(env)).map((signal) => signal.sourceUrl));
  const added: ResearchSignal[] = [];
  let skipped = 0;

  for (const input of candidates) {
    const sourceUrl = String(input.sourceUrl ?? "").trim();
    if (publicSourceType(sourceUrl) !== "reddit" || existingUrls.has(sourceUrl)) {
      skipped += 1;
      continue;
    }
    const theme = cleanResearchText(input.theme, 64, "Other NTU student discussion");
    const audience = cleanResearchText(input.audience, 64, "NTU students");
    const insight = cleanResearchText(input.insight, 420, "");
    if (insight.length < 12) {
      skipped += 1;
      continue;
    }
    const tags = cleanResearchTags(input.tags);
    const timestamp = now();
    const signal: ResearchSignal = {
      id: crypto.randomUUID(),
      sourceUrl,
      sourceType: "reddit",
      collectionMethod: "browser-curated",
      // Browser import contains taxonomy output only: no username, post body,
      // comment, profile or external link. It can guide topic selection but
      // cannot be used as evidence for a factual statement.
      status: "approved",
      theme,
      audience,
      insight,
      tags,
      expiresAt: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: timestamp,
      updatedAt: timestamp
    };
    await env.DB.prepare("INSERT INTO knowledge_entries (id, payload, created_at, updated_at) VALUES (?, ?, ?, ?)")
      .bind(signal.id, JSON.stringify(signal), signal.createdAt, signal.updatedAt)
      .run();
    existingUrls.add(sourceUrl);
    added.push(signal);
  }
  return { added, skipped };
}

async function approveResearchSignal(env: Env, id: string, input: Partial<ResearchSignal>): Promise<ResearchSignal> {
  const row = await env.DB.prepare("SELECT payload FROM knowledge_entries WHERE id = ?").bind(id).first<{ payload: string }>();
  if (!row) throw new HttpError(404, "Research signal not found.");
  const current = normalizeResearchSignal(JSON.parse(row.payload) as ResearchSignal);
  if (current.readOnly) throw new HttpError(403, "This curated signal is read-only.");
  const theme = cleanResearchText(input.theme, 64, "");
  const audience = cleanResearchText(input.audience, 64, "");
  const insight = cleanResearchText(input.insight, 420, "");
  if (!theme || !audience || insight.length < 12) {
    throw new HttpError(400, "Add a theme, audience, and a paraphrased insight before approving.");
  }
  const signal: ResearchSignal = { ...current, theme, audience, insight, status: "approved", updatedAt: now() };
  await env.DB.prepare("UPDATE knowledge_entries SET payload = ?, updated_at = ? WHERE id = ?")
    .bind(JSON.stringify(signal), signal.updatedAt, id)
    .run();
  return signal;
}

function cleanResearchText(value: unknown, maxLength: number, fallback: string) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);
  return text || fallback;
}

function cleanResearchTags(value: unknown) {
  const values = Array.isArray(value) ? value : [];
  return [...new Set(values.map((item) => cleanResearchText(item, 32, "")).filter(Boolean))].slice(0, 3);
}

function publicSourceType(value: string): ResearchSignal["sourceType"] | undefined {
  try {
    const host = new URL(value).hostname.toLowerCase();
    if (host === "xiaohongshu.com" || host.endsWith(".xiaohongshu.com") || host === "xhslink.com" || host.endsWith(".xhslink.com")) return "xiaohongshu";
    if (host === "reddit.com" || host.endsWith(".reddit.com")) return "reddit";
    return undefined;
  } catch {
    return undefined;
  }
}

function normalizeResearchSignal(signal: ResearchSignal): ResearchSignal {
  return { ...signal, sourceType: signal.sourceType ?? (publicSourceType(signal.sourceUrl) ?? "xiaohongshu"), status: signal.status ?? "approved" };
}

function redditStatus(env: Env) {
  return {
    configured: Boolean(env.REDDIT_CLIENT_ID && env.REDDIT_CLIENT_SECRET),
    retentionDays: 30,
    communities: ["r/NTU", "r/SGExams", "r/asksingapore", "r/singapore (NTU search only)"],
    scope: "Browser-curated samples are available now. If API credentials are approved later, each sync scans up to 500 candidates; only high-relevance metadata is retained. No authors, post bodies or comments are retained."
  };
}

async function syncRedditSignals(env: Env): Promise<RedditSyncResult> {
  if (!env.REDDIT_CLIENT_ID || !env.REDDIT_CLIENT_SECRET) {
    throw new HttpError(412, "Reddit sync is not configured. Add REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET as Cloudflare Worker secrets first.");
  }

  await pruneExpiredResearchSignals(env);
  const token = await getRedditAccessToken(env);
  const streams = [
    "/r/NTU/new?limit=100",
    "/r/NTU/top?limit=100&t=year",
    "/r/SGExams/search?q=NTU&restrict_sr=on&sort=new&t=year&limit=100",
    "/r/asksingapore/search?q=NTU&restrict_sr=on&sort=new&t=year&limit=100",
    "/r/singapore/search?q=NTU&restrict_sr=on&sort=new&t=year&limit=100"
  ];
  const batches = await Promise.all(streams.map((path) => listRedditPosts(path, token, env)));
  const existingUrls = new Set((await listResearchSignals(env)).map((signal) => signal.sourceUrl));
  // Keep this boundary enforceable even if upstream ignores requested limits.
  const rawCandidates = batches.flat().slice(0, 500);
  const candidates = [...new Map(rawCandidates.map((post) => [post.id, post])).values()]
    .filter(isRelevantRedditPost)
    .sort((left, right) => redditQuality(right) - redditQuality(left))
    .slice(0, 400);
  let added = 0;
  let skipped = 0;
  const timestamp = now();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  for (const post of candidates) {
    const sourceUrl = `https://www.reddit.com${post.permalink}`;
    if (existingUrls.has(sourceUrl)) {
      skipped += 1;
      continue;
    }
    const theme = detectRedditTheme(post.title ?? "");
    const signal: ResearchSignal = {
      id: `reddit-${post.id}`,
      sourceUrl,
      sourceType: "reddit",
      collectionMethod: "api",
      status: "approved",
      theme,
      audience: redditAudience(theme),
      insight: `A recent public community discussion matched the ${theme} topic. Use it only to prioritize a helpful editorial angle; verify every NTU-specific claim against official sources.`,
      interactionCount: Math.max(0, Number(post.score ?? 0)) + Math.max(0, Number(post.num_comments ?? 0)),
      expiresAt,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    await env.DB.prepare("INSERT INTO knowledge_entries (id, payload, created_at, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at")
      .bind(signal.id, JSON.stringify(signal), signal.createdAt, signal.updatedAt)
      .run();
    existingUrls.add(sourceUrl);
    added += 1;
  }

  return { configured: true, scanned: rawCandidates.length, selected: candidates.length, added, skipped, retentionDays: 30, communities: redditStatus(env).communities };
}

interface RedditPost {
  id?: string;
  permalink?: string;
  title?: string;
  subreddit?: string;
  score?: number;
  num_comments?: number;
  created_utc?: number;
  over_18?: boolean;
  stickied?: boolean;
}

async function getRedditAccessToken(env: Env) {
  const credentials = btoa(`${env.REDDIT_CLIENT_ID}:${env.REDDIT_CLIENT_SECRET}`);
  const response = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": env.REDDIT_USER_AGENT ?? "NTU-CBA-Content-Research/1.0"
    },
    body: "grant_type=client_credentials"
  });
  const data = await response.json().catch(() => ({})) as { access_token?: string };
  if (!response.ok || !data.access_token) throw new HttpError(502, "Reddit OAuth token request failed. Check the Worker secrets and approved API access.");
  return data.access_token;
}

async function listRedditPosts(path: string, token: string, env: Env): Promise<RedditPost[]> {
  const response = await fetch(`https://oauth.reddit.com${path}`, {
    headers: { Authorization: `Bearer ${token}`, "User-Agent": env.REDDIT_USER_AGENT ?? "NTU-CBA-Content-Research/1.0" }
  });
  const data = await response.json().catch(() => ({})) as { data?: { children?: Array<{ data?: RedditPost }> } };
  if (!response.ok) throw new HttpError(502, "Reddit public-post request failed. Check the approved API scope and rate limit.");
  return (data.data?.children ?? []).map((item) => item.data).filter((post): post is RedditPost => Boolean(post));
}

function detectRedditTheme(title: string) {
  const normalized = title.toLowerCase();
  if (/intern|career|resume|cv|loa|placement/.test(normalized)) return "Internship and career planning";
  if (/hall|hostel|accommodation|room|housing/.test(normalized)) return "Accommodation and hall life";
  if (/exchange|international|visa|arrival|freshman/.test(normalized)) return "International student transition";
  if (/module|course|exam|study|gpa|academic/.test(normalized)) return "Academic planning";
  if (/social|friend|club|cca|life|boring/.test(normalized)) return "Campus life and belonging";
  return "NTU student questions";
}

function isRelevantRedditPost(post: RedditPost) {
  if (post.over_18 || post.stickied || !post.permalink || !post.id) return false;
  const subreddit = (post.subreddit ?? "").toLowerCase();
  if (subreddit === "ntu") return true;
  return /\bntu\b|nanyang|nbs|nanyang business/i.test(post.title ?? "");
}

function redditQuality(post: RedditPost) {
  const interactions = Math.max(0, Number(post.score ?? 0)) + Math.max(0, Number(post.num_comments ?? 0));
  const ageDays = Math.max(0, (Date.now() / 1000 - Number(post.created_utc ?? 0)) / 86_400);
  return interactions * 8 + Math.max(0, 180 - ageDays);
}

function redditAudience(theme: string) {
  if (theme === "Internship and career planning") return "NTU students planning internships";
  if (theme === "Accommodation and hall life") return "Incoming NTU students";
  if (theme === "International student transition") return "International and exchange students";
  return "NTU students";
}

async function pruneExpiredResearchSignals(env: Env) {
  const result = await env.DB.prepare("SELECT id, payload FROM knowledge_entries WHERE created_at < ? LIMIT 500").bind(new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString()).all<{ id: string; payload: string }>();
  const staleIds = result.results
    .map((row) => ({ id: row.id, signal: normalizeResearchSignal(JSON.parse(row.payload) as ResearchSignal) }))
    .filter(({ signal }) => signal.sourceType === "reddit" && signal.expiresAt && new Date(signal.expiresAt).getTime() <= Date.now())
    .map(({ id }) => id);
  if (staleIds.length) await env.DB.batch(staleIds.map((id) => env.DB.prepare("DELETE FROM knowledge_entries WHERE id = ?").bind(id)));
}

async function getPost(env: Env, id: string): Promise<MarketingPost | undefined> {
  const row = await env.DB.prepare("SELECT payload FROM posts WHERE id = ?").bind(id).first<{ payload: string }>();
  return row ? withDefaults(JSON.parse(row.payload) as MarketingPost) : undefined;
}

async function savePost(env: Env, post: MarketingPost) {
  await env.DB.prepare("INSERT INTO posts (id, payload, created_at, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at")
    .bind(post.id, JSON.stringify(post), post.createdAt, post.updatedAt)
    .run();
}

async function appendLog(env: Env, action: string, status: "ok" | "error", message: string, metadata?: RunLog["metadata"]) {
  const entry: RunLog = { id: crypto.randomUUID(), action, status, message, metadata, createdAt: now() };
  await env.DB.prepare("INSERT INTO run_logs (id, action, status, message, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(entry.id, entry.action, entry.status, entry.message, JSON.stringify(entry.metadata ?? {}), entry.createdAt)
    .run();
}

async function migrateLocalData(request: Request, env: Env, origin: string | null) {
  const token = request.headers.get("X-Migration-Token") ?? "";
  if (!env.SITES_MIGRATION_TOKEN || token !== env.SITES_MIGRATION_TOKEN) throw new HttpError(401, "Invalid migration token.");
  const input = await readJson<{ posts?: MarketingPost[]; logs?: RunLog[] }>(request);
  const posts = Array.isArray(input.posts) ? input.posts : [];
  const logs = Array.isArray(input.logs) ? input.logs : [];
  if (posts.length > 500 || logs.length > 1_000) throw new HttpError(400, "Migration payload is too large.");

  const statements = [
    ...posts.map((post) => {
      const normalized = withDefaults(post);
      return env.DB.prepare("INSERT INTO posts (id, payload, created_at, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at")
        .bind(normalized.id, JSON.stringify(normalized), normalized.createdAt, normalized.updatedAt);
    }),
    ...logs.map((log) => env.DB.prepare("INSERT INTO run_logs (id, action, status, message, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET action = excluded.action, status = excluded.status, message = excluded.message, metadata = excluded.metadata, created_at = excluded.created_at")
      .bind(log.id, log.action, log.status, log.message, JSON.stringify(log.metadata ?? {}), log.createdAt))
  ];
  if (statements.length) await env.DB.batch(statements);
  return respond({ ok: true, posts: posts.length, logs: logs.length }, 201, env, origin);
}

async function recentLogs(env: Env): Promise<RunLog[]> {
  const result = await env.DB.prepare("SELECT id, action, status, message, metadata, created_at FROM run_logs ORDER BY created_at DESC LIMIT 12").all<{ id: string; action: string; status: "ok" | "error"; message: string; metadata: string; created_at: string }>();
  return result.results.map((row) => ({ id: row.id, action: row.action, status: row.status, message: row.message, metadata: JSON.parse(row.metadata || "{}"), createdAt: row.created_at }));
}

async function createGeneratedPost(env: Env, existing: MarketingPost[], offset: number, useModel = true): Promise<MarketingPost> {
  const fallback = templatePost(offset);
  if (!useModel || !env.DEEPSEEK_API_KEY || Number(env.MAX_COST_CNY_PER_POST ?? 0.5) < 0.12) return fallback;
  try {
    const inspirationSignals = selectRedditInspirationSignals(await listResearchSignals(env));
    const editorialBrief = buildEditorialBrief(inspirationSignals);
    const generated = await callDeepSeek(env, fallback, "", inspirationSignals, editorialBrief);
    if (generated) return withInspirationMetadata({ ...fallback, ...generated, id: crypto.randomUUID(), createdAt: now(), updatedAt: now(), generator: "deepseek-source-constrained", estimatedCostCny: 0.12 }, inspirationSignals, editorialBrief.angle);
  } catch {
    // A no-cost template is safer than blocking the operator or inventing a fact.
  }
  return fallback;
}

async function regeneratePost(env: Env, post: MarketingPost, feedback: string): Promise<MarketingPost> {
  const inspirationSignals = env.DEEPSEEK_API_KEY ? selectRedditInspirationSignals(await listResearchSignals(env)) : [];
  const editorialBrief = buildEditorialBrief(inspirationSignals);
  const generated = env.DEEPSEEK_API_KEY ? await callDeepSeek(env, post, feedback, inspirationSignals, editorialBrief).catch(() => undefined) : undefined;
  const base = generated ? { ...post, ...generated } : { ...post, title: fitTitle(post.title), body: `${post.body}\n\n补充：${feedback}` };
  const next = { ...base, id: post.id, revisionNotes: [...post.revisionNotes, feedback], updatedAt: now(), generator: generated ? "deepseek-source-constrained" : "template-revision" };
  return generated ? withInspirationMetadata(next, inspirationSignals, editorialBrief.angle) : next;
}

async function callDeepSeek(env: Env, post: MarketingPost, feedback: string, researchSignals: ResearchSignal[], editorialBrief: ReturnType<typeof buildEditorialBrief>): Promise<Pick<MarketingPost, "title" | "body" | "tags" | "imageIdeas" | "callToAction" | "review"> | undefined> {
  const sourceText = officialSources.map((source) => ({ id: source.id, title: source.title, url: source.url, claims: source.claims })).map((source) => JSON.stringify(source)).join("\n");
  const signalText = researchSignals.map((signal) => JSON.stringify({ theme: signal.theme, audience: signal.audience, tags: signal.tags ?? [], insight: signal.insight })).join("\n");
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { ...jsonHeaders, Authorization: `Bearer ${env.DEEPSEEK_API_KEY}` },
    body: JSON.stringify({
      model: env.DEEPSEEK_MODEL || "deepseek-chat",
      temperature: 0.7,
      max_tokens: 1000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You write natural Simplified Chinese Xiaohongshu drafts for an NTU Chinese student society. Return JSON only. The title is 20 Chinese characters or fewer. Never invent dates, venues, event names, fees, eligibility, opening hours, deadlines, or services. Any factual statement must be directly supported by the supplied official sources. When a detail is unknown, write a general personal suggestion and tell readers to check the linked official page. The public-reference signals are NOT facts and MUST NOT be cited, quoted, closely paraphrased, attributed to a creator, or used to name a specific person. Never write Reddit, forum, netizen, post, or a similar attribution. Use community signals only to choose a useful topic, a realistic pain point, or a narrative structure. The body must contain a short opening situation, then at least three visibly separated practical steps, then a gentle verification reminder. Do not use generic filler. Avoid hard selling and unsupported certainty." },
        { role: "user", content: `Draft to improve:\n${JSON.stringify({ title: post.title, body: post.body, tags: post.tags, feedback })}\n\nEditorial brief (follow its audience, angle and action plan; it is not evidence):\n${JSON.stringify(editorialBrief)}\n\nApproved official source pack:\n${sourceText}\n\nPublic-reference signals (topic inspiration only, never factual evidence):\n${signalText || "No public-reference signals yet."}\n\nReturn {title,body,tags,imageIdeas,callToAction,review:{score,notes,approved}}.` }
      ]
    })
  });
  if (!response.ok) return undefined;
  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content;
  if (!content) return undefined;
  const parsed = JSON.parse(content) as Partial<MarketingPost>;
  if (typeof parsed.title !== "string" || typeof parsed.body !== "string" || !Array.isArray(parsed.tags)) return undefined;
  const safetyNotes = draftSafetyNotes(parsed.body.trim());
  return {
    title: fitTitle(parsed.title),
    body: parsed.body.trim(),
    tags: parsed.tags.filter((tag): tag is string => typeof tag === "string").map(cleanTag).filter(Boolean).slice(0, 10),
    imageIdeas: Array.isArray(parsed.imageIdeas) ? parsed.imageIdeas.filter((idea): idea is string => typeof idea === "string").slice(0, 3) : post.imageIdeas,
    callToAction: typeof parsed.callToAction === "string" ? parsed.callToAction.trim() : post.callToAction,
    review: {
      score: safetyNotes.length ? 72 : 90,
      notes: ["Source-constrained AI draft. Review before saving to publishing list.", ...safetyNotes],
      approved: safetyNotes.length === 0
    }
  };
}

function withInspirationMetadata(post: MarketingPost, inspirationSignals: ResearchSignal[], editorialAngle: string): MarketingPost {
  if (!inspirationSignals.length) return post;
  const localSignals = inspirationSignals.map((signal) => "社区灵感：" + signal.theme).slice(0, 5);
  return {
    ...post,
    topic: { ...post.topic, localSignals },
    review: {
      ...post.review,
      notes: [...post.review.notes, "内容策略：" + editorialAngle, "本次使用 " + inspirationSignals.length + " 条已核准、脱敏的社区选题信号；只用于选题和结构，不作为事实依据。"]
    }
  };
}

function templatePost(offset: number): MarketingPost {
  const theme = themes[Math.abs(offset) % themes.length];
  const timestamp = now();
  return {
    id: crypto.randomUUID(),
    title: theme.title,
    body: `${theme.scene}，很多同学会同时收到课程、社团和生活上的信息。\n\n我自己的做法是先把“需要今天确认”的事写下来，再回到对应的官方页面核对。这样至少不会把群聊里的转述，当成最终答案。\n\nNTU 的 Student Life、International Students、Academic Calendar 和 NBS Student Life 页面都是可以先查的入口。具体日期、资格、地点或活动安排，请以链接里的最新说明为准。\n\n把这篇当作一个整理信息的小提醒，不确定时宁可多核对一次。`,
    tags: ["NTU", "NBS", "新加坡留学", "NTU留学生", "校园生活"],
    imageIdeas: ["便利贴封面：大标题配三条核对信息", "清单图：官方来源、同学经验、下一步行动", "文字卡：不确定的信息先回官方页面"],
    imageAssets: [],
    callToAction: "你最希望我们整理哪一类 NTU / NBS 校园信息？",
    status: "draft",
    topic: { style: theme.style, targetSegment: "general", scene: theme.scene, angle: theme.angle, hook: theme.title, localSignals: ["NTU", "NBS", "Singapore"] },
    review: { score: 90, notes: ["All operational facts are kept general and linked to official sources."], approved: true },
    metrics: emptyMetrics(),
    estimatedCostCny: 0,
    generator: "source-constrained-template",
    createdAt: timestamp,
    updatedAt: timestamp,
    revisionNotes: [],
    sourceReferences: officialSources.slice(0, 3),
    factCheck: { status: "verified", notes: ["Source pack matched to the draft. Specific changing details are intentionally omitted."], checkedAt: timestamp }
  };
}

function blankPost(): MarketingPost {
  const timestamp = now();
  return { ...templatePost(0), id: crypto.randomUUID(), title: "", body: "", tags: [], imageIdeas: [], callToAction: "", status: "draft", review: { score: 0, notes: [], approved: false }, createdAt: timestamp, updatedAt: timestamp, sourceReferences: [], factCheck: { status: "needs_review", notes: [] } };
}

function validatePatch(post: MarketingPost, patch: Partial<MarketingPost>): MarketingPost {
  const next = withDefaults({ ...post, ...patch, metrics: { ...post.metrics, ...(patch.metrics ?? {}) }, updatedAt: now() });
  if (!next.title.trim() || !next.body.trim()) throw new HttpError(400, "Title and body are required.");
  next.title = fitTitle(next.title);
  if ((next.status === "approved" || next.status === "published") && !verifiedSources(next.sourceReferences, next.factCheck)) {
    throw new HttpError(409, "Verified official sources are required before a post enters the publishing list.");
  }
  if (next.status === "published" && !validPublishedUrl(next.publishedUrl)) throw new HttpError(400, "A valid published Xiaohongshu URL is required before marking a post as published.");
  return next;
}

function verifiedSources(sources: SourceReference[], factCheck: MarketingPost["factCheck"]) {
  const allowed = new Map(officialSources.map((source) => [source.id, source.url]));
  return factCheck.status === "verified" && sources.length > 0 && sources.every((source) => allowed.get(source.id) === source.url);
}

function publishPackage(post: MarketingPost) {
  const title = fitTitle(post.title);
  const tagsLine = post.tags.map((tag) => `#${cleanTag(tag)}`).join(" ");
  return {
    postId: post.id,
    title,
    body: post.body,
    tagsLine,
    imageIdeas: post.imageIdeas,
    imageAssets: post.imageAssets,
    coverText: title,
    visualBrief: `封面文字：${title}\n场景：${post.topic.scene}\n构图：3:4便利贴信息卡，大标题不超过两行，三个短信息点。`,
    imagePrompt: "Vertical NTU Chinese student society sticky-note cover, paper white, warm red, deep green, clear Chinese headline space, no realistic photo required.",
    assetChecklist: ["封面图：大标题 + 3条短信息", "信息图：来源或步骤", "互动图：一个问题"],
    fullText: [post.body, post.callToAction, tagsLine].filter(Boolean).join("\n\n")
  };
}

async function status(env: Env) {
  const posts = await listPosts(env);
  const total = posts.reduce((sum, post) => sum + post.estimatedCostCny, 0);
  const views = posts.reduce((sum, post) => sum + post.metrics.views, 0);
  const interactions = posts.reduce((sum, post) => sum + post.metrics.likes + post.metrics.saves + post.metrics.comments + post.metrics.follows, 0);
  const inquiries = posts.reduce((sum, post) => sum + post.metrics.inquiries, 0);
  return {
    ok: true,
    strategy: { sampleSize: posts.length, measuredPosts: posts.filter((post) => post.metrics.views > 0).length, styleBuckets: [], segmentBuckets: [], recommendation: posts.length < 3 ? "样本还少，先发布3至5条并回填数据。" : "优先延续有收藏和评论的内容形式。" },
    cost: { totalEstimatedCostCny: total, averageEstimatedCostCny: posts.length ? total / posts.length : 0, paidModelPosts: posts.filter((post) => post.estimatedCostCny > 0).length, withinPerPostBudget: posts.every((post) => post.estimatedCostCny <= Number(env.MAX_COST_CNY_PER_POST ?? 0.5)) },
    recentRuns: await recentLogs(env),
    commands: { publish: "Cloud workspace prepares drafts only; publish manually in Xiaohongshu Creator Center.", dailySchedule: "Cloudflare Cron: 09:15 Singapore time." },
    metrics: { views, interactions, inquiries }
  };
}

function calendar(days: number) {
  const count = between(days, 1, 30);
  return Array.from({ length: count }, (_, index) => {
    const theme = themes[index % themes.length];
    const date = new Date(Date.now() + index * 86_400_000).toISOString().slice(0, 10);
    return { date, slot: index + 1, topic: { style: theme.style, targetSegment: "general", scene: theme.scene, angle: theme.angle, hook: theme.title, localSignals: ["NTU", "NBS"] }, objective: "Create a source-backed draft for review.", suggestedFormat: "Sticky-note cover + text post" };
  });
}

function goLive() {
  return { ok: false, generatedAt: now(), requiredFailures: [], missingExternalEvidence: ["manual Xiaohongshu creator-session check", "published URL evidence"], nextSteps: ["Review a draft, download or upload a cover, publish manually, then paste the URL back."], checks: [{ name: "manual-publish-only", ok: true, severity: "required", detail: "The cloud API never clicks Xiaohongshu publish." }] };
}

function preflightEvidence() {
  return { ok: false, path: "local-only", stale: true, missingGroups: ["title", "body", "upload", "publishButton"], groups: { title: { ok: false, selectors: [] }, body: { ok: false, selectors: [] }, upload: { ok: false, selectors: [] }, publishButton: { ok: false, selectors: [] } }, diagnostics: { visibleButtons: [] }, detail: "Creator Center preflight is intentionally local-only." };
}

function cloudScheduleStatus() {
  return { ok: true, installed: true, taskName: "Cloudflare daily draft", state: "managed", detail: "Cloudflare Cron creates one review draft daily at 09:15 Singapore time.", checkedAt: now(), command: "Configured in worker/wrangler.toml", rawOutput: [] };
}

function coverSvg(post: MarketingPost) {
  const title = escapeXml(fitTitle(post.title));
  const scene = escapeXml(post.topic.scene.slice(0, 34));
  const tags = post.tags.slice(0, 4).map((tag, index) => `<text x="92" y="${1260 + index * 42}" font-size="28" font-weight="700">#${escapeXml(cleanTag(tag))}</text>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1440" viewBox="0 0 1080 1440"><rect width="1080" height="1440" fill="#f5f1e8"/><path d="M0 0H1080V1440H0z" fill="none" stroke="#d9d2c2" stroke-width="2"/><text x="82" y="115" fill="#1d312c" font-family="Arial, sans-serif" font-size="34" font-weight="800">NTU CBA · CAMPUS NOTE</text><rect x="76" y="210" width="928" height="780" rx="12" fill="#fffdf7" stroke="#1d312c" stroke-width="7"/><rect x="132" y="280" width="520" height="350" fill="#ffe78b" stroke="#1d312c" stroke-width="6" transform="rotate(-2 392 455)"/><text x="170" y="385" fill="#1d312c" font-family="Arial, sans-serif" font-size="76" font-weight="900">${title}</text><rect x="684" y="350" width="238" height="164" fill="#b8ded5" stroke="#1d312c" stroke-width="6" transform="rotate(3 803 432)"/><text x="714" y="416" fill="#1d312c" font-family="Arial, sans-serif" font-size="30" font-weight="800">校园信息</text><text x="714" y="456" fill="#1d312c" font-family="Arial, sans-serif" font-size="30" font-weight="800">先核对来源</text><text x="130" y="764" fill="#425550" font-family="Arial, sans-serif" font-size="38" font-weight="700">${scene}</text><rect x="132" y="820" width="760" height="70" fill="#e7503d"/><text x="162" y="870" fill="#fffdf7" font-family="Arial, sans-serif" font-size="34" font-weight="800">官方来源 + 同学经验 + 可执行下一步</text>${tags}</svg>`;
}

function withDefaults(post: MarketingPost): MarketingPost {
  return { ...post, imageAssets: post.imageAssets ?? [], revisionNotes: post.revisionNotes ?? [], sourceReferences: post.sourceReferences ?? [], factCheck: post.factCheck ?? { status: "needs_review", notes: [] }, metrics: { ...emptyMetrics(), ...(post.metrics ?? {}) } };
}

function emptyMetrics() { return { views: 0, likes: 0, saves: 0, comments: 0, follows: 0, inquiries: 0 }; }
function now() { return new Date().toISOString(); }
function fitTitle(value: string) { return Array.from(value.trim()).slice(0, 20).join("").replace(/[，。；、\s]+$/, ""); }
function cleanTag(value: string) { return value.replace(/^#/, "").replace(/\s+/g, "").slice(0, 24); }
function validPublishedUrl(value: unknown) { try { const url = new URL(String(value)); return url.hostname.endsWith("xiaohongshu.com"); } catch { return false; } }
function between(value: number, min: number, max: number) { return Math.max(min, Math.min(max, Number.isFinite(value) ? Math.floor(value) : min)); }
function escapeXml(value: string) { return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;"); }
async function readJson<T>(request: Request): Promise<T> { try { return await request.json() as T; } catch { throw new HttpError(400, "Request body must be valid JSON."); } }
function corsHeaders(env: Env, origin: string | null) { const allowed = env.ALLOWED_ORIGIN; const headers = new Headers(); if (!allowed || allowed.startsWith("REPLACE_")) { headers.set("Access-Control-Allow-Origin", origin ?? "*"); } else if (origin === allowed) { headers.set("Access-Control-Allow-Origin", allowed); } headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type"); headers.set("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS"); headers.set("Vary", "Origin"); return headers; }
function respond(value: unknown, status: number, env: Env, origin: string | null) { const headers = new Headers(jsonHeaders); corsHeaders(env, origin).forEach((value, key) => headers.set(key, value)); return new Response(JSON.stringify(value), { status, headers }); }
class HttpError extends Error { constructor(readonly status: number, message: string) { super(message); } }
