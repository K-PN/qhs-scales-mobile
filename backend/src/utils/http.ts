import { Request, Response, NextFunction, RequestHandler } from "express";
import { ZodError } from "zod";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const route =
  (
    handler: (req: Request, res: Response) => Promise<unknown>,
  ): RequestHandler =>
  (req, res, next) => {
    void handler(req, res).catch(next);
  };
export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (error instanceof ZodError)
    return res.status(400).json({
      message: "Thông tin không hợp lệ. Kiểm tra lại các trường đã nhập.",
    });
  if (error instanceof HttpError)
    return res.status(error.status).json({ message: error.message });
  if ((error as { code?: string })?.code === "ER_DUP_ENTRY")
    return res.status(409).json({ message: "Tên tài khoản đã tồn tại." });
  console.error(
    "API error",
    error instanceof Error ? error.message : "Unknown error",
  );
  return res
    .status(500)
    .json({ message: "Không thể xử lý yêu cầu. Vui lòng thử lại." });
}
