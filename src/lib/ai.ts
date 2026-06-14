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
  "你是一个精通视觉艺术、当代摄影与图像美学的后台分类接口。\n" +
  '</Role>\n' +
  '<Task>\n' +
  '请仔细分析输入的图片，为图片分配一个最契合的艺术大类，并为其起一个富有高级感、艺术感、诗意且不超过8个字（含标点/空格）的中文名字。\n' +
  '</Task>\n' +
  '<Rules>\n' +
  '1. 【大类分类范围】：必须且只能从以下大类中选择一个：[城市景观, 动物世界, 自然风光, 街头纪实, 微距生态, 星空静谧, 人物肖像, 静物美学]。\n' +
  '2. 【起名风格】：杜绝低俗、直白或大白话（如"好看的猫咪"、"深夜的城市"）。应具有电影质感、叙事感或意境感。\n' +
  '3. 【字数限制】：名字必须 ≤ 8 个汉字，越精炼越好。\n' +
  '4. 【几组风格示例（Few-Shot）】：\n' +
  '   - 城市夜景 → 名字: "霓虹囚徒" 或 "流动的昼夜"\n' +
  '   - 一只猫的特写 → 名字: "琥珀里的凝视"\n' +
  '   - 荒漠树木 → 名字: "寂静长白"\n' +
  '   - 星空/星轨 → 名字: "星河逆旅"\n' +
  '</Rules>\n' +
  '<OutputFormat>\n' +
  '为了方便后台解析，请严格按照以下 JSON 格式输出，不要包含任何前导词、解释或 Markdown 标记（如 ```json）。\n' +
  '{"title":"高级感名字","category":"对应的大类"}\n' +
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
