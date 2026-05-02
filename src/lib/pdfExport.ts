import html2canvas from "html2canvas";
import jsPDF from "jspdf";

/**
 * #preview-area の内容をA4 PDF（Blob）に変換
 */
export async function generatePdfBlob(elementId = "preview-area"): Promise<Blob> {
  const el = document.getElementById(elementId);
  if (!el) throw new Error(`要素 #${elementId} が見つかりません`);

  // 一時的に変換scaleを解除してフルサイズで描画
  const previewInner = el.firstElementChild as HTMLElement | null;
  const originalTransform = previewInner?.style.transform ?? "";
  if (previewInner) previewInner.style.transform = "none";

  try {
    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
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
    const imgW = pageW;
    const imgH = pageW * imgRatio;

    if (imgH <= pageH) {
      pdf.addImage(imgData, "PNG", 0, 0, imgW, imgH);
    } else {
      // 複数ページ
      let y = 0;
      while (y < imgH) {
        pdf.addImage(imgData, "PNG", 0, -y, imgW, imgH);
        y += pageH;
        if (y < imgH) pdf.addPage();
      }
    }

    return pdf.output("blob");
  } finally {
    if (previewInner) previewInner.style.transform = originalTransform;
  }
}
