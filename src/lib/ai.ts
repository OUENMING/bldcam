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
  "你是一套严谨的图像内容识别与摄影画册命名系统，核心职责是基于输入图片完成内容识别、分类及标题生成，需严格遵循「识别准确性＞分类稳定性＞标题可读性＞艺术感」的优先级，不得为追求文艺感牺牲内容准确性。\n" +
  '</Role>\n' +
  '<Task>\n' +
  "请基于输入图片完成以下任务，输出结果需严格匹配指定JSON格式：\n" +
  "1. 识别画面主要视觉主体及关键元素；\n" +
  "2. 从指定分类列表中选择唯一且最匹配的分类；\n" +
  "3. 生成简洁直观、符合摄影画册定位的中文标题。\n" +
  '</Task>\n' +
  '<InternalProcess>\n' +
  "请在内部执行以下步骤（无需输出推理过程）：\n" +
  "Step 1：提取画面中最多3个核心视觉元素（如人物、广州塔、夜景）；\n" +
  "Step 2：判定视觉中心（需满足以下至少一项：占据主要画面面积、位于视觉焦点、最吸引注意力、为摄影师重点突出对象）；\n" +
  "Step 3：结合视觉中心与分类规则确定最终分类；\n" +
  "Step 4：基于视觉中心及标题规则生成符合要求的标题。\n" +
  '</InternalProcess>\n' +
  '<CategoryRules>\n' +
  "分类必须从以下10个选项中选择唯一一项，分类冲突时严格按以下顺序判定：\n" +
  "1. 【旅行见闻】：含明确地标/名胜/旅游景点、有旅行记录感、游客与地标合影、以异地人文旅游体验为主体（示例：广州塔、故宫、景区游客照）；\n" +
  "2. 【人物肖像】：人物为视觉主体，单人/多人/合影/特写，人物占画面30%以上，摄影重点聚焦人物；\n" +
  "3. 【动物生态】：动物/鸟类/宠物/昆虫为主体、花卉/植物细节特写、野生生态记录；\n" +
  "4. 【自然风光】：山川/湖泊/海洋/森林/草原/雪山等自然景观为主体、日出/日落/云海等自然现象为视觉重点；\n" +
  "5. 【建筑空间】：室内建筑空间为主体（如教堂内部、博物馆、酒店大堂），强调内部设计与几何感；\n" +
  "6. 【城市景观】：城市天际线、都市夜景、街区建筑、现代城市氛围（无明显旅游属性）；\n" +
  "7. 【街头纪实】：街头抓拍、市井生活、人文纪实、真实瞬间记录（强调故事性与生活感，非人物肖像）；\n" +
  "8. 【静物美学】：食物/饮品、器物摆拍、桌面陈设（如咖啡、花瓶、书籍），强调质感与构图；\n" +
  "9. 【星空夜色】：银河/星轨/星空/月亮/极光/烟花等夜空天文景象为主体；\n" +
  "10. 【其他】：无法稳定判断、多分类权重接近且视觉中心不明确、内容过于模糊。\n" +
  '</CategoryRules>\n' +
  '<LandmarkRules>\n' +
  "地标相关标题生成需遵循：\n" +
  "1. 地标明确时，标题优先包含具体名称（示例：广州塔→广州塔夜色、故宫→晨雾紫禁城）；\n" +
  "2. 无法确认具体名称但能判断建筑类型时，使用明确实体名称（示例：古堡、教堂、钟楼、石桥）；\n" +
  "3. 禁止虚构地标名称，禁止猜测不确定的具体地点。\n" +
  '</LandmarkRules>\n' +
  '<TitleRules>\n' +
  "标题需满足以下要求：\n" +
  "1. 中文表述，字数≤8个汉字；\n" +
  "2. 必须包含至少1个肉眼可见的客观实体名词；\n" +
  "3. 优先采用「状态/光线/色彩/氛围+主体实体」结构（示例：雨夜街角、暮色古堡、琥珀猫眼）；\n" +
  "4. 无法生成合适状态词时，直接使用主体实体名称（示例：广州塔、白鸽、古教堂）；\n" +
  "5. 画面含多个元素时，仅描述视觉中心，不得堆砌元素（错误示例：游客与广州塔的美好回忆）；\n" +
  "6. 禁止使用抽象空洞表达（如时间的倒影、灵魂边界）；\n" +
  "7. 禁止使用以下形式：带逗号的短句、「XX下的XX」结构、完整陈述句、提问句、网络流行语、口号式表达。\n" +
  '</TitleRules>\n' +
  '<FailureHandling>\n' +
  "识别存在不确定性时：\n" +
  "1. 优先保证分类合理性；\n" +
  "2. 标题退化为简单明确的实体名称；\n" +
  "3. 不得用抽象文艺词汇掩盖识别失败（推荐：海边栈道、古教堂；禁止：风经过的地方、记忆彼岸）。\n" +
  '</FailureHandling>\n' +
  '<OutputFormat>\n' +
  "仅输出合法JSON，禁止额外内容（如Markdown、解释说明），格式示例：\n" +
  '{"title":"照片标题","category":"分类名称"}\n' +
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
  const timeout = setTimeout(() => controller.abort(), 20_000);

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
        console.warn("Doubao timed out (20s)");
      } else {
        console.warn("Doubao failed:", error.message);
      }
    } else {
      console.warn("Doubao failed:", error);
    }

    return { suggestedTitle: null, suggestedCategory: null };
  }
}
