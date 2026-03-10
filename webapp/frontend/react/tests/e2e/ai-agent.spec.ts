import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const initialTitle = "年収550万円以上で即内定！技術×ビジネス思考を磨く27・28卒向けハッカソン受付開始";
const initialContent = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "プレスリリース配信サービス「PR TIMES」等を運営する株式会社PR TIMES（東京都港区、代表取締役：山口拓己、東証プライム、名証プレミア：3922）は、2026年3月9日（月）、10日（火）、11日（水）の3日間、2027・28年卒業予定のエンジニア志望学生(*1)を対象とした「PR TIMES HACKATHON 2026 Spring」をPR TIMES本社（赤坂インターシティ）で開催します。",
        },
      ],
    },
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "一次募集締切は2026年2月1日（日） 23:59まで、下記フォームより本日からエントリー受付を開始いたします。",
        },
      ],
    },
  ],
} as const;

async function resetPressRelease(request: APIRequestContext) {
  const current = await request.get("http://127.0.0.1:8080/press-releases/1");
  expect(current.ok()).toBeTruthy();
  const currentBody = await current.json();

  const response = await request.post("http://127.0.0.1:8080/press-releases/1", {
    data: {
      title: initialTitle,
      content: initialContent,
      version: currentBody.version,
    },
  });

  expect(response.ok()).toBeTruthy();
}

async function openAiPanel(page: Page) {
  await page.goto("/");
  await expect(page.getByPlaceholder("タイトルを入力してください")).toHaveValue(initialTitle);
  await page.getByRole("button", { name: "AI" }).click();
  await expect(page.getByRole("heading", { name: "AIアシスタント" })).toBeVisible();
}

async function createAiSuggestion(page: Page, prompt: string) {
  await page.getByPlaceholder("AIに質問してみましょう").fill(prompt);
  await page.getByRole("button", { name: "送信" }).click();
  await expect(page.locator(".aiMessage-assistant").last()).toContainText("提案を文書内に追加しました。");
  await expect(page.locator(".aiSuggestionWidget")).toHaveCount(1);
}

test.beforeEach(async ({ request }) => {
  await resetPressRelease(request);
});

test("AI edits are embedded into the document", async ({ page }) => {
  await openAiPanel(page);

  const prompt = "2つ目の段落の末尾に「AI_E2E_APPEND_TOKEN」を追加してください。";
  await createAiSuggestion(page, prompt);
  await expect(page.getByRole("button", { name: "まとめて反映" })).toBeVisible();
  await expect(page.getByRole("button", { name: "まとめて見送る" })).toBeVisible();
  await expect(page.locator(".aiSuggestionDiffCard")).toHaveCount(1);
  await expect(page.getByText("After")).toBeVisible();
  await expect(page.locator(".aiSuggestionDiffToken-added")).toContainText("AI_E2E_APPEND_TOKEN");
});

test("AI proposals can be applied to the editor", async ({ page }) => {
  await openAiPanel(page);

  const prompt = "2つ目の段落の末尾に「AI_E2E_APPLY_TOKEN」を追加してください。";
  await createAiSuggestion(page, prompt);
  await expect(page.getByRole("button", { name: "まとめて反映" })).toBeVisible();
  await page.getByRole("button", { name: "まとめて反映" }).click();

  await expect(page.locator(".ProseMirror")).toContainText("AI_E2E_APPLY_TOKEN");
});

test("AI proposals can be discarded from the document", async ({ page }) => {
  await openAiPanel(page);

  const prompt = "2つ目の段落の末尾に「AI_E2E_DISCARD_TOKEN」を追加してください。";
  await createAiSuggestion(page, prompt);
  await expect(page.getByRole("button", { name: "まとめて見送る" })).toBeVisible();
  await page.getByRole("button", { name: "まとめて見送る" }).click();

  await expect(page.locator(".aiSuggestionWidget")).toHaveCount(0);
  await expect(page.locator(".ProseMirror")).not.toContainText("AI_E2E_DISCARD_TOKEN");
});

test("AI suggestions persist after reload", async ({ page }) => {
  await openAiPanel(page);

  const prompt = "2つ目の段落の末尾に「AI_E2E_RELOAD_TOKEN」を追加してください。";
  await createAiSuggestion(page, prompt);

  await page.reload();
  await expect(page.getByRole("heading", { name: "AIアシスタント" })).toBeVisible();
  await expect(page.locator(".aiSuggestionWidget")).toHaveCount(1);
  await expect(page.locator(".aiSuggestionTrigger")).toBeVisible();
  await page.locator(".aiSuggestionTrigger").click();
  await expect(page.locator(".aiSuggestionPrompt").first()).toContainText("AI_E2E_RELOAD_TOKEN");
});

test("AI conversation history remains in the thread for follow-up prompts", async ({ page }) => {
  await openAiPanel(page);

  await createAiSuggestion(page, "2つ目の段落の末尾に「AI_E2E_THREAD_FIRST」を追加してください。");
  await expect(page.locator(".aiMessage-user .aiMessageBody").last()).toHaveText(
    "2つ目の段落の末尾に「AI_E2E_THREAD_FIRST」を追加してください。",
  );

  await page.getByPlaceholder("AIに質問してみましょう").fill("さっきの提案を踏まえて、同じ段落の先頭に「AI_E2E_THREAD_SECOND」も追加してください。");
  await page.getByRole("button", { name: "送信" }).click();

  await expect(page.locator(".aiSuggestionWidget")).toHaveCount(2);
  await expect(page.locator(".aiMessage-user .aiMessageBody").last()).toHaveText(
    "さっきの提案を踏まえて、同じ段落の先頭に「AI_E2E_THREAD_SECOND」も追加してください。",
  );
});
