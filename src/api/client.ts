const API_BASE_URL = "http://127.0.0.1:8000";

export async function checkBackendHealth() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/health`);
    if (!response.ok) throw new Error("网络请求失败");
    return await response.json();
  } catch (error) {
    console.error("无法连接后端:", error);
    return null;
  }
}