<?php
require_once __DIR__ . '/../config/db.php';

$action = $_GET['action'] ?? '';

const WATCH_AD_REWARD_COINS = 0.02;
const READER_WITHDRAWAL_MIN_PHP = 3.00;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = getJsonInput();
} else {
    $input = $_GET;
}

switch ($action) {
    case 'withdraw':
        $id = $input['id'] ?? '';
        $userId = $input['userId'] ?? '';
        $amount = (double)($input['amount'] ?? 0.0);
        $method = $input['method'] ?? '';
        $accountInfo = $input['accountInfo'] ?? '';
        $source = $input['source'] ?? '';
        $timestamp = (int)($input['timestamp'] ?? 0);

        if (empty($id) || empty($userId) || $amount <= 0 || empty($method) || empty($accountInfo)) {
            respondError("Missing or invalid withdrawal inputs");
        }

        try {
            $pdo->beginTransaction();

            if ($source === 'AUTHOR') {
                $stmtUpdate = $pdo->prepare("UPDATE users SET authorIncome = authorIncome - ? WHERE id = ?");
                $stmtUpdate->execute([$amount, $userId]);
            } else if ($source === 'READER') {
                if ($amount < READER_WITHDRAWAL_MIN_PHP) {
                    $pdo->rollBack();
                    respondError("Minimum reader withdrawal is PHP 3.00");
                }

                $stmtBalance = $pdo->prepare("SELECT readerCoins FROM users WHERE id = ?");
                $stmtBalance->execute([$userId]);
                $readerCoins = (double)($stmtBalance->fetchColumn() ?: 0.0);
                $coins = round($amount * 100, 2);

                if ($readerCoins < $coins) {
                    $pdo->rollBack();
                    respondError("Insufficient reader balance");
                }

                $stmtUpdate = $pdo->prepare("UPDATE users SET readerCoins = readerCoins - ? WHERE id = ?");
                $stmtUpdate->execute([$coins, $userId]);
            } else if ($source === 'REFERRAL') {
                // Referral is computed. No direct user field deduction needed
            } else {
                $stmtUpdate = $pdo->prepare("UPDATE users SET balance = balance - ? WHERE id = ?");
                $stmtUpdate->execute([$amount, $userId]);
            }

            // Insert transaction
            $stmtInsert = $pdo->prepare("INSERT INTO transactions (id, userId, amount, method, accountInfo, source, timestamp, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending')");
            $stmtInsert->execute([$id, $userId, $amount, $method, $accountInfo, $source, $timestamp]);

            $pdo->commit();
            respondJson(["success" => true]);
        } catch (Exception $e) {
            $pdo->rollBack();
            respondError("Withdrawal transaction failed: " . $e->getMessage(), 500);
        }
        break;

    case 'record_ad_watch':
        $id = $input['id'] ?? '';
        $userId = $input['userId'] ?? '';
        $watchedAt = (int)($input['watchedAt'] ?? 0);

        if (empty($id) || empty($userId)) {
            respondError("Missing ad watch inputs");
        }

        if ($watchedAt <= 0) {
            $watchedAt = round(microtime(true) * 1000);
        }

        try {
            $pdo->beginTransaction();

            $stmtUser = $pdo->prepare("SELECT 1 FROM users WHERE id = ?");
            $stmtUser->execute([$userId]);
            if (!$stmtUser->fetchColumn()) {
                $pdo->rollBack();
                respondError("User not found", 404);
            }

            $stmtInsert = $pdo->prepare("INSERT INTO ad_watch_events (id, userId, rewardCoins, watchedAt) VALUES (?, ?, ?, ?)");
            $stmtInsert->execute([$id, $userId, WATCH_AD_REWARD_COINS, $watchedAt]);

            $stmtCoins = $pdo->prepare("UPDATE users SET readerCoins = readerCoins + ?, totalReaderCoins = totalReaderCoins + ? WHERE id = ?");
            $stmtCoins->execute([WATCH_AD_REWARD_COINS, WATCH_AD_REWARD_COINS, $userId]);

            $stmtBalance = $pdo->prepare("SELECT readerCoins, totalReaderCoins FROM users WHERE id = ?");
            $stmtBalance->execute([$userId]);
            $balances = $stmtBalance->fetch();

            $pdo->commit();
            respondJson([
                "success" => true,
                "rewardCoins" => WATCH_AD_REWARD_COINS,
                "readerCoins" => (double)$balances['readerCoins'],
                "totalReaderCoins" => (double)$balances['totalReaderCoins']
            ]);
        } catch (Exception $e) {
            $pdo->rollBack();
            respondError("Failed to record ad watch: " . $e->getMessage(), 500);
        }
        break;

    case 'get_transactions':
        $userId = $input['userId'] ?? '';
        if (empty($userId)) {
            respondError("Missing user ID");
        }

        $stmt = $pdo->prepare("SELECT * FROM transactions WHERE userId = ? ORDER BY timestamp DESC");
        $stmt->execute([$userId]);
        $transactions = $stmt->fetchAll();

        foreach ($transactions as &$t) {
            $t['amount'] = (double)$t['amount'];
            $t['timestamp'] = (int)$t['timestamp'];
        }
        respondJson($transactions);
        break;

    case 'claim_referral_reward':
        $userId = $input['userId'] ?? '';
        if (empty($userId)) {
            respondError("Missing user ID");
        }

        try {
            $pdo->beginTransaction();

            // Fetch user and check if reward already claimed
            $stmtUser = $pdo->prepare("SELECT isReferralRewardClaimed, referredBy, username, profileImageUrl FROM users WHERE id = ?");
            $stmtUser->execute([$userId]);
            $user = $stmtUser->fetch();

            if (!$user || $user['isReferralRewardClaimed']) {
                respondError("Reward already claimed or user not found");
            }

            $amount = 10;
            // Update current user readerCoins
            $stmtCoins = $pdo->prepare("UPDATE users SET readerCoins = readerCoins + ?, totalReaderCoins = totalReaderCoins + ? WHERE id = ?");
            $stmtCoins->execute([$amount, $amount, $userId]);

            // If referred by someone, credit referrer and send them a notification
            if (!empty($user['referredBy'])) {
                $stmtReferrer = $pdo->prepare("SELECT id FROM users WHERE username = ?");
                $stmtReferrer->execute([$user['referredBy']]);
                $referrerId = $stmtReferrer->fetchColumn();

                if ($referrerId) {
                    // Credit referrer readerCoins
                    $stmtCoinsRef = $pdo->prepare("UPDATE users SET readerCoins = readerCoins + ?, totalReaderCoins = totalReaderCoins + ? WHERE id = ?");
                    $stmtCoinsRef->execute([$amount, $amount, $referrerId]);

                    // Send referral notification
                    $notifId = bin2hex(random_bytes(16));
                    $content = "You earned 10 coins because " . $user['username'] . " used your referral!";
                    $stmtNotif = $pdo->prepare("INSERT INTO notifications (id, userId, type, actorId, actorName, actorProfileImageUrl, content) VALUES (?, ?, 'REFERRAL_REWARD', ?, ?, ?, ?)");
                    $stmtNotif->execute([$notifId, $referrerId, $userId, $user['username'], $user['profileImageUrl'], $content]);
                }
            }

            // Mark referral reward as claimed
            $stmtClaimed = $pdo->prepare("UPDATE users SET isReferralRewardClaimed = 1 WHERE id = ?");
            $stmtClaimed->execute([$userId]);

            $pdo->commit();
            respondJson(["success" => true]);
        } catch (Exception $e) {
            $pdo->rollBack();
            respondError("Failed to claim referral reward: " . $e->getMessage(), 500);
        }
        break;

    case 'get_referral_stats':
        $username = $input['username'] ?? '';
        if (empty($username)) {
            respondError("Missing username");
        }

        // 1. Calculate total referral coins from both referred reading and rewarded ad watching.
        $stmtCoins = $pdo->prepare("
            SELECT SUM(
                CASE 
                    WHEN read_count >= 110 AND ad_count >= 20 THEN 200
                    WHEN read_count >= 80 AND ad_count >= 15 THEN 130
                    WHEN read_count >= 40 AND ad_count >= 10 THEN 70
                    WHEN read_count >= 25 AND ad_count >= 7 THEN 35
                    WHEN read_count >= 15 AND ad_count >= 5 THEN 15
                    WHEN read_count >= 5 AND ad_count >= 3 THEN 5
                    ELSE 0 
                END
            )
            FROM (
                SELECT u.id, COUNT(DISTINCT urp.partId) as read_count, COUNT(DISTINCT awe.id) as ad_count
                FROM users u
                LEFT JOIN user_read_parts urp ON u.id = urp.userId
                LEFT JOIN ad_watch_events awe ON u.id = awe.userId
                WHERE u.referredBy = ?
                GROUP BY u.id
            ) AS subquery
        ");
        $stmtCoins->execute([$username]);
        $totalCoins = (int)($stmtCoins->fetchColumn() ?: 0);

        // 2. Calculate referral author withdrawals
        $stmtWithdrawals = $pdo->prepare("
            SELECT SUM(amount) FROM transactions 
            WHERE userId IN (SELECT id FROM users WHERE referredBy = ?) 
            AND userId IN (SELECT DISTINCT authorId FROM stories) 
            AND source = 'AUTHOR'
        ");
        $stmtWithdrawals->execute([$username]);
        $totalWithdrawals = (double)($stmtWithdrawals->fetchColumn() ?: 0.0);

        respondJson([
            "totalReferralCoins" => $totalCoins,
            "referralAuthorWithdrawals" => $totalWithdrawals
        ]);
        break;

    default:
        respondError("Invalid transactions action", 404);
}
