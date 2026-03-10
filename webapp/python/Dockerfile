# pandas等のビルドエラーを防ぐため、安定版の3.12を使用します
FROM python:3.12-slim

WORKDIR /app

# PostgreSQL接続用ライブラリ(psycopg2等)のビルドに必要なパッケージ
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# キャッシュを有効活用するために先にコピー
COPY requirements.txt .

# 依存関係のインストール
RUN pip install --no-cache-dir -r requirements.txt

# アプリケーションのコードをコピー
COPY . .

# Flask用のポート5000をコンテナ側に公開
EXPOSE 5000

# Flaskアプリケーションの起動コマンド
CMD ["flask", "run", "--host=0.0.0.0", "--port=5000"]