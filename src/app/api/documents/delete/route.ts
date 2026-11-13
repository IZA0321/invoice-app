/**
 * POST /api/documents/delete  { id }
 * 履歴（documents）の行を削除し、DriveのPDFはゴミ箱へ移す（30日間は復元できる）。
 * 認証は /api/documents/create と同じ。
 */
import { NextRequest, NextResponse } from "next/server";
import { HttpError, authorize, deleteDocumentRow, getDocument, trashDriveFile } from "@/lib/server/docsServer";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    await authorize(req.headers.get("authorization"));
    const body = (await req.json().catch(() => ({}))) as { id?: string };
    if (!body.id) throw new HttpError(400, "id が必要です");
    const doc = await getDocument(body.id);
    if (!doc) throw new HttpError(404, "書類が見つかりません");
    const driveTrashed = doc.drive_file_id ? await trashDriveFile(doc.drive_file_id) : false;
    await deleteDocumentRow(doc.id);
    return NextResponse.json({ ok: true, id: doc.id, doc_number: doc.doc_number, drive_file_id: doc.drive_file_id, drive_trashed: driveTrashed });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status });
  }
}
