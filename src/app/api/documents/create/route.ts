/**
 * POST /api/documents/create
 * 書類データを受け取り、画面と同じ見た目のPDFを作って Google Drive に保存し、履歴（documents）に登録する。
 * 人の操作（Google認証ポップアップ等）は不要。
 *
 * 認証: Authorization: Bearer <DOCS_API_SECRET> または 書類アプリにログイン中のオーナーのトークン
 * 入力: CreateDocInput（src/lib/server/docsServer.ts）＋ dry_run?: boolean
 *   dry_run=true のときは保存・登録せず、PDFそのもの（application/pdf）を返す（見た目の確認用）
 * 出力: { ok, id, doc_number, file_name, pdf_url, drive_file_id, total_amount }
 */
import { NextRequest, NextResponse } from "next/server";
import {
  HttpError,
  authorize,
  deleteDocumentRow,
  fileNameFor,
  insertDocument,
  nextDocNumber,
  normalizeInput,
  previewProps,
  renderPdf,
  stripPrefix,
  totalOf,
  trashDriveFile,
  updateDocument,
  uploadPdfToDrive,
  withPrefix,
} from "@/lib/server/docsServer";

export const runtime = "nodejs";
export const maxDuration = 60;

function originOf(req: NextRequest) {
  return process.env.RENDER_ORIGIN || new URL(req.url).origin;
}

export async function POST(req: NextRequest) {
  let insertedId: string | null = null;
  let driveFileId: string | null = null;
  try {
    await authorize(req.headers.get("authorization"));
    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      throw new HttpError(400, "JSONを読めません");
    }
    const dryRun = !!(raw as { dry_run?: boolean })?.dry_run;
    const { input, data, taxMode, lang } = normalizeInput(raw);
    const docType = input.doc_type;
    const totalAmount = totalOf(data, taxMode);
    const fileName = fileNameFor(docType, data, lang);

    if (dryRun) {
      const num = input.doc_number ? withPrefix(docType, input.doc_number) : await nextDocNumber(docType);
      const pdf = await renderPdf(originOf(req), previewProps(docType, { ...data, docNumber: stripPrefix(num) }, taxMode, lang));
      return new NextResponse(Buffer.from(pdf), {
        headers: {
          "Content-Type": "application/pdf",
          "X-Doc-Number": num,
          "X-File-Name": encodeURIComponent(fileName),
        },
      });
    }

    // 1) 番号を確保して履歴に先に登録（PDFに載る番号と履歴の番号を必ず一致させる）
    const record = {
      doc_type: docType,
      recipient_name: data.recipientName,
      recipient_honorific: data.recipientHonorific,
      requester_name: input.requester_name ?? null,
      subject: data.subject || null,
      issue_date: data.issueDate,
      total_amount: totalAmount,
      items: data.items,
      payment_method: data.paymentMethod || null,
      remarks: data.remarks || null,
      due_date: docType === "invoice" && data.extraDate ? data.extraDate : null,
      ...(docType === "invoice" ? { payment_status: "unpaid" } : {}),
    };
    let docNumber = "";
    for (let attempt = 0; attempt < 5 && !insertedId; attempt++) {
      docNumber = input.doc_number ? withPrefix(docType, input.doc_number) : await nextDocNumber(docType);
      const r = await insertDocument({ ...record, doc_number: docNumber });
      if ("id" in r) insertedId = r.id;
      else if (input.doc_number) throw new HttpError(409, `書類番号 ${docNumber} は既に使われています`);
    }
    if (!insertedId) throw new HttpError(409, "空き番号を確保できませんでした");

    // 2) PDF生成 → Drive保存
    const pdf = await renderPdf(originOf(req), previewProps(docType, { ...data, docNumber: stripPrefix(docNumber) }, taxMode, lang));
    const uploaded = await uploadPdfToDrive(pdf, fileName, docType);
    driveFileId = uploaded.id;

    // 3) 履歴にPDFのリンクを記録
    await updateDocument(insertedId, { pdf_url: uploaded.webViewLink, drive_file_id: uploaded.id });

    return NextResponse.json({
      ok: true,
      id: insertedId,
      doc_number: docNumber,
      file_name: fileName,
      pdf_url: uploaded.webViewLink,
      drive_file_id: uploaded.id,
      total_amount: totalAmount,
    });
  } catch (e) {
    // 途中で失敗したら作りかけを片付ける（履歴の行は削除、Driveのファイルはゴミ箱へ）
    if (driveFileId) await trashDriveFile(driveFileId).catch(() => undefined);
    if (insertedId) await deleteDocumentRow(insertedId).catch(() => undefined);
    const status = e instanceof HttpError ? e.status : 500;
    const message = e instanceof Error ? e.message : String(e);
    if (status >= 500) console.error("documents/create failed:", e);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
