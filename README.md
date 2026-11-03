# 世界模拟器

一个以人物为核心、以世界规则为约束、支持事件驱动与有限自主运行的本地优先型网页模拟器。

## 当前阶段

Phase 0：冻结术语、规格与验收样例；尚未开始网页功能开发。

## 核心约束

- V 永远表示“锚定（Anchoring）”，不表示旧 BMOS 的 Validation。
- 事件、行动、后果与长期沉积必须可审计、可回放、可分叉。
- 普通行动可自动执行；重大行动和长期沉积必须由作者确认。
- AI 仅生成草案与渲染，不拥有状态提交或审批权限。

## 目录

```text
docs/product/       # PRD 与验收标准
docs/architecture/  # 数据模型、API 与模块架构
docs/decisions/     # 关键产品与技术决策
fixtures/           # 固定种子世界与回归样例
tests/              # 自动化测试
```

详细规格见 `docs/product/world-simulator-v1-spec.md`。
