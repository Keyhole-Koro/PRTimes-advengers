package main

import (
	"log"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
)

func main() {
	// データベース接続の初期化
	db := GetDB()
	defer db.Close()

	log.Println("Database connection established")

	// Chiルーターの初期化
	r := chi.NewRouter()

	// ミドルウェアの設定
	r.Use(middleware.Logger)       // ログ出力
	r.Use(middleware.Recoverer)    // パニックからの復旧
	r.Use(middleware.RequestID)    // リクエストIDの付与
	r.Use(middleware.RealIP)       // クライアントの実IPアドレスを取得

	// CORSミドルウェアの設定（開発用）
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Content-Type"},
		AllowCredentials: false,
		MaxAge:           300,
	}))

	// ルート定義
	r.Get("/press-releases/{id}", GetPressReleaseHandler)
	r.Post("/press-releases/{id}", SavePressReleaseHandler)

	// サーバー起動
	port := ":8080"
	log.Printf("Starting server on %s", port)
	if err := http.ListenAndServe(port, r); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
