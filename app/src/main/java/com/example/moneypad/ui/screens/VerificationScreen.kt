package com.example.moneypad.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Assignment
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun VerificationScreen(
    viewModel: ProfileViewModel,
    onNavigateBack: () -> Unit
) {
    val user by viewModel.user.collectAsState()
    var qualifyingStoriesCount by remember { mutableIntStateOf(0) }
    var isLoadingRequirements by remember { mutableStateOf(true) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(Unit) {
        qualifyingStoriesCount = viewModel.countQualifyingStories()
        isLoadingRequirements = false
    }

    val hasMetRequirements = qualifyingStoriesCount >= 2

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Author Verification") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            item {
                Text(
                    "WE ALSO INTRODUCE YOU OUR VERIFIED ACCOUNT BADGE!",
                    fontSize = 20.sp,
                    fontWeight = FontWeight.ExtraBold,
                    color = MaterialTheme.colorScheme.primary
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    "One-Time Payment: ₱149.00",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold
                )
            }

            // Requirements Section
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f))
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.AutoMirrored.Filled.Assignment, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("REQUIREMENTS", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                        }
                        Spacer(modifier = Modifier.height(12.dp))
                        
                        RequirementItem(
                            text = "Must have published at least 2 stories with at least 10 chapters each",
                            isMet = hasMetRequirements,
                            currentStatus = if (isLoadingRequirements) "Checking..." else "($qualifyingStoriesCount/2 stories found)"
                        )
                        
                        RequirementItem(
                            text = "All works must be original and follow community guidelines",
                            isMet = true, // Soft requirement
                            currentStatus = ""
                        )
                        
                        RequirementItem(
                            text = "No required number of followers",
                            isMet = true,
                            currentStatus = ""
                        )
                    }
                }
            }

            // Benefits Section
            item {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.Redeem, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("EXCLUSIVE BENEFITS FOREVER", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                }
            }

            item {
                BenefitSection(
                    title = "GROW YOUR AUDIENCE",
                    icon = Icons.Default.Campaign,
                    benefits = listOf(
                        "Featured in special verified section",
                        "Priority in search results",
                        "Promotion on our official Facebook",
                        "Unique verified badge beside your name",
                        "Ad-free management of your works",
                        "Dedicated support channel"
                    )
                )
            }

            item {
                BenefitSection(
                    title = "EARN MORE",
                    icon = Icons.Default.MonetizationOn,
                    benefits = listOf(
                        "Higher earning rate: $0.05 per 50 views",
                        "Lower minimum withdrawal: ₱20.00"
                    )
                )
            }

            item {
                Spacer(modifier = Modifier.height(24.dp))
                Button(
                    onClick = {
                        viewModel.verifyUser()
                        onNavigateBack()
                    },
                    modifier = Modifier.fillMaxWidth(),
                    enabled = hasMetRequirements && !isLoadingRequirements,
                    shape = RoundedCornerShape(12.dp),
                    contentPadding = PaddingValues(16.dp)
                ) {
                    Text(
                        if (hasMetRequirements) "Pay ₱149.00 & Get Verified" else "Requirements Not Met",
                        fontWeight = FontWeight.Bold
                    )
                }
                if (!hasMetRequirements && !isLoadingRequirements) {
                    Text(
                        "You need at least 2 published stories with 10+ chapters each to apply.",
                        color = MaterialTheme.colorScheme.error,
                        fontSize = 12.sp,
                        modifier = Modifier.padding(top = 8.dp)
                    )
                }
            }
        }
    }
}

@Composable
fun RequirementItem(text: String, isMet: Boolean, currentStatus: String) {
    Row(
        modifier = Modifier.padding(vertical = 4.dp),
        verticalAlignment = Alignment.Top
    ) {
        Icon(
            imageVector = if (isMet) Icons.Default.CheckCircle else Icons.Default.RadioButtonUnchecked,
            contentDescription = null,
            tint = if (isMet) Color.Green else Color.Gray,
            modifier = Modifier.size(20.dp)
        )
        Spacer(modifier = Modifier.width(8.dp))
        Column {
            Text(text, fontSize = 14.sp)
            if (currentStatus.isNotEmpty()) {
                Text(currentStatus, fontSize = 12.sp, color = if (isMet) Color.Green else MaterialTheme.colorScheme.primary)
            }
        }
    }
}

@Composable
fun BenefitSection(title: String, icon: ImageVector, benefits: List<String>) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(20.dp))
                Spacer(modifier = Modifier.width(8.dp))
                Text(title, fontWeight = FontWeight.Bold, fontSize = 14.sp, color = MaterialTheme.colorScheme.primary)
            }
            Spacer(modifier = Modifier.height(8.dp))
            benefits.forEach { benefit ->
                Row(modifier = Modifier.padding(vertical = 2.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.Star, contentDescription = null, modifier = Modifier.size(14.dp), tint = MaterialTheme.colorScheme.secondary)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(benefit, fontSize = 13.sp)
                }
            }
        }
    }
}
