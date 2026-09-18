package com.example.moneypad.data.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.example.moneypad.data.model.Review
import com.example.moneypad.data.model.Story
import com.example.moneypad.data.model.StoryPart
import com.example.moneypad.data.model.Transaction
import com.example.moneypad.data.model.User
import com.example.moneypad.data.model.Conversation
import com.example.moneypad.data.model.Follow
import com.example.moneypad.data.model.Notification
import kotlinx.coroutines.flow.Flow

@Dao
interface MoneyPadDao {
    // ── Notifications ────────────────────────────────────────────────────────
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertNotification(notification: Notification)

    @Query("SELECT * FROM notifications WHERE userId = :userId ORDER BY timestamp DESC")
    fun getNotificationsForUser(userId: String): Flow<List<Notification>>

    @Query("UPDATE notifications SET isRead = 1 WHERE id = :notificationId")
    suspend fun markNotificationAsRead(notificationId: String)

    @Query("UPDATE notifications SET isRead = 1 WHERE userId = :userId")
    suspend fun markAllNotificationsAsRead(userId: String)

    @Query("SELECT COUNT(*) FROM notifications WHERE userId = :userId AND isRead = 0")
    fun getUnreadNotificationCount(userId: String): Flow<Int>

    // ── User ─────────────────────────────────────────────────────────────────
    @Query("SELECT * FROM users WHERE id = :userId")
    fun getUser(userId: String): Flow<User?>

    @Query("SELECT * FROM users WHERE username = :username")
    fun getUserByUsernameFlow(username: String): Flow<User?>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertUser(user: User)

    @Query("UPDATE users SET balance = balance + :amount WHERE id = :userId")
    suspend fun updateBalance(userId: String, amount: Double)

    @Query("UPDATE users SET authorIncome = authorIncome + :amount WHERE id = :userId")
    suspend fun updateAuthorIncome(userId: String, amount: Double)

    @Query("UPDATE users SET readerCoins = readerCoins + :amount, totalReaderCoins = totalReaderCoins + :amount WHERE id = :userId")
    suspend fun updateReaderCoins(userId: String, amount: Double)

    @Query("UPDATE users SET balance = balance - :amount WHERE id = :userId")
    suspend fun deductBalance(userId: String, amount: Double)

    @Query("UPDATE users SET authorIncome = authorIncome - :amount WHERE id = :userId")
    suspend fun deductAuthorIncome(userId: String, amount: Double)

    @Query("UPDATE users SET readerCoins = readerCoins - :amount WHERE id = :userId")
    suspend fun deductReaderCoins(userId: String, amount: Double)

    @Query("""
        SELECT SUM(
            CASE 
                WHEN read_count >= 110 THEN 200
                WHEN read_count >= 80 THEN 130
                WHEN read_count >= 40 THEN 70
                WHEN read_count >= 25 THEN 35
                WHEN read_count >= 15 THEN 15
                WHEN read_count >= 5 THEN 5
                ELSE 0 
            END
        )
        FROM (
            SELECT u.id, COUNT(DISTINCT urp.partId) as read_count
            FROM users u
            LEFT JOIN user_read_parts urp ON u.id = urp.userId
            WHERE u.referredBy = :username
            GROUP BY u.id
        )
    """)
    fun getTotalReferralCoins(username: String): Flow<Int?>

    @Query("SELECT SUM(amount) FROM transactions WHERE userId IN (SELECT id FROM users WHERE referredBy = :username) AND userId IN (SELECT DISTINCT authorId FROM stories) AND source = 'AUTHOR'")
    fun getReferralAuthorWithdrawals(username: String): Flow<Double?>

    @Query("SELECT COUNT(*) > 0 FROM stories WHERE authorId = :userId")
    suspend fun isUserAuthor(userId: String): Boolean

    @Query("SELECT SUM(amount) FROM transactions WHERE userId = :userId AND source = :source")
    fun getTotalWithdrawalsBySource(userId: String, source: String): Flow<Double?>

    @Query("SELECT * FROM users WHERE username = :username")
    suspend fun getUserByUsername(username: String): User?

    @Query("SELECT * FROM users WHERE email = :email")
    suspend fun getUserByEmail(email: String): User?

    @Query("SELECT * FROM users WHERE (username = :identifier OR email = :identifier) AND password = :password")
    suspend fun login(identifier: String, password: String): User?

    @Query("SELECT * FROM users WHERE username LIKE '%' || :query || '%'")
    fun searchAuthors(query: String): Flow<List<User>>

    @Query("UPDATE users SET bio = :bio, profileImageUrl = :profileImageUrl, coverImageUrl = :coverImageUrl WHERE id = :userId")
    suspend fun updateUserProfile(userId: String, bio: String, profileImageUrl: String?, coverImageUrl: String?)

    @Query("UPDATE users SET referredBy = :referrerUsername WHERE id = :userId")
    suspend fun updateReferrer(userId: String, referrerUsername: String)

    @Query("UPDATE users SET isReferralRewardClaimed = 1 WHERE id = :userId")
    suspend fun markReferralRewardClaimed(userId: String)

    @Query("UPDATE users SET username = :username, birthday = :birthday, gender = :gender, preferredGenres = :preferredGenres WHERE id = :userId")
    suspend fun updateUserSettings(userId: String, username: String, birthday: String, gender: String, preferredGenres: String)

    @Query("UPDATE users SET gender = :gender, onboardingStep = MAX(onboardingStep, 2) WHERE id = :userId")
    suspend fun updateOnboardingGender(userId: String, gender: String)

    @Query("UPDATE users SET birthday = :birthday, onboardingStep = MAX(onboardingStep, 3) WHERE id = :userId")
    suspend fun updateOnboardingBirthday(userId: String, birthday: String)

    @Query("UPDATE users SET preferredGenres = :preferredGenres WHERE id = :userId")
    suspend fun updatePreferredGenres(userId: String, preferredGenres: String)

    @Query("UPDATE users SET onboardingStep = :step WHERE id = :userId")
    suspend fun updateOnboardingStep(userId: String, step: Int)

    @Query("UPDATE users SET onboardingCompleted = 1, onboardingStep = 3 WHERE id = :userId")
    suspend fun markOnboardingCompleted(userId: String)

    @Query("UPDATE users SET password = :newPassword WHERE id = :userId")
    suspend fun updatePassword(userId: String, newPassword: String)

    @Query("SELECT password FROM users WHERE id = :userId")
    suspend fun getPassword(userId: String): String?

    @Query("UPDATE users SET loginTimestamp = :timestamp WHERE id = :userId")
    suspend fun updateLoginTimestamp(userId: String, timestamp: Long)

    @Query("UPDATE users SET referralCount = referralCount + 1 WHERE username = :username")
    suspend fun incrementReferralCount(username: String)

    @Query("UPDATE users SET followers = followers + :delta WHERE id = :userId")
    suspend fun updateFollowers(userId: String, delta: Int)

    @Query("UPDATE users SET following = following + :delta WHERE id = :userId")
    suspend fun updateFollowing(userId: String, delta: Int)

    @Query("SELECT COUNT(*) FROM stories WHERE authorId = :userId AND isPublished = 1 AND (SELECT COUNT(*) FROM story_parts WHERE storyId = stories.id AND isPublished = 1) >= 10")
    suspend fun countQualifyingStories(userId: String): Int

    @Query("UPDATE users SET isVerified = 1 WHERE id = :userId")
    suspend fun verifyUser(userId: String)

    @Query("UPDATE users SET adFreeUntil = :timestamp WHERE id = :userId")
    suspend fun updateAdFreeUntil(userId: String, timestamp: Long)

    @Query("UPDATE users SET isAdFreePermanently = 1 WHERE id = :userId")
    suspend fun markAdFreePermanently(userId: String)

    @androidx.room.Transaction
    suspend fun claimReferralRewardTransaction(
        userId: String,
        amount: Double,
        referrerId: String?,
        notification: Notification?
    ) {
        updateReaderCoins(userId, amount)
        if (referrerId != null) {
            updateReaderCoins(referrerId, amount)
        }
        if (notification != null) {
            insertNotification(notification)
        }
        markReferralRewardClaimed(userId)
    }

    @Query("UPDATE conversations SET senderProfileImageUrl = :imageUrl, senderName = :name, isSenderVerified = :isVerified WHERE senderId = :userId")
    suspend fun updateConversationsSyncInfo(userId: String, name: String, imageUrl: String?, isVerified: Boolean)

    @Query("UPDATE notifications SET actorProfileImageUrl = :imageUrl, actorName = :name, isActorVerified = :isVerified WHERE actorId = :userId")
    suspend fun updateNotificationsSyncInfo(userId: String, name: String, imageUrl: String?, isVerified: Boolean)

    @Query("UPDATE reviews SET username = :username, userProfileImageUrl = :profileImageUrl, isUserVerified = :isVerified WHERE userId = :userId")
    suspend fun updateReviewsSyncInfo(userId: String, username: String, profileImageUrl: String?, isVerified: Boolean)

    @Query("UPDATE part_annotations SET username = :name, isUserVerified = :isVerified WHERE userId = :userId")
    suspend fun updatePartAnnotationsSyncInfo(userId: String, name: String, isVerified: Boolean)

    @Query("UPDATE stories SET authorName = :name, isAuthorVerified = :isVerified WHERE authorId = :userId")
    suspend fun updateStoriesSyncInfo(userId: String, name: String, isVerified: Boolean)

    // ── Follows ───────────────────────────────────────────────────────────────
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertFollow(follow: Follow)

    @Query("DELETE FROM follows WHERE followerId = :followerId AND followedId = :followedId")
    suspend fun deleteFollow(followerId: String, followedId: String)

    @Query("SELECT EXISTS(SELECT 1 FROM follows WHERE followerId = :followerId AND followedId = :followedId)")
    fun isFollowing(followerId: String, followedId: String): Flow<Boolean>

    /** Returns list of User objects who follow the given user */
    @Query("SELECT * FROM users WHERE id IN (SELECT followerId FROM follows WHERE followedId = :userId)")
    fun getFollowers(userId: String): Flow<List<User>>

    /** Returns list of User objects that the given user follows */
    @Query("SELECT * FROM users WHERE id IN (SELECT followedId FROM follows WHERE followerId = :userId)")
    fun getFollowing(userId: String): Flow<List<User>>

    // ── Conversations ─────────────────────────────────────────────────────────
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertConversation(conversation: Conversation)

    @Query("SELECT * FROM conversations WHERE id = :id")
    suspend fun getConversationById(id: String): Conversation?

    @Query("SELECT * FROM conversations WHERE authorId = :authorId AND parentId IS NULL ORDER BY timestamp DESC")
    fun getConversationsForAuthor(authorId: String): Flow<List<Conversation>>

    @Query("SELECT * FROM conversations WHERE parentId = :parentId ORDER BY timestamp ASC")
    fun getReplies(parentId: String): Flow<List<Conversation>>

    @Query("UPDATE conversations SET likes = likes + :delta, isLiked = CASE WHEN :delta > 0 THEN 1 ELSE 0 END WHERE id = :id")
    suspend fun updateConversationLikes(id: String, delta: Int)

    // ── Stories ───────────────────────────────────────────────────────────────
    @Query("SELECT * FROM stories WHERE isPublished = 1")
    fun getAllStories(): Flow<List<Story>>

    @Query("SELECT genres FROM stories WHERE genres != ''")
    fun getAllStoryGenres(): Flow<List<String>>

    @Query("SELECT * FROM stories WHERE authorId = :authorId AND isPublished = 1 ORDER BY rowid DESC")
    fun getPublishedStoriesByAuthor(authorId: String): Flow<List<Story>>

    @Query("SELECT * FROM stories WHERE authorId = :authorId AND isPublished = 0")
    fun getDraftStoriesByAuthor(authorId: String): Flow<List<Story>>

    @Query("SELECT * FROM stories WHERE id = :storyId")
    suspend fun getStoryById(storyId: String): Story?

    @Query("SELECT * FROM stories WHERE id = :storyId")
    fun getStoryByIdFlow(storyId: String): Flow<Story?>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertStory(story: Story)

    @Query("DELETE FROM stories WHERE id = :storyId")
    suspend fun deleteStory(storyId: String)

    @Query("DELETE FROM story_parts WHERE storyId = :storyId")
    suspend fun deleteStoryParts(storyId: String)

    @Query("UPDATE stories SET readCount = readCount + 1 WHERE id = :storyId")
    suspend fun incrementReadCount(storyId: String)

    @Query("UPDATE stories SET uniqueViews = uniqueViews + 1 WHERE id = :storyId")
    suspend fun incrementUniqueViews(storyId: String)

    @Query("UPDATE stories SET repeatedViews = repeatedViews + 1 WHERE id = :storyId")
    suspend fun incrementRepeatedViews(storyId: String)

    @Query("UPDATE story_parts SET readCount = readCount + 1 WHERE id = :partId")
    suspend fun incrementPartReadCount(partId: String)

    @Query("UPDATE stories SET isPublished = 1, lastUpdatedAt = :timestamp WHERE id = :storyId")
    suspend fun publishStory(storyId: String, timestamp: Long = System.currentTimeMillis())

    @Query("UPDATE stories SET isPublished = 0, lastUpdatedAt = :timestamp WHERE id = :storyId")
    suspend fun unpublishStory(storyId: String, timestamp: Long = System.currentTimeMillis())

    @Query("""
        SELECT s.* FROM stories s
        JOIN users u ON s.authorId = u.id
        WHERE (s.title LIKE '%' || :query || '%' OR s.genres LIKE '%' || :query || '%') 
        AND (s.genres LIKE '%' || :genre || '%' OR :genre = 'All') 
        AND s.isPublished = 1 
        AND s.authorId != :excludeAuthorId
        ORDER BY u.isVerified DESC, s.lastUpdatedAt DESC
    """)
    fun searchStoriesExcludingAuthor(query: String, genre: String, excludeAuthorId: String): Flow<List<Story>>

    @Query("SELECT * FROM users WHERE username LIKE '%' || :query || '%' AND id != :excludeUserId ORDER BY isVerified DESC")
    fun searchAuthorsExcludingSelf(query: String, excludeUserId: String): Flow<List<User>>

    @Query("SELECT * FROM stories WHERE genres LIKE '%' || :genre || '%' AND isPublished = 1")
    fun getStoriesByGenre(genre: String): Flow<List<Story>>

    @Query("SELECT * FROM stories WHERE isPublished = 1 ORDER BY lastUpdatedAt DESC")
    fun getUpdatedStories(): Flow<List<Story>>

    // ── Story Parts ───────────────────────────────────────────────────────────
    @Query("SELECT * FROM story_parts WHERE storyId = :storyId ORDER BY `order` ASC")
    fun getPartsForStory(storyId: String): Flow<List<StoryPart>>

    @Query("SELECT * FROM story_parts WHERE id = :partId")
    suspend fun getStoryPartById(partId: String): StoryPart?

    @Query("SELECT COUNT(*) FROM story_parts WHERE storyId = :storyId AND isPublished = 1")
    suspend fun getPublishedPartCount(storyId: String): Int

    @Query("SELECT * FROM story_parts WHERE storyId = :storyId AND isPublished = 1 ORDER BY `order` ASC")
    fun getPublishedPartsForStory(storyId: String): Flow<List<StoryPart>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertStoryPart(part: StoryPart)

    @Query("UPDATE stories SET lastUpdatedAt = :timestamp WHERE id = :storyId")
    suspend fun updateStoryLastUpdated(storyId: String, timestamp: Long = System.currentTimeMillis())

    @Query("DELETE FROM story_parts WHERE id = :partId")
    suspend fun deleteStoryPart(partId: String)

    // ── User Read Parts ───────────────────────────────────────────────────────
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertUserReadPart(readPart: com.example.moneypad.data.model.UserReadPart)

    @Query("SELECT * FROM user_read_parts WHERE userId = :userId")
    fun getUserReadParts(userId: String): Flow<List<com.example.moneypad.data.model.UserReadPart>>

    @Query("SELECT storyId FROM user_read_parts WHERE userId = :userId GROUP BY storyId ORDER BY MAX(readAt) DESC")
    fun getRecentlyReadStoryIds(userId: String): Flow<List<String>>

    @Query("SELECT COUNT(*) FROM user_read_parts WHERE userId = :userId AND storyId = :storyId")
    fun getReadPartsCountForStory(userId: String, storyId: String): Flow<Int>

    @Query("SELECT MAX(readAt) FROM user_read_parts WHERE userId = :userId AND storyId = :storyId")
    suspend fun getLastReadTimestamp(userId: String, storyId: String): Long?

    @Query("SELECT EXISTS(SELECT 1 FROM user_read_parts WHERE userId = :userId AND partId = :partId)")
    fun isPartRead(userId: String, partId: String): Flow<Boolean>

    @Query("SELECT EXISTS(SELECT 1 FROM user_read_parts WHERE userId = :userId AND partId = :partId)")
    suspend fun hasUserReadPart(userId: String, partId: String): Boolean


    // ── Transactions ──────────────────────────────────────────────────────────
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertTransaction(transaction: Transaction)

    @Query("SELECT * FROM transactions WHERE userId = :userId ORDER BY timestamp DESC")
    fun getTransactionsForUser(userId: String): Flow<List<Transaction>>

    // ── Reviews ───────────────────────────────────────────────────────────────
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertReview(review: Review)

    @Query("SELECT * FROM reviews WHERE storyId = :storyId ORDER BY timestamp DESC")
    fun getReviewsForStory(storyId: String): Flow<List<Review>>

    @Query("SELECT EXISTS(SELECT 1 FROM reviews WHERE storyId = :storyId AND userId = :userId)")
    fun hasUserReviewed(storyId: String, userId: String): Flow<Boolean>

    // ── Likes ────────────────────────────────────────────────────────────────
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertStoryLike(like: com.example.moneypad.data.model.UserStoryLike)

    @Query("DELETE FROM user_story_likes WHERE userId = :userId AND storyId = :storyId")
    suspend fun deleteStoryLike(userId: String, storyId: String)

    @Query("SELECT EXISTS(SELECT 1 FROM user_story_likes WHERE userId = :userId AND storyId = :storyId)")
    fun isStoryLikedByUser(userId: String, storyId: String): Flow<Boolean>

    @Query("UPDATE stories SET likes = (SELECT COUNT(*) FROM user_story_likes WHERE storyId = :storyId) WHERE id = :storyId")
    suspend fun updateStoryLikesCount(storyId: String)

    @Query("""
        UPDATE stories SET commentsCount = (
            SELECT COUNT(*) FROM part_annotations 
            WHERE partId IN (SELECT id FROM story_parts WHERE storyId = :storyId) 
            AND type = 'COMMENT'
        ) WHERE id = :storyId
    """)
    suspend fun updateStoryCommentsCount(storyId: String)

    // ── Part Annotations ──────────────────────────────────────────────────────
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertPartAnnotation(annotation: com.example.moneypad.data.model.PartAnnotation)

    @Query("SELECT * FROM part_annotations WHERE partId = :partId ORDER BY timestamp DESC")
    fun getAnnotationsForPart(partId: String): Flow<List<com.example.moneypad.data.model.PartAnnotation>>

    @Query("SELECT COUNT(*) FROM part_annotations WHERE partId = :partId AND selectedText = :selectedText AND startIndex = :startIndex AND endIndex = :endIndex AND type = 'LIKE'")
    fun getReactionCountForText(partId: String, selectedText: String, startIndex: Int, endIndex: Int): Flow<Int>

    // ── Library ───────────────────────────────────────────────────────────────
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertLibraryStory(libraryStory: com.example.moneypad.data.model.LibraryStory)

    @Query("DELETE FROM library_stories WHERE userId = :userId AND storyId = :storyId")
    suspend fun deleteLibraryStory(userId: String, storyId: String)

    @Query("SELECT * FROM stories WHERE id IN (SELECT storyId FROM library_stories WHERE userId = :userId ORDER BY downloadedAt DESC)")
    fun getLibraryStories(userId: String): Flow<List<Story>>

    @Query("SELECT COUNT(*) FROM library_stories WHERE userId = :userId")
    fun getLibraryStoryCount(userId: String): Flow<Int>

    @Query("SELECT EXISTS(SELECT 1 FROM library_stories WHERE userId = :userId AND storyId = :storyId)")
    fun isStoryInLibrary(userId: String, storyId: String): Flow<Boolean>

    // ── Reading Lists ─────────────────────────────────────────────────────────

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertReadingList(readingList: com.example.moneypad.data.model.ReadingList)

    @Query("DELETE FROM reading_lists WHERE id = :listId")
    suspend fun deleteReadingList(listId: String)

    @Query("SELECT * FROM reading_lists WHERE userId = :userId ORDER BY createdAt DESC")
    fun getReadingListsForUser(userId: String): Flow<List<com.example.moneypad.data.model.ReadingList>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertReadingListStory(readingListStory: com.example.moneypad.data.model.ReadingListStory)

    @Query("DELETE FROM reading_list_stories WHERE listId = :listId AND storyId = :storyId")
    suspend fun deleteReadingListStory(listId: String, storyId: String)

    @Query("SELECT * FROM stories WHERE id IN (SELECT storyId FROM reading_list_stories WHERE listId = :listId ORDER BY addedAt DESC)")
    fun getStoriesForReadingList(listId: String): Flow<List<Story>>

    @Query("SELECT EXISTS(SELECT 1 FROM reading_list_stories WHERE listId = :listId AND storyId = :storyId)")
    suspend fun isStoryInReadingList(listId: String, storyId: String): Boolean
}
