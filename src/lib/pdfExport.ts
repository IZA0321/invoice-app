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

  const previewInner = el.firstElementChild as HTMLElement | null;

  // 元のスタイルを記憶
  const original = {
    elTransform: el.style.transform,
    elWidth: el.style.width,
    elMaxWidth: el.style.maxWidth,
    elMinWidth: el.style.minWidth,
    elMarginBottom: el.style.marginBottom,
    elOverflow: el.style.overflow,
    innerTransform: previewInner?.style.transform ?? "",
    innerWidth: previewInner?.style.width ?? "",
    innerMaxWidth: previewInner?.style.maxWidth ?? "",
  };

  // A4幅相当（210mm = 794px @ 96dpi）に強制
  const A4_WIDTH_PX = 794;
  el.style.transform = "none";
  el.style.width = `${A4_WIDTH_PX}px`;
  el.style.maxWidth = `${A4_WIDTH_PX}px`;
  el.style.minWidth = `${A4_WIDTH_PX}px`;
  el.style.marginBottom = "0";
  el.style.overflow = "visible";
  if (previewInner) {
    previewInner.style.transform = "none";
    previewInner.style.width = `${A4_WIDTH_PX}px`;
    previewInner.style.maxWidth = `${A4_WIDTH_PX}px`;
  }

  // レンダリング反映を待つ
  await new Promise((r) => requestAnimationFrame(r));
  await new Promise((r) => setTimeout(r, 100));

  try {
    const fullHeight = el.scrollHeight;
    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      width: A4_WIDTH_PX,
      height: fullHeight,
      windowWidth: A4_WIDTH_PX,
      windowHeight: fullHeight,
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
      pdf.addImage(imgData, "PNG", 0, 0, imgWFull, imgHFull);
    } else {
      // 全体縮小して1ページに収める
      const scaledH = pageH;
      const scaledW = pageH / imgRatio;
      const offsetX = (pageW - scaledW) / 2;
      pdf.addImage(imgData, "PNG", offsetX, 0, scaledW, scaledH);
    }

    return pdf.output("blob");
  } finally {
    // 元のスタイルを復元
    el.style.transform = original.elTransform;
    el.style.width = original.elWidth;
    el.style.maxWidth = original.elMaxWidth;
    el.style.minWidth = original.elMinWidth;
    el.style.marginBottom = original.elMarginBottom;
    el.style.overflow = original.elOverflow;
    if (previewInner) {
      previewInner.style.transform = original.innerTransform;
      previewInner.style.width = original.innerWidth;
      previewInner.style.maxWidth = original.innerMaxWidth;
    }
  }
}
