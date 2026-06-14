// ── Volcengine Ark (豆包) Vision API ─────────────────
//
// Docs: https://www.volcengine.com/docs/82379/1362931
//
// Uses the Responses API (/v3/responses), NOT Chat Completions.
// Auth: standard Bearer token (unlike MiMo's custom api-key).

const BASE_URL =
  process.env.ARK_BASE_URL || "https://ark.cn-beijing.volces.com/api/v3";
const API_KEY = process.env.ARK_API_KEY || "";
const MODEL = "doubao-seed-2-0-mini-260428";

// ── Types ────────────────────────────────────────────

export interface AiSuggestion {
  suggestedTitle: string | null;
  suggestedCategory: string | null;
}

// ── Prompt ───────────────────────────────────────────

const USER_PROMPT =
  '<Role>\n' +
  "你是一个专业的摄影图库后台图像识别与自动打标专家。\n" +
  '</Role>\n' +
  '<Task>\n' +
  '请精准识别输入的图片内容，判断其是否包含知名名胜古迹或著名地标建筑。在此基础上，为图片进行【大类分类】，并生成一个【兼具画面写实与艺术氛围、不超过8字】的名字。\n' +
  '</Task>\n' +
  '<Rules>\n' +
  '1. 【大类分类标准】：必须且只能从以下大类中选择一个：[城市景观, 动物世界, 自然风光, 街头纪实, 微距生态, 星空静谧, 人物肖像, 静物美学]。\n' +
  '2. 【命名核心逻辑】：名字 = [画面的核心视觉主体/地标] + [当下的光线/时间/氛围修辞]，必须让人一眼能看出拍的是什么，严禁使用过于抽象、空洞的词汇。\n' +
  '3. 【地标特例规则（最高优先级）】：\n' +
  '   - 如果识别到图片中含有**知名名胜古迹或地标建筑**，必须直接以"[氛围/光线] 下的 [地标名称]"的形式命名。\n' +
  '   - 示例 1：拍的是夜晚的广州塔 → 名字: "月夜下的广州塔"\n' +
  '   - 示例 2：拍的是夕阳时的都柏林古堡 → 名字: "夕阳下的都柏林古堡"\n' +
  '   - 示例 3：拍的是晨雾中的故宫 → 名字: "晨雾中的故宫"\n' +
  '4. 【普通场景命名示例（不超过8字）】：\n' +
  '   - 城市夜景（无特定地标） → 名字: "深夜的霓虹街区"\n' +
  '   - 一只猫的特写 → 名字: "午后打盹的橘猫"\n' +
  '   - 荒漠树木 → 名字: "荒漠中的独狼树"\n' +
  '   - 星空/星轨 → 名字: "静谧的璀璨星河"\n' +
  '</Rules>\n' +
  '<OutputFormat>\n' +
  '请严格按照以下 JSON 格式输出，不要包含任何前导词、解释或 Markdown 标记。\n' +
  '{"title":"生成的照片名字","category":"对应的大类"}\n' +
  '</OutputFormat>';

// ── JSON extraction ─────────────────────────────────

function extractJson(raw: string): Record<string, unknown> | null {
  let cleaned = raw.trim();

  // Strip markdown fences
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, "");
    cleaned = cleaned.replace(/\n?```\s*$/, "");
    cleaned = cleaned.trim();
  }

  // Find first { ... } pair
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first !== -1 && last > first) {
    cleaned = cleaned.slice(first, last + 1);
  } else {
    return null;
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

// ── Regex fallback ──────────────────────────────────

function extractByRegex(raw: string): AiSuggestion {
  let title: string | null = null;
  let category: string | null = null;

  const titleMatch = raw.match(
    /(?:标题|名称|作品名)[:：]\s*(.+?)(?:\n|$|，|。|·|,)/i,
  );
  if (titleMatch) title = titleMatch[1].trim().slice(0, 20);

  const catMatch = raw.match(
    /(?:分类|类别|类型|标签)[:：]\s*(.+?)(?:\n|$|，|。|·|,)/i,
  );
  if (catMatch) category = catMatch[1].trim();

  return { suggestedTitle: title, suggestedCategory: category };
}

// ── Suggest ──────────────────────────────────────────

/**
 * Call Volcengine Ark (Doubao) vision model via Responses API.
 *
 * Uses raw fetch because the Responses API format differs from
 * the Chat Completions format that the OpenAI SDK assumes.
 *
 * Timeout: 10s. On ANY failure returns nulls silently.
 */
export async function suggestMetadata(
  base64Image: string,
  mimeType = "image/webp",
): Promise<AiSuggestion> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(`${BASE_URL}/responses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_image",
                image_url: `data:${mimeType};base64,${base64Image}`,
              },
              {
                type: "input_text",
                text: USER_PROMPT,
              },
            ],
          },
        ],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.warn(`Doubao HTTP ${res.status}:`, errBody.slice(0, 300));
      return { suggestedTitle: null, suggestedCategory: null };
    }

    const data = await res.json();

    // CoT models (e.g. doubao-seed-2-0-lite) put reasoning as output[0]
    // and the actual message as output[1] (or later).
    // Find the first "message" type item, NOT just output[0].
    const outputTypes = data.output?.map((o: unknown) => (o as { type?: string }).type) ?? [];
    console.log("Doubao output types:", outputTypes);

    const messageItem = data.output?.find(
      (o: unknown) => (o as { type?: string }).type === "message",
    ) as { content?: Array<{ type?: string; text?: string }> } | undefined;

    const content = messageItem?.content?.find(
      (c) => c.type === "output_text",
    )?.text;

    if (!content) {
      console.warn(
        "Doubao: no output_text in message. Full output:",
        JSON.stringify(data.output).slice(0, 400),
      );
      return { suggestedTitle: null, suggestedCategory: null };
    }

    console.log("━━━ Doubao raw ━━━");
    console.log(content.slice(0, 500));
    console.log("━━━━━━━━━━━━━━━━━━━");

    // 1) JSON
    const parsed = extractJson(content);
    if (parsed) {
      console.log("Doubao JSON parsed OK");
      const title =
        typeof parsed.title === "string" && parsed.title.trim().length > 0
          ? parsed.title.trim().slice(0, 20)
          : null;
      const category =
        typeof parsed.category === "string" &&
        parsed.category.trim().length > 0
          ? parsed.category.trim()
          : null;
      return { suggestedTitle: title, suggestedCategory: category };
    }

    // 2) Regex fallback
    console.log("Doubao JSON parse failed, trying regex...");
    const regexResult = extractByRegex(content);
    if (regexResult.suggestedTitle || regexResult.suggestedCategory) {
      console.log("Doubao regex extracted:", regexResult);
      return regexResult;
    }

    console.warn("Doubao could not extract title/category");
    return { suggestedTitle: null, suggestedCategory: null };
  } catch (error) {
    clearTimeout(timeout);

    if (error instanceof Error) {
      if (error.name === "AbortError") {
        console.warn("Doubao timed out (10s)");
      } else {
        console.warn("Doubao failed:", error.message);
      }
    } else {
      console.warn("Doubao failed:", error);
    }

    return { suggestedTitle: null, suggestedCategory: null };
  }
}
