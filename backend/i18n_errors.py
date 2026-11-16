"""I 国际化：把常见 API 业务错误按 Accept-Language 返回英文。

保持状态码与业务语义不变，只替换可安全翻译的 detail；未知中文返回状态级英文兜底，
避免英文界面里突然出现整段中文。请求头缺失时继续返回中文，兼容现有调用方。
"""

from __future__ import annotations

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

EXACT = {
    "请先登录": "Please sign in first",
    "登录已失效，请重新登录": "Session expired. Please sign in again.",
    "用户名或密码不正确": "Incorrect username or password",
    "用户名或邮箱已被注册": "Username or email is already registered",
    "用户名或邮箱已存在": "Username or email already exists",
    "用户名已存在": "Username already exists",
    "邮箱已被使用": "Email is already in use",
    "密码至少 8 个字符": "Password must be at least 8 characters",
    "密码过长": "Password is too long",
    "请输入有效的邮箱地址": "Enter a valid email address",
    "请输入有效的邀请码": "Enter a valid invite code",
    "邀请码无效或已停用": "Invite code is invalid or disabled",
    "邀请码已过期": "Invite code has expired",
    "邀请码使用次数已用完": "Invite code has no uses left",
    "验证码不正确": "Incorrect verification code",
    "验证码已过期，请重新发送": "Verification code expired. Request a new one.",
    "验证码尝试次数过多，请重新发送": "Too many code attempts. Request a new code.",
    "只有好友之间可以私信": "Only friends can message each other",
    "不能给自己发私信": "You cannot message yourself",
    "不能拉黑自己": "You cannot block yourself",
    "不能添加自己为好友": "You cannot add yourself as a friend",
    "不能关注自己": "You cannot follow yourself",
    "你们已经是好友": "You are already friends",
    "已有待处理的好友申请": "There is already a pending friend request",
    "好友申请不存在": "Friend request not found",
    "好友申请已处理": "Friend request has already been handled",
    "动态不存在": "Post not found",
    "评论不存在": "Comment not found",
    "评论不能为空": "Comment cannot be empty",
    "会话不存在": "Conversation not found",
    "消息需要文字或图片": "Message needs text or an image",
    "动态需要文字或图片": "Post needs text or an image",
    "动态文字过长": "Post text is too long",
    "至少选择一个社区": "Choose at least one community",
    "动态只能投放到内容社区或社交社区": "Posts can only target the content or social community",
    "一条动态最多 9 张图片": "A post can include at most 9 images",
    "可见范围非法": "Invalid visibility",
    "范围非法": "Invalid scope",
    "频道非法": "Invalid channel",
    "用户不存在": "User not found",
    "主页仅好友可见": "This profile is visible to friends only",
    "对方未开放好友申请": "This creator is not accepting friend requests",
    "对方未开放关注": "This creator is not accepting follows",
}

PREFIXES = [
    ("你们之间已拉黑", "You have blocked each other, so this action is unavailable"),
    ("无权编辑", "You do not have permission to edit this"),
    ("无权删除", "You do not have permission to delete this"),
    ("无权", "You do not have permission to do that"),
    ("只能", "This value is not allowed"),
    ("必须是", "This value is invalid"),
    ("非法", "Invalid input"),
    ("不存在", "Not found"),
    ("已拉黑", "This user is blocked"),
    ("请填写", "Please fill in the required fields"),
    ("请输入", "Please enter the required value"),
    ("至少", "The value is too short"),
    ("不能", "This action is not allowed"),
]

STATUS_FALLBACK = {
    400: "Bad request",
    401: "Authentication required",
    403: "This action is not allowed",
    404: "Not found",
    405: "Method not allowed",
    409: "This action conflicts with the current state",
    410: "This resource is no longer available",
    422: "Invalid input",
    429: "Too many requests. Please try again later.",
    500: "Server error",
    502: "Upstream service error",
    503: "Service temporarily unavailable",
}


def english_detail(detail, status: int):
    if not isinstance(detail, str):
        return detail
    if detail in EXACT:
        return EXACT[detail]
    for prefix, replacement in PREFIXES:
        if detail.startswith(prefix):
            return replacement
    # 没有映射的中文错误不能直接丢给英文界面；保留可读的状态级说明。
    if any("\u4e00" <= char <= "\u9fff" for char in detail):
        return STATUS_FALLBACK.get(status, "Request failed")
    return detail


async def localized_http_exception_handler(request: Request, exc: StarletteHTTPException):
    language = request.headers.get("accept-language", "").lower()
    detail = exc.detail
    if language.startswith("en"):
        detail = english_detail(detail, exc.status_code)
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": detail},
        headers=getattr(exc, "headers", None),
    )
