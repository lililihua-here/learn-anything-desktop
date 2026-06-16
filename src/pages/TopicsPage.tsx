import { useState } from "react";
import { useLocale } from "../i18n/useLocale";
import { useSettingsStore } from "../stores/settingsStore";
import TopicCard from "../components/topics/TopicCard";

interface Topic {
  nameEn: string;
  nameZh: string;
  slug: string;
  descriptionEn: string;
  descriptionZh: string;
  domainCount: number;
}

const TOPICS: Topic[] = [
  {
    nameEn: "Python Basics",
    nameZh: "Python 基础",
    slug: "python-ji-chu",
    descriptionEn: "Learn Python syntax, common data structures, and the standard library.",
    descriptionZh: "学习 Python 语法、常用数据结构与标准库，建立稳定的编程基础。",
    domainCount: 12,
  },
  {
    nameEn: "JavaScript Fundamentals",
    nameZh: "JavaScript 入门",
    slug: "javascript-ru-men",
    descriptionEn: "Cover JavaScript fundamentals, DOM manipulation, events, and browser APIs.",
    descriptionZh: "掌握 JavaScript 基础、DOM 操作、事件处理与浏览器 API。",
    domainCount: 10,
  },
  {
    nameEn: "Computer Networking",
    nameZh: "计算机网络",
    slug: "ji-suan-ji-wang-luo",
    descriptionEn: "Understand protocol stacks, TCP/IP, HTTP, DNS, and the core network model.",
    descriptionZh: "理解协议栈、TCP/IP、HTTP、DNS 等核心概念，搭建网络认知框架。",
    domainCount: 8,
  },
  {
    nameEn: "Data Structures",
    nameZh: "数据结构",
    slug: "shu-ju-jie-gou",
    descriptionEn: "Study arrays, linked lists, stacks, queues, trees, and graphs.",
    descriptionZh: "学习数组、链表、栈、队列、树和图等经典结构及其使用场景。",
    domainCount: 15,
  },
  {
    nameEn: "Git Version Control",
    nameZh: "Git 版本控制",
    slug: "git-ban-ben-kong-zhi",
    descriptionEn: "Learn daily Git commands, branching, merging strategies, and team workflows.",
    descriptionZh: "掌握 Git 常用命令、分支管理、合并策略与团队协作流程。",
    domainCount: 6,
  },
  {
    nameEn: "Linux Basics",
    nameZh: "Linux 基础",
    slug: "linux-ji-chu",
    descriptionEn: "Learn the Linux command line, file permissions, process management, and shell scripts.",
    descriptionZh: "学习 Linux 命令行、文件权限、进程管理与 Shell 脚本。",
    domainCount: 9,
  },
];

export default function TopicsPage() {
  const [search, setSearch] = useState("");
  const locale = useSettingsStore((s) => s.locale);
  const L = useLocale();
  const normalizedSearch = search.trim().toLowerCase();

  const filtered = TOPICS.filter((topic) => {
    if (!normalizedSearch) return true;
    const name = locale === "zh-CN" ? topic.nameZh : topic.nameEn;
    const description = locale === "zh-CN" ? topic.descriptionZh : topic.descriptionEn;
    return (
      name.toLowerCase().includes(normalizedSearch) ||
      description.toLowerCase().includes(normalizedSearch)
    );
  });

  return (
    <div className="h-full overflow-y-auto bg-gray-50 dark:bg-slate-950">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{L.topics.title}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{L.topics.subtitle}</p>
        </div>

        <div className="mb-6">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={L.topics.search}
            className="h-11 w-full rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-900 shadow-sm transition-all focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:ring-indigo-500/20"
          />
        </div>

        {filtered.length === 0 ? (
          <div className="py-16 text-center text-gray-400 dark:text-gray-500">
            <p className="text-base">{L.topics.noMatch}</p>
            <p className="mt-1 text-xs">{L.topics.noMatchHint}</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {filtered.map((topic) => (
              <TopicCard
                key={topic.slug}
                name={locale === "zh-CN" ? topic.nameZh : topic.nameEn}
                description={locale === "zh-CN" ? topic.descriptionZh : topic.descriptionEn}
                slug={topic.slug}
                domainCount={topic.domainCount}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
