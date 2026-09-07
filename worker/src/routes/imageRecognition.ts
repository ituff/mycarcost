import { Hono } from 'hono';
import type { Env } from '../index';
import {
  IMAGE_MAX_SIZE_BYTES,
  IMAGE_ALLOWED_MIME_TYPES,
  IMAGE_RECOGNITION_TIMEOUT_MS,
} from '@mycarcost/shared';

const imageRecognition = new Hono<{ Bindings: Env }>();

// POST /api/image-recognition - upload image and recognize consumption data
imageRecognition.post('/', async (c) => {
  const db = c.env.DB;

  // Check if LLM API is configured
  const apiUrlSetting = await db
    .prepare("SELECT value FROM settings WHERE key = 'llm_api_url'")
    .first<{ value: string }>();
  const apiKeySetting = await db
    .prepare("SELECT value FROM settings WHERE key = 'llm_api_key'")
    .first<{ value: string }>();
  const modelSetting = await db
    .prepare("SELECT value FROM settings WHERE key = 'llm_model'")
    .first<{ value: string }>();

  if (!apiUrlSetting?.value || !apiKeySetting?.value) {
    return c.json({ error: '图片识别API未配置，请在设置中配置LLM API地址和密钥' }, 422);
  }
  if (!modelSetting?.value) {
    return c.json({ error: '图片识别API未配置模型名称，请在设置中填写模型（如 qwen-vl-max）' }, 422);
  }

  // Parse multipart form data
  let formData: FormData;
  try {
    formData = await c.req.formData();
  } catch {
    return c.json({ error: '请求格式错误，请使用multipart/form-data' }, 400);
  }

  const file = formData.get('image') as File | null;
  if (!file) {
    return c.json({ error: '请上传图片' }, 400);
  }

  // Validate MIME type
  if (!IMAGE_ALLOWED_MIME_TYPES.includes(file.type)) {
    return c.json({ error: '仅支持JPEG和PNG格式的图片' }, 400);
  }

  // Validate file size
  if (file.size > IMAGE_MAX_SIZE_BYTES) {
    return c.json({ error: '图片大小不能超过10MB' }, 400);
  }

  // Read file as base64
  const arrayBuffer = await file.arrayBuffer();
  const base64 = btoa(
    new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
  );

  // Upload to R2 temporarily (optional, for audit)
  const r2Key = `recognition/${crypto.randomUUID()}.${file.type === 'image/png' ? 'png' : 'jpg'}`;
  try {
    await c.env.BUCKET?.put(r2Key, arrayBuffer, {
      httpMetadata: { contentType: file.type },
    });
  } catch {
    // R2 upload failure is non-critical, continue with recognition
  }

  // Call LLM API
  const prompt = `请分析这张汽车充电/加油截图，提取以下信息并以JSON格式返回：
- batteryBefore: 充电前剩余电量百分比（整数，0-100）
- batteryAfter: 充电后电量百分比（整数，0-100）
- totalMileage: 当前总里程数（数字，单位km）

如果某个字段无法识别，返回null。
只返回JSON，不要返回其他文本。格式示例：
{"batteryBefore": 20, "batteryAfter": 80, "totalMileage": 12345.6}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), IMAGE_RECOGNITION_TIMEOUT_MS);

    const response = await fetch(apiUrlSetting.value, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKeySetting.value}`,
      },
      body: JSON.stringify({
        model: modelSetting.value,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${file.type};base64,${base64}`,
                },
              },
            ],
          },
        ],
        max_tokens: 200,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return c.json({ error: '图片识别API调用失败', status: response.status }, 502);
    }

    const data: any = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      return c.json({ error: '图片识别API返回数据格式错误' }, 502);
    }

    // Parse the JSON from the content
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('no json');
      }
      const parsed = JSON.parse(jsonMatch[0]);
      return c.json({
        batteryBefore: parsed.batteryBefore ?? null,
        batteryAfter: parsed.batteryAfter ?? null,
        totalMileage: parsed.totalMileage ?? null,
      });
    } catch {
      return c.json({ error: '图片识别结果解析失败，请手动输入' }, 502);
    }
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      return c.json({ error: '图片识别超时，请重试或手动输入' }, 504);
    }
    return c.json({ error: '图片识别服务调用失败' }, 500);
  }
});

export default imageRecognition;
