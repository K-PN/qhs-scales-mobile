export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

// Proxies and older API servers may return HTML, including a successful SPA page.
// Never expose HTML or a JSON parser exception to the user.
export async function readApiResponse<T>(response: Response): Promise<T> {
  const raw = await response.text();
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    if (response.status === 404) {
      throw new ApiError(
        404,
        "Máy chủ chưa hỗ trợ chức năng này. Vui lòng cập nhật hoặc khởi động lại backend.",
      );
    }
    if (response.status === 429) {
      throw new ApiError(
        429,
        "Quá nhiều yêu cầu. Vui lòng đợi một lát rồi thử lại.",
      );
    }
    if (response.status >= 500) {
      throw new ApiError(
        response.status,
        "Máy chủ đang gặp sự cố. Vui lòng thử lại sau.",
      );
    }
    if (/^\s*</.test(raw)) {
      throw new ApiError(
        response.status,
        "Địa chỉ API đang trả về trang web thay vì dữ liệu. Vui lòng kiểm tra cấu hình máy chủ.",
      );
    }
    throw new ApiError(
      response.status,
      "Máy chủ trả về dữ liệu không hợp lệ. Vui lòng thử lại.",
    );
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new ApiError(
      response.status,
      "Máy chủ trả về dữ liệu không hợp lệ. Vui lòng thử lại.",
    );
  }
  return data as T;
}
