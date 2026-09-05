<?php
require_once __DIR__ . '/../config/db.php';

$action = $_GET['action'] ?? '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = getJsonInput();
} else {
    $input = $_GET;
}

switch ($action) {
    case 'list_all':
        $stmt = $pdo->prepare("SELECT * FROM stories WHERE isPublished = 1 ORDER BY lastUpdatedAt DESC");
        $stmt->execute();
        $stories = $stmt->fetchAll();

        foreach ($stories as &$story) {
            $story['readCount'] = (int)$story['readCount'];
            $story['isPublished'] = (bool)$story['isPublished'];
            $story['isCompleted'] = (bool)$story['isCompleted'];
            $story['isMature'] = (bool)$story['isMature'];
            $story['likes'] = (int)$story['likes'];
            $story['commentsCount'] = (int)$story['commentsCount'];
            $story['uniqueViews'] = (int)$story['uniqueViews'];
            $story['repeatedViews'] = (int)$story['repeatedViews'];
            $story['isAuthorVerified'] = (bool)$story['isAuthorVerified'];
        }
        respondJson($stories);
        break;

    case 'get_by_id':
        $storyId = $input['storyId'] ?? '';
        if (empty($storyId)) {
            respondError("Missing story ID");
        }

        $stmt = $pdo->prepare("SELECT * FROM stories WHERE id = ?");
        $stmt->execute([$storyId]);
        $story = $stmt->fetch();

        if ($story) {
            $story['readCount'] = (int)$story['readCount'];
            $story['isPublished'] = (bool)$story['isPublished'];
            $story['isCompleted'] = (bool)$story['isCompleted'];
            $story['isMature'] = (bool)$story['isMature'];
            $story['likes'] = (int)$story['likes'];
            $story['commentsCount'] = (int)$story['commentsCount'];
            $story['uniqueViews'] = (int)$story['uniqueViews'];
            $story['repeatedViews'] = (int)$story['repeatedViews'];
            $story['isAuthorVerified'] = (bool)$story['isAuthorVerified'];
            respondJson($story);
        } else {
            respondError("Story not found", 404);
        }
        break;

    case 'create':
        $id = $input['id'] ?? '';
        $authorId = $input['authorId'] ?? '';
        $authorName = $input['authorName'] ?? '';
        $title = $input['title'] ?? '';
        $overview = $input['overview'] ?? '';
        $genres = $input['genres'] ?? '';
        $coverImageUrl = $input['coverImageUrl'] ?? null;
        $isPublished = (int)($input['isPublished'] ?? 0);
        $isCompleted = (int)($input['isCompleted'] ?? 0);
        $isMature = (int)($input['isMature'] ?? 0);
        $lastUpdatedAt = (int)($input['lastUpdatedAt'] ?? 0);

        if (empty($id) || empty($authorId) || empty($title)) {
            respondError("Missing required story parameters");
        }

        try {
            $pdo->beginTransaction();

            // Get actor verification status
            $stmtUser = $pdo->prepare("SELECT isVerified FROM users WHERE id = ?");
            $stmtUser->execute([$authorId]);
            $isAuthorVerified = (int)($stmtUser->fetchColumn() ?: 0);
            if ($authorId === 'moneypad_official_id') {
                $isAuthorVerified = 1;
            }

            $stmt = $pdo->prepare("INSERT INTO stories (id, authorId, authorName, title, overview, genres, coverImageUrl, isPublished, isCompleted, isMature, lastUpdatedAt, isAuthorVerified) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
            $stmt->execute([$id, $authorId, $authorName, $title, $overview, $genres, $coverImageUrl, $isPublished, $isCompleted, $isMature, $lastUpdatedAt, $isAuthorVerified]);

            if ($isPublished === 1) {
                notifyFollowersServer($pdo, $authorId, 'NEW_STORY', $id, $title, null, null, $lastUpdatedAt);
            }

            $pdo->commit();
            respondJson(["success" => true, "id" => $id]);
        } catch (Exception $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            respondError("Create story failed: " . $e->getMessage(), 500);
        }
        break;

    case 'update':
        $id = $input['id'] ?? '';
        $title = $input['title'] ?? '';
        $overview = $input['overview'] ?? '';
        $genres = $input['genres'] ?? '';
        $coverImageUrl = $input['coverImageUrl'] ?? null;
        $isPublished = (int)($input['isPublished'] ?? 0);
        $isCompleted = (int)($input['isCompleted'] ?? 0);
        $isMature = (int)($input['isMature'] ?? 0);
        $lastUpdatedAt = (int)($input['lastUpdatedAt'] ?? 0);

        if (empty($id) || empty($title)) {
            respondError("Missing required story parameters");
        }

        try {
            $pdo->beginTransaction();

            $stmtCheck = $pdo->prepare("SELECT authorId, isPublished, title FROM stories WHERE id = ?");
            $stmtCheck->execute([$id]);
            $currentStory = $stmtCheck->fetch();

            $authorId = $currentStory['authorId'] ?? '';

            $stmtVer = $pdo->prepare("SELECT isVerified FROM users WHERE id = ?");
            $stmtVer->execute([$authorId]);
            $isAuthorVerified = (int)($stmtVer->fetchColumn() ?: 0);
            if ($authorId === 'moneypad_official_id') {
                $isAuthorVerified = 1;
            }

            $stmt = $pdo->prepare("UPDATE stories SET title = ?, overview = ?, genres = ?, coverImageUrl = ?, isPublished = ?, isCompleted = ?, isMature = ?, lastUpdatedAt = ?, isAuthorVerified = ? WHERE id = ?");
            $stmt->execute([$title, $overview, $genres, $coverImageUrl, $isPublished, $isCompleted, $isMature, $lastUpdatedAt, $isAuthorVerified, $id]);

            if ($isPublished === 1 && $currentStory && (int)$currentStory['isPublished'] === 0) {
                notifyFollowersServer($pdo, $authorId, 'NEW_STORY', $id, $title, null, null, $lastUpdatedAt);
            }

            $pdo->commit();
            respondJson(["success" => true]);
        } catch (Exception $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            respondError("Update story failed: " . $e->getMessage(), 500);
        }
        break;

    case 'delete':
        $storyId = $input['storyId'] ?? '';
        $authorId = $input['authorId'] ?? '';
        if (empty($storyId)) {
            respondError("Missing story ID");
        }

        try {
            $pdo->beginTransaction();

            $stmtCheck = $pdo->prepare("SELECT authorId FROM stories WHERE id = ?");
            $stmtCheck->execute([$storyId]);
            $owner = $stmtCheck->fetchColumn();

            if (!$owner) {
                respondError("Story not found", 404);
            }

            if (!empty($authorId) && $owner !== $authorId) {
                respondError("Unauthorized to delete this story", 403);
            }

            $stmt = $pdo->prepare("DELETE FROM stories WHERE id = ?");
            $stmt->execute([$storyId]);

            $stmtParts = $pdo->prepare("DELETE FROM story_parts WHERE storyId = ?");
            $stmtParts->execute([$storyId]);

            $pdo->commit();
            respondJson(["success" => true]);
        } catch (Exception $e) {
            $pdo->rollBack();
            respondError("Delete story failed: " . $e->getMessage(), 500);
        }
        break;

    case 'publish':
        $storyId = $input['storyId'] ?? '';
        $timestamp = (int)($input['timestamp'] ?? 0);

        if (empty($storyId)) {
            respondError("Missing story ID");
        }

        try {
            $pdo->beginTransaction();

            $stmtStory = $pdo->prepare("SELECT authorId, title FROM stories WHERE id = ?");
            $stmtStory->execute([$storyId]);
            $story = $stmtStory->fetch();

            if (!$story) {
                respondError("Story not found", 404);
            }

            $stmt = $pdo->prepare("UPDATE stories SET isPublished = 1, lastUpdatedAt = ? WHERE id = ?");
            $stmt->execute([$timestamp, $storyId]);

            notifyFollowersServer($pdo, $story['authorId'], 'NEW_STORY', $storyId, $story['title'], null, null, $timestamp);

            $pdo->commit();
            respondJson(["success" => true]);
        } catch (Exception $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            respondError("Publish story failed: " . $e->getMessage(), 500);
        }
        break;

    case 'unpublish':
        $storyId = $input['storyId'] ?? '';
        $timestamp = (int)($input['timestamp'] ?? 0);

        if (empty($storyId)) {
            respondError("Missing story ID");
        }

        $stmt = $pdo->prepare("UPDATE stories SET isPublished = 0, lastUpdatedAt = ? WHERE id = ?");
        $stmt->execute([$timestamp, $storyId]);
        respondJson(["success" => true]);
        break;

    case 'list_by_author_published':
        $authorId = $input['authorId'] ?? '';
        if (empty($authorId)) {
            respondError("Missing author ID");
        }

        $stmt = $pdo->prepare("SELECT * FROM stories WHERE authorId = ? AND isPublished = 1 ORDER BY lastUpdatedAt DESC");
        $stmt->execute([$authorId]);
        $stories = $stmt->fetchAll();

        foreach ($stories as &$story) {
            $story['readCount'] = (int)$story['readCount'];
            $story['isPublished'] = (bool)$story['isPublished'];
            $story['isCompleted'] = (bool)$story['isCompleted'];
            $story['isMature'] = (bool)$story['isMature'];
            $story['likes'] = (int)$story['likes'];
            $story['commentsCount'] = (int)$story['commentsCount'];
            $story['uniqueViews'] = (int)$story['uniqueViews'];
            $story['repeatedViews'] = (int)$story['repeatedViews'];
            $story['isAuthorVerified'] = (bool)$story['isAuthorVerified'];
        }
        respondJson($stories);
        break;

    case 'list_by_author_drafts':
        $authorId = $input['authorId'] ?? '';
        if (empty($authorId)) {
            respondError("Missing author ID");
        }

        $stmt = $pdo->prepare("SELECT * FROM stories WHERE authorId = ? AND isPublished = 0");
        $stmt->execute([$authorId]);
        $stories = $stmt->fetchAll();

        foreach ($stories as &$story) {
            $story['readCount'] = (int)$story['readCount'];
            $story['isPublished'] = (bool)$story['isPublished'];
            $story['isCompleted'] = (bool)$story['isCompleted'];
            $story['isMature'] = (bool)$story['isMature'];
            $story['likes'] = (int)$story['likes'];
            $story['commentsCount'] = (int)$story['commentsCount'];
            $story['uniqueViews'] = (int)$story['uniqueViews'];
            $story['repeatedViews'] = (int)$story['repeatedViews'];
            $story['isAuthorVerified'] = (bool)$story['isAuthorVerified'];
        }
        respondJson($stories);
        break;

    case 'search':
        $query = $input['query'] ?? '';
        $genre = $input['genre'] ?? 'All';
        $excludeAuthorId = $input['excludeAuthorId'] ?? '';

        // Match Room DAO search: search query in title or genres, optional genre filter, isPublished=1, order by verified and lastUpdatedAt
        $sql = "SELECT s.* FROM stories s 
                JOIN users u ON s.authorId = u.id 
                WHERE (s.title LIKE ? OR s.genres LIKE ?) 
                AND s.isPublished = 1 
                AND s.authorId != ? ";
        
        $params = ["%" . $query . "%", "%" . $query . "%", $excludeAuthorId];

        if ($genre !== 'All') {
            $sql .= "AND s.genres LIKE ? ";
            $params[] = "%" . $genre . "%";
        }

        $sql .= "ORDER BY u.isVerified DESC, s.lastUpdatedAt DESC";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $stories = $stmt->fetchAll();

        foreach ($stories as &$story) {
            $story['readCount'] = (int)$story['readCount'];
            $story['isPublished'] = (bool)$story['isPublished'];
            $story['isCompleted'] = (bool)$story['isCompleted'];
            $story['isMature'] = (bool)$story['isMature'];
            $story['likes'] = (int)$story['likes'];
            $story['commentsCount'] = (int)$story['commentsCount'];
            $story['uniqueViews'] = (int)$story['uniqueViews'];
            $story['repeatedViews'] = (int)$story['repeatedViews'];
            $story['isAuthorVerified'] = (bool)$story['isAuthorVerified'];
        }
        respondJson($stories);
        break;

    case 'get_genres':
        $stmt = $pdo->prepare("SELECT genres FROM stories WHERE genres != ''");
        $stmt->execute();
        $genreRows = $stmt->fetchAll(PDO::FETCH_COLUMN);

        $discovered = [];
        foreach ($genreRows as $row) {
            $parts = explode(',', $row);
            foreach ($parts as $p) {
                $trimmed = trim($p);
                if (!empty($trimmed)) {
                    $discovered[] = $trimmed;
                }
            }
        }

        $defaultGenres = [
            "Romance", "Fantasy", "Mystery", "Sci-Fi", "Horror",
            "Action", "LGBTQIA+", "Werewolf", "New Adult", "Short Story",
            "Teen Fiction", "Historical Fiction", "Paranormal", "Humor",
            "Contemporary Lit", "Diverse Lit", "Thriller", "Adventure",
            "Fan Fiction", "Non-Fiction", "Poetry"
        ];

        $all = array_unique(array_merge($discovered, $defaultGenres));
        sort($all);
        respondJson(array_values($all));
        break;

    default:
        respondError("Invalid stories action", 404);
}
