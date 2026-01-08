# 系统功能增强计划：物品栏、上下文感知与UI分离 (修订版)

## 1. 数据结构与物品栏逻辑 (Data & Logic)
首先，我们需要扩展人物数据结构以支持“物品栏”，并更新 `character_recorder` 智能体来维护它。

*   **修改 `src/types/index.ts`**:
    *   `CharacterProfile` 接口新增 `inventory: string[]` 字段，用于存储主角的物品列表。
*   **修改 `src/api/analyzers.ts`**:
    *   更新 `buildCharacterProfile` 函数，初始化 `inventory` 字段（默认为空数组）。
    *   更新 `analyzeCharacters` 函数：
        *   解析返回 JSON 中的 `inventory` 字段。
        *   实现合并逻辑：新物品追加，已消耗物品移除。
    *   更新 `updateCharacterVector` 函数，将 `inventory` 信息写入向量文本中。
*   **修改 `src/store/agentConfigStore.ts`**:
    *   更新 `character_recorder` 的系统提示词：
        *   **明确物品收录标准**：仅记录明确获得的、具有长期价值或任务属性的物品（如武器、钥匙、重要信物）。
        *   **排除临时物品**：明确指示忽略临时性、随手可得且用完即弃的物品（如“为了反击抓起的碎玻璃”、“路边的石头”）。
        *   **持久性原则**：对于重要物品，除非剧情明确提及丢失、损坏或消耗，否则不得从物品栏移除。

## 2. 强制上下文注入与一致性约束 (Mandatory Context Injection)
不再依赖向量检索，而是将主角的状态（身体+物品）强制注入到写作和评审的 Prompt 中，并增加逻辑约束。

*   **修改 `src/api/deepseek.ts`**:
    *   **更新 `generateNovelSegment` (小说家)**:
        *   新增参数 `protagonistProfile` (类型 `CharacterProfile`).
        *   构建 `protagonistMsg` 字符串，包含身体状态 (`bodyStatus`) 和物品栏 (`inventory`)。
        *   在 `processTemplate` 中注入 `protagonistStatus: protagonistMsg` 变量。
    *   **更新 `generateExpertCritique` (专家评审)**:
        *   新增参数 `protagonistProfile`.
        *   同样构建并注入 `protagonistStatus` 变量。
*   **修改 `src/store/agentConfigStore.ts`**:
    *   更新 `novel_writer` 系统提示词：
        *   添加 `{{protagonistStatus}}` 占位符。
        *   **增加物品使用约束**：明确要求主角只能使用“物品栏中已有”或“当前场景环境中合理存在”的物品。严禁使用凭空出现的物品（如在荒郊野外凭空变出绷带）。
    *   更新 `expert_critique` 系统提示词：
        *   添加 `{{protagonistStatus}}` 占位符。
        *   **增加逻辑检查指令**：要求专家重点审查主角使用的物品是否合理（检查是否在物品栏中，或是否符合场景环境）。如果主角使用了未持有的物品且环境不支持，必须指出为逻辑漏洞。
*   **修改 `src/store/useDiscussionStore.ts`**:
    *   在调用 `generateNovelSegment` 和 `generateExpertCritique` 的地方，传递主角数据。

## 3. UI 分离与交互优化 (UI/UX)
将右侧面板拆分为独立的“专家视图”和“人体视图”，并提供独立的控制按钮。

*   **修改 `src/pages/NovelWorkshopPage.tsx`**:
    *   **状态管理**: 将 `isRightPanelOpen` 替换为 `activePanel` (类型 `'none' | 'experts' | 'body'`)。
    *   **按钮设计**:
        *   在右侧边缘设计两个垂直排列的悬浮按钮（抽屉把手式）。
        *   上方按钮：图标（如 `Activity`），点击切换“人体视图”。
        *   下方按钮：图标（如 `Users`），点击切换“专家视图”。
    *   **面板渲染**: 根据 `activePanel` 渲染对应内容。
    *   **物品展示**: 在 `BodyStatusView` 组件中增加“随身物品”区域，展示 `inventory` 列表。

## 4. 验证计划
*   **Prompt测试**: 在 Debug 面板检查生成的 Prompt，确认包含了物品使用约束。
*   **逻辑测试**: 模拟“主角想用枪但没枪”的场景，看专家是否指出错误。
*   **UI测试**: 确认两个视图按钮工作正常且互斥。
