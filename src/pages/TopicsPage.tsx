import { useState } from "react";
import { useLocale } from "../i18n/useLocale";
import TopicCard from "../components/topics/TopicCard";

interface Topic {
  name: string;
  slug: string;
  description: string;
  domainCount: number;
}

const TOPICS: Topic[] = [
  {
    name: "Python 基础",
    slug: "python-ji-chu",
    description: "学习 Python 语法、常用数据结构与标准库，建立稳定的编程基础。",
    domainCount: 12,
  },
  {
    name: "JavaScript 入门",
    slug: "javascript-ru-men",
    description: "掌握 JavaScript 基础、DOM 操作、事件处理与浏览器 API。",
    domainCount: 10,
  },
  {
    name: "计算机网络",
    slug: "ji-suan-ji-wang-luo",
    description: "理解协议栈、TCP/IP、HTTP、DNS 等核心概念，搭建网络认知框架。",
    domainCount: 8,
  },
  {
    name: "数据结构",
    slug: "shu-ju-jie-gou",
    description: "学习数组、链表、栈、队列、树和图等经典结构及其使用场景。",
    domainCount: 15,
  },
  {
    name: "Git 版本控制",
    slug: "git-ban-ben-kong-zhi",
    description: "掌握 Git 常用命令、分支管理、合并策略与团队协作工作流。",
    domainCount: 6,
  },
  {
    name: "Linux 基础",
    slug: "linux-ji-chu",
    description: "学习 Linux 命令行、文件权限、进程管理与 Shell 脚本。",
    domainCount: 9,
  },
];

export default function TopicsPage() {
  const [search, setSearch] = useState("");
  const L = useLocale();

  const filtered = TOPICS.filter(
    (topic) =>
      topic.name.includes(search) ||
      topic.description.includes(search),
  );

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">{L.topics.title}</h1>
          <p className="mt-1 text-sm text-gray-500">{L.topics.subtitle}</p>
        </div>

        <div className="mb-6">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={L.topics.search}
            className="h-11 w-full rounded-xl border border-gray-200 bg-white px-4 text-sm shadow-sm transition-all focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
        </div>

        {filtered.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <p className="text-base">{L.topics.noMatch}</p>
            <p className="mt-1 text-xs">{L.topics.noMatchHint}</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {filtered.map((topic) => (
              <TopicCard key={topic.slug} {...topic} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
