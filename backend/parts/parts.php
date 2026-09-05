<?php
require_once __DIR__ . '/../config/db.php';

$action = $_GET['action'] ?? '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = getJsonInput();
} else {
    $input = $_GET;
}

switch ($action) {
    case 'list_parts':
        $storyId = $input['storyId'] ?? '';
        $onlyPublished = (bool)($input['onlyPublished'] ?? false);

        if (empty($storyId)) {
            respondError("Missing story ID");
        }

        $sql = "SELECT * FROM story_parts WHERE storyId = ? ";
        if ($onlyPublished) {
            $sql .= "AND isPublished = 1 ";
        }
        $sql .= "ORDER BY `order` ASC";

        $stmt = $pdo->prepare($sql);
        $stmt->execute([$storyId]);
        $parts = $stmt->fetchAll();

        foreach ($parts as &$part) {
            $part['order'] = (int)$part['order'];
            $part['isPublished'] = (bool)$part['isPublished'];
            $part['readCount'] = (int)$part['readCount'];
        }
        respondJson($parts);
        break;

    case 'get_part_by_id':
        $partId = $input['partId'] ?? '';
        if (empty($partId)) {
            respondError("Missing part ID");
        }

        $stmt = $pdo->prepare("SELECT * FROM story_parts WHERE id = ?");
        $stmt->execute([$partId]);
        $part = $stmt->fetch();

        if ($part) {
            $part['order'] = (int)$part['order'];
            $part['isPublished'] = (bool)$part['isPublished'];
            $part['readCount'] = (int)$part['readCount'];
            respondJson($part);
        } else {
            respondError("Story part not found", 404);
        }
        break;

    case 'add_part':
        $id = $input['id'] ?? '';
        $storyId = $input['storyId'] ?? '';
        $title = $input['title'] ?? '';
        $content = $input['content'] ?? '';
        $order = (int)($input['order'] ?? 0);
        $publishedAt = (int)($input['publishedAt'] ?? 0);
        $isPublished = (int)($input['isPublished'] ?? 0);
        $headerImageUrl = $input['headerImageUrl'] ?? null;

        if (empty($id) || empty($storyId) || empty($title) || empty($content)) {
            respondError("Missing required story part parameters");
        }

        try {
            $pdo->beginTransaction();

            $stmtCheck = $pdo->prepare("SELECT isPublished FROM story_parts WHERE id = ?");
            $stmtCheck->execute([$id]);
            $currentPart = $stmtCheck->fetch();

            if ($currentPart) {
                $stmt = $pdo->prepare("UPDATE story_parts SET title = ?, content = ?, `order` = ?, publishedAt = ?, isPublished = ?, headerImageUrl = ? WHERE id = ?");
                $stmt->execute([$title, $content, $order, $publishedAt, $isPublished, $headerImageUrl, $id]);

                if ($isPublished === 1 && (int)$currentPart['isPublished'] === 0) {
                    $stmtStory = $pdo->prepare("SELECT authorId, title FROM stories WHERE id = ?");
                    $stmtStory->execute([$storyId]);
                    $story = $stmtStory->fetch();
                    if ($story) {
                        notifyFollowersServer($pdo, $story['authorId'], 'NEW_PART', $storyId, $story['title'], $id, $title, $publishedAt);
                    }
                }
            } else {
                $stmt = $pdo->prepare("INSERT INTO story_parts (id, storyId, title, content, `order`, publishedAt, isPublished, headerImageUrl) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
                $stmt->execute([$id, $storyId, $title, $content, $order, $publishedAt, $isPublished, $headerImageUrl]);

                if ($isPublished === 1) {
                    $stmtStory = $pdo->prepare("SELECT authorId, title, isPublished FROM stories WHERE id = ?");
                    $stmtStory->execute([$storyId]);
                    $story = $stmtStory->fetch();
                    if ($story) {
                        if ((int)$story['isPublished'] === 0) {
                            $stmtPubStory = $pdo->prepare("UPDATE stories SET isPublished = 1, lastUpdatedAt = ? WHERE id = ?");
                            $stmtPubStory->execute([$publishedAt ?: round(microtime(true) * 1000), $storyId]);
                        }
                        notifyFollowersServer($pdo, $story['authorId'], 'NEW_PART', $storyId, $story['title'], $id, $title, $publishedAt);
                    }
                }
            }

            $pdo->commit();
            respondJson(["success" => true, "id" => $id]);
        } catch (Exception $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            respondError("Add story part failed: " . $e->getMessage(), 500);
        }
        break;

    case 'update_part':
        $id = $input['id'] ?? '';
        $title = $input['title'] ?? '';
        $content = $input['content'] ?? '';
        $order = (int)($input['order'] ?? 0);
        $publishedAt = (int)($input['publishedAt'] ?? 0);
        $isPublished = (int)($input['isPublished'] ?? 0);
        $headerImageUrl = $input['headerImageUrl'] ?? null;

        if (empty($id) || empty($title) || empty($content)) {
            respondError("Missing required story part parameters");
        }

        try {
            $pdo->beginTransaction();

            $stmtCheck = $pdo->prepare("SELECT storyId, isPublished FROM story_parts WHERE id = ?");
            $stmtCheck->execute([$id]);
            $currentPart = $stmtCheck->fetch();

            $stmt = $pdo->prepare("UPDATE story_parts SET title = ?, content = ?, `order` = ?, publishedAt = ?, isPublished = ?, headerImageUrl = ? WHERE id = ?");
            $stmt->execute([$title, $content, $order, $publishedAt, $isPublished, $headerImageUrl, $id]);

            if ($isPublished === 1) {
                $storyId = $currentPart['storyId'];
                $stmtStory = $pdo->prepare("SELECT authorId, title, isPublished FROM stories WHERE id = ?");
                $stmtStory->execute([$storyId]);
                $story = $stmtStory->fetch();
                if ($story) {
                    if ((int)$story['isPublished'] === 0) {
                        $stmtPubStory = $pdo->prepare("UPDATE stories SET isPublished = 1, lastUpdatedAt = ? WHERE id = ?");
                        $stmtPubStory->execute([$publishedAt ?: round(microtime(true) * 1000), $storyId]);
                    }
                    if ($currentPart && (int)$currentPart['isPublished'] === 0) {
                        notifyFollowersServer($pdo, $story['authorId'], 'NEW_PART', $storyId, $story['title'], $id, $title, $publishedAt);
                    }
                }
            }

            $pdo->commit();
            respondJson(["success" => true]);
        } catch (Exception $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            respondError("Update story part failed: " . $e->getMessage(), 500);
        }
        break;

    case 'delete_part':
        $partId = $input['partId'] ?? '';
        if (empty($partId)) {
            respondError("Missing part ID");
        }

        $stmt = $pdo->prepare("DELETE FROM story_parts WHERE id = ?");
        $stmt->execute([$partId]);
        respondJson(["success" => true]);
        break;

    case 'record_read':
        $userId = $input['userId'] ?? '';
        $storyId = $input['storyId'] ?? '';

        if (empty($storyId)) {
            respondError("Missing story ID");
        }

        $stmtStory = $pdo->prepare("SELECT authorId FROM stories WHERE id = ?");
        $stmtStory->execute([$storyId]);
        $story = $stmtStory->fetch();

        if (!$story) {
            respondError("Story not found", 404);
        }

        $authorId = $story['authorId'];
        $isAuthor = ($userId === $authorId);

        // Get last read timestamp
        $stmtLast = $pdo->prepare("SELECT MAX(readAt) FROM user_read_parts WHERE userId = ? AND storyId = ?");
        $stmtLast->execute([$userId, $storyId]);
        $lastRead = $stmtLast->fetchColumn();

        $now = round(microtime(true) * 1000);

        if ($isAuthor || $lastRead === null || ($now - $lastRead > 30 * 60 * 1000)) {
            try {
                $pdo->beginTransaction();

                if ($lastRead === null) {
                    $stmtInc = $pdo->prepare("UPDATE stories SET uniqueViews = uniqueViews + 1 WHERE id = ?");
                    $stmtInc->execute([$storyId]);
                } else {
                    $stmtInc = $pdo->prepare("UPDATE stories SET repeatedViews = repeatedViews + 1 WHERE id = ?");
                    $stmtInc->execute([$storyId]);
                }

                $stmtCount = $pdo->prepare("UPDATE stories SET readCount = readCount + 1 WHERE id = ?");
                $stmtCount->execute([$storyId]);

                // Credit author income if user is not author and has never read this story before
                if (!$isAuthor && $lastRead === null) {
                    $stmtAuth = $pdo->prepare("SELECT isVerified FROM users WHERE id = ?");
                    $stmtAuth->execute([$authorId]);
                    $isVerified = (int)($stmtAuth->fetchColumn() ?: 0);
                    if ($authorId === 'moneypad_official_id') {
                        $isVerified = 1;
                    }

                    $rate = $isVerified ? 0.0005 : 0.0003;

                    $stmtIncome = $pdo->prepare("UPDATE users SET authorIncome = authorIncome + ? WHERE id = ?");
                    $stmtIncome->execute([$rate, $authorId]);
                }

                $pdo->commit();
                respondJson(["success" => true, "recorded" => true]);
            } catch (Exception $e) {
                $pdo->rollBack();
                respondError("Failed to record story read: " . $e->getMessage(), 500);
            }
        } else {
            respondJson(["success" => true, "recorded" => false]);
        }
        break;

    case 'record_part_read':
        $userId = $input['userId'] ?? '';
        $storyId = $input['storyId'] ?? '';
        $partId = $input['partId'] ?? '';

        if (empty($userId) || empty($storyId) || empty($partId)) {
            respondError("Missing required parameters for part read");
        }

        try {
            $pdo->beginTransaction();

            $stmtCheck = $pdo->prepare("SELECT 1 FROM user_read_parts WHERE userId = ? AND partId = ?");
            $stmtCheck->execute([$userId, $partId]);
            $alreadyRead = $stmtCheck->fetchColumn();

            if (!$alreadyRead) {
                $stmtInc = $pdo->prepare("UPDATE story_parts SET readCount = readCount + 1 WHERE id = ?");
                $stmtInc->execute([$partId]);
            }

            $now = round(microtime(true) * 1000);
            $stmtInsert = $pdo->prepare("INSERT IGNORE INTO user_read_parts (userId, partId, storyId, readAt) VALUES (?, ?, ?, ?)");
            $stmtInsert->execute([$userId, $partId, $storyId, $now]);

            $pdo->commit();
            respondJson(["success" => true]);
        } catch (Exception $e) {
            $pdo->rollBack();
            respondError("Failed to record part read: " . $e->getMessage(), 500);
        }
        break;

    case 'record_part_view':
        $partId = $input['partId'] ?? '';
        if (empty($partId)) {
            respondError("Missing part ID");
        }

        $stmt = $pdo->prepare("UPDATE story_parts SET readCount = readCount + 1 WHERE id = ?");
        $stmt->execute([$partId]);
        respondJson(["success" => true]);
        break;

    case 'get_published_count':
        $storyId = $input['storyId'] ?? '';
        if (empty($storyId)) {
            respondError("Missing story ID");
        }

        $stmt = $pdo->prepare("SELECT COUNT(*) FROM story_parts WHERE storyId = ? AND isPublished = 1");
        $stmt->execute([$storyId]);
        $count = (int)$stmt->fetchColumn();
        respondJson(["count" => $count]);
        break;

    default:
        respondError("Invalid parts action", 404);
}
