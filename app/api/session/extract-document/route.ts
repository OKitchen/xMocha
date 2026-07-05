import { NextResponse } from "next/server";

import { normalizeLanguage } from "../../../../src/interfaces/web/api-utils";
import { extractDecisionDocument } from "../../../../src/interfaces/web/document-extraction";
import {
  publicRateLimits,
  rateLimitResponse,
} from "../../../../src/interfaces/web/rate-limit-response";

export const runtime = "nodejs";

const maxUploadBytes = 5 * 1024 * 1024;

export async function POST(request: Request) {
  let responseLanguage: "en" | "zh-CN" = "en";

  try {
    const limited = await rateLimitResponse(
      request,
      publicRateLimits.documentExtract,
    );
    if (limited) return limited;

    const formData = await request.formData();
    responseLanguage = normalizeLanguage(formData.get("language"));
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return errorResponse(responseLanguage, "No file was uploaded.", "没有收到上传文件。", 400);
    }

    if (file.size <= 0) {
      return errorResponse(responseLanguage, "The uploaded file is empty.", "上传文件为空。", 400);
    }

    if (file.size > maxUploadBytes) {
      return errorResponse(
        responseLanguage,
        "The file is larger than 5MB. Please upload a smaller excerpt.",
        "文件超过 5MB。请上传较小摘录。",
        413,
      );
    }

    const extracted = await extractDecisionDocument(file);
    if (!extracted.content.trim()) {
      return errorResponse(
        responseLanguage,
        "No readable text was found in this file.",
        "没有从文件中读取到可用文字。",
        422,
      );
    }

    return NextResponse.json(extracted);
  } catch (error) {
    console.error("document_extract_failed", error);
    return errorResponse(
      responseLanguage,
      "Failed to read the file. Please try a text-based PDF or text file.",
      "读取文件失败。请尝试上传可复制文字的 PDF 或文本文件。",
      500,
    );
  }
}

function errorResponse(
  language: "en" | "zh-CN",
  en: string,
  zh: string,
  status: number,
) {
  return NextResponse.json(
    { error: language === "en" ? en : zh },
    { status },
  );
}
