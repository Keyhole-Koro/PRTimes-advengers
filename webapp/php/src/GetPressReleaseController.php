<?php

namespace App;

use DateMalformedStringException;
use DateTimeImmutable;
use PDOException;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

/**
 * プレスリリース取得コントローラー
 *
 * GET /press-releases/:id エンドポイントの処理を担当
 */
class GetPressReleaseController
{
    /**
     * プレスリリースを取得する
     *
     * @param ServerRequestInterface $request HTTPリクエスト
     * @param ResponseInterface $response HTTPレスポンス
     * @param array $args URLパラメータ（idを含む）
     * @return ResponseInterface JSONレスポンスを返す
     */
    public static function handle(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        // URLパラメータからIDを取得して検証
        $idParam = (string)$args['id'];
        if (!ctype_digit($idParam) || (int)$idParam <= 0) {
            $payload = json_encode(['code' => 'INVALID_ID', 'message' => 'Invalid ID']);
            $response->getBody()->write($payload);
            return $response
                ->withHeader('Content-Type', 'application/json')
                ->withStatus(400);
        }
        $id = (int)$idParam;

        try {
            // データベース接続を取得（必要なタイミングで実行）
            $db = Database::getConnection();

            // データベースからプレスリリースを取得
            $stmt = $db->prepare('SELECT id, title, content, created_at, updated_at FROM press_releases WHERE id = :id');
            $stmt->execute(['id' => $id]);
            $row = $stmt->fetch();

            // レコードが存在しない場合は404エラーを返す
            if (!$row) {
                $payload = json_encode(['code' => 'NOT_FOUND', 'message' => 'Press release not found']);
                $response->getBody()->write($payload);
                return $response
                    ->withHeader('Content-Type', 'application/json')
                    ->withStatus(404);
            }

            // レスポンスデータを整形
            // contentは文字列のまま返す
            $data = [
                'id' => (int)$row['id'],
                'title' => $row['title'],
                'content' => $row['content'],
                'created_at' => self::formatTimestamp((string)$row['created_at']),
                'updated_at' => self::formatTimestamp((string)$row['updated_at']),
            ];

            // JSONレスポンスを返す
            $payload = json_encode($data);
            $response->getBody()->write($payload);
            return $response->withHeader('Content-Type', 'application/json');

        } catch (PDOException) {
            // データベースエラーが発生した場合は500エラーを返す
            $payload = json_encode(['code' => 'INTERNAL_ERROR', 'message' => 'Internal server error']);
            $response->getBody()->write($payload);
            return $response
                ->withHeader('Content-Type', 'application/json')
                ->withStatus(500);
        } catch (DateMalformedStringException) {
            $payload = json_encode(['code' => 'INTERNAL_ERROR', 'message' => 'Internal server error']);
            $response->getBody()->write($payload);
            return $response
                ->withHeader('Content-Type', 'application/json')
                ->withStatus(500);
        }
    }

    /**
     * @throws DateMalformedStringException
     */
    private static function formatTimestamp(string $timestamp): string
    {
        return new DateTimeImmutable($timestamp)
            ->format('Y-m-d\TH:i:s.u');
    }

}
