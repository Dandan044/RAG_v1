# 优化方案：智能体交互并发执行

经过代码分析，我发现小说工作流中的 **大纲讨论阶段 (Outline Discussion Phase)** 目前是顺序执行的，这导致当有多个专家参与时，效率非常低下。我建议将此阶段的专家发言改为 **并发执行**。

## 问题分析
- **位置**: [useDiscussionStore.ts](file:///d:/python_project/RAG_v1/src/store/useDiscussionStore.ts) 中的 `processNovelCycle` 函数。
- **现状**:
  - 大纲讨论包含 2 轮。
  - 目前代码使用 `for (const expert of experts)` 循环，配合 `await` **顺序**调用每个专家的 API。
  - 假设有 5 位专家，每位耗时 10 秒，一轮讨论就需要 50 秒。
- **瓶颈**: 用户需要漫长等待每位专家依次发言，且专家之间在同一轮内其实不需要严格的顺序依赖（通常是基于上一轮的汇总）。

## 实施计划

### 1. 重构大纲讨论逻辑 (`outline_discussion`)
将串行执行改为 **每轮并行执行 (Fan-out/Fan-in)**。

- **修改前**:
  ```typescript
  for (let r = 0; r < 2; r++) {
      for (const expert of experts) {
          await generateOutlineContribution(...); // 必须等上一个说完
      }
  }
  ```
- **修改后**:
  ```typescript
  for (let r = 0; r < 2; r++) {
      // 1. 批量创建所有专家的占位消息（让UI显示所有专家都在思考）
      // 2. 使用 Promise.all 并发触发所有专家的生成请求
      await Promise.all(experts.map(expert => generateOutlineContribution(...)));
      // 3. 本轮结束后，统一汇总观点，供下一轮参考
  }
  ```

### 2. 预期效果
- **效率提升**: 时间复杂度从 `O(轮次 × 专家数)` 降低为 `O(轮次)`。5 位专家的讨论速度将提升近 **5倍**。
- **用户体验**: 用户将看到所有专家头像同时进入“思考中”状态，并几乎同时输出观点，氛围更热烈。

## 验证方法
- 修改代码后，启动小说工作流。
- 观察大纲生成阶段，确认多个专家的回复是否同时开始流式输出（或在极短时间内相继开始）。
- 检查生成的 `discussionLog` 是否完整包含所有专家的观点。
