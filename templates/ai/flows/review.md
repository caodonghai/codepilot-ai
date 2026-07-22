# /ai:review

使用此流程审查变更的正确性和风险。

## 输入

- 必需：`<change>` 名称。

## 协议

1. 阅读 `.ai/core/workflow.md` 和 `.ai/core/review.md`。
2. 如果 `openspec/changes/<change>` 存在，读取其下的所有文件。如果不存在，根据用户声明的请求审查当前 diff。
3. 阅读 `superpowers/skills/code-review.md`。
4. 检查 diff 和相关的周围代码。
5. 优先处理 bug、回归、范围蔓延、缺失状态、损坏的请求契约和缺失的验证。
6. 除非明确要求修复发现，否则不要重写代码。
7. 尽可能提供文件和行引用。

## 输出

首先返回发现，按严重性排序。如果没有发现，说明这一点并列出任何剩余的验证风险。