import React from "react";
import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer, Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer";
import { ReceiptData } from "@/types/receipt";
import { calcReceipt, formatCurrency } from "@/lib/receiptUtils";

Font.register({
  family: "NotoSansJP",
  fonts: [
    { src: "https://fonts.gstatic.com/s/notosansjp/v53/-F6jfjtqLzI2JPCgQBnw7HFyzSD-AsregP8VFBEj757J.ttf" },
    { src: "https://fonts.gstatic.com/s/notosansjp/v53/-F6ofjtqLzI2JPCgQBnw7HFyzSD-AsregP8VFJxE4g.ttf", fontWeight: "bold" },
  ],
});

const styles = StyleSheet.create({
  page: {
    fontFamily: "NotoSansJP",
    fontSize: 10,
    paddingTop: 40,
    paddingBottom: 40,
    paddingLeft: 50,
    paddingRight: 50,
    color: "#333",
  },
  headerRight: {
    alignItems: "flex-end",
    marginBottom: 4,
  },
  headerNo: {
    fontSize: 10,
    color: "#555",
  },
  headerDate: {
    fontSize: 10,
    color: "#555",
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "center",
    letterSpacing: 8,
    marginBottom: 20,
    marginTop: 4,
  },
  recipientRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 4,
  },
  recipientName: {
    fontSize: 13,
    fontWeight: "bold",
  },
  recipientHonorific: {
    fontSize: 11,
    marginLeft: 6,
    marginBottom: 1,
  },
  recipientUnderline: {
    borderBottomWidth: 1,
    borderBottomColor: "#aaa",
    paddingBottom: 4,
    marginBottom: 16,
    width: "70%",
  },
  amountBox: {
    borderWidth: 1,
    borderColor: "#bbb",
    padding: 10,
    marginBottom: 14,
    width: "80%",
  },
  amountText: {
    fontSize: 18,
    fontWeight: "bold",
  },
  descriptionRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 4,
  },
  descLabel: {
    fontSize: 10,
    marginRight: 8,
    color: "#555",
  },
  descValue: {
    fontSize: 11,
    fontWeight: "bold",
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: "#aaa",
    paddingBottom: 2,
  },
  descSuffix: {
    fontSize: 10,
    marginLeft: 6,
    marginBottom: 2,
    color: "#555",
  },
  confirmed: {
    fontSize: 10,
    marginBottom: 30,
    color: "#333",
  },
  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  breakdownSection: {
    width: "45%",
  },
  breakdownTitle: {
    fontSize: 9,
    color: "#888",
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
    paddingBottom: 2,
    marginBottom: 6,
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    paddingBottom: 3,
    marginBottom: 3,
  },
  breakdownLabel: {
    fontSize: 9,
    color: "#555",
  },
  breakdownValue: {
    fontSize: 9,
    color: "#333",
  },
  sealBox: {
    position: "absolute",
    left: 10,
    bottom: 8,
    borderWidth: 1,
    borderColor: "#aaa",
    borderStyle: "dashed",
    padding: 6,
    width: 72,
  },
  sealText: {
    fontSize: 7,
    color: "#888",
    textAlign: "center",
    lineHeight: 1.4,
  },
  issuerSection: {
    width: "48%",
    alignItems: "flex-end",
  },
  issuerName: {
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 3,
  },
  issuerDetail: {
    fontSize: 8.5,
    color: "#555",
    textAlign: "right",
    lineHeight: 1.5,
  },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 50,
    right: 50,
    textAlign: "center",
    fontSize: 7.5,
    color: "#aaa",
  },
});

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

export async function POST(req: NextRequest) {
  try {
    const data: ReceiptData = await req.json();
    const receipt = calcReceipt(data);

    const doc = (
      <Document>
        <Page size="A4" style={styles.page}>
          {/* No. / 日付 */}
          <View style={styles.headerRight}>
            <Text style={styles.headerNo}>No.　{receipt.receiptNo}</Text>
            <Text style={styles.headerDate}>{formatDate(receipt.issueDate)}</Text>
          </View>

          {/* タイトル */}
          <Text style={styles.title}>領　収　書</Text>

          {/* 宛名 */}
          <View style={styles.recipientUnderline}>
            <View style={styles.recipientRow}>
              <Text style={styles.recipientName}>{receipt.recipientName}</Text>
              <Text style={styles.recipientHonorific}>御中</Text>
            </View>
          </View>

          {/* 金額 */}
          <View style={styles.amountBox}>
            <Text style={styles.amountText}>¥ {formatCurrency(receipt.amount)}-</Text>
          </View>

          {/* 但し書き */}
          <View style={styles.descriptionRow}>
            <Text style={styles.descLabel}>但し</Text>
            <Text style={styles.descValue}>{receipt.description}</Text>
            <Text style={styles.descSuffix}>として</Text>
          </View>

          <Text style={styles.confirmed}>上記正に領収致しました。</Text>

          {/* 内訳 + 発行者 */}
          <View style={styles.bottomRow}>
            <View style={styles.breakdownSection}>
              <Text style={styles.breakdownTitle}>内　訳</Text>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>税抜金額</Text>
                <Text style={styles.breakdownValue}>¥{formatCurrency(receipt.taxExcluded)}-</Text>
              </View>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>消費税額</Text>
                <Text style={styles.breakdownValue}>¥{formatCurrency(receipt.taxAmount)}-</Text>
              </View>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>消費税率</Text>
                <Text style={styles.breakdownValue}>{receipt.taxRate}%</Text>
              </View>
            </View>

            <View style={styles.issuerSection}>
              <Text style={styles.issuerName}>IZA株式会社</Text>
              <Text style={styles.issuerDetail}>
                〒180-0022{"\n"}
                東京都武蔵野市境1-15-10{"\n"}
                イストワール302{"\n"}
                TEL：090-7542-9315{"\n"}
                担当：高橋賢太朗
              </Text>
            </View>
          </View>

          {/* 電子領収書スタンプ */}
          <View style={styles.sealBox}>
            <Text style={styles.sealText}>電子領収書{"\n"}につき印紙{"\n"}不要</Text>
          </View>

          {/* フッター */}
          <Text style={styles.footer}>
            この領収書は IZA株式会社 書類管理システムで作成されました
          </Text>
        </Page>
      </Document>
    );

    const buffer = await renderToBuffer(doc);
    const uint8 = new Uint8Array(buffer);

    return new NextResponse(uint8, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${receipt.receiptNo}_receipt.pdf"`,
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "PDF生成エラー" }, { status: 500 });
  }
}
