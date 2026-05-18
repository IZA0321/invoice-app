import html2canvas from "html2canvas-pro";
import jsPDF from "jspdf";

/**
 * #preview-area の内容をA4 PDF（Blob）に変換
 * モバイル端末でも常にA4サイズ（794px幅）でレンダリングすることで
 * 1ページに収まるレイアウトを保証する。
 */
export async function generatePdfBlob(elementId = "preview-area"): Promise<Blob> {
  const el = document.getElementById(elementId);
  if (!el) throw new Error(`要素 #${elementId} が見つかりません`);

  // プレビュー本体（最初の子要素）を取得
  const previewInner = el.firstElementChild as HTMLElement | null;
  if (!previewInner) throw new Error("プレビュー要素が見つかりません");

  // 元のスタイルを記憶
  const originalTransform = previewInner.style.transform;
  const originalWidth = previewInner.style.width;
  const originalMaxWidth = previewInner.style.maxWidth;
  const originalMinHeight = previewInner.style.minHeight;
  const originalElWidth = el.style.width;

  // A4サイズ相当（210mm = 約794px @ 96dpi）に強制
  const A4_WIDTH_PX = 794;
  previewInner.style.transform = "none";
  previewInner.style.width = `${A4_WIDTH_PX}px`;
  previewInner.style.maxWidth = `${A4_WIDTH_PX}px`;
  previewInner.style.minHeight = "auto";
  el.style.width = `${A4_WIDTH_PX}px`;

  // レンダリング反映を待つ
  await new Promise((r) => requestAnimationFrame(r));
  await new Promise((r) => setTimeout(r, 50));

  try {
    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      width: A4_WIDTH_PX,
      windowWidth: A4_WIDTH_PX,
    });

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgRatio = canvas.height / canvas.width;
    const imgWFull = pageW;
    const imgHFull = pageW * imgRatio;

    if (imgHFull <= pageH) {
      // 高さがA4以内 → 通常配置
      pdf.addImage(imgData, "PNG", 0, 0, imgWFull, imgHFull);
    } else {
      // 高さがA4超 → 1ページに収まるよう全体縮小
      const scaledH = pageH;
      const scaledW = pageH / imgRatio;
      const offsetX = (pageW - scaledW) / 2;
      pdf.addImage(imgData, "PNG", offsetX, 0, scaledW, scaledH);
    }

    return pdf.output("blob");
  } finally {
    // 元のスタイルを復元
    previewInner.style.transform = originalTransform;
    previewInner.style.width = originalWidth;
    previewInner.style.maxWidth = originalMaxWidth;
    previewInner.style.minHeight = originalMinHeight;
    el.style.width = originalElWidth;
  }
}
