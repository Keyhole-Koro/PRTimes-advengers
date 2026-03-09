package main

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
)

// PressRelease はプレスリリースのデータ構造
type PressRelease struct {
	ID        int    `json:"id"`
	Title     string `json:"title"`
	Content   string `json:"content"` // TipTap形式のJSON文字列
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
}

// SavePressReleaseRequest はプレスリリース保存リクエストのデータ構造
type SavePressReleaseRequest struct {
	Title   string `json:"title"`
	Content string `json:"content"`
}

// ErrorResponse はエラーレスポンスのデータ構造
type ErrorResponse struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// SuccessResponse は成功レスポンスのデータ構造
type SuccessResponse struct {
	Message string `json:"message"`
}

// GetPressReleaseHandler はプレスリリースを取得するハンドラー
// GET /press-releases/:id
func GetPressReleaseHandler(w http.ResponseWriter, r *http.Request) {
	// URLパラメータからIDを取得
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil || id <= 0 {
		respondWithError(w, http.StatusBadRequest, "INVALID_ID", "Invalid ID")
		return
	}

	// データベースからプレスリリースを取得
	db := GetDB()
	var pr PressRelease
	var contentStr string
	var createdAt time.Time
	var updatedAt time.Time

	err = db.QueryRow(
		context.Background(),
		"SELECT id, title, content, created_at, updated_at FROM press_releases WHERE id = $1",
		id,
	).Scan(&pr.ID, &pr.Title, &contentStr, &createdAt, &updatedAt)

	if err == pgx.ErrNoRows {
		// レコードが存在しない場合は404エラー
		respondWithError(w, http.StatusNotFound, "NOT_FOUND", "Press release not found")
		return
	} else if err != nil {
		// その他のデータベースエラー
		respondWithError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Internal server error")
		return
	}

	// contentは文字列のまま
	pr.Content = contentStr
	pr.CreatedAt = formatTimestamp(createdAt)
	pr.UpdatedAt = formatTimestamp(updatedAt)

	// JSONレスポンスを返す
	respondWithJSON(w, http.StatusOK, pr)
}

// SavePressReleaseHandler はプレスリリースを保存（更新）するハンドラー
// POST /press-releases/:id
func SavePressReleaseHandler(w http.ResponseWriter, r *http.Request) {
	const maxRequestBodyBytes = 1 << 20 // 1MB

	// URLパラメータからIDを取得
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil || id <= 0 {
		respondWithError(w, http.StatusBadRequest, "INVALID_ID", "Invalid ID")
		return
	}

	limitedBody := http.MaxBytesReader(w, r.Body, maxRequestBodyBytes)
	body, err := io.ReadAll(limitedBody)
	if err != nil {
		var maxBytesErr *http.MaxBytesError
		if errors.As(err, &maxBytesErr) {
			respondWithError(w, http.StatusRequestEntityTooLarge, "BODY_TOO_LARGE", "Request body too large")
			return
		}

		respondWithError(w, http.StatusBadRequest, "INVALID_JSON", "Invalid JSON")
		return
	}

	// リクエストボディをパース
	var payload interface{}
	if err := json.Unmarshal(body, &payload); err != nil {
		respondWithError(w, http.StatusBadRequest, "INVALID_JSON", "Invalid JSON")
		return
	}

	// JSONオブジェクトでない場合も必須フィールド不足として扱う
	data, ok := payload.(map[string]interface{})
	if !ok {
		data = map[string]interface{}{}
	}

	titleRaw, titleExists := data["title"]
	contentRaw, contentExists := data["content"]

	title, titleOK := titleRaw.(string)
	content, contentOK := contentRaw.(string)

	if !titleExists || !contentExists || !titleOK || !contentOK {
		respondWithError(w, http.StatusBadRequest, "MISSING_REQUIRED_FIELDS", "Title and content are required")
		return
	}
	req := SavePressReleaseRequest{
		Title:   title,
		Content: content,
	}

	// データベース接続を取得
	db := GetDB()
	ctx := context.Background()

	// レコードの存在確認
	var exists bool
	err = db.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM press_releases WHERE id = $1)", id).Scan(&exists)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Internal server error")
		return
	}

	if !exists {
		// レコードが存在しない場合は404エラー
		respondWithError(w, http.StatusNotFound, "NOT_FOUND", "Press release not found")
		return
	}

	// プレスリリースを更新
	// contentはJSON文字列として保存
	_, err = db.Exec(
		ctx,
		`UPDATE press_releases
		 SET title = $1, content = $2, updated_at = CURRENT_TIMESTAMP
		 WHERE id = $3`,
		req.Title,
		req.Content,
		id,
	)

	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Internal server error")
		return
	}

	// 更新後のデータを取得
	var pressRelease PressRelease
	var createdAt time.Time
	var updatedAt time.Time
	err = db.QueryRow(
		ctx,
		"SELECT id, title, content, created_at, updated_at FROM press_releases WHERE id = $1",
		id,
	).Scan(&pressRelease.ID, &pressRelease.Title, &pressRelease.Content, &createdAt, &updatedAt)

	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Internal server error")
		return
	}

	pressRelease.CreatedAt = formatTimestamp(createdAt)
	pressRelease.UpdatedAt = formatTimestamp(updatedAt)

	// 更新されたPressReleaseオブジェクトを返す
	respondWithJSON(w, http.StatusOK, pressRelease)
}

// respondWithJSON はJSONレスポンスを返すヘルパー関数
func respondWithJSON(w http.ResponseWriter, statusCode int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(payload)
}

// respondWithError はエラーレスポンスを返すヘルパー関数
func respondWithError(w http.ResponseWriter, statusCode int, code string, message string) {
	respondWithJSON(w, statusCode, ErrorResponse{Code: code, Message: message})
}

func formatTimestamp(t time.Time) string {
	return t.Format("2006-01-02T15:04:05.000000")
}
