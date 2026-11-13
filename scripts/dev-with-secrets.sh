#!/bin/bash
# 書類API（/api/documents/*）をローカルで試すための開発サーバー起動。
# 秘密情報はファイルに書かず、起動時に手元の保管場所から環境変数として読み込む。
#   Google: gws の認証情報（AI秘書Botと同じOAuthクライアント／refresh token）
#   Supabase secretキー: ~/.config/iza-secretary/supabase_secret
#   APIキー: ~/.config/iza-secretary/docs_api_secret
set -euo pipefail
cd "$(dirname "$0")/.."
CFG="$HOME/.config/iza-secretary"

eval "$(gws auth export --unmasked | python3 -c '
import json, shlex, sys
d = json.load(sys.stdin)
for k, v in (("GOOGLE_CLIENT_ID", "client_id"), ("GOOGLE_CLIENT_SECRET", "client_secret"), ("GOOGLE_REFRESH_TOKEN", "refresh_token")):
    print(f"export {k}={shlex.quote(d[v])}")
')"
# SupabaseのURL（.env.local では空になっているため）。supabase.env の SUPABASE_KEY は秘密キーなので公開変数にしない
export NEXT_PUBLIC_SUPABASE_URL="$(grep -E '^SUPABASE_URL=' "$CFG/supabase.env" | cut -d= -f2-)"
export SUPABASE_SECRET_KEY="$(tr -d '\n' < "$CFG/supabase_secret")"
export DOCS_API_SECRET="$(tr -d '\n' < "$CFG/docs_api_secret")"

exec npx next dev -p "${PORT:-3100}"
