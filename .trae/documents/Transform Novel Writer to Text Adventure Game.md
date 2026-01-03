# Transform Novel Writer into Interactive Text Adventure Game

## 1. Type Definitions & State Management
- **Modify `NovelSession` interface** in `src/types/index.ts` (implied):
    - Add `currentOptions: string[]` to store the generated choices.
    - Add `choiceHistory: { round: number; choice: string }[]` to track user decisions.
    - Add `status` state: `'selecting_option'`.

## 2. Agent Configuration (`src/store/agentConfigStore.ts`)
- **Modify `novel_writer`**:
    - Change role from "Author" to "Narrator".
    - Update system prompt to focus on interactive storytelling.
    - Limit output length to 100-1500 words.
    - Inject `{{userChoice}}` into the prompt.
- **Add `option_generator`**:
    - System prompt: "Read the current story segment and generate 3 distinct actions/choices for the protagonist."
- **Update `expert_critique`**:
    - Add instruction to verify if the story segment aligns with the `{{userChoice}}`.

## 3. API Implementation (`src/api/deepseek.ts`)
- **Implement `generateOptions`**:
    - Input: Current story content.
    - Output: Array of 3 strings.
- **Update `generateNovelSegment`**:
    - Accept `userChoice` as a parameter.
    - Include `userChoice` in the prompt construction.

## 4. Workflow Logic (`src/store/useDiscussionStore.ts`)
- **Modify `processNovelCycle`**:
    - **Drafting Phase**:
        - Reduce generation to **single pass** (remove the 3-segment loop for the first round).
        - Retrieve `userChoice` from `choiceHistory` for the current round.
        - Pass `userChoice` to `generateNovelSegment`.
    - **Revising Phase (End)**:
        - Instead of immediately looping to the next round:
            - Call `generateOptions` with the finalized text.
            - Update session with `currentOptions`.
            - Set status to `'selecting_option'`.
- **Add `submitOption(choice: string)` action**:
    - Record the choice in `choiceHistory`.
    - Clear `currentOptions`.
    - Increment `currentRound`.
    - Set status to `'drafting'`.
    - Trigger `processNovelCycle`.

## 5. Frontend Implementation (`src/pages/NovelWorkshopPage.tsx`)
- **Add Interaction UI**:
    - Create an overlay or section that appears when `status === 'selecting_option'`.
    - Display the 3 generated options as buttons.
    - Add a 4th "Custom Input" option.
- **Timer Logic**:
    - Implement a 20-second countdown using `useEffect`.
    - If time expires, randomly select one of the 3 generated options and call `submitOption`.

## 6. Logic Verification
- Ensure the "Narrator" receives the previous choice.
- Ensure the "Expert" checks against the choice.
- Verify the single-generation constraint.
