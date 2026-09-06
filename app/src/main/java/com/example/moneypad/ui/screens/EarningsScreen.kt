package com.example.moneypad.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.MenuBook
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.CardGiftcard
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Create
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Lightbulb
import androidx.compose.material.icons.filled.MonetizationOn
import androidx.compose.material.icons.filled.Redeem
import androidx.compose.material.icons.filled.RocketLaunch
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.platform.LocalContext
import android.app.Activity
import android.widget.Toast
import com.example.moneypad.ads.AdManager
import com.example.moneypad.data.model.Transaction
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EarningsScreen(viewModel: EarningsViewModel) {
    val context = LocalContext.current
    val uiState by viewModel.uiState.collectAsState()
    var showWithdrawDialog by remember { mutableStateOf(false) }
    var showUpgradeDialog by remember { mutableStateOf(false) }
    var showUpgradeSuccess by remember { mutableStateOf<String?>(null) }

    val isDark = MaterialTheme.colorScheme.background == Color(0xFF121212)
    val balanceColor = if (isDark) Color(0xFFFFD700) else Color(0xFF6200EE)

    val conversionRate = 60.0
    val coinToPhpRate = 0.01 // 100 coins = 1 peso => 1 coin = 0.01 peso

    val authorUsd = uiState.user?.authorIncome ?: 0.0
    val authorPhp = authorUsd * conversionRate

    val readerCoins = uiState.user?.readerCoins ?: 0.0
    val readerPhp = readerCoins * coinToPhpRate
    val watchAdCooldownSeconds by viewModel.watchAdCooldownSeconds.collectAsState()
    val isClaimingWatchAdReward by viewModel.isClaimingWatchAdReward.collectAsState()
    var isWatchAdShowing by remember { mutableStateOf(false) }

    val referralPhp = uiState.referralBalance

    val totalPhp = authorPhp + readerPhp + referralPhp

    val uniqueViews = uiState.myPublishedStories.sumOf { it.uniqueViews }
    val repeatedViews = uiState.myPublishedStories.sumOf { it.repeatedViews }

    val clipboard = LocalClipboardManager.current
    val appLink = "https://moneypad.app/join/${uiState.user?.username}"

    var showClaimRewardDialog by remember { mutableStateOf(false) }
    var isClaiming by remember { mutableStateOf(false) }
    var referrerInput by remember { mutableStateOf("") }
    var referrerError by remember { mutableStateOf<String?>(null) }

    // Check if user has a referrer but hasn't claimed reward yet
    LaunchedEffect(uiState.user) {
        uiState.user?.let { user ->
            if (!isClaiming && user.referredBy.isNotBlank() && !user.isReferralRewardClaimed) {
                showClaimRewardDialog = true
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Earnings") },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background,
                    titleContentColor = MaterialTheme.colorScheme.primary
                )
            )
        }
    ) { innerPadding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
            contentPadding = PaddingValues(vertical = 16.dp)
        ) {
            // Welcome Bonus Card (1-day grace period)
            val user = uiState.user
            if (user != null && user.referredBy.isBlank() && !user.isReferralRewardClaimed) {
                val now = System.currentTimeMillis()
                val gracePeriod = 24 * 60 * 60 * 1000L
                if (now - user.signupTimestamp < gracePeriod) {
                    item {
                        val expiryTime = user.signupTimestamp + gracePeriod
                        var remainingTime by remember { 
                            mutableLongStateOf(expiryTime - System.currentTimeMillis()) 
                        }

                        LaunchedEffect(Unit) {
                            while (remainingTime > 0) {
                                kotlinx.coroutines.delay(1000)
                                remainingTime = expiryTime - System.currentTimeMillis()
                            }
                        }

                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(
                                containerColor = MaterialTheme.colorScheme.primaryContainer
                            ),
                            shape = RoundedCornerShape(16.dp)
                        ) {
                            Column(modifier = Modifier.padding(16.dp)) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Icon(
                                            Icons.Default.Redeem,
                                            contentDescription = null,
                                            tint = MaterialTheme.colorScheme.onPrimaryContainer,
                                            modifier = Modifier.size(20.dp)
                                        )
                                        Spacer(modifier = Modifier.width(8.dp))
                                        Text(
                                            "Welcome Bonus!",
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 18.sp,
                                            color = MaterialTheme.colorScheme.onPrimaryContainer
                                        )
                                    }
                                    
                                    val hours = remainingTime / (1000 * 60 * 60)
                                    val minutes = (remainingTime / (1000 * 60)) % 60
                                    val seconds = (remainingTime / 1000) % 60
                                    Text(
                                        text = String.format("%02d:%02d:%02d", hours, minutes, seconds),
                                        color = MaterialTheme.colorScheme.onPrimaryContainer,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 14.sp
                                    )
                                }
                                Text(
                                    "Enter the username of the person who invited you to claim 10 Reader Coins!",
                                    fontSize = 13.sp,
                                    color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.8f)
                                )
                                Spacer(modifier = Modifier.height(12.dp))
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    OutlinedTextField(
                                        value = referrerInput,
                                        onValueChange = { 
                                            referrerInput = it
                                            referrerError = null
                                        },
                                        placeholder = { Text("Referrer Username", fontSize = 12.sp) },
                                        modifier = Modifier.weight(1f),
                                        singleLine = true,
                                        isError = referrerError != null,
                                        shape = RoundedCornerShape(12.dp),
                                        colors = TextFieldDefaults.colors(
                                            focusedContainerColor = Color.White,
                                            unfocusedContainerColor = Color.White
                                        )
                                    )
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Button(
                                        onClick = {
                                            if (referrerInput.isNotBlank()) {
                                                viewModel.updateReferrer(
                                                    referrerInput,
                                                    onSuccess = {
                                                        referrerInput = ""
                                                        // dialog will show via LaunchedEffect
                                                    },
                                                    onError = { referrerError = it }
                                                )
                                            }
                                        },
                                        shape = RoundedCornerShape(12.dp)
                                    ) {
                                        Text("Claim")
                                    }
                                }
                                if (referrerError != null) {
                                    Text(
                                        referrerError!!,
                                        color = MaterialTheme.colorScheme.error,
                                        fontSize = 11.sp,
                                        modifier = Modifier.padding(top = 4.dp)
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // Categories
            item {
                Text("Earning Categories", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
            }

            // Author Income
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    elevation = CardDefaults.cardElevation(defaultElevation = 3.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.Create, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Author Income", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                        }
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "Earn $0.03 (₱1.80) for every 50 unique views on your published stories.",
                            fontSize = 14.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Column {
                                Text("Total Income", fontSize = 12.sp, color = Color.Gray)
                                Text("$${String.format("%.3f", authorUsd)} (₱${String.format("%.2f", authorPhp)})", fontWeight = FontWeight.Bold)
                            }
                            Column(horizontalAlignment = Alignment.End) {
                                Text("Unique Views", fontSize = 12.sp, color = Color.Gray)
                                Text("$uniqueViews", fontWeight = FontWeight.Bold)
                            }
                            Column(horizontalAlignment = Alignment.End) {
                                Text("Repeated Views", fontSize = 12.sp, color = Color.Gray)
                                Text("$repeatedViews", fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }

            // Reader Coins
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    elevation = CardDefaults.cardElevation(defaultElevation = 3.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.AutoMirrored.Filled.MenuBook, contentDescription = null, tint = MaterialTheme.colorScheme.secondary)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Reader Coins", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                        }
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "Earn coins by reading! 100 Coins = ₱1.00",
                            fontSize = 14.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Column {
                                Text("Coins", fontSize = 12.sp, color = Color.Gray)
                                Text(String.format("%,.2f", readerCoins), fontWeight = FontWeight.Bold)
                            }
                            Column(horizontalAlignment = Alignment.End) {
                                Text("PHP Value", fontSize = 12.sp, color = Color.Gray)
                                Text("₱${String.format("%.2f", readerPhp)}", fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }

            // Watch Ads
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    elevation = CardDefaults.cardElevation(defaultElevation = 3.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.MonetizationOn, contentDescription = null, tint = Color(0xFFFF9800))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Watch Ads", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                        }
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "Earn 0.02 Coins per ad. A 1-minute timer starts after each ad closes.",
                            fontSize = 14.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Spacer(modifier = Modifier.height(12.dp))

                        val canWatchAd = watchAdCooldownSeconds == 0 && !isClaimingWatchAdReward && !isWatchAdShowing
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text("Reward", fontSize = 12.sp, color = Color.Gray)
                                Text("0.02 Coins", fontWeight = FontWeight.Bold)
                            }
                            Button(
                                onClick = {
                                    val activity = context as? Activity
                                    if (activity == null) {
                                        Toast.makeText(context, "Unable to show ad right now.", Toast.LENGTH_SHORT).show()
                                    } else {
                                        isWatchAdShowing = true
                                        AdManager.showRewardInterstitialIfReady(
                                            activity = activity,
                                            onAdClosed = {
                                                isWatchAdShowing = false
                                                viewModel.claimWatchAdReward { success ->
                                                    val message = if (success) {
                                                        "You earned 0.02 Coins!"
                                                    } else {
                                                        "Unable to credit reward. Please try again."
                                                    }
                                                    Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
                                                }
                                            },
                                            onUnavailable = {
                                                isWatchAdShowing = false
                                                Toast.makeText(context, "Ad is still loading. Please try again shortly.", Toast.LENGTH_SHORT).show()
                                            }
                                        )
                                    }
                                },
                                enabled = canWatchAd,
                                shape = RoundedCornerShape(12.dp)
                            ) {
                                Text(
                                    when {
                                        isClaimingWatchAdReward || isWatchAdShowing -> "Processing"
                                        watchAdCooldownSeconds > 0 -> "${watchAdCooldownSeconds}s"
                                        else -> "Watch Ad"
                                    }
                                )
                            }
                        }
                    }
                }
            }

            // Invitations
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    elevation = CardDefaults.cardElevation(defaultElevation = 3.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.CardGiftcard, contentDescription = null, tint = Color(0xFFE91E63))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Invite & Earn Rewards", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                        }
                        Spacer(modifier = Modifier.height(8.dp))
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.AutoMirrored.Filled.MenuBook, contentDescription = null, modifier = Modifier.size(16.dp), tint = MaterialTheme.colorScheme.primary)
                            Spacer(modifier = Modifier.width(4.dp))
                            Icon(Icons.Default.AutoAwesome, contentDescription = null, modifier = Modifier.size(14.dp), tint = Color(0xFFFFD700))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                "Get more coins when your friends read!",
                                fontSize = 13.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                        Spacer(modifier = Modifier.height(4.dp))
                        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                            ReferralRewardRow("Read 5 chapters + Watch 3 ads", "10 Coins")
                            ReferralRewardRow("Read 15 chapters + Watch 5 ads", "30 Coins")
                            ReferralRewardRow("Read 25 chapters + Watch 7 ads", "50 Coins")
                            ReferralRewardRow("Read 40 chapters + Watch 10 ads", "80 Coins")
                            ReferralRewardRow("Read 80 chapters + Watch 15 ads", "160 Coins")
                            ReferralRewardRow("Read 110 chapters + Watch 20 ads", "220 Coins")
                        }
                        Text(
                            "(Total of 550 coins/referral)",
                            fontSize = 11.sp,
                            color = Color.Gray,
                            modifier = Modifier.padding(start = 24.dp)
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Row(verticalAlignment = Alignment.Top) {
                            Icon(Icons.Default.Lightbulb, contentDescription = null, modifier = Modifier.size(16.dp), tint = Color(0xFFFFD700))
                            Spacer(modifier = Modifier.width(8.dp))
                            Column {
                                Text(
                                    "Tip: The more they read, the more you earn! Invite your friends now!",
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Medium,
                                    color = MaterialTheme.colorScheme.primary
                                )
                                Spacer(modifier = Modifier.height(4.dp))
                                Icon(Icons.Default.RocketLaunch, contentDescription = null, modifier = Modifier.size(16.dp), tint = MaterialTheme.colorScheme.primary)
                            }
                        }

                        Spacer(modifier = Modifier.height(16.dp))
                        HorizontalDivider(color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.2f))
                        Spacer(modifier = Modifier.height(16.dp))

                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.AutoAwesome, contentDescription = null, modifier = Modifier.size(16.dp), tint = Color(0xFFFFD700))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Author Referral Bonus", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                            Spacer(modifier = Modifier.width(8.dp))
                            Icon(Icons.Default.AutoAwesome, contentDescription = null, modifier = Modifier.size(16.dp), tint = Color(0xFFFFD700))
                        }
                        Spacer(modifier = Modifier.height(8.dp))
                        Row(verticalAlignment = Alignment.Top) {
                            Icon(Icons.Default.MonetizationOn, contentDescription = null, modifier = Modifier.size(18.dp), tint = Color(0xFF4CAF50))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                "Earn 5% Commission FOREVER! Get a share every time your invited author withdraws their earnings!",
                                fontSize = 13.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }

                        Spacer(modifier = Modifier.height(16.dp))
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(8.dp))
                                .padding(horizontal = 12.dp, vertical = 10.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                text = appLink,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.weight(1f)
                            )
                            IconButton(
                                onClick = { clipboard.setText(AnnotatedString(appLink)) },
                                modifier = Modifier.size(36.dp)
                            ) {
                                Icon(Icons.Default.ContentCopy, contentDescription = "Copy link", tint = MaterialTheme.colorScheme.primary)
                            }
                        }
                    }
                }
            }

            // Invite Stats
            item {
                val referralCount = uiState.user?.referralCount ?: 0
                
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.05f)
                    ),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            "Total Estimated Earnings: ₱${String.format("%.2f", totalPhp)}",
                            fontWeight = FontWeight.Bold,
                            fontSize = 16.sp,
                            color = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.fillMaxWidth(),
                            textAlign = TextAlign.Center
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceEvenly,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.weight(1f)) {
                                Text("Total Invites", fontSize = 10.sp, color = Color.Gray)
                                Text("$referralCount", fontWeight = FontWeight.Bold, fontSize = 18.sp)
                            }
                            
                            VerticalDivider(modifier = Modifier.height(30.dp), thickness = 1.dp, color = Color.LightGray)
                            
                            Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.weight(1f)) {
                                Text("Coins Accumulated", fontSize = 10.sp, color = Color.Gray, textAlign = TextAlign.Center)
                                Text("${uiState.referralCoinsAccumulated}", fontWeight = FontWeight.Bold, fontSize = 18.sp)
                            }

                            VerticalDivider(modifier = Modifier.height(30.dp), thickness = 1.dp, color = Color.LightGray)

                            Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.weight(1f)) {
                                Text("Commission", fontSize = 10.sp, color = Color.Gray)
                                Text("₱${String.format("%.2f", uiState.referralCommission)}", fontWeight = FontWeight.Bold, fontSize = 18.sp, color = MaterialTheme.colorScheme.primary)
                            }
                        }
                    }
                }
            }

            // Actions
            item {
                Text("Actions", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
            }
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Button(
                        onClick = { showWithdrawDialog = true },
                        modifier = Modifier.weight(1f).height(50.dp),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text("Withdraw Funds")
                    }
                    OutlinedButton(
                        onClick = { showUpgradeDialog = true },
                        modifier = Modifier.weight(1f).height(50.dp),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Icon(Icons.Default.Star, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Upgrade Plan")
                    }
                }
            }

            // Transactions
            item {
                Text("Transaction History", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
            }
            
            if (uiState.transactions.isEmpty()) {
                item {
                    Text("No transactions yet.", color = Color.Gray, modifier = Modifier.padding(vertical = 16.dp))
                }
            } else {
                items(uiState.transactions) { tx ->
                    TransactionItem(transaction = tx)
                }
            }
            
            item {
                Spacer(modifier = Modifier.height(40.dp))
            }
        }
    }

    if (showWithdrawDialog) {
        WithdrawDialog(
            onDismiss = { showWithdrawDialog = false },
            onConfirm = { amount, method, info, source ->
                viewModel.withdraw(amount, method, info, source)
                showWithdrawDialog = false
            },
            authorPhp = authorPhp,
            readerPhp = readerPhp,
            referralPhp = uiState.referralBalance
        )
    }

    if (showUpgradeSuccess != null) {
        AlertDialog(
            onDismissRequest = { showUpgradeSuccess = null },
            title = { Text("Success") },
            text = { Text("Successfully upgraded to ${showUpgradeSuccess} plan!") },
            confirmButton = {
                Button(onClick = { showUpgradeSuccess = null }) {
                    Text("OK")
                }
            }
        )
    }

    if (showUpgradeDialog) {
        UpgradePlanDialog(
            onDismiss = { showUpgradeDialog = false },
            onConfirm = { plan -> 
                viewModel.upgradeAdFree(
                    plan = if (plan.contains("90")) "90MIN" else "PERMANENT",
                    onSuccess = {
                        showUpgradeDialog = false
                        showUpgradeSuccess = plan
                        Toast.makeText(context, "Successfully upgraded to $plan plan!", Toast.LENGTH_LONG).show()
                    },
                    onError = { error ->
                        Toast.makeText(context, error, Toast.LENGTH_LONG).show()
                    }
                )
            }
        )
    }

    if (showClaimRewardDialog) {
        AlertDialog(
            onDismissRequest = { showClaimRewardDialog = false },
            title = { 
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.Redeem, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Welcome Reward!")
                }
            },
            text = { Text("Congratulations! Since you were invited by a friend, you are eligible for a 10 Reader Coins welcome bonus.") },
            confirmButton = {
                Button(
                    onClick = {
                        viewModel.claimReferralReward()
                        showClaimRewardDialog = false
                    }
                ) {
                    Text("Claim 10 Coins")
                }
            },
            dismissButton = {
                TextButton(onClick = { showClaimRewardDialog = false }) {
                    Text("Maybe Later")
                }
            }
        )
    }
}

@Composable
fun ReferralRewardRow(label: String, reward: String) {
    Row(
        modifier = Modifier.padding(start = 24.dp, top = 2.dp, bottom = 2.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(Icons.AutoMirrored.Filled.MenuBook, contentDescription = null, modifier = Modifier.size(12.dp), tint = Color.Gray)
        Spacer(modifier = Modifier.width(8.dp))
        Text(label, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(modifier = Modifier.weight(1f))
        Text(reward, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
    }
}

@Composable
fun UpgradePlanDialog(onDismiss: () -> Unit, onConfirm: (String) -> Unit) {
    var selectedPlan by remember { mutableStateOf("90 Minutes Ad-Free") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Upgrade Plan") },
        text = {
            Column {
                Text("Select an upgrade option:", fontSize = 14.sp)
                Spacer(modifier = Modifier.height(16.dp))
                
                Card(
                    onClick = { selectedPlan = "90 Minutes Ad-Free" },
                    colors = CardDefaults.cardColors(
                        containerColor = if (selectedPlan == "90 Minutes Ad-Free") 
                            MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surface
                    ),
                    modifier = Modifier.fillMaxWidth(),
                    border = if (selectedPlan == "90 Minutes Ad-Free") null else 
                        androidx.compose.foundation.BorderStroke(1.dp, Color.LightGray)
                ) {
                    Row(
                        modifier = Modifier.padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        RadioButton(selected = selectedPlan == "90 Minutes Ad-Free", onClick = { selectedPlan = "90 Minutes Ad-Free" })
                        Spacer(modifier = Modifier.width(8.dp))
                        Column {
                            Text("90 Minutes Ad-Free", fontWeight = FontWeight.Bold)
                            Text("Cost: 500 Coins", fontSize = 12.sp, color = Color.Gray)
                        }
                    }
                }
                
                Spacer(modifier = Modifier.height(12.dp))

                Card(
                    onClick = { selectedPlan = "Permanent Ad-Free" },
                    colors = CardDefaults.cardColors(
                        containerColor = if (selectedPlan == "Permanent Ad-Free") 
                            MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surface
                    ),
                    modifier = Modifier.fillMaxWidth(),
                    border = if (selectedPlan == "Permanent Ad-Free") null else 
                        androidx.compose.foundation.BorderStroke(1.dp, Color.LightGray)
                ) {
                    Row(
                        modifier = Modifier.padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        RadioButton(selected = selectedPlan == "Permanent Ad-Free", onClick = { selectedPlan = "Permanent Ad-Free" })
                        Spacer(modifier = Modifier.width(8.dp))
                        Column {
                            Text("Permanent Ad-Free", fontWeight = FontWeight.Bold)
                            Text("Cost: ₱1,499.00", fontSize = 12.sp, color = Color.Gray)
                        }
                    }
                }
            }
        },
        confirmButton = {
            Button(onClick = { onConfirm(selectedPlan) }) {
                Text("Confirm")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        }
    )
}

@Composable
fun WithdrawDialog(
    onDismiss: () -> Unit,
    onConfirm: (Double, String, String, String) -> Unit,
    authorPhp: Double,
    readerPhp: Double,
    referralPhp: Double
) {
    var source by remember { mutableStateOf("AUTHOR") } // "AUTHOR", "READER", or "REFERRAL"
    var amount by remember { mutableStateOf("") }
    var method by remember { mutableStateOf("GCash") }
    var accountInfo by remember { mutableStateOf("") }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var showProcessingAlert by remember { mutableStateOf(false) }

    if (showProcessingAlert) {
        AlertDialog(
            onDismissRequest = { showProcessingAlert = false },
            title = { Text("Request Submitted") },
            text = { Text("Your withdrawal request has been received and will be processed within 2 to 14 days.") },
            confirmButton = {
                Button(onClick = {
                    val amt = amount.toDoubleOrNull() ?: 0.0
                    onConfirm(amt, method, accountInfo, source)
                    showProcessingAlert = false
                }) { Text("OK") }
            }
        )
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Withdraw Funds") },
        text = {
            Column {
                Text("Select Source:", fontSize = 14.sp, fontWeight = FontWeight.Bold)
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.weight(1f)) {
                        RadioButton(
                            selected = source == "AUTHOR",
                            onClick = { source = "AUTHOR"; errorMessage = null },
                            modifier = Modifier.size(36.dp)
                        )
                        Text("Author", fontSize = 11.sp, maxLines = 1, softWrap = false)
                    }
                    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.weight(1f)) {
                        RadioButton(
                            selected = source == "READER",
                            onClick = { source = "READER"; errorMessage = null },
                            modifier = Modifier.size(36.dp)
                        )
                        Text("Reader", fontSize = 11.sp, maxLines = 1, softWrap = false)
                    }
                    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.weight(1.2f)) {
                        RadioButton(
                            selected = source == "REFERRAL",
                            onClick = { source = "REFERRAL"; errorMessage = null },
                            modifier = Modifier.size(36.dp)
                        )
                        Text("Referral", fontSize = 11.sp, maxLines = 1, softWrap = false)
                    }
                }
                
                val currentBalance = when(source) {
                    "AUTHOR" -> authorPhp
                    "READER" -> readerPhp
                    else -> referralPhp
                }
                
                val minWithdrawal = when(source) {
                    "AUTHOR" -> 50.00
                    "READER" -> 3.0
                    else -> when (method) { // REFERRAL
                        "PayPal", "PayMaya" -> 40.0
                        "GCash" -> 50.0
                        else -> 50.0
                    }
                }
                
                Text(
                    text = "Available: ₱${String.format("%.2f", currentBalance)}",
                    fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(
                    text = "Min withdrawal: ₱${String.format("%.2f", minWithdrawal)}",
                    fontSize = 12.sp, color = MaterialTheme.colorScheme.primary
                )
                
                Spacer(modifier = Modifier.height(16.dp))
                Text("Select Method:", fontSize = 14.sp, fontWeight = FontWeight.Bold)
                Column {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        RadioButton(selected = method == "GCash", onClick = { method = "GCash"; errorMessage = null })
                        Text("GCash", fontSize = 13.sp)
                        Spacer(modifier = Modifier.width(8.dp))
                        RadioButton(selected = method == "PayMaya", onClick = { method = "PayMaya"; errorMessage = null })
                        Text("PayMaya", fontSize = 13.sp)
                    }
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        RadioButton(selected = method == "PayPal", onClick = { method = "PayPal"; errorMessage = null })
                        Text("PayPal", fontSize = 13.sp)
                    }
                }
                
                OutlinedTextField(
                    value = amount,
                    onValueChange = { 
                        amount = it
                        errorMessage = null
                    },
                    label = { Text("Amount (PHP)") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    modifier = Modifier.fillMaxWidth(),
                    isError = errorMessage != null && errorMessage?.contains("Amount") == true
                )
                
                Spacer(modifier = Modifier.height(8.dp))
                
                OutlinedTextField(
                    value = accountInfo,
                    onValueChange = { 
                        if (method == "PayPal") {
                            accountInfo = it
                            errorMessage = null
                        } else {
                            val digitsOnly = it.filter { char -> char.isDigit() }
                            if (digitsOnly.length <= 11) {
                                accountInfo = digitsOnly
                                errorMessage = null
                            }
                        }
                    },
                    label = { 
                        Text(
                            when (method) {
                                "GCash" -> "GCash Number"
                                "PayMaya" -> "PayMaya Number"
                                else -> "PayPal Email"
                            }
                        ) 
                    },
                    placeholder = { 
                        Text(
                            if (method == "PayPal") "e.g. email@example.com" else "e.g. 09123456789"
                        ) 
                    },
                    keyboardOptions = KeyboardOptions(
                        keyboardType = if (method == "PayPal") KeyboardType.Email else KeyboardType.Number
                    ),
                    modifier = Modifier.fillMaxWidth(),
                    isError = errorMessage != null && (errorMessage?.contains("Number") == true || errorMessage?.contains("Email") == true)
                )
                
                if (errorMessage != null) {
                    Text(
                        text = errorMessage!!,
                        color = MaterialTheme.colorScheme.error,
                        fontSize = 12.sp,
                        modifier = Modifier.padding(top = 4.dp)
                    )
                }
            }
        },
        confirmButton = {
            Button(onClick = {
                val amt = amount.toDoubleOrNull() ?: 0.0
                val phoneRegex = "^09\\d{9}$".toRegex()
                val emailRegex = "^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+$".toRegex()
                
                val currentBalance = when(source) {
                    "AUTHOR" -> authorPhp
                    "READER" -> readerPhp
                    else -> referralPhp
                }
                
                val minWithdrawal = when(source) {
                    "AUTHOR" -> 50.00
                    "READER" -> 3.0
                    else -> when (method) { // REFERRAL
                        "PayPal", "PayMaya" -> 40.0
                        "GCash" -> 50.0
                        else -> 50.0
                    }
                }
                
                when {
                    amt < minWithdrawal -> errorMessage = "Minimum withdrawal is ₱${String.format("%.2f", minWithdrawal)}"
                    amt > currentBalance -> errorMessage = "Insufficient balance"
                    method != "PayPal" && !accountInfo.matches(phoneRegex) -> errorMessage = "Enter a valid 11-digit number starting with 09"
                    method == "PayPal" && !accountInfo.matches(emailRegex) -> errorMessage = "Enter a valid Email address"
                    else -> {
                        showProcessingAlert = true
                    }
                }
            }) { Text("Confirm") }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        }
    )
}

@Composable
fun TransactionItem(transaction: Transaction) {
    val dateFormat = remember { SimpleDateFormat("MMM dd, yyyy HH:mm", Locale.getDefault()) }
    
    Card(
        modifier = Modifier.fillMaxWidth(),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Row(
            modifier = Modifier.padding(16.dp).fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(transaction.method, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                Text(transaction.accountInfo, color = Color.Gray, fontSize = 12.sp)
                Text(dateFormat.format(Date(transaction.timestamp)), color = Color.Gray, fontSize = 12.sp)
            }
            Text(
                text = "-₱${String.format("%.2f", transaction.amount)}",
                color = MaterialTheme.colorScheme.error,
                fontWeight = FontWeight.Bold,
                fontSize = 16.sp
            )
        }
    }
}
