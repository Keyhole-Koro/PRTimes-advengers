#!/bin/bash
# 1. バックエンド(Docker)の起動
cd /home/ec2-user/press-release-app
docker-compose up -d --build

# 2. フロントエンド(React)の起動
FRONTEND_DIR="/home/ec2-user/press-release-app/webapp/frontend/react"

# ディレクトリが存在するかチェック
if [ -d "$FRONTEND_DIR" ]; then
  cd "$FRONTEND_DIR"
  
  # 依存関係のインストール
  npm install
  
  # nohup を使ってバックグラウンドで起動し、ログを frontend.log に出力
  # 最後の & がバックグラウンド実行のサインです
  nohup npm run dev > frontend.log 2>&1 &
  
  # 起動したプロセスのID(PID)をファイルに保存（停止時に使用するため）
  echo $! > frontend.pid
fi