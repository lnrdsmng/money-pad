package com.example.moneypad.ui.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Face
import androidx.compose.material.icons.filled.Face3
import androidx.compose.material.icons.filled.FaceRetouchingNatural
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.time.LocalDate

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OnboardingScreen(
    onOnboardingComplete: () -> Unit,
    viewModel: OnboardingViewModel
) {
    val uiState by viewModel.uiState.collectAsState()

    LaunchedEffect(uiState.isComplete) {
        if (uiState.isComplete) {
            onOnboardingComplete()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Setup your profile", fontWeight = FontWeight.Bold) }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 24.dp)
                .verticalScroll(rememberScrollState()),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Progress Indicator
            LinearProgressIndicator(
                progress = { uiState.currentStep / 3f },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(8.dp)
                    .clip(RoundedCornerShape(4.dp)),
            )

            Spacer(modifier = Modifier.height(16.dp))
            Text(
                text = "Step ${uiState.currentStep} of 3",
                color = MaterialTheme.colorScheme.primary,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.height(32.dp))

            if (uiState.error != null) {
                Text(
                    text = uiState.error!!,
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.padding(bottom = 16.dp)
                )
            }

            when (uiState.currentStep) {
                1 -> GenderSelectionStep(
                    selectedGender = uiState.selectedGender,
                    onGenderSelect = viewModel::setGender
                )
                2 -> BirthdayInputStep(
                    month = uiState.birthMonth,
                    day = uiState.birthDay,
                    year = uiState.birthYear,
                    onDateChange = viewModel::setBirthDate
                )
                3 -> GenresSelectionStep(
                    availableGenres = uiState.availableGenres,
                    selectedGenres = uiState.selectedGenres,
                    onGenreToggle = viewModel::toggleGenre
                )
            }

            Spacer(modifier = Modifier.weight(1f))
            Spacer(modifier = Modifier.height(24.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                if (uiState.currentStep == 3) {
                    TextButton(onClick = { viewModel.skipGenres() }) {
                        Text("Skip", color = Color.Gray)
                    }
                } else {
                    Spacer(modifier = Modifier.weight(1f))
                }

                Button(
                    onClick = { viewModel.nextStep() },
                    modifier = Modifier
                        .fillMaxWidth(if (uiState.currentStep == 3) 0.5f else 1f)
                        .height(50.dp),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    if (uiState.isLoading) {
                        CircularProgressIndicator(color = Color.White, modifier = Modifier.size(24.dp))
                    } else {
                        Text(if (uiState.currentStep == 3) "Finish" else "Continue", fontSize = 18.sp)
                    }
                }
            }
            Spacer(modifier = Modifier.height(32.dp))
        }
    }
}

@Composable
fun GenderSelectionStep(
    selectedGender: String,
    onGenderSelect: (String) -> Unit
) {
    Text(
        text = "What is your sex?",
        fontSize = 24.sp,
        fontWeight = FontWeight.Bold,
        modifier = Modifier.fillMaxWidth(),
        textAlign = TextAlign.Start
    )
    Spacer(modifier = Modifier.height(32.dp))

    val genders = listOf(
        Pair("Male", Icons.Filled.Face),
        Pair("Female", Icons.Filled.Face3),
        Pair("Others", Icons.Filled.FaceRetouchingNatural)
    )

    genders.forEach { (gender, icon) ->
        val isSelected = selectedGender == gender
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 8.dp)
                .clickable { onGenderSelect(gender) }
                .border(
                    width = 2.dp,
                    color = if (isSelected) MaterialTheme.colorScheme.primary else Color.Transparent,
                    shape = RoundedCornerShape(12.dp)
                ),
            colors = CardDefaults.cardColors(
                containerColor = if (isSelected) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceVariant
            ),
            shape = RoundedCornerShape(12.dp)
        ) {
            Row(
                modifier = Modifier
                    .padding(20.dp)
                    .fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = if (isSelected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(32.dp)
                )
                Spacer(modifier = Modifier.width(16.dp))
                Text(
                    text = gender,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Medium,
                    color = if (isSelected) MaterialTheme.colorScheme.onPrimaryContainer else MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BirthdayInputStep(
    month: String,
    day: String,
    year: String,
    onDateChange: (String, String, String) -> Unit
) {
    Text(
        text = "When is your birthday?",
        fontSize = 24.sp,
        fontWeight = FontWeight.Bold,
        modifier = Modifier.fillMaxWidth(),
        textAlign = TextAlign.Start
    )
    Spacer(modifier = Modifier.height(8.dp))
    Text(
        text = "You must be at least 16 years old to use Money Pad.",
        fontSize = 14.sp,
        color = Color.Gray,
        modifier = Modifier.fillMaxWidth(),
        textAlign = TextAlign.Start
    )
    Spacer(modifier = Modifier.height(32.dp))

    val currentYear = LocalDate.now().year
    val months = (1..12).map { it.toString() }
    val days = (1..31).map { it.toString() }
    val years = ((currentYear - 100)..currentYear).map { it.toString() }.reversed()

    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        DropdownSelector(
            label = "Month",
            options = months,
            selectedOption = month,
            onOptionSelected = { onDateChange(it, day, year) },
            modifier = Modifier.weight(1f)
        )
        DropdownSelector(
            label = "Day",
            options = days,
            selectedOption = day,
            onOptionSelected = { onDateChange(month, it, year) },
            modifier = Modifier.weight(1f)
        )
        DropdownSelector(
            label = "Year",
            options = years,
            selectedOption = year,
            onOptionSelected = { onDateChange(month, day, it) },
            modifier = Modifier.weight(1.5f)
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DropdownSelector(
    label: String,
    options: List<String>,
    selectedOption: String,
    onOptionSelected: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    var expanded by remember { mutableStateOf(false) }

    ExposedDropdownMenuBox(
        expanded = expanded,
        onExpandedChange = { expanded = it },
        modifier = modifier
    ) {
        OutlinedTextField(
            value = selectedOption,
            onValueChange = {},
            readOnly = true,
            singleLine = true,
            textStyle = LocalTextStyle.current.copy(fontSize = 14.sp),
            label = { 
                Text(
                    text = label, 
                    fontSize = 12.sp, 
                    maxLines = 1, 
                    overflow = androidx.compose.ui.text.style.TextOverflow.Visible,
                    softWrap = false
                ) 
            },
            trailingIcon = { 
                Icon(
                    imageVector = androidx.compose.material.icons.Icons.Filled.ArrowDropDown,
                    contentDescription = null,
                    modifier = Modifier.size(20.dp)
                ) 
            },
            colors = ExposedDropdownMenuDefaults.outlinedTextFieldColors(),
            modifier = Modifier.menuAnchor()
        )
        ExposedDropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false }
        ) {
            options.forEach { option ->
                DropdownMenuItem(
                    text = { Text(option) },
                    onClick = {
                        onOptionSelected(option)
                        expanded = false
                    }
                )
            }
        }
    }
}

@Composable
fun GenresSelectionStep(
    availableGenres: List<String>,
    selectedGenres: List<String>,
    onGenreToggle: (String) -> Unit
) {
    Text(
        text = "What do you like to read?",
        fontSize = 24.sp,
        fontWeight = FontWeight.Bold,
        modifier = Modifier.fillMaxWidth(),
        textAlign = TextAlign.Start
    )
    Spacer(modifier = Modifier.height(8.dp))
    Text(
        text = "Select up to 5 genres you're interested in. (${selectedGenres.size}/5)",
        fontSize = 14.sp,
        color = Color.Gray,
        modifier = Modifier.fillMaxWidth(),
        textAlign = TextAlign.Start
    )
    Spacer(modifier = Modifier.height(24.dp))

    LazyVerticalGrid(
        columns = GridCells.Adaptive(minSize = 120.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(max = 400.dp)
    ) {
        items(availableGenres) { genre ->
            val isSelected = selectedGenres.contains(genre)
            FilterChip(
                selected = isSelected,
                onClick = { onGenreToggle(genre) },
                label = { Text(genre) },
                leadingIcon = if (isSelected) {
                    { Icon(Icons.Filled.Check, contentDescription = "Selected", modifier = Modifier.size(16.dp)) }
                } else null,
                modifier = Modifier.fillMaxWidth()
            )
        }
    }
}
