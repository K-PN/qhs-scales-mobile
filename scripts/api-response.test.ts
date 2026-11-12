import { test } from "node:test";
import assert from "node:assert/strict";
import { ApiError, readApiResponse } from "../mobile/lib/api-response.js";

test("reads grouped reports and preserves JSON API errors", async () => {
  const result = { items: [], total: 0, page: 1, limit: 10 };
  assert.deepEqual(await readApiResponse(Response.json(result)), result);
  assert.deepEqual(
    await readApiResponse(
      Response.json({ message: "Phiên đã hết hạn." }, { status: 401 }),
    ),
    { message: "Phiên đã hết hạn." },
  );
});

test("old backend HTML 404 reports missing endpoint without leaking parser errors", async () => {
  await assert.rejects(
    readApiResponse(
      new Response("<!DOCTYPE html><html>Cannot GET /reports/groups</html>", {
        status: 404,
      }),
    ),
    (error: unknown) =>
      error instanceof ApiError &&
      error.status === 404 &&
      error.message.includes("khởi động lại backend") &&
      !error.message.includes("Unexpected token"),
  );
});

test("a web page at the API URL is not treated as successful statistics", async () => {
  await assert.rejects(
    readApiResponse(new Response("<!DOCTYPE html><html>App</html>")),
    /trả về trang web/,
  );
});

test("proxy failures and plaintext rate limits are readable", async () => {
  await assert.rejects(
    readApiResponse(new Response("<html>Bad gateway</html>", { status: 502 })),
    /Máy chủ đang gặp sự cố/,
  );
  await assert.rejects(
    readApiResponse(new Response("Too many requests", { status: 429 })),
    /Quá nhiều yêu cầu/,
  );
});

test("malformed and non-object JSON cannot become successful report data", async () => {
  for (const body of ["", '{"items":', "null", "[]", '"ok"']) {
    await assert.rejects(
      readApiResponse(new Response(body)),
      /dữ liệu không hợp lệ/,
    );
  }
});
