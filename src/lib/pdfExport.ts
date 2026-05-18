import html2canvas from "html2canvas-pro";
import jsPDF from "jspdf";

const A4_WIDTH_PX = 794;

/**
 * #preview-area を画面外でA4幅にクローンして撮影し、A4 PDFに変換
 * スマホでもビューポート幅に依存しない安定したレンダリング
 */
export async function generatePdfBlob(elementId = "preview-area"): Promise<Blob> {
  const el = document.getElementById(elementId);
  if (!el) throw new Error(`要素 #${elementId} が見つかりません`);

  // クローン作成
  const clone = el.cloneNode(true) as HTMLElement;
  clone.removeAttribute("id");
  clone.style.position = "absolute";
  clone.style.left = "0";
  clone.style.top = "0";
  clone.style.transform = "none";
  clone.style.width = `${A4_WIDTH_PX}px`;
  clone.style.maxWidth = `${A4_WIDTH_PX}px`;
  clone.style.minWidth = `${A4_WIDTH_PX}px`;
  clone.style.height = "auto";
  clone.style.minHeight = "auto";
  clone.style.maxHeight = "none";
  clone.style.margin = "0";
  clone.style.boxShadow = "none";
  clone.style.zIndex = "-9999";
  clone.style.pointerEvents = "none";

  // 画面外コンテナで非表示
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-99999px";
  container.style.top = "0";
  container.style.width = `${A4_WIDTH_PX}px`;
  container.style.height = "auto";
  container.style.overflow = "visible";
  container.style.pointerEvents = "none";
  container.style.background = "white";
  container.appendChild(clone);
  document.body.appendChild(container);

  // 内側要素の変形も解除
  const inner = clone.firstElementChild as HTMLElement | null;
  if (inner) {
    inner.style.transform = "none";
    inner.style.width = `${A4_WIDTH_PX}px`;
    inner.style.maxWidth = `${A4_WIDTH_PX}px`;
    inner.style.minWidth = `${A4_WIDTH_PX}px`;
  }

  // レンダリング反映待ち（フォント・画像読み込み含む）
  await new Promise((r) => requestAnimationFrame(r));
  await new Promise((r) => setTimeout(r, 150));

  try {
    const canvas = await html2canvas(clone, {
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
    const imgHFull = pageW * imgRatio;

    if (imgHFull <= pageH) {
      pdf.addImage(imgData, "PNG", 0, 0, pageW, imgHFull);
    } else {
      // 1ページに収めるため縮小
      const scaledW = pageH / imgRatio;
      const offsetX = (pageW - scaledW) / 2;
      pdf.addImage(imgData, "PNG", offsetX, 0, scaledW, pageH);
    }

    return pdf.output("blob");
  } finally {
    document.body.removeChild(container);
  }
}
