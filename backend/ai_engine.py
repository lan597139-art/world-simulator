import ipaddress
import json
import os
from contextvars import ContextVar
from pathlib import Path
from urllib.parse import urlparse

from dotenv import load_dotenv
from openai import OpenAI

ENV_PATH = Path(__file__).with_name(".env")
DEFAULT_BASE_URL = "https://api.deepseek.com"
DEFAULT_MODEL = "deepseek-chat"
MODEL = DEFAULT_MODEL  # 兼容旧引用；实际调用请用 get_model()

# 访客自带 Key：由中间件按请求写入，服务端不落库、不写日志。
_personal_ai: ContextVar[dict | None] = ContextVar("personal_ai", default=None)


def _server_key_enabled() -> bool:
    return (os.getenv("AI_SERVER_KEY_ENABLED", "true") or "").strip().lower() not in {
        "0", "false", "no", "off"
    }


def _safe_base_url(value: str) -> str:
    """只接受公网 HTTPS，防止访客把后端当 SSRF 跳板。"""
    value = (value or "").strip().rstrip("/")
    if not value:
        return ""
    try:
        parsed = urlparse(value)
    except Exception:
        return ""
    if parsed.scheme != "https" or not parsed.hostname:
        return ""
    host = parsed.hostname.lower()
    if host in {"localhost", "127.0.0.1", "::1"} or host.endswith(".local"):
        return ""
    try:
        address = ipaddress.ip_address(host)
        if address.is_private or address.is_loopback or address.is_link_local:
            return ""
    except ValueError:
        pass
    return value


def _read_config() -> tuple[str, str, str]:
    """每次调用都重读 .env；访客 Key 优先于站长共享 Key。"""
    if ENV_PATH.exists():
        load_dotenv(dotenv_path=ENV_PATH, override=True)
    env_key = (os.getenv("DEEPSEEK_API_KEY") or "").strip()
    env_base = (os.getenv("DEEPSEEK_BASE_URL") or DEFAULT_BASE_URL).strip() or DEFAULT_BASE_URL
    env_model = (os.getenv("DEEPSEEK_MODEL") or DEFAULT_MODEL).strip() or DEFAULT_MODEL

    personal = _personal_ai.get()
    if personal and personal.get("key"):
        return (
            personal["key"],
            _safe_base_url(personal.get("base_url") or "") or env_base,
            (personal.get("model") or env_model).strip() or env_model,
        )
    return (env_key if _server_key_enabled() else ""), env_base, env_model


def set_request_ai_config(key: str = "", base_url: str = "", model: str = ""):
    """中间件调用：返回 ContextVar token，请求结束后必须 reset。"""
    key = (key or "").strip()
    if not key or len(key) > 300:
        return None
    return _personal_ai.set({
        "key": key,
        "base_url": (base_url or "").strip()[:500],
        "model": (model or "").strip()[:120],
    })


def reset_request_ai_config(token) -> None:
    if token is not None:
        _personal_ai.reset(token)


def get_model() -> str:
    return _read_config()[2]


def get_client() -> OpenAI:
    # 不缓存客户端：不同访客可能同时使用不同 Key，缓存会造成串用。
    key, base_url, _model = _read_config()
    if not key:
        raise RuntimeError("未配置 AI API Key")
    return OpenAI(api_key=key, base_url=base_url, timeout=120.0)


def ai_config_status() -> dict:
    key, base_url, model = _read_config()
    personal = _personal_ai.get()
    hint = ""
    if key:
        hint = f"{key[:4]}…{key[-4:]}" if len(key) > 10 else "已配置"
    shared_enabled = _server_key_enabled()
    return {
        "configured": bool(key),
        "using_personal_key": bool(personal and personal.get("key")),
        "shared_key_enabled": shared_enabled,
        "server_key_configured": bool((os.getenv("DEEPSEEK_API_KEY") or "").strip()),
        "key_hint": hint,
        "base_url": base_url,
        "model": model,
        "env_path": str(ENV_PATH),
        "hot_reload": True,
        "message": "" if key else (
            "本站已关闭站长共享 Key，请在「AI 接入」中填写自己的 API Key"
            if not shared_enabled else "未配置 API Key，请检查 backend/.env"
        ),
    }

def ai_error_message(error) -> str:
    text = str(error)
    lowered = text.lower()
    if "402" in text or "insufficient balance" in lowered:
        return "AI 额度不足：当前 API 账户余额已耗尽，请充值或更换自己的 API Key。"
    if "401" in text or "authentication" in lowered or "invalid api key" in lowered:
        return "AI 鉴权失败：API Key 无效或已过期。使用访客 Key 时请在「AI 接入」检查；站长请检查 backend/.env。"
    if "429" in text or "rate limit" in lowered:
        return "AI 请求过于频繁，请稍后再试。"
    if "timeout" in lowered:
        return "AI 响应超时，请检查网络或稍后重试。"
    if "connection" in lowered or "network" in lowered:
        return "AI 网络连接失败，请检查「AI 接入」中的 Base URL 与网络。"
    return f"AI 调用失败：{text[:300]}"

def run_simulation(event_data: dict, characters_data: list):
    if not ai_config_status()["configured"]:
        return {"error": "未配置 API Key：请在「AI 接入」填写自己的 Key，或由站长配置 backend/.env。"}
    # 提取人物核心数据，减少无用的 token 消耗
    chars_info = []
    for c in characters_data:
        engines = c.get('engines', {})
        chars_info.append({
            "name": c.get('name'),
            "engines": engines.get('ovtde', {}),
            "dominance": engines.get('dominance', {}),
            "main_color": (c.get('runtime') or {}).get('main_color'),
            "growth_version": (c.get('runtime') or {}).get('version'),
        })

    prompt = f"""
    你是一个高度严谨的小说世界模拟引擎。请根据当前发生的事件，推演这个世界的变化以及涉及人物的自主行动。
    
    【当前事件】：
    名称：{event_data.get('name')}
    发生时间：{event_data.get('story_time')}
    发生地点：{event_data.get('location')}
    涉及组织：{event_data.get('organization')}
    描述：{event_data.get('description')}
    极性：{event_data.get('polarity')} | 强度：{event_data.get('intensity')}
    
    【涉及人物（包含五引擎设定）】：
    {json.dumps(chars_info, ensure_ascii=False, indent=2)}

    【作者预设推演方向】：
    {event_data.get('author_direction') or '未预设，按人物引擎、关系与事件逻辑自然推演。'}

    【作者预设推演视角】：
    {event_data.get('perspective') or '全局客观视角，重点观察事件涉及的人物与组织。'}
    说明：方向是作者希望世界线与人物行动倾斜的方向，但不得违背人物既有引擎与关系逻辑；视角只影响重点观察谁、从谁的位置理解行动，不改变客观世界变化。
    
    【推演要求（必须严格遵守）】：
    1. 请结合发生地点和组织环境，判断事件对人物的影响。
    2. 判断事件是否导致某些人物之间（特别是参与事件的人物之间）的关系发生本质变化（例如从亲密变敌对，或者从漠视变认同）。
    3. 输出必须是严格的 JSON 格式，不要包含任何 Markdown 标记。
    4. **你必须在 JSON 中提供 `relationship_changes` 数组。如果没有变化，请提供一个空数组 []；如果有变化，请填入具体变化。**
    
    JSON 输出格式如下：
    {{
        "relationship_changes": [
            {{
                "source_name": "起点人物名字",
                "target_name": "终点人物名字",
                "new_quadrant": "变化后的四象限（必须是：亲密/认同/敌对/漠视 之一）",
                "reason": "关系变化的原因简述"
            }}
        ],
        "world_changes": "详细描述世界现实发生了哪些客观变化",
        "actions": [
            {{
                "name": "人物名字",
                "engine": "激活的主导引擎（如 O 秩序）",
                "action": "人物采取的具体行动",
                "status": "行动结果（如成功、失败、引发新冲突）"
            }}
        ]
    }}
    """

    try:
        # ✅ 加入超时机制，防止网络波动导致无限等待卡死
        response = get_client().chat.completions.create(
            model=get_model(),
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.7,
            timeout=90.0 # 最大等待 90 秒
        )
        return json.loads(response.choices[0].message.content)
    except Exception as e:
        print("❌ AI 推演报错:", e)
        return {"error": ai_error_message(e)}