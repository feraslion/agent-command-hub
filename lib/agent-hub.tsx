import { PropsWithChildren, createContext, useContext, useMemo, useState } from "react";

export type ProjectStatus = "قيد البناء" | "قيد المراجعة" | "مكتمل";
export type AgentStatus = "نشط" | "بانتظار المهمة" | "مراجعة";
export type TaskStatus = "مكتمل" | "قيد التنفيذ" | "مراجعة" | "قادم" | "محجوب";
export type EventType =
  | "TASK_CREATED"
  | "TASK_ASSIGNED"
  | "ARTIFACT_CREATED"
  | "TEST_REQUESTED"
  | "REVIEW_REQUESTED"
  | "REVIEW_APPROVED";

export type Project = {
  id: string;
  name: string;
  code: string;
  status: ProjectStatus;
  progress: number;
  currentStage: string;
  currentAgent: string;
  updatedAt: string;
};

export type Agent = {
  id: string;
  name: string;
  role: string;
  status: AgentStatus;
  color: string;
  responsibility: string;
  input: string;
  constraints: string;
  output: string;
  handoff: string;
};

export type Task = {
  id: string;
  projectId: string;
  title: string;
  stage: string;
  owner: string;
  status: TaskStatus;
  priority: "عالية" | "متوسطة" | "منخفضة";
  artifact: string;
};

export type ExecutionEvent = {
  id: string;
  projectId: string;
  taskId?: string;
  type: EventType;
  label: string;
  actor: string;
  time: string;
  detail: string;
};

export type Decision = {
  id: string;
  code: string;
  decision: string;
  reason: string;
  approvedBy: string;
  date: string;
};

export type ChatMessage = {
  id: string;
  sender: "أنت" | "النظام";
  text: string;
  time: string;
};

const activeProjectId = "ad1";

const initialProjects: Project[] = [
  {
    id: activeProjectId,
    name: "منصة إدارة المخزون",
    code: "AD1",
    status: "قيد البناء",
    progress: 72,
    currentStage: "البناء الخلفي",
    currentAgent: "Backend Builder",
    updatedAt: "الآن",
  },
  {
    id: "ac2",
    name: "بوابة خدمات العملاء",
    code: "AC2",
    status: "قيد المراجعة",
    progress: 91,
    currentStage: "المراجعة",
    currentAgent: "Reviewer Agent",
    updatedAt: "منذ 18 دقيقة",
  },
];

const initialAgents: Agent[] = [
  {
    id: "orchestrator",
    name: "Orchestrator Agent",
    role: "مدير المنظومة",
    status: "نشط",
    color: "#4F46E5",
    responsibility: "يفهم الهدف، يجزّئ العمل، ويختار الوكيل وتسلسل التنفيذ المناسبين.",
    input: "هدف المشروع، حالة المهام، مخرجات الوكلاء، وسياسة الموافقات.",
    constraints: "لا يغيّر الشيفرة أو مخطط البيانات مباشرة، ولا يتجاوز بوابات الموافقة.",
    output: "خطة تنفيذ مرتبة، تكليفات، وقرار التصعيد أو التوقف.",
    handoff: "Requirements أو Architect أو Planner بحسب مرحلة المشروع.",
  },
  {
    id: "requirements",
    name: "Requirements Agent",
    role: "تحليل المتطلبات",
    status: "بانتظار المهمة",
    color: "#0F766E",
    responsibility: "يحوّل وصف المستخدم إلى مواصفات وظيفية وقابلة للتحقق.",
    input: "وصف الهدف، نطاق المستخدمين، والقيود التجارية.",
    constraints: "لا يبدأ البرمجة قبل إكمال معايير القبول والافتراضات.",
    output: "Specification تشمل الأدوار، الشاشات، سير العمل، ومعايير القبول.",
    handoff: "Architect Agent.",
  },
  {
    id: "research",
    name: "Research Agent",
    role: "بحث وتحقق",
    status: "بانتظار المهمة",
    color: "#2563EB",
    responsibility: "يجمع المراجع والتوثيق والحلول التقنية الحديثة عند الحاجة.",
    input: "سؤال بحث محدد أو قرار تقني يحتاج دليلاً.",
    constraints: "يقدّم مصادر وملخصات؛ لا يفرض قراراً معمارياً.",
    output: "نتائج منظمة مع روابط، مفاضلات، ومخاطر.",
    handoff: "Architect أو Planner.",
  },
  {
    id: "architect",
    name: "Architect Agent",
    role: "المعمارية",
    status: "بانتظار المهمة",
    color: "#7C3AED",
    responsibility: "يحدد الواجهة والخدمات والبيانات والأمان وقابلية المراقبة.",
    input: "المواصفات ونتائج البحث والقيود التشغيلية.",
    constraints: "لا يتخطى متطلبات الموافقة للقرارات عالية الأثر.",
    output: "Architecture وTech Stack وData Model وAPI Spec.",
    handoff: "Planner Agent.",
  },
  {
    id: "planner",
    name: "Planner Agent",
    role: "تخطيط التنفيذ",
    status: "بانتظار المهمة",
    color: "#C2410C",
    responsibility: "يحوّل المعمارية إلى Epics وميزات ومهام قابلة للتحقق.",
    input: "المواصفات والمعمارية وقيود التنفيذ.",
    constraints: "لا يكلّف وكيل بناء بلا تعريف واضح للمخرج ومعيار القبول.",
    output: "Backlog مرتب مع التبعيات وأولوية التنفيذ.",
    handoff: "Frontend أو Backend Builder.",
  },
  {
    id: "frontend",
    name: "Frontend Builder",
    role: "بناء الواجهة",
    status: "مراجعة",
    color: "#DB2777",
    responsibility: "ينفذ تجربة المستخدم والمكونات والتنقل وإتاحة الوصول.",
    input: "مهمة واجهة، مواصفات، ومعايير قبول.",
    constraints: "لا يعدّل مخطط البيانات أو قواعد الخلفية من تلقاء نفسه.",
    output: "شيفرة واجهة، اختبارات، وملاحظات التكامل.",
    handoff: "Integration وQA.",
  },
  {
    id: "backend",
    name: "Backend Builder",
    role: "بناء الخدمات",
    status: "نشط",
    color: "#0369A1",
    responsibility: "ينفذ الواجهات البرمجية وقواعد الأعمال والتحقق والتفويض.",
    input: "API Spec ومهمة خلفية وقواعد العمل.",
    constraints: "لا يغيّر تجربة الواجهة أو قواعد المنتج بلا طلب معتمد.",
    output: "خدمات API واختبارات وتوثيق تكامل.",
    handoff: "QA Agent.",
  },
  {
    id: "qa",
    name: "QA Agent",
    role: "تحقق الجودة",
    status: "بانتظار المهمة",
    color: "#15803D",
    responsibility: "يتحقق باستقلالية من السلوك والحالات الطرفية والتكامل.",
    input: "بناء قابل للاختبار ومعايير القبول.",
    constraints: "لا يصلح الشيفرة مباشرة؛ يعيد تقريراً قابلاً للتنفيذ.",
    output: "PASS أو FAIL أو BLOCKED مع الأدلة.",
    handoff: "Debug أو Reviewer.",
  },
  {
    id: "debug",
    name: "Debug Agent",
    role: "تحليل الأعطال",
    status: "بانتظار المهمة",
    color: "#B91C1C",
    responsibility: "يحدد السبب الجذري ويقترح إصلاحاً يمنع تكرار المشكلة.",
    input: "تقرير فشل QA وسجل الخطأ والسياق.",
    constraints: "لا يعالج العرض فقط ولا يغلق الفشل بلا إعادة اختبار.",
    output: "Root Cause Analysis وإصلاح مقترح.",
    handoff: "Builder ثم QA لإعادة التحقق.",
  },
  {
    id: "reviewer",
    name: "Reviewer Agent",
    role: "بوابة المراجعة",
    status: "بانتظار المهمة",
    color: "#334155",
    responsibility: "يراجع المتطلبات والمعمارية والشيفرة والاختبارات قبل الإقرار.",
    input: "مخرجات البناء وتقارير QA والقرارات.",
    constraints: "لا يبني الميزة، ويصدر APPROVED أو REWORK REQUIRED فقط.",
    output: "قرار مراجعة موثق مع ملاحظات.",
    handoff: "Release عند الإقرار أو Builder عند إعادة العمل.",
  },
];

const initialTasks: Task[] = [
  { id: "t1", projectId: activeProjectId, title: "تحويل الهدف إلى مواصفات", stage: "المتطلبات", owner: "Requirements Agent", status: "مكتمل", priority: "عالية", artifact: "SPECIFICATION.md" },
  { id: "t2", projectId: activeProjectId, title: "إقرار معمارية النظام", stage: "المعمارية", owner: "Architect Agent", status: "مكتمل", priority: "عالية", artifact: "ARCHITECTURE.md" },
  { id: "t3", projectId: activeProjectId, title: "إنشاء تدفق الواجهة الأساسية", stage: "البناء", owner: "Frontend Builder", status: "مكتمل", priority: "متوسطة", artifact: "واجهة الجوال" },
  { id: "t4", projectId: activeProjectId, title: "تنفيذ عقود واجهة الخدمة", stage: "البناء", owner: "Backend Builder", status: "قيد التنفيذ", priority: "عالية", artifact: "API-SPEC.md" },
  { id: "t5", projectId: activeProjectId, title: "التحقق من مسارات التكامل", stage: "الجودة", owner: "QA Agent", status: "قادم", priority: "عالية", artifact: "QA-REPORT.md" },
  { id: "t6", projectId: activeProjectId, title: "بوابة مراجعة الإصدار", stage: "المراجعة", owner: "Reviewer Agent", status: "قادم", priority: "متوسطة", artifact: "REVIEW.md" },
];

const initialEvents: ExecutionEvent[] = [
  { id: "e1", projectId: activeProjectId, taskId: "t4", type: "TASK_ASSIGNED", label: "إسناد مهمة", actor: "Orchestrator Agent", time: "قبل دقيقتين", detail: "تم إسناد عقد الخدمة إلى Backend Builder." },
  { id: "e2", projectId: activeProjectId, taskId: "t3", type: "ARTIFACT_CREATED", label: "إنتاج مخرج", actor: "Frontend Builder", time: "قبل 11 دقيقة", detail: "تم تسليم تدفق الواجهة الأساسية إلى التكامل." },
  { id: "e3", projectId: activeProjectId, taskId: "t2", type: "REVIEW_APPROVED", label: "إقرار المراجعة", actor: "Reviewer Agent", time: "قبل 26 دقيقة", detail: "تم اعتماد قرار المعمارية DEC-001." },
];

const initialDecisions: Decision[] = [
  { id: "d1", code: "DEC-001", decision: "اعتماد عقود API مستقلة عن واجهة الجوال", reason: "تسهيل اختبار التكامل واستبدال الواجهة دون تغيير قواعد الأعمال.", approvedBy: "Architect Agent", date: "17 أغسطس 2026" },
];

const initialMessages: ChatMessage[] = [
  { id: "m1", sender: "النظام", text: "بدأت دورة البناء بعد اعتماد المعمارية. الوكيل الحالي: Backend Builder.", time: "10:24" },
  { id: "m2", sender: "أنت", text: "أعطِ أولوية لمسارات المبيعات والتقارير في أول تسليم.", time: "10:29" },
];

type HubContextValue = {
  projects: Project[];
  agents: Agent[];
  tasks: Task[];
  events: ExecutionEvent[];
  decisions: Decision[];
  messages: ChatMessage[];
  activeProject: Project;
  addProject: () => void;
  requestVerification: (taskId: string) => void;
  sendMessage: (text: string) => void;
};

const HubContext = createContext<HubContextValue | null>(null);

export function HubProvider({ children }: PropsWithChildren) {
  const [projects, setProjects] = useState(initialProjects);
  const [tasks, setTasks] = useState(initialTasks);
  const [events, setEvents] = useState(initialEvents);
  const [messages, setMessages] = useState(initialMessages);
  const activeProject = projects.find((project) => project.id === activeProjectId) ?? projects[0];

  const addProject = () => {
    const nextNumber = projects.length + 1;
    const newProject: Project = {
      id: `local-${Date.now()}`,
      name: `مشروع جديد ${nextNumber}`,
      code: `NP${nextNumber}`,
      status: "قيد البناء",
      progress: 0,
      currentStage: "تحليل المتطلبات",
      currentAgent: "Requirements Agent",
      updatedAt: "الآن",
    };
    setProjects((current) => [newProject, ...current]);
  };

  const requestVerification = (taskId: string) => {
    const task = tasks.find((item) => item.id === taskId);
    if (!task || task.status !== "قيد التنفيذ") return;
    setTasks((current) => current.map((item) => item.id === taskId ? { ...item, status: "مراجعة" } : item));
    setProjects((current) => current.map((project) => project.id === task.projectId ? { ...project, progress: 78, currentStage: "الجودة", currentAgent: "QA Agent", updatedAt: "الآن" } : project));
    setEvents((current) => [{ id: `event-${Date.now()}`, projectId: task.projectId, taskId, type: "TEST_REQUESTED", label: "طلب تحقق", actor: "Backend Builder", time: "الآن", detail: "أُرسل عقد الخدمة إلى QA لإجراء التحقق." }, ...current]);
  };

  const sendMessage = (text: string) => {
    const normalized = text.trim();
    if (!normalized) return;
    setMessages((current) => [...current, { id: `message-${Date.now()}`, sender: "أنت", text: normalized, time: "الآن" }]);
  };

  const value = useMemo(() => ({ projects, agents: initialAgents, tasks, events, decisions: initialDecisions, messages, activeProject, addProject, requestVerification, sendMessage }), [projects, tasks, events, messages, activeProject]);
  return <HubContext.Provider value={value}>{children}</HubContext.Provider>;
}

export function useAgentHub() {
  const context = useContext(HubContext);
  if (!context) throw new Error("useAgentHub must be used within HubProvider");
  return context;
}

export function statusTone(status: ProjectStatus | AgentStatus | TaskStatus) {
  if (status === "مكتمل" || status === "نشط") return "success" as const;
  if (status === "قيد التنفيذ" || status === "قيد البناء") return "primary" as const;
  if (status === "مراجعة" || status === "قيد المراجعة") return "warning" as const;
  if (status === "محجوب") return "error" as const;
  return "muted" as const;
}
