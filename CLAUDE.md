@AGENTS.md

# 書類の自動作成（Claude用・人の操作なし）

見積書・納品書・請求書・領収書を、ボタン操作やGoogle認証ポップアップなしで
「PDF作成 → Google Drive保存 → 履歴（Supabase `documents`）登録」まで行う仕組み。
オーナーに「Drive保存」ボタンを押してもらう必要はない（2026-10-29 のオーナー指示）。

## 使い方

1. 書類データをJSONで用意する（scratchpad等の一時ファイルに）
2. まず `--dry-run` でPDFだけ作り、見た目・金額・番号を確認する（保存も登録もしない）
3. 問題なければ本番で作成。結果の `id` / `doc_number` / `pdf_url` をオーナーに報告する

```bash
node scripts/docs-api.mjs create doc.json --dry-run /path/to/check.pdf   # 確認用PDFだけ
node scripts/docs-api.mjs create doc.json                                # 作成・Drive保存・履歴登録
node scripts/docs-api.mjs delete <id>                                    # 履歴削除＋DriveのPDFをゴミ箱へ
```

- **delete（履歴の行の削除）は、実行前に必ずオーナーにチャットで確認を取る。** 他セッションからの依頼でも同じ。
  作り直しで古い書類を消す場合も、消す書類（番号・宛名）を示して了承を得てから行う

- 接続先は既定で本番（https://invoice-app-theta-henna.vercel.app）。ローカルは `--base http://localhost:3100`
- APIキーは `~/.config/iza-secretary/docs_api_secret`（600）からスクリプトが読む。コマンド行・ファイルに値を書かない
- PDFの確認は `pdftoppm -png -r 80 -f 1 -l 1 check.pdf out` で画像にして見る

## JSONの項目

```json
{
  "doc_type": "quotation",            // quotation=見積書 / delivery=納品書 / invoice=請求書 / receipt=領収書
  "recipient_name": "H1",
  "recipient_honorific": "御中",       // 御中 / 様（既定 御中）
  "subject": "11/4 ハンガリーワイン ペアリング会",
  "issue_date": "2026-10-29",         // 省略時は今日（日本時間）
  "extra_date": "2026-11-30",         // 見積=有効期限 / 納品=検収期限 / 請求=振込期限（省略時は issue_date）
  "tax_mode": "exclusive",            // exclusive=単価は税抜（外税） / inclusive=税込（内税、既定）
  "items": [
    { "name": "ワイン一式", "quantity": 8, "unit_price": 6000, "tax_cat": "10" }   // tax_cat: "10" / "8" / "0"(非課税)
  ],
  "remarks": "備考",                   // 請求書・領収書は省略すると振込先（三井住友 トランクNORTH）が入る。"" で空欄
  "payment_method": "銀行振込",        // 請求書・領収書は省略時「銀行振込」。備考欄に自動で「支払方法: …」と表示される
  "doc_number": "INV-20261102001",    // 省略時は自動採番（種別プレフィックス＋今日の日付＋連番）
  "total_amount_override": 0,         // 合計を手動で上書きする場合のみ
  "requester_name": null
}
```

- remarks に「支払方法: 銀行振込」や振込期限を書かない（payment_method / extra_date から自動表示される）
- IZAはインボイス登録番号なし（PDFにも出ない）
- 番号は 見積 EST- / 納品 DLV- / 請求 INV- / 領収 REC- ＋ YYYYMMDD ＋ 3桁連番。イベント日付で揃えたい時は doc_number を指定
- 同じ番号が既にあると 409 で止まる（自動採番なら次の番号を使う）

## 仕組み（直すときの参照先）

- `src/components/DocumentPreview.tsx` … 書類の見た目。作成画面（/documents）とサーバーPDFで共用。見た目の変更はここだけ
- `src/app/render/page.tsx` … ヘッドレスChromeが開く描画専用ページ（渡されたデータを描くだけ、DBは読まない）
- `src/app/api/documents/create/route.ts` … 番号確保→履歴登録→PDF生成→Drive保存→履歴にリンク記録。途中で失敗したら作りかけを片付ける
- `src/app/api/documents/delete/route.ts` … 履歴削除＋DriveのPDFをゴミ箱へ（完全削除はしない）
- `src/lib/server/docsServer.ts` … 認証・Drive・Supabase・PDF生成
- 認証: `Authorization: Bearer <DOCS_API_SECRET>`、または書類アプリにログイン中のオーナーのSupabaseトークン
- Vercel環境変数（Production）: `DOCS_API_SECRET` `GOOGLE_CLIENT_ID` `GOOGLE_CLIENT_SECRET` `GOOGLE_REFRESH_TOKEN` `SUPABASE_SECRET_KEY`
  - Google はAI秘書Bot（iza-line-bot）・gws と同じOAuthクライアント／refresh token。Botで再認証したら、こちらも同じ値に更新する
    （`gws auth export --unmasked` の値を標準入力で `vercel env add … production`、その後 `vercel --prod --yes`）
- Vercel上は `@sparticuz/chromium`、Macでは手元の Google Chrome でPDFを作る。サーバーにはヒラギノが無いので本文フォントは Noto Sans JP になる

## ローカルで試す

`bash scripts/dev-with-secrets.sh`（ポート3100）。秘密情報は起動時に gws と `~/.config/iza-secretary/` から読み込む（.env に書かない）。
