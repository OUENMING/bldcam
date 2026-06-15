// ── Volcengine Ark (豆包) Vision API ─────────────────
//
// Docs: https://www.volcengine.com/docs/82379/1362931
//
// Uses the Responses API (/v3/responses), NOT Chat Completions.
// Auth: standard Bearer token (unlike MiMo's custom api-key).

const BASE_URL =
  process.env.ARK_BASE_URL || "https://ark.cn-beijing.volces.com/api/v3";
const API_KEY = process.env.ARK_API_KEY || "";
const MODEL = "doubao-seed-2-0-lite-260428";

// ── Types ────────────────────────────────────────────

export interface AiSuggestion {
  suggestedTitle: string | null;
  suggestedCategory: string | null;
}

// ── Prompt ───────────────────────────────────────────

const USER_PROMPT =
  '<Role>\n' +
  "你是一个专业的摄影画册出版商，擅长为照片起【直击画面、干净凝练且兼具美感】的艺术标题。\n" +
  '</Role>\n' +
  '<Task>\n' +
  '请精准识别输入的图片内容，判断其是否包含知名名胜古迹（如广州塔、都柏林古堡等），为其分配一个最契合的【大类分类】，并输出一个【拒绝故弄玄虚、一目了然、不超过8字】的中文标题。\n' +
  '</Task>\n' +
  '<Rules>\n' +
  '1. 【大类分类范围】：必须且只能从以下大类中选择一个：[城市景观, 动物世界, 自然风光, 街头纪实, 微距生态, 星空静谧, 人物肖像, 静物美学]。\n' +
  '2. 🚫【标题死律（绝对禁止）】：\n' +
  '   - 严禁故弄玄虚！严禁使用空洞、抽象、让人摸不着头脑的虚词（如："时间的倒影"、"光影的呢喃"、"寂静的维度"、"灵魂的边界"）。\n' +
  '   - 严禁使用带有逗号的短句或啰唆的"XX下的XX"。\n' +
  '3. 💡【核心命名逻辑（事实锚定）】：\n' +
  '   - 标题必须是**干净利落的名词短语**（结构通常为：氛围/状态/细节 + 画面核心实体）。\n' +
  '   - 艺术感来源于对光线、色彩或状态的精准捕捉，但**必须保留画面中肉眼可见的客观实体名词**（如古堡、红墙、猫眼、星河），让人看一眼标题就能立刻对应上画面。\n' +
  '4. 🎯【地标建筑/名胜古迹处理（必须带有地标名）】：\n' +
  '   - 拍的是夜晚的广州塔 → 标题: "广州塔夜色" 或 "霓虹小蛮腰"\n' +
  '   - 拍的是夕阳下的都柏林古堡 → 标题: "暮色古堡" 或 "夕阳都柏林"\n' +
  '   - 拍的是晨雾中的故宫 → 标题: "晨雾紫禁城" 或 "红墙落雪"\n' +
  '5. 🎨【常规场景命名示范（高级且一目了然）】：\n' +
  '   - 城市普通夜景 → 标题: "不夜城霓虹" 或 "午夜街区"\n' +
  '   - 一只猫的特写 → 标题: "窗前猫影" 或 "琥珀猫眼"\n' +
  '   - 荒漠树木 → 标题: "荒漠枯木" 或 "孤悬旷野"\n' +
  '   - 星空/星轨 → 标题: "星盘轨迹" 或 "璀璨星河"\n' +
  '</Rules>\n' +
  '<OutputFormat>\n' +
  '为了方便后台无缝解析，请严格按照以下 JSON 格式输出，不要包含任何前导词或解释。\n' +
  '{"title":"生成的照片标题","category":"对应的大类"}\n' +
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
  const timeout = setTimeout(() => controller.abort(), 16_000);

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
        console.warn("Doubao timed out (16s)");
      } else {
        console.warn("Doubao failed:", error.message);
      }
    } else {
      console.warn("Doubao failed:", error);
    }

    return { suggestedTitle: null, suggestedCategory: null };
  }
}
