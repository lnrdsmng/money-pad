package com.example.moneypad.data

import android.content.Context
import android.net.Uri
import com.example.moneypad.data.dao.MoneyPadDao
import com.example.moneypad.data.model.*
import com.example.moneypad.data.remote.RetrofitClient
import com.example.moneypad.utils.ImageUtils
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.firstOrNull
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import java.io.File
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.format.DateTimeParseException
import java.util.UUID
import org.json.JSONObject

private const val SESSION_DURATION_MS = 7L * 24 * 60 * 60 * 1000 // 7 days
private const val MINIMUM_ONBOARDING_AGE = 16
private const val MAX_PREFERRED_GENRES = 5
private const val WATCH_AD_REWARD_COINS = 0.02

private val DEFAULT_STORY_GENRES = listOf(
    "Romance", "Fantasy", "Mystery", "Sci-Fi", "Horror",
    "Action", "LGBTQIA+", "Werewolf", "New Adult", "Short Story",
    "Teen Fiction", "Historical Fiction", "Paranormal", "Humor",
    "Contemporary Lit", "Diverse Lit", "Thriller", "Adventure",
    "Fan Fiction", "Non-Fiction", "Poetry"
)

class MoneyPadRepository(private val context: Context, private val dao: MoneyPadDao) {

    private val sharedPreferences = context.getSharedPreferences("moneypad_prefs", Context.MODE_PRIVATE)
    private val api = RetrofitClient.apiService
    private val repositoryScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private val referralCoinsOverrides = kotlinx.coroutines.flow.MutableStateFlow<Map<String, Int>>(emptyMap())
    private val referralAuthorWithdrawalOverrides = kotlinx.coroutines.flow.MutableStateFlow<Map<String, Double>>(emptyMap())

    var currentUserId: String = sharedPreferences.getString("userId", "") ?: ""
    var currentUsername: String = sharedPreferences.getString("username", "") ?: ""

    private fun parseErrorMessage(errorBody: String?, defaultMessage: String): String {
        if (errorBody.isNullOrBlank()) return defaultMessage
        return try {
            JSONObject(errorBody).getString("error")
        } catch (e: Exception) {
            errorBody
        }
    }

    companion object {
        const val OFFICIAL_USER_ID = "moneypad_official_id"
        const val OFFICIAL_USERNAME = "moneypad"
        const val OFFICIAL_EMAIL = "moneypad@moneypad.com"
        const val OFFICIAL_PASSWORD = "@Moneypad3014"
        const val MIN_PUBLISHED_PARTS_TO_PUBLISH_STORY = 1
    }

    /** Returns true if there is an active (< 7 days old) saved session */
    fun hasActiveSession(): Boolean {
        if (currentUserId.isEmpty()) return false
        val ts = sharedPreferences.getLong("loginTimestamp", 0L)
        return (System.currentTimeMillis() - ts) < SESSION_DURATION_MS
    }

    private fun saveLoginState(userId: String, username: String) {
        val now = System.currentTimeMillis()
        sharedPreferences.edit()
            .putString("userId", userId)
            .putString("username", username)
            .putLong("loginTimestamp", now)
            .apply()
    }

    private fun clearLoginState() {
        sharedPreferences.edit()
            .remove("userId")
            .remove("username")
            .remove("loginTimestamp")
            .apply()
    }

    private suspend fun ensureOfficialUserExists() {
        val existing = dao.getUser(OFFICIAL_USER_ID).firstOrNull()
        if (existing == null) {
            val officialUser = User(
                id = OFFICIAL_USER_ID,
                username = OFFICIAL_USERNAME,
                email = OFFICIAL_EMAIL,
                password = OFFICIAL_PASSWORD,
                bio = "Official Money Pad Account",
                onboardingCompleted = true,
                onboardingStep = 3,
                isVerified = true
            )
            dao.insertUser(officialUser)
        }
    }

    // ── Notifications ────────────────────────────────────────────────────────

    fun getNotifications(): Flow<List<Notification>> {
        if (currentUserId.isNotEmpty()) {
            repositoryScope.launch {
                try {
                    val response = api.getNotifications(currentUserId)
                    if (response.isSuccessful && response.body() != null) {
                        response.body()?.forEach { dao.insertNotification(it) }
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
        }
        return dao.getNotificationsForUser(currentUserId)
    }

    fun getUnreadNotificationCount(): Flow<Int> {
        if (currentUserId.isNotEmpty()) {
            repositoryScope.launch {
                try {
                    val response = api.getNotifications(currentUserId)
                    if (response.isSuccessful && response.body() != null) {
                        response.body()?.forEach { dao.insertNotification(it) }
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
        }
        return dao.getUnreadNotificationCount(currentUserId)
    }

    suspend fun markNotificationAsRead(notificationId: String) {
        try {
            api.markNotificationAsRead(mapOf("notificationId" to notificationId))
        } catch (e: Exception) {
            e.printStackTrace()
        }
        dao.markNotificationAsRead(notificationId)
    }

    suspend fun markAllNotificationsAsRead() {
        try {
            api.markAllNotificationsAsRead(mapOf("userId" to currentUserId))
        } catch (e: Exception) {
            e.printStackTrace()
        }
        dao.markAllNotificationsAsRead(currentUserId)
    }

    // ── Auth ──────────────────────────────────────────────────────────────────

    suspend fun isUsernameTaken(username: String): Boolean {
        return try {
            val response = api.checkUsername(mapOf("username" to username))
            response.body()?.get("taken") ?: (dao.getUserByUsername(username) != null)
        } catch (e: Exception) {
            dao.getUserByUsername(username) != null
        }
    }

    suspend fun isEmailTaken(email: String): Boolean {
        return try {
            val response = api.checkEmail(mapOf("email" to email))
            response.body()?.get("taken") ?: (dao.getUserByEmail(email) != null)
        } catch (e: Exception) {
            dao.getUserByEmail(email) != null
        }
    }

    suspend fun signup(
        username: String,
        email: String,
        password: String,
        referrerUsername: String = ""
    ): Result<User> {
        return try {
            val response = api.signup(
                mapOf(
                    "username" to username,
                    "email" to email,
                    "password" to password,
                    "referrerUsername" to referrerUsername
                )
            )
            if (response.isSuccessful && response.body() != null) {
                val user = response.body()!!
                dao.insertUser(user)
                
                // Auto-create local follow to match PHP side local state
                dao.insertFollow(Follow(user.id, OFFICIAL_USER_ID))
                dao.updateFollowing(user.id, 1)
                
                Result.success(user)
            } else {
                val errorMsg = parseErrorMessage(response.errorBody()?.string(), "Signup failed")
                Result.failure(Exception(errorMsg))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun updateReferrer(referrerUsername: String): Result<Unit> {
        return try {
            val response = api.updateSettings(
                mapOf(
                    "userId" to currentUserId,
                    "username" to currentUsername,
                    "referredBy" to referrerUsername
                )
            )
            if (response.isSuccessful) {
                dao.updateReferrer(currentUserId, referrerUsername)
                dao.incrementReferralCount(referrerUsername)
                Result.success(Unit)
            } else {
                Result.failure(Exception(parseErrorMessage(response.errorBody()?.string(), "Referral update failed")))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun claimReferralReward() {
        if (currentUserId.isNotEmpty()) {
            try {
                val response = api.claimReferralReward(mapOf("userId" to currentUserId))
                if (response.isSuccessful) {
                    val user = dao.getUser(currentUserId).firstOrNull() ?: return
                    if (user.isReferralRewardClaimed) return

                    var referrerId: String? = null

                    if (user.referredBy.isNotBlank()) {
                        val referrer = dao.getUserByUsername(user.referredBy)
                        if (referrer != null) {
                            referrerId = referrer.id
                        }
                    }

                    dao.claimReferralRewardTransaction(
                        userId = currentUserId,
                        amount = 10.0,
                        referrerId = referrerId,
                        notification = null
                    )
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    fun logout() {
        currentUserId = ""
        currentUsername = ""
        clearLoginState()
    }

    suspend fun login(identifier: String, password: String): Result<User> {
        return try {
            val response = api.login(mapOf("identifier" to identifier, "password" to password))
            if (response.isSuccessful && response.body() != null) {
                val user = response.body()!!
                currentUserId = user.id
                currentUsername = user.username
                dao.insertUser(user)
                saveLoginState(currentUserId, currentUsername)
                Result.success(user)
            } else {
                val errorMsg = parseErrorMessage(response.errorBody()?.string(), "Invalid username or password")
                Result.failure(Exception(errorMsg))
            }
        } catch (e: Exception) {
            val user = dao.login(identifier, password)
            if (user != null) {
                currentUserId = user.id
                currentUsername = user.username
                val now = System.currentTimeMillis()
                dao.updateLoginTimestamp(user.id, now)
                saveLoginState(currentUserId, currentUsername)
                Result.success(user)
            } else {
                Result.failure(Exception("Network unavailable and credentials not cached."))
            }
        }
    }

    @OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)
    fun getUser(userId: String): Flow<User?> {
        if (userId.isNotEmpty()) {
            repositoryScope.launch {
                try {
                    val response = api.getUser(userId)
                    if (response.isSuccessful && response.body() != null) {
                        dao.insertUser(response.body()!!)
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
        }
        return dao.getUser(userId).flatMapLatest { user ->
            if (user != null) flowOf(user)
            else dao.getUserByUsernameFlow(userId)
        }
    }

    fun getCurrentUser(): Flow<User?> = getUser(currentUserId)

    suspend fun initUser() {
        ensureOfficialUserExists()
        if (currentUserId.isNotEmpty() && !hasActiveSession()) {
            logout()
        } else if (currentUserId.isNotEmpty()) {
            try {
                val response = api.getUser(currentUserId)
                if (response.isSuccessful && response.body() != null) {
                    dao.insertUser(response.body()!!)
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    suspend fun earnReaderCoins(amount: Int) {
        if (currentUserId.isNotEmpty()) {
            try {
                api.updateAdFree(UpdateAdFreeRequest(userId = currentUserId, coinsDelta = amount))
            } catch (e: Exception) {
                e.printStackTrace()
            }
            dao.updateReaderCoins(currentUserId, amount.toDouble())
        }
    }

    suspend fun recordRewardedAdWatch(): Boolean {
        if (currentUserId.isEmpty()) return false

        val eventId = UUID.randomUUID().toString()
        val watchedAt = System.currentTimeMillis()
        return try {
            val response = api.recordAdWatch(
                RecordAdWatchRequest(
                    id = eventId,
                    userId = currentUserId,
                    watchedAt = watchedAt
                )
            )

            if (response.isSuccessful) {
                dao.updateReaderCoins(currentUserId, WATCH_AD_REWARD_COINS)
                true
            } else {
                false
            }
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    // ── Settings ──────────────────────────────────────────────────────────────

    suspend fun updateSettings(
        username: String,
        birthday: String,
        gender: String,
        preferredGenres: String
    ): Result<Unit> {
        return try {
            val response = api.updateSettings(
                mapOf(
                    "userId" to currentUserId,
                    "username" to username,
                    "birthday" to birthday,
                    "gender" to gender,
                    "preferredGenres" to preferredGenres
                )
            )
            if (response.isSuccessful) {
                dao.updateUserSettings(currentUserId, username, birthday, gender, preferredGenres)
                currentUsername = username
                sharedPreferences.edit().putString("username", username).apply()

                val user = dao.getUser(currentUserId).firstOrNull() ?: return Result.success(Unit)
                dao.updateConversationsSyncInfo(currentUserId, username, user.profileImageUrl, user.isVerified)
                dao.updateNotificationsSyncInfo(currentUserId, username, user.profileImageUrl, user.isVerified)
                dao.updateReviewsSyncInfo(currentUserId, username, user.profileImageUrl, user.isVerified)
                dao.updatePartAnnotationsSyncInfo(currentUserId, username, user.isVerified)
                dao.updateStoriesSyncInfo(currentUserId, username, user.isVerified)
                
                Result.success(Unit)
            } else {
                Result.failure(Exception(parseErrorMessage(response.errorBody()?.string(), "Update settings failed")))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    fun getAvailableGenres(): Flow<List<String>> {
        repositoryScope.launch {
            try {
                val response = api.getAvailableGenres()
                if (response.isSuccessful && response.body() != null) {
                    // Handled automatically via local aggregation if stories sync
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
        return dao.getAllStoryGenres().map { genreRows ->
            val discovered = genreRows
                .flatMap { row -> row.split(",") }
                .map { it.trim() }
                .filter { it.isNotBlank() }
                .distinct()
                .sorted()

            (discovered + DEFAULT_STORY_GENRES).distinct()
        }
    }

    suspend fun saveOnboardingGender(gender: String): Result<Unit> {
        val normalizedGender = gender.trim()
        val validGenders = setOf("Male", "Female", "Others")
        if (normalizedGender !in validGenders) {
            return Result.failure(Exception("Choose a gender to continue"))
        }

        return try {
            val response = api.onboardingGender(mapOf("userId" to currentUserId, "gender" to normalizedGender))
            if (response.isSuccessful) {
                dao.updateOnboardingGender(currentUserId, normalizedGender)
                Result.success(Unit)
            } else {
                Result.failure(Exception(parseErrorMessage(response.errorBody()?.string(), "Gender update failed")))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun saveOnboardingBirthday(birthday: String): Result<Unit> {
        if (birthday.isBlank()) {
            return Result.failure(Exception("Choose your birthday to continue"))
        }

        val birthDate = try {
            LocalDate.parse(birthday, DateTimeFormatter.ISO_LOCAL_DATE)
        } catch (_: DateTimeParseException) {
            return Result.failure(Exception("Enter a valid birthday"))
        }

        val minimumBirthDate = LocalDate.now().minusYears(MINIMUM_ONBOARDING_AGE.toLong())
        if (birthDate.isAfter(minimumBirthDate)) {
            return Result.failure(Exception("You must be at least 16 years old"))
        }

        return try {
            val response = api.onboardingBirthday(mapOf("userId" to currentUserId, "birthday" to birthday))
            if (response.isSuccessful) {
                dao.updateOnboardingBirthday(currentUserId, birthday)
                Result.success(Unit)
            } else {
                Result.failure(Exception(parseErrorMessage(response.errorBody()?.string(), "Birthday update failed")))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun saveOnboardingGenres(genres: List<String>): Result<Unit> {
        val selectedGenres = genres.map { it.trim() }.filter { it.isNotBlank() }.distinct()
        if (selectedGenres.size > MAX_PREFERRED_GENRES) {
            return Result.failure(Exception("Choose up to 5 genres"))
        }

        return try {
            val response = api.onboardingGenres(mapOf("userId" to currentUserId, "genres" to selectedGenres.joinToString(",")))
            if (response.isSuccessful) {
                dao.updatePreferredGenres(currentUserId, selectedGenres.joinToString(","))
                Result.success(Unit)
            } else {
                Result.failure(Exception(parseErrorMessage(response.errorBody()?.string(), "Genres update failed")))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun completeOnboarding(genres: List<String>): Result<Unit> {
        val genreResult = saveOnboardingGenres(genres)
        if (genreResult.isFailure) return genreResult

        val user = dao.getUserByUsername(currentUsername)
            ?: return Result.failure(Exception("User session expired"))
        if (user.gender.isBlank()) {
            dao.updateOnboardingStep(currentUserId, 1)
            return Result.failure(Exception("Choose a gender to continue"))
        }
        val birthdayResult = saveOnboardingBirthday(user.birthday)
        if (birthdayResult.isFailure) {
            dao.updateOnboardingStep(currentUserId, 2)
            return birthdayResult
        }

        return try {
            val response = api.completeOnboarding(mapOf("userId" to currentUserId))
            if (response.isSuccessful) {
                dao.markOnboardingCompleted(currentUserId)
                Result.success(Unit)
            } else {
                Result.failure(Exception(parseErrorMessage(response.errorBody()?.string(), "Failed to complete onboarding")))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun changePassword(currentPassword: String, newPassword: String): Result<Unit> {
        return try {
            val response = api.changePassword(
                mapOf(
                    "userId" to currentUserId,
                    "currentPassword" to currentPassword,
                    "newPassword" to newPassword
                )
            )
            if (response.isSuccessful) {
                dao.updatePassword(currentUserId, newPassword)
                Result.success(Unit)
            } else {
                Result.failure(Exception(parseErrorMessage(response.errorBody()?.string(), "Failed to change password")))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun uploadImage(file: File): Result<String> {
        return try {
            val requestFile = file.asRequestBody("image/*".toMediaTypeOrNull())
            val body = MultipartBody.Part.createFormData("image", file.name, requestFile)
            val response = api.uploadImage(body)
            if (response.isSuccessful && response.body() != null) {
                val url = response.body()!!["url"]
                if (url != null) {
                    Result.success(url)
                } else {
                    Result.failure(Exception("Upload response missing url"))
                }
            } else {
                Result.failure(Exception("Upload failed: ${response.message()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    private fun isLocalUri(uriString: String): Boolean {
        return uriString.startsWith("content://") || 
               uriString.startsWith("file://") || 
               uriString.startsWith("/")
    }

    private fun getFileFromUriString(uriString: String): File? {
        return try {
            val cleanUri = if (uriString.startsWith("/")) {
                Uri.fromFile(File(uriString))
            } else {
                Uri.parse(uriString)
            }
            val localPath = ImageUtils.saveImageToInternalStorage(context, cleanUri)
            if (localPath != null) File(localPath) else null
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    // ── Profile ───────────────────────────────────────────────────────────────

    suspend fun updateUserProfile(bio: String, profileImageUrl: String?, coverImageUrl: String?) {
        var finalProfileUrl = profileImageUrl
        var finalCoverUrl = coverImageUrl

        if (profileImageUrl != null && isLocalUri(profileImageUrl)) {
            val file = getFileFromUriString(profileImageUrl)
            if (file != null) {
                val uploadResult = uploadImage(file)
                file.delete()
                if (uploadResult.isSuccess) {
                    finalProfileUrl = uploadResult.getOrNull()
                }
            }
        }

        if (coverImageUrl != null && isLocalUri(coverImageUrl)) {
            val file = getFileFromUriString(coverImageUrl)
            if (file != null) {
                val uploadResult = uploadImage(file)
                file.delete()
                if (uploadResult.isSuccess) {
                    finalCoverUrl = uploadResult.getOrNull()
                }
            }
        }

        try {
            api.updateProfile(
                mapOf(
                    "userId" to currentUserId,
                    "bio" to bio,
                    "profileImageUrl" to finalProfileUrl,
                    "coverImageUrl" to finalCoverUrl
                )
            )
        } catch (e: Exception) {
            e.printStackTrace()
        }
        dao.updateUserProfile(currentUserId, bio, finalProfileUrl, finalCoverUrl)
        
        val user = dao.getUser(currentUserId).firstOrNull() ?: return
        dao.updateConversationsSyncInfo(currentUserId, user.username, finalProfileUrl, user.isVerified)
        dao.updateNotificationsSyncInfo(currentUserId, user.username, finalProfileUrl, user.isVerified)
        dao.updateReviewsSyncInfo(currentUserId, user.username, finalProfileUrl, user.isVerified)
        dao.updatePartAnnotationsSyncInfo(currentUserId, user.username, user.isVerified)
        dao.updateStoriesSyncInfo(currentUserId, user.username, user.isVerified)
    }

    // ── Social ────────────────────────────────────────────────────────────────

    fun getFollowers(userId: String): Flow<List<User>> {
        if (userId.isNotEmpty()) {
            repositoryScope.launch {
                try {
                    val response = api.getFollowers(userId)
                    if (response.isSuccessful && response.body() != null) {
                        response.body()?.forEach {
                            dao.insertUser(it)
                            dao.insertFollow(Follow(followerId = it.id, followedId = userId))
                        }
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
        }
        return dao.getFollowers(userId)
    }

    fun getFollowing(userId: String): Flow<List<User>> {
        if (userId.isNotEmpty()) {
            repositoryScope.launch {
                try {
                    val response = api.getFollowing(userId)
                    if (response.isSuccessful && response.body() != null) {
                        response.body()?.forEach {
                            dao.insertUser(it)
                            dao.insertFollow(Follow(followerId = userId, followedId = it.id))
                        }
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
        }
        return dao.getFollowing(userId)
    }

    suspend fun followUser(followedId: String) {
        try {
            api.followUser(mapOf("followerId" to currentUserId, "followedId" to followedId))
        } catch (e: Exception) {
            e.printStackTrace()
        }
        dao.insertFollow(Follow(currentUserId, followedId))
        dao.updateFollowing(currentUserId, 1)
        dao.updateFollowers(followedId, 1)
    }

    suspend fun unfollowUser(followedId: String) {
        if (followedId == OFFICIAL_USER_ID) return // Cannot unfollow official account
        try {
            api.unfollowUser(mapOf("followerId" to currentUserId, "followedId" to followedId))
        } catch (e: Exception) {
            e.printStackTrace()
        }
        dao.deleteFollow(currentUserId, followedId)
        dao.updateFollowing(currentUserId, -1)
        dao.updateFollowers(followedId, -1)
    }

    fun isFollowing(followedId: String): Flow<Boolean> {
        if (currentUserId.isNotEmpty() && followedId.isNotEmpty()) {
            repositoryScope.launch {
                try {
                    val response = api.isFollowing(currentUserId, followedId)
                    if (response.isSuccessful) {
                        val following = response.body()?.get("following") ?: false
                        if (following) {
                            dao.insertFollow(Follow(currentUserId, followedId))
                        } else {
                            dao.deleteFollow(currentUserId, followedId)
                        }
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
        }
        return dao.isFollowing(currentUserId, followedId)
    }

    // ── Stories ───────────────────────────────────────────────────────────────

    fun getAllStories(): Flow<List<Story>> {
        repositoryScope.launch {
            try {
                val response = api.getAllStories()
                if (response.isSuccessful && response.body() != null) {
                    response.body()?.forEach { dao.insertStory(it) }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
        return dao.getAllStories()
    }

    fun getPublishedStoriesByAuthor(authorId: String): Flow<List<Story>> {
        if (authorId.isNotEmpty()) {
            repositoryScope.launch {
                try {
                    val response = api.getPublishedStoriesByAuthor(authorId)
                    if (response.isSuccessful && response.body() != null) {
                        response.body()?.forEach { dao.insertStory(it) }
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
        }
        return dao.getPublishedStoriesByAuthor(authorId)
    }

    fun getDraftStoriesByAuthor(authorId: String): Flow<List<Story>> {
        if (authorId.isNotEmpty()) {
            repositoryScope.launch {
                try {
                    val response = api.getDraftStoriesByAuthor(authorId)
                    if (response.isSuccessful && response.body() != null) {
                        response.body()?.forEach { dao.insertStory(it) }
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
        }
        return dao.getDraftStoriesByAuthor(authorId)
    }

    suspend fun getStoryById(storyId: String): Story? {
        if (storyId.isNotEmpty()) {
            try {
                val response = api.getStoryById(storyId)
                if (response.isSuccessful && response.body() != null) {
                    dao.insertStory(response.body()!!)
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
        return dao.getStoryById(storyId)
    }

    fun getStoryByIdFlow(storyId: String): Flow<Story?> {
        if (storyId.isNotEmpty()) {
            repositoryScope.launch {
                try {
                    val response = api.getStoryById(storyId)
                    if (response.isSuccessful && response.body() != null) {
                        dao.insertStory(response.body()!!)
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
        }
        return dao.getStoryByIdFlow(storyId)
    }

    suspend fun createStory(
        title: String, genres: String, overview: String, coverImageUrl: String?,
        isPublished: Boolean = false, isCompleted: Boolean = false, isMature: Boolean = false
    ) {
        val storyId = UUID.randomUUID().toString()
        val currentUser = dao.getUser(currentUserId).firstOrNull()

        var finalCoverUrl = coverImageUrl
        if (coverImageUrl != null && isLocalUri(coverImageUrl)) {
            val file = getFileFromUriString(coverImageUrl)
            if (file != null) {
                val uploadResult = uploadImage(file)
                file.delete()
                if (uploadResult.isSuccess) {
                    finalCoverUrl = uploadResult.getOrNull()
                }
            }
        }

        val story = Story(
            id = storyId,
            authorId = currentUserId, authorName = currentUsername,
            title = title, genres = genres, overview = overview,
            coverImageUrl = finalCoverUrl,
            isPublished = isPublished, isCompleted = isCompleted, isMature = isMature,
            isAuthorVerified = currentUser?.isVerified == true || currentUserId == OFFICIAL_USER_ID
        )

        try {
            api.createStory(story)
        } catch (e: Exception) {
            e.printStackTrace()
        }
        dao.insertStory(story)
    }

    suspend fun createStoryAndReturnId(
        title: String, genres: String, overview: String, coverImageUrl: String?,
        isPublished: Boolean = false, isCompleted: Boolean = false, isMature: Boolean = false
    ): String {
        val id = UUID.randomUUID().toString()
        val currentUser = dao.getUser(currentUserId).firstOrNull()

        var finalCoverUrl = coverImageUrl
        if (coverImageUrl != null && isLocalUri(coverImageUrl)) {
            val file = getFileFromUriString(coverImageUrl)
            if (file != null) {
                val uploadResult = uploadImage(file)
                file.delete()
                if (uploadResult.isSuccess) {
                    finalCoverUrl = uploadResult.getOrNull()
                }
            }
        }

        val story = Story(
            id = id,
            authorId = currentUserId, authorName = currentUsername,
            title = title, genres = genres, overview = overview,
            coverImageUrl = finalCoverUrl,
            isPublished = isPublished, isCompleted = isCompleted, isMature = isMature,
            lastUpdatedAt = System.currentTimeMillis(),
            isAuthorVerified = currentUser?.isVerified == true || currentUserId == OFFICIAL_USER_ID
        )

        try {
            api.createStory(story)
        } catch (e: Exception) {
            e.printStackTrace()
        }
        dao.insertStory(story)
        return id
    }

    suspend fun publishStory(storyId: String): Boolean {
        val story = dao.getStoryById(storyId)
        if (story == null || story.isPublished || !canPublishStory(storyId)) {
            return false
        }
        val now = System.currentTimeMillis()
        try {
            api.publishStory(PublishStoryRequest(storyId, now))
        } catch (e: Exception) {
            e.printStackTrace()
        }
        dao.publishStory(storyId, now)
        return true
    }

    suspend fun unpublishStory(storyId: String) {
        val now = System.currentTimeMillis()
        try {
            api.unpublishStory(PublishStoryRequest(storyId, now))
        } catch (e: Exception) {
            e.printStackTrace()
        }
        dao.unpublishStory(storyId, now)
    }

    suspend fun updateStory(story: Story) {
        var finalCoverUrl = story.coverImageUrl
        if (story.coverImageUrl != null && isLocalUri(story.coverImageUrl)) {
            val file = getFileFromUriString(story.coverImageUrl)
            if (file != null) {
                val uploadResult = uploadImage(file)
                file.delete()
                if (uploadResult.isSuccess) {
                    finalCoverUrl = uploadResult.getOrNull()
                }
            }
        }

        val currentUser = dao.getUser(currentUserId).firstOrNull()
        val updatedStory = story.copy(
            coverImageUrl = finalCoverUrl,
            isAuthorVerified = currentUser?.isVerified == true || currentUserId == OFFICIAL_USER_ID
        )
        try {
            api.updateStory(updatedStory)
        } catch (e: Exception) {
            e.printStackTrace()
        }
        dao.insertStory(updatedStory)
    }

    suspend fun deleteStory(storyId: String) {
        try {
            api.deleteStory(mapOf("storyId" to storyId))
        } catch (e: Exception) {
            e.printStackTrace()
        }
        dao.deleteStory(storyId)
        dao.deleteStoryParts(storyId)
    }

    fun getStoriesByGenre(genre: String): Flow<List<Story>> {
        // Handled dynamically via Room triggers and general feed syncing
        return dao.getStoriesByGenre(genre)
    }

    fun getUpdatedStories(): Flow<List<Story>> = dao.getUpdatedStories()

    fun getRecentlyReadStoryIds(): Flow<List<String>> = dao.getRecentlyReadStoryIds(currentUserId)

    fun getReadPartsCount(storyId: String): Flow<Int> = dao.getReadPartsCountForStory(currentUserId, storyId)

    suspend fun addStoryPart(
        storyId: String, title: String, content: String, order: Int,
        partId: String? = null, isPublished: Boolean = false, headerImageUrl: String? = null
    ): String {
        val now = System.currentTimeMillis()
        val id = partId ?: UUID.randomUUID().toString()
        val oldPart = dao.getStoryPartById(id)

        var finalHeaderUrl = headerImageUrl
        if (headerImageUrl != null && isLocalUri(headerImageUrl)) {
            val file = getFileFromUriString(headerImageUrl)
            if (file != null) {
                val uploadResult = uploadImage(file)
                file.delete()
                if (uploadResult.isSuccess) {
                    finalHeaderUrl = uploadResult.getOrNull()
                }
            }
        }

        val part = StoryPart(
            id = id,
            storyId = storyId, title = title, content = content, order = oldPart?.order ?: order,
            publishedAt = getPublishedAtForSave(oldPart, isPublished, now),
            isPublished = isPublished,
            readCount = oldPart?.readCount ?: 0,
            headerImageUrl = finalHeaderUrl
        )

        try {
            api.addStoryPart(part)
        } catch (e: Exception) {
            e.printStackTrace()
        }
        dao.insertStoryPart(part)

        if (isPublished) {
            val story = dao.getStoryById(storyId)
            if (story != null) {
                if (!story.isPublished && canPublishStory(storyId)) {
                    try {
                        api.publishStory(PublishStoryRequest(storyId, now))
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                    dao.publishStory(storyId, now)
                } else {
                    dao.updateStoryLastUpdated(storyId, now)
                }
            }
        } else {
            unpublishStoryIfBelowMinimum(storyId, now)
        }
        return id
    }

    suspend fun updateStoryPart(
        partId: String, storyId: String, title: String, content: String,
        order: Int, isPublished: Boolean, headerImageUrl: String? = null
    ) {
        val now = System.currentTimeMillis()
        val oldPart = dao.getStoryPartById(partId)

        var finalHeaderUrl = headerImageUrl
        if (headerImageUrl != null && isLocalUri(headerImageUrl)) {
            val file = getFileFromUriString(headerImageUrl)
            if (file != null) {
                val uploadResult = uploadImage(file)
                file.delete()
                if (uploadResult.isSuccess) {
                    finalHeaderUrl = uploadResult.getOrNull()
                }
            }
        }

        val part = StoryPart(
            id = partId,
            storyId = storyId,
            title = title,
            content = content,
            order = oldPart?.order ?: order,
            publishedAt = getPublishedAtForSave(oldPart, isPublished, now),
            isPublished = isPublished,
            readCount = oldPart?.readCount ?: 0,
            headerImageUrl = finalHeaderUrl
        )

        try {
            api.updateStoryPart(part)
        } catch (e: Exception) {
            e.printStackTrace()
        }
        dao.insertStoryPart(part)

        if (isPublished) {
            val story = dao.getStoryById(storyId)
            if (story != null) {
                if (!story.isPublished && canPublishStory(storyId)) {
                    try {
                        api.publishStory(PublishStoryRequest(storyId, now))
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                    dao.publishStory(storyId, now)
                } else if (oldPart == null || !oldPart.isPublished) {
                    dao.updateStoryLastUpdated(storyId, now)
                }
            }
        } else {
            unpublishStoryIfBelowMinimum(storyId, now)
        }
    }

    suspend fun deleteStoryPart(partId: String) {
        val part = dao.getStoryPartById(partId)
        if (part != null) {
            try {
                api.deleteStoryPart(mapOf("partId" to partId))
            } catch (e: Exception) {
                e.printStackTrace()
            }
            dao.deleteStoryPart(partId)
            unpublishStoryIfBelowMinimum(part.storyId, System.currentTimeMillis())
        }
    }

    private suspend fun canPublishStory(storyId: String): Boolean =
        dao.getPublishedPartCount(storyId) >= MIN_PUBLISHED_PARTS_TO_PUBLISH_STORY

    private fun getPublishedAtForSave(oldPart: StoryPart?, isPublished: Boolean, now: Long): Long =
        if (isPublished && oldPart?.isPublished == true) oldPart.publishedAt else now

    private suspend fun unpublishStoryIfBelowMinimum(storyId: String, timestamp: Long) {
        if (!canPublishStory(storyId)) {
            try {
                api.unpublishStory(PublishStoryRequest(storyId, timestamp))
            } catch (e: Exception) {
                e.printStackTrace()
            }
            dao.unpublishStory(storyId, timestamp)
        }
    }

    fun getPartsForStory(storyId: String): Flow<List<StoryPart>> {
        repositoryScope.launch {
            try {
                val response = api.getPartsForStory(storyId, onlyPublished = false)
                if (response.isSuccessful && response.body() != null) {
                    response.body()?.forEach { dao.insertStoryPart(it) }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
        return dao.getPartsForStory(storyId)
    }

    fun getPublishedPartsForStory(storyId: String): Flow<List<StoryPart>> {
        repositoryScope.launch {
            try {
                val response = api.getPartsForStory(storyId, onlyPublished = true)
                if (response.isSuccessful && response.body() != null) {
                    response.body()?.forEach { dao.insertStoryPart(it) }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
        return dao.getPublishedPartsForStory(storyId)
    }

    suspend fun recordRead(storyId: String) {
        try {
            api.recordRead(mapOf("userId" to currentUserId, "storyId" to storyId))
        } catch (e: Exception) {
            e.printStackTrace()
        }

        val story = dao.getStoryById(storyId) ?: return
        val lastRead = dao.getLastReadTimestamp(currentUserId, storyId)
        val now = System.currentTimeMillis()
        val isAuthor = currentUserId == story.authorId

        if (isAuthor || lastRead == null || (now - lastRead > 30 * 60 * 1000)) {
            if (lastRead == null) {
                dao.incrementUniqueViews(storyId)
            } else {
                dao.incrementRepeatedViews(storyId)
            }
            dao.incrementReadCount(storyId)

            if (!isAuthor && lastRead == null) {
                val author = dao.getUser(story.authorId).firstOrNull()
                val rate = if (author?.isVerified == true) 0.001 else 0.0006
                dao.updateAuthorIncome(story.authorId, rate)
            }
        }
    }

    suspend fun countQualifyingStories(userId: String): Int = dao.countQualifyingStories(userId)

    suspend fun verifyUser(userId: String) {
        try {
            api.verifyUser(mapOf("userId" to userId))
        } catch (e: Exception) {
            e.printStackTrace()
        }
        dao.verifyUser(userId)
        
        val user = dao.getUser(userId).firstOrNull() ?: return
        dao.updateConversationsSyncInfo(userId, user.username, user.profileImageUrl, true)
        dao.updateNotificationsSyncInfo(userId, user.username, user.profileImageUrl, true)
        dao.updateReviewsSyncInfo(userId, user.username, user.profileImageUrl, true)
        dao.updatePartAnnotationsSyncInfo(userId, user.username, true)
        dao.updateStoriesSyncInfo(userId, user.username, true)
    }

    suspend fun upgradeToAdFree90Min(): Boolean {
        if (currentUserId.isEmpty()) return false
        val user = dao.getUser(currentUserId).firstOrNull() ?: return false
        if (user.readerCoins < 500) return false
        
        val ninetyMinFromNow = System.currentTimeMillis() + (90 * 60 * 1000)
        try {
            api.updateAdFree(UpdateAdFreeRequest(userId = currentUserId, timestamp = ninetyMinFromNow, permanent = false))
        } catch (e: Exception) {
            e.printStackTrace()
        }
        dao.deductReaderCoins(currentUserId, 500.0)
        dao.updateAdFreeUntil(currentUserId, ninetyMinFromNow)
        return true
    }

    suspend fun upgradeToAdFreePermanent(): Boolean {
        if (currentUserId.isEmpty()) return false
        val user = dao.getUser(currentUserId).firstOrNull() ?: return false
        if (user.balance < 1499.0) return false

        var apiSuccess = false
        try {
            val response = api.updateAdFree(UpdateAdFreeRequest(userId = currentUserId, timestamp = 0, permanent = true))
            if (response.isSuccessful && response.body()?.get("success") == true) {
                apiSuccess = true
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }

        if (!apiSuccess) return false

        val now = System.currentTimeMillis()
        val transactionId = UUID.randomUUID().toString()

        dao.deductBalance(currentUserId, 1499.0)
        dao.markAdFreePermanently(currentUserId)
        dao.insertTransaction(
            Transaction(
                id = transactionId,
                userId = currentUserId,
                amount = 1499.0,
                method = "Ad-Free Upgrade",
                accountInfo = "Permanent",
                source = "REFERRAL",
                timestamp = now,
                status = "Completed"
            )
        )
        return true
    }

    suspend fun recordPartRead(storyId: String, partId: String) {
        if (currentUserId.isEmpty()) return
        try {
            api.recordPartRead(mapOf("userId" to currentUserId, "storyId" to storyId, "partId" to partId))
        } catch (e: Exception) {
            e.printStackTrace()
        }
        val wasAlreadyRead = dao.hasUserReadPart(currentUserId, partId)
        if (!wasAlreadyRead) {
            dao.incrementPartReadCount(partId)
        }
        dao.insertUserReadPart(
            UserReadPart(
                userId = currentUserId,
                partId = partId,
                storyId = storyId,
                readAt = System.currentTimeMillis()
            )
        )
    }

    suspend fun recordPartView(partId: String) {
        try {
            api.recordPartView(mapOf("partId" to partId))
        } catch (e: Exception) {
            e.printStackTrace()
        }
        dao.incrementPartReadCount(partId)
    }

    suspend fun withdraw(amount: Double, method: String, accountInfo: String, source: String = ""): Boolean {
        if (amount <= 0) return false
        val transactionId = UUID.randomUUID().toString()
        val now = System.currentTimeMillis()
        try {
            api.withdraw(
                WithdrawRequest(
                    id = transactionId,
                    userId = currentUserId,
                    amount = amount,
                    method = method,
                    accountInfo = accountInfo,
                    source = source,
                    timestamp = now
                )
            )
        } catch (e: Exception) {
            e.printStackTrace()
        }
        
        if (source == "AUTHOR") {
            dao.deductAuthorIncome(currentUserId, amount)
        } else if (source == "READER") {
            val coinsToDeduct = amount * 100
            dao.deductReaderCoins(currentUserId, coinsToDeduct)
        } else if (source != "REFERRAL") {
            dao.deductBalance(currentUserId, amount)
        }
        
        dao.insertTransaction(
            Transaction(
                id = transactionId,
                userId = currentUserId, amount = amount,
                method = method, accountInfo = accountInfo,
                source = source, timestamp = now
            )
        )
        return true
    }

    fun getTransactions(userId: String): Flow<List<Transaction>> {
        repositoryScope.launch {
            try {
                val response = api.getTransactions(userId)
                if (response.isSuccessful && response.body() != null) {
                    response.body()?.forEach { dao.insertTransaction(it) }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
        return dao.getTransactionsForUser(userId)
    }

    fun getTotalWithdrawalsBySource(userId: String, source: String): Flow<Double> =
        dao.getTotalWithdrawalsBySource(userId, source).map { it ?: 0.0 }

    fun getTotalReferralCoins(username: String): Flow<Int> {
        repositoryScope.launch {
            try {
                val response = api.getReferralStats(username)
                if (response.isSuccessful && response.body() != null) {
                    val body = response.body()!!
                    val totalReferralCoins = (body["totalReferralCoins"] as? Number)?.toInt() ?: 0
                    val referralAuthorWithdrawals = (body["referralAuthorWithdrawals"] as? Number)?.toDouble() ?: 0.0
                    referralCoinsOverrides.value = referralCoinsOverrides.value + (username to totalReferralCoins)
                    referralAuthorWithdrawalOverrides.value =
                        referralAuthorWithdrawalOverrides.value + (username to referralAuthorWithdrawals)
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
        return combine(
            dao.getTotalReferralCoins(username).map { it ?: 0 },
            referralCoinsOverrides
        ) { local, overrides -> overrides[username] ?: local }
    }

    fun getReferralAuthorWithdrawals(username: String): Flow<Double> =
        combine(
            dao.getReferralAuthorWithdrawals(username).map { it ?: 0.0 },
            referralAuthorWithdrawalOverrides
        ) { local, overrides -> overrides[username] ?: local }

    fun searchStories(query: String, genre: String = "All"): Flow<List<Story>> {
        repositoryScope.launch {
            try {
                val response = api.searchStories(query, genre, currentUserId)
                if (response.isSuccessful && response.body() != null) {
                    response.body()?.forEach { dao.insertStory(it) }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
        return dao.searchStoriesExcludingAuthor(query, genre, currentUserId).map { stories ->
            if (genre == "All") stories else stories.filter { story -> story.hasGenre(genre) }
        }
    }

    private fun Story.hasGenre(genre: String): Boolean =
        genres.split(",").map { it.trim() }.any { it.equals(genre, ignoreCase = true) }

    fun searchAuthors(query: String): Flow<List<User>> {
        repositoryScope.launch {
            try {
                val response = api.searchAuthors(query, currentUserId)
                if (response.isSuccessful && response.body() != null) {
                    response.body()?.forEach { dao.insertUser(it) }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
        return dao.searchAuthorsExcludingSelf(query, currentUserId)
    }

    // ── Conversations ─────────────────────────────────────────────────────────

    suspend fun sendMessage(authorId: String, message: String, parentId: String? = null) {
        val currentUser = dao.getUser(currentUserId).firstOrNull()
        val conversationId = UUID.randomUUID().toString()
        val isSenderVerified = currentUser?.isVerified == true || currentUserId == OFFICIAL_USER_ID
        val now = System.currentTimeMillis()
        val conv = Conversation(
            id = conversationId,
            authorId = authorId, senderId = currentUserId,
            senderName = currentUsername, message = message, 
            senderProfileImageUrl = currentUser?.profileImageUrl,
            parentId = parentId,
            isSenderVerified = isSenderVerified,
            timestamp = now
        )

        var success = false
        try {
            val response = api.sendMessage(conv)
            if (response.isSuccessful && response.body()?.get("success") == true) {
                success = true
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
        if (success) {
            dao.insertConversation(conv)
        }
    }

    fun getConversations(authorId: String): Flow<List<Conversation>> {
        if (authorId.isNotEmpty()) {
            repositoryScope.launch {
                try {
                    val response = api.getConversations(authorId)
                    if (response.isSuccessful && response.body() != null) {
                        response.body()?.forEach { dao.insertConversation(it) }
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
        }
        return dao.getConversationsForAuthor(authorId)
    }

    fun getReplies(parentId: String): Flow<List<Conversation>> {
        if (parentId.isNotEmpty()) {
            repositoryScope.launch {
                try {
                    val response = api.getReplies(parentId)
                    if (response.isSuccessful && response.body() != null) {
                        response.body()?.forEach { dao.insertConversation(it) }
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
        }
        return dao.getReplies(parentId)
    }

    suspend fun getConversation(id: String): Conversation? {
        // Can optionally sync from API if needed, fallback to DAO
        return dao.getConversationById(id)
    }

    suspend fun toggleConversationLike(conversationId: String, delta: Int) {
        try {
            api.toggleConversationLike(
                ToggleConversationLikeRequest(
                    conversationId = conversationId,
                    delta = delta,
                    userId = currentUserId
                )
            )
        } catch (e: Exception) {
            e.printStackTrace()
        }
        dao.updateConversationLikes(conversationId, delta)
    }

    // ── Reviews ───────────────────────────────────────────────────────────────

    suspend fun addReview(storyId: String, rating: Int, comment: String) {
        val currentUser = dao.getUser(currentUserId).firstOrNull()
        val reviewId = UUID.randomUUID().toString()
        val now = System.currentTimeMillis()
        val review = Review(
            id = reviewId,
            storyId = storyId, userId = currentUserId,
            username = currentUsername, 
            userProfileImageUrl = currentUser?.profileImageUrl,
            rating = rating, comment = comment,
            isUserVerified = currentUser?.isVerified == true || currentUserId == OFFICIAL_USER_ID,
            timestamp = now
        )

        try {
            api.addReview(review)
        } catch (e: Exception) {
            e.printStackTrace()
        }
        dao.insertReview(review)
    }

    fun getReviewsForStory(storyId: String): Flow<List<Review>> {
        repositoryScope.launch {
            try {
                val response = api.getReviewsForStory(storyId)
                if (response.isSuccessful && response.body() != null) {
                    response.body()?.forEach { dao.insertReview(it) }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
        return dao.getReviewsForStory(storyId)
    }

    fun hasUserReviewed(storyId: String): Flow<Boolean> {
        repositoryScope.launch {
            try {
                val response = api.hasUserReviewed(storyId, currentUserId)
                if (response.isSuccessful && response.body() != null) {
                    // Update locally if reviewed on server (represented in review flow)
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
        return dao.hasUserReviewed(storyId, currentUserId)
    }

    // ── Likes ────────────────────────────────────────────────────────────────

    fun isStoryLikedByUser(storyId: String): Flow<Boolean> {
        repositoryScope.launch {
            try {
                val response = api.isStoryLikedByUser(currentUserId, storyId)
                if (response.isSuccessful) {
                    val liked = response.body()?.get("liked") ?: false
                    if (liked) {
                        dao.insertStoryLike(UserStoryLike(currentUserId, storyId))
                    } else {
                        dao.deleteStoryLike(currentUserId, storyId)
                    }
                    dao.updateStoryLikesCount(storyId)
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
        return dao.isStoryLikedByUser(currentUserId, storyId)
    }

    suspend fun toggleStoryLike(storyId: String) {
        try {
            api.toggleStoryLike(mapOf("userId" to currentUserId, "storyId" to storyId))
        } catch (e: Exception) {
            e.printStackTrace()
        }
        
        val alreadyLiked = dao.isStoryLikedByUser(currentUserId, storyId).firstOrNull() ?: false
        if (alreadyLiked) {
            dao.deleteStoryLike(currentUserId, storyId)
        } else {
            dao.insertStoryLike(UserStoryLike(currentUserId, storyId))
        }
        dao.updateStoryLikesCount(storyId)
    }

    // ── Part Annotations ──────────────────────────────────────────────────────

    suspend fun addPartAnnotation(
        partId: String,
        selectedText: String,
        startIndex: Int,
        endIndex: Int,
        type: String,
        content: String? = null
    ): String? {
        val currentUser = dao.getUser(currentUserId).firstOrNull()
        val part = dao.getStoryPartById(partId)
        val storyId = part?.storyId
        val annotationId = UUID.randomUUID().toString()
        val now = System.currentTimeMillis()

        val annotation = PartAnnotation(
            id = annotationId,
            partId = partId,
            userId = currentUserId,
            username = currentUsername,
            selectedText = selectedText,
            startIndex = startIndex,
            endIndex = endIndex,
            type = type,
            content = content,
            isUserVerified = currentUser?.isVerified == true || currentUserId == OFFICIAL_USER_ID,
            timestamp = now
        )

        try {
            api.addPartAnnotation(annotation)
        } catch (e: Exception) {
            e.printStackTrace()
        }
        dao.insertPartAnnotation(annotation)

        if (type == "COMMENT" && storyId != null) {
            dao.updateStoryCommentsCount(storyId)
        }
        
        return storyId
    }

    fun getAnnotationsForPart(partId: String): Flow<List<PartAnnotation>> {
        repositoryScope.launch {
            try {
                val response = api.getAnnotationsForPart(partId)
                if (response.isSuccessful && response.body() != null) {
                    response.body()?.forEach { dao.insertPartAnnotation(it) }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
        return dao.getAnnotationsForPart(partId)
    }

    // ── Library ───────────────────────────────────────────────────────────────

    suspend fun addStoryToLibrary(storyId: String): Result<Unit> {
        val count = dao.getLibraryStoryCount(currentUserId).firstOrNull() ?: 0
        if (count >= 15) {
            return Result.failure(Exception("Library is full. Please remove a story before downloading again."))
        }

        val now = System.currentTimeMillis()
        try {
            val response = api.addStoryToLibrary(AddStoryToLibraryRequest(userId = currentUserId, storyId = storyId, downloadedAt = now))
            if (response.isSuccessful) {
                dao.insertLibraryStory(LibraryStory(currentUserId, storyId, now))
                return Result.success(Unit)
            } else {
                return Result.failure(Exception(parseErrorMessage(response.errorBody()?.string(), "Library addition failed")))
            }
        } catch (e: Exception) {
            // Local fallback
            dao.insertLibraryStory(LibraryStory(currentUserId, storyId, now))
            return Result.success(Unit)
        }
    }

    suspend fun removeStoryFromLibrary(storyId: String) {
        try {
            api.removeStoryFromLibrary(mapOf("userId" to currentUserId, "storyId" to storyId))
        } catch (e: Exception) {
            e.printStackTrace()
        }
        dao.deleteLibraryStory(currentUserId, storyId)
    }

    fun getLibraryStories(): Flow<List<Story>> {
        if (currentUserId.isNotEmpty()) {
            repositoryScope.launch {
                try {
                    val response = api.getLibraryStories(currentUserId)
                    if (response.isSuccessful && response.body() != null) {
                        response.body()?.forEach {
                            dao.insertStory(it)
                            dao.insertLibraryStory(LibraryStory(currentUserId, it.id))
                        }
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
        }
        return dao.getLibraryStories(currentUserId)
    }

    fun isStoryInLibrary(storyId: String): Flow<Boolean> = dao.isStoryInLibrary(currentUserId, storyId)

    fun isPartRead(partId: String): Flow<Boolean> = dao.isPartRead(currentUserId, partId)

    // ── Reading Lists ─────────────────────────────────────────────────────────

    suspend fun createReadingList(name: String, description: String = "") {
        val readingListId = UUID.randomUUID().toString()
        val now = System.currentTimeMillis()
        val list = ReadingList(
            id = readingListId,
            userId = currentUserId,
            name = name,
            description = description,
            createdAt = now
        )

        try {
            api.createReadingList(list)
        } catch (e: Exception) {
            e.printStackTrace()
        }
        dao.insertReadingList(list)
    }

    suspend fun deleteReadingList(listId: String) {
        try {
            api.deleteReadingList(mapOf("listId" to listId))
        } catch (e: Exception) {
            e.printStackTrace()
        }
        dao.deleteReadingList(listId)
    }

    fun getReadingLists(): Flow<List<ReadingList>> {
        if (currentUserId.isNotEmpty()) {
            repositoryScope.launch {
                try {
                    val response = api.getReadingLists(currentUserId)
                    if (response.isSuccessful && response.body() != null) {
                        response.body()?.forEach { dao.insertReadingList(it) }
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
        }
        return dao.getReadingListsForUser(currentUserId)
    }

    fun getReadingLists(userId: String): Flow<List<ReadingList>> {
        if (userId.isNotEmpty()) {
            repositoryScope.launch {
                try {
                    val response = api.getReadingLists(userId)
                    if (response.isSuccessful && response.body() != null) {
                        response.body()?.forEach { dao.insertReadingList(it) }
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
        }
        return dao.getReadingListsForUser(userId)
    }

    suspend fun addStoryToReadingList(listId: String, storyId: String) {
        val now = System.currentTimeMillis()
        try {
            api.addStoryToReadingList(AddStoryToReadingListRequest(listId = listId, storyId = storyId, addedAt = now))
        } catch (e: Exception) {
            e.printStackTrace()
        }
        dao.insertReadingListStory(ReadingListStory(listId, storyId, now))
    }

    suspend fun removeStoryFromReadingList(listId: String, storyId: String) {
        try {
            api.removeStoryFromReadingList(mapOf("listId" to listId, "storyId" to storyId))
        } catch (e: Exception) {
            e.printStackTrace()
        }
        dao.deleteReadingListStory(listId, storyId)
    }

    fun getStoriesForReadingList(listId: String): Flow<List<Story>> {
        repositoryScope.launch {
            try {
                val response = api.getStoriesForReadingList(listId)
                if (response.isSuccessful && response.body() != null) {
                    response.body()?.forEach {
                        dao.insertStory(it)
                        dao.insertReadingListStory(ReadingListStory(listId, it.id))
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
        return dao.getStoriesForReadingList(listId)
    }

    suspend fun isStoryInReadingList(listId: String, storyId: String): Boolean = dao.isStoryInReadingList(listId, storyId)
}
