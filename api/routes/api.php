<?php

use App\Http\Controllers\Api\V1\AdminController;
use App\Http\Controllers\Api\V1\AdminPlanPurchaseController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\ChatController;
use App\Http\Controllers\Api\V1\DailyLoginRewardController;
use App\Http\Controllers\Api\V1\EarningsController;
use App\Http\Controllers\Api\V1\InteractionController;
use App\Http\Controllers\Api\V1\NotificationController;
use App\Http\Controllers\Api\V1\PaymentMethodSettingController;
use App\Http\Controllers\Api\V1\PlanController;
use App\Http\Controllers\Api\V1\PlanPurchaseController;
use App\Http\Controllers\Api\V1\ReadingSessionController;
use App\Http\Controllers\Api\V1\ReferralController;
use App\Http\Controllers\Api\V1\StoryController;
use App\Http\Controllers\Api\V1\StoryPartController;
use App\Http\Controllers\Api\V1\SystemMessageController;
use App\Http\Controllers\Api\V1\TransactionController;
use App\Http\Controllers\Api\V1\UploadController;
use App\Http\Controllers\Api\V1\UserController;
use App\Http\Controllers\Api\V1\VerificationController;
use App\Http\Controllers\Api\V1\WithdrawalController;
use App\Http\Middleware\AdminMiddleware;
use App\Http\Middleware\SyncExpiredPlan;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    // Public Routes
    Route::post('/auth/login', [AuthController::class, 'login']);
    Route::post('/auth/signup', [AuthController::class, 'signup']);
    Route::get('/users/search', [UserController::class, 'search']);
    Route::get('/users/{userId}', [UserController::class, 'show']);

    Route::get('/stories', [StoryController::class, 'index']);
    Route::get('/stories/search', [StoryController::class, 'search']);
    Route::get('/stories/continue-reading', [StoryController::class, 'continueReading'])->middleware(['auth:sanctum', SyncExpiredPlan::class]);
    Route::get('/stories/recommended', [StoryController::class, 'recommended'])->middleware(['auth:sanctum', SyncExpiredPlan::class]);
    Route::get('/stories/{storyId}', [StoryController::class, 'show']);
    Route::get('/authors/{authorId}/stories/published', [StoryController::class, 'publishedByAuthor']);
    Route::get('/genres', [StoryController::class, 'genres']);

    Route::get('/stories/{storyId}/parts', [StoryPartController::class, 'index']);
    Route::get('/parts/{partId}', [StoryPartController::class, 'show']);
    Route::get('/stories/{storyId}/parts/published-count', [StoryPartController::class, 'publishedCount']);
    Route::get('/withdrawals/policy', [WithdrawalController::class, 'policy']);

    Route::get('/users/{userId}/followers', [InteractionController::class, 'followers']);
    Route::get('/users/{userId}/following', [InteractionController::class, 'following']);
    Route::get('/authors/{authorId}/conversations', [InteractionController::class, 'conversations']);
    Route::get('/conversations/{parentId}/replies', [InteractionController::class, 'replies']);
    Route::get('/stories/{storyId}/reviews', [InteractionController::class, 'reviews']);
    Route::get('/parts/{partId}/annotations', [InteractionController::class, 'annotations']);
    Route::get('/users/{username}/referral-stats', [TransactionController::class, 'referralStats']);

    // Protected Routes (Require Authentication)
    Route::middleware(['auth:sanctum', SyncExpiredPlan::class])->group(function () {
        Route::post('/auth/logout', [AuthController::class, 'logout']);
        Route::get('/auth/me', [AuthController::class, 'me']);

        Route::put('/users/{userId}/profile', [UserController::class, 'updateProfile']);
        Route::post('/users/{userId}/onboarding/gender', [UserController::class, 'onboardingGender']);
        Route::post('/users/{userId}/onboarding/birthday', [UserController::class, 'onboardingBirthday']);
        Route::post('/users/{userId}/onboarding/genres', [UserController::class, 'onboardingGenres']);
        Route::post('/users/{userId}/onboarding/complete', [UserController::class, 'completeOnboarding']);
        Route::post('/auth/change-password', [AuthController::class, 'changePassword']);
        Route::put('/users/settings', [UserController::class, 'updateSettings']);
        Route::put('/users/{userId}/settings', [UserController::class, 'updateSettings']);

        // Media
        Route::post('/upload', [UploadController::class, 'upload']);

        // Withdrawals new flow
        Route::post('/withdrawals/check-eligibility', [WithdrawalController::class, 'checkEligibility']);
        Route::get('/users/{userId}/withdrawal-requests', [WithdrawalController::class, 'index']);
        Route::post('/withdrawal-requests/{id}/watch-ad', [WithdrawalController::class, 'watchAd']);
        Route::post('/withdrawal-requests/{id}/skip-ads', [WithdrawalController::class, 'skipAds']);

        // Author Verification
        Route::get('/authors/verification-status', [VerificationController::class, 'status']);
        Route::post('/authors/verify', [VerificationController::class, 'apply']);

        // System Messages
        Route::get('/users/{userId}/system-messages', [SystemMessageController::class, 'index']);
        Route::put('/system-messages/{id}/read', [SystemMessageController::class, 'markAsRead']);

        // Chat
        Route::get('/chat/messages', [ChatController::class, 'index']);
        Route::post('/chat/messages', [ChatController::class, 'store']);
        Route::post('/chat/messages/{id}/react', [ChatController::class, 'toggleReaction']);

        // Reading Sessions
        Route::post('/reading/start', [ReadingSessionController::class, 'start']);
        Route::post('/reading/heartbeat', [ReadingSessionController::class, 'heartbeat'])
            ->middleware('throttle:30,1');
        Route::post('/reading/stop', [ReadingSessionController::class, 'stop']);
        Route::get('/users/{userId}/reading-progress/{storyId}', [ReadingSessionController::class, 'getProgress']);
        Route::post('/users/{userId}/reading-progress', [ReadingSessionController::class, 'saveProgress']);

        // Feeds & Stories
        Route::get('/stories/continue-reading', [StoryController::class, 'continueReading']);
        Route::get('/stories/recommended', [StoryController::class, 'recommended']);
        Route::post('/stories', [StoryController::class, 'store']);
        Route::put('/stories/{storyId}', [StoryController::class, 'update']);
        Route::delete('/stories/{storyId}', [StoryController::class, 'destroy']);
        Route::post('/stories/{storyId}/publish', [StoryController::class, 'publish']);
        Route::post('/stories/{storyId}/unpublish', [StoryController::class, 'unpublish']);
        Route::get('/authors/{authorId}/stories/drafts', [StoryController::class, 'draftsByAuthor']);

        // Parts
        Route::post('/stories/{storyId}/parts', [StoryPartController::class, 'store']);
        Route::put('/parts/{partId}', [StoryPartController::class, 'update']);
        Route::delete('/parts/{partId}', [StoryPartController::class, 'destroy']);
        Route::post('/stories/{storyId}/read', [StoryPartController::class, 'recordStoryRead']);
        Route::post('/parts/{partId}/read', [StoryPartController::class, 'recordPartRead']);
        Route::post('/parts/{partId}/view', [StoryPartController::class, 'recordPartView']);

        // Interactions
        Route::post('/users/{userId}/follow', [InteractionController::class, 'follow']);
        Route::post('/users/{userId}/unfollow', [InteractionController::class, 'unfollow']);
        Route::get('/users/{userId}/is-following/{followedId}', [InteractionController::class, 'isFollowing']);
        Route::post('/conversations', [InteractionController::class, 'storeConversation']);
        Route::post('/conversations/{conversationId}/like', [InteractionController::class, 'likeConversation']);
        Route::post('/stories/{storyId}/reviews', [InteractionController::class, 'storeReview']);
        Route::get('/stories/{storyId}/reviews/has-reviewed', [InteractionController::class, 'hasReviewed']);
        Route::post('/stories/{storyId}/like', [InteractionController::class, 'likeStory']);
        Route::get('/stories/{storyId}/is-liked', [InteractionController::class, 'isStoryLiked']);
        Route::post('/parts/{partId}/annotations', [InteractionController::class, 'storeAnnotation']);

        // Referrals
        Route::post('/referrals/claim-welcome', [ReferralController::class, 'claimWelcome']);
        Route::get('/referrals/milestones', [ReferralController::class, 'milestones']);
        Route::post('/referrals/claim-milestone', [ReferralController::class, 'claimMilestone']);

        // Transactions
        Route::get('/users/{userId}/transactions', [TransactionController::class, 'index']);
        Route::post('/transactions/withdraw', [TransactionController::class, 'withdraw']);
        Route::get('/transactions/ad-watch/status', [TransactionController::class, 'adWatchStatus']);
        Route::post('/transactions/ad-watch', [TransactionController::class, 'adWatch']);

        // Pending reading income and claims
        Route::get('/earnings/income', [EarningsController::class, 'income']);
        Route::get('/earnings/claimed', [EarningsController::class, 'claimed']);
        Route::post('/earnings/claims', [EarningsController::class, 'createClaim'])
            ->middleware('throttle:10,1');
        Route::post('/earnings/claims/{claim}/complete', [EarningsController::class, 'completeClaim'])
            ->middleware('throttle:10,1');
        Route::delete('/earnings/claims/{claim}', [EarningsController::class, 'cancelClaim'])
            ->middleware('throttle:10,1');

        // Notifications
        Route::get('/notifications', [NotificationController::class, 'index']);
        Route::get('/notifications/unread-count', [NotificationController::class, 'unreadCount']);
        Route::put('/notifications/{notificationId}/read', [NotificationController::class, 'markAsRead']);
        Route::post('/notifications/read-all', [NotificationController::class, 'markAllAsRead']);
        Route::put('/notifications/read-all', [NotificationController::class, 'markAllAsRead']);
        Route::get('/users/{userId}/notifications', [NotificationController::class, 'index']);
        Route::post('/notifications', [NotificationController::class, 'store']);
        Route::get('/users/{userId}/notifications/unread-count', [NotificationController::class, 'unreadCount']);
        Route::put('/users/{userId}/notifications/read-all', [NotificationController::class, 'markAllAsRead']);

        // Plans
        Route::get('/plans', [PlanController::class, 'index']);
        Route::get('/payment-methods', [PaymentMethodSettingController::class, 'index']);
        Route::get('/plan-purchases', [PlanPurchaseController::class, 'index']);
        Route::post('/plan-purchases', [PlanPurchaseController::class, 'store'])
            ->middleware('throttle:10,1');
        Route::get('/users/{userId}/plan', [PlanController::class, 'current']);

        // New-account daily rewards
        Route::get('/daily-login-reward', [DailyLoginRewardController::class, 'show']);
        Route::post('/daily-login-reward/claim', [DailyLoginRewardController::class, 'claim'])
            ->middleware('throttle:10,1');
    });

    // Admin Routes
    Route::middleware(['auth:sanctum', AdminMiddleware::class])->prefix('admin')->group(function () {
        Route::get('/withdrawals/eligible', [AdminController::class, 'eligibleWithdrawals']);
        Route::get('/withdrawals/pending-review', [AdminController::class, 'pendingReviewWithdrawals']);
        Route::get('/withdrawals/approved', [AdminController::class, 'approvedWithdrawals']);
        Route::get('/withdrawals/completed', [AdminController::class, 'completedWithdrawals']);
        Route::post('/withdrawals/mass-notify', [AdminController::class, 'massNotifyEligible']);
        Route::post('/withdrawals/{id}/approve', [AdminController::class, 'approveWithdrawal']);
        Route::post('/withdrawals/{id}/complete', [AdminController::class, 'completeWithdrawal']);
        Route::post('/withdrawals/{id}/reject', [AdminController::class, 'rejectWithdrawal']);
        Route::post('/messages/send', [AdminController::class, 'sendMessage']);
        Route::post('/messages/broadcast', [AdminController::class, 'broadcastMessage']);
        Route::get('/users', [AdminController::class, 'users']);
        Route::get('/plan-purchases', [AdminPlanPurchaseController::class, 'index']);
        Route::get('/plan-purchases/{planPurchase}/proof', [AdminPlanPurchaseController::class, 'proof']);
        Route::post('/plan-purchases/{planPurchase}/approve', [AdminPlanPurchaseController::class, 'approve']);
        Route::post('/plan-purchases/{planPurchase}/reject', [AdminPlanPurchaseController::class, 'reject']);
        Route::get('/payment-methods', [PaymentMethodSettingController::class, 'adminIndex']);
        Route::put('/payment-methods/{paymentMethodSetting}', [PaymentMethodSettingController::class, 'update']);
        Route::get('/verification-requests', [VerificationController::class, 'adminIndex']);
        Route::get('/verification-requests/{verificationRequest}/proof', [VerificationController::class, 'adminProof']);
        Route::post('/verification-requests/{id}/approve', [VerificationController::class, 'adminApprove']);
        Route::post('/verification-requests/{id}/reject', [VerificationController::class, 'adminReject']);
    });
});
