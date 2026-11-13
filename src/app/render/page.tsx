"use client";

/**
 * サーバー側PDF生成用の描画ページ（/api/documents/create がヘッドレスChromeで開く）。
 * window.__IZA_RENDER__ に渡された書類データを、書類作成画面と同じ DocumentPreview で描く。
 * DBは読まず、渡されたものを表示するだけ。描画・画像・フォントの準備ができたら
 * <html data-render-ready="1"> を立てる。
 */
import { useEffect, useState } from "react";
import DocumentPreview, { type DocumentPreviewProps } from "@/components/DocumentPreview";

declare global {
  interface Window {
    __IZA_RENDER__?: DocumentPreviewProps;
  }
}

export default function RenderPage() {
  const [props, setProps] = useState<DocumentPreviewProps | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 外部（ヘッドレスChrome）から渡されたデータを一度だけ読む
    if (window.__IZA_RENDER__) setProps(window.__IZA_RENDER__);
  }, []);

  useEffect(() => {
    if (!props) return;
    let cancelled = false;
    (async () => {
      const imgs = Array.from(document.querySelectorAll("#preview-area img")) as HTMLImageElement[];
      await Promise.all(
        imgs.map((img) =>
          img.complete && img.naturalWidth > 0
            ? Promise.resolve()
            : new Promise<void>((r) => {
                img.addEventListener("load", () => r(), { once: true });
                img.addEventListener("error", () => r(), { once: true });
                setTimeout(r, 5000);
              })
        )
      );
      await document.fonts.ready;
      if (!cancelled) document.documentElement.setAttribute("data-render-ready", "1");
    })();
    return () => {
      cancelled = true;
    };
  }, [props]);

  return (
    <>
      {/* サーバー（Linux）にはヒラギノが無いので Noto Sans JP を代わりに使う。Macではヒラギノが優先される */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;600;700;900&display=block" />
      <style>{`html, body { background: #fff !important; margin: 0; padding: 0; }`}</style>
      {props && (
        <div
          id="preview-area"
          className="bg-white"
          style={{
            width: "794px",
            fontFamily: '-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic", sans-serif',
          }}
        >
          <DocumentPreview {...props} />
        </div>
      )}
    </>
  );
}
