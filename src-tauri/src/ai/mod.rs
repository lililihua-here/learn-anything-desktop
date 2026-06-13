/// Socratic tutor system prompt (Chinese).
pub const SOCRATIC_SYSTEM_PROMPT: &str = "\
你是苏格拉底式学习导师。通过提问引导用户深入理解概念。

首轮对话先询问用户「你对这个概念了解多少？」并给出3个选项：
- 完全没听过 → 从生活化类比开始讲解
- 听过但不理解 → 从概念定义入手
- 有一定了解 → 直接进入核心要点，通过提问检验理解

讲解时：
- 用贴近生活的类比辅助理解
- 给出简单的代码/文字示例
- 识别相关的子概念让用户选择深入学习方向

每一步讲完后询问：接下来想了解什么？

当你识别到一个值得学习的子概念时，调用 present_card 函数生成知识卡片。
当用户选择做测验时，调用 start_quiz 函数出题。
当用户完成学习或测验后，调用 update_concept_status 更新概念掌握状态。
当用户学完当前概念后，调用 suggest_next 推荐下一步方向。";

/// Tool definitions for Anthropic function calling.
pub const SOCRATIC_TOOLS: &[(&str, &str, &str)] = &[
    (
        "present_card",
        "为该学习主题中识别到的一个子概念生成知识卡片",
        r#"{"type":"object","properties":{"name":{"type":"string","description":"子概念名称"},"slug":{"type":"string","description":"kebab-case 标识符"},"summary":{"type":"string","description":"一句话中文描述，不超过20字"}},"required":["name","slug","summary"]}"#,
    ),
    (
        "start_quiz",
        "为当前概念生成测验题",
        r#"{"type":"object","properties":{"quiz_type":{"type":"string","enum":["choice","short_answer","code"]},"questions":{"type":"array","items":{"type":"object","properties":{"question":{"type":"string"},"options":{"type":"array","items":{"type":"string"}},"correct_index":{"type":"integer"},"expected_keywords":{"type":"array","items":{"type":"string"}},"min_matches":{"type":"integer"},"test_cases":{"type":"array"},"starter_code":{"type":"string"},"function_name":{"type":"string"}}}},"required":["quiz_type","questions"]}}"#,
    ),
    (
        "update_concept_status",
        "更新概念的学习状态",
        r#"{"type":"object","properties":{"slug":{"type":"string"},"status":{"type":"string","enum":["unexplored","in_progress","needs_practice","mastered"]},"confidence":{"type":"number","minimum":0,"maximum":1}},"required":["slug","status","confidence"]}"#,
    ),
    (
        "suggest_next",
        "推荐下一步学习方向",
        r#"{"type":"object","properties":{"options":{"type":"array","items":{"type":"object","properties":{"name":{"type":"string"},"slug":{"type":"string"},"reason":{"type":"string"}}}},"required":["options"]}}"#,
    ),
];
