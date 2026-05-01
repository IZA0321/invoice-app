import Link from "next/link";

export default function DownloadsPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-4 sticky top-0 z-10 flex items-center gap-3">
        <Link href="/documents" className="text-blue-500 text-lg">‹</Link>
        <h1 className="text-lg font-bold text-gray-800">素材ダウンロード</h1>
      </header>

      <div className="max-w-lg mx-auto px-4 py-8 space-y-4">
        <p className="text-sm text-gray-500">アプリで使用できる素材をダウンロードできます。</p>

        {/* 角印 */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
          <div className="flex items-center gap-4 mb-4">
            <img src="/iza_kakuin.svg" alt="IZA角印" className="w-20 h-20 object-contain border border-gray-100 rounded" />
            <div>
              <p className="font-semibold text-gray-800">IZA株式会社 角印</p>
              <p className="text-xs text-gray-500 mt-1">領収書・請求書・見積書に使用</p>
            </div>
          </div>
          <a
            href="/iza_kakuin.svg"
            download="IZA株式会社_角印.svg"
            className="block w-full bg-blue-600 text-white text-center py-3 rounded-xl font-semibold text-sm hover:bg-blue-700 transition-colors"
          >
            ダウンロード（SVG）
          </a>
        </div>

        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100 text-sm text-blue-800">
          <p className="font-semibold mb-1">アプリへの取り込み方</p>
          <ol className="space-y-1 text-xs list-decimal list-inside">
            <li>上記からファイルをダウンロード</li>
            <li>書類作成画面の「🖼️ ロゴ・印影」を開く</li>
            <li>「印影 / 角印」の「選択」をタップ</li>
            <li>ダウンロードしたファイルを選択</li>
          </ol>
        </div>
      </div>
    </main>
  );
}
