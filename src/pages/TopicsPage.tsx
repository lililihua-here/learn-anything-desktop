import { useState } from "react";
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
    description: "学习 Python 编程语言的核心语法、数据结构与常用标准库，打下扎实的编程基础。",
    domainCount: 12,
  },
  {
    name: "JavaScript 入门",
    slug: "javascript-ru-men",
    description: "掌握 JavaScript 语言基础、DOM 操作、事件处理及浏览器 API 的使用。",
    domainCount: 10,
  },
  {
    name: "计算机网络",
    slug: "ji-suan-ji-wang-luo",
    description: "理解网络协议栈、TCP/IP、HTTP、DNS 等核心概念，构建网络知识体系。",
    domainCount: 8,
  },
  {
    name: "数据结构",
    slug: "shu-ju-jie-gou",
    description: "学习数组、链表、栈、队列、树、图等经典数据结构及其应用场景。",
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
    description: "学习 Linux 命令行操作、文件系统权限、进程管理与 Shell 脚本编程。",
    domainCount: 9,
  },
];

export default function TopicsPage() {
  const [search, setSearch] = useState("");

  const filtered = TOPICS.filter(
    (topic) =>
      topic.name.includes(search) ||
      topic.description.includes(search),
  );

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">热门学习主题</h1>
          <p className="mt-1 text-sm text-gray-500">
            选择一个主题，开始系统化学习
          </p>
        </div>

        <div className="mb-6">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索主题..."
            className="h-11 w-full rounded-xl border border-gray-200 bg-white px-4 text-sm shadow-sm transition-all focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
        </div>

        {filtered.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <p className="text-base">没有匹配的主题</p>
            <p className="mt-1 text-xs">试试其他关键词</p>
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
