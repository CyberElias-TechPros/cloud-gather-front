package com.cloudgather.app.ui

import android.Manifest
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.compose.*
import com.cloudgather.app.data.*
import com.cloudgather.app.transfer.TransferWorker

private val LightColors = lightColorScheme(primary = Color(0xFF5058D9), secondary = Color(0xFF526579),
    tertiary = Color(0xFF137B68), background = Color(0xFFF8F9FF), surface = Color(0xFFF8F9FF))
private val DarkColors = darkColorScheme(primary = Color(0xFFBEC2FF), secondary = Color(0xFFBAC8DC), tertiary = Color(0xFF83D5BF))

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CloudGatherApp(vm: AppViewModel) {
    val context = LocalContext.current
    val settings = remember { context.getSharedPreferences("appearance", 0) }
    var theme by remember { mutableStateOf(settings.getString("theme", "system")!!) }
    MaterialTheme(colorScheme = if (theme == "dark" || (theme == "system" && isSystemInDarkTheme())) DarkColors else LightColors) {
        val user by vm.user.collectAsStateWithLifecycle()
        val starting by vm.starting.collectAsStateWithLifecycle()
        val error by vm.error.collectAsStateWithLifecycle()
        val busy by vm.busy.collectAsStateWithLifecycle()
        val incoming by vm.incoming.collectAsStateWithLifecycle()
        val snackbar = remember { SnackbarHostState() }
        LaunchedEffect(error) { error?.let { snackbar.showSnackbar(it); vm.clearError() } }
        val notifications = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { }
        LaunchedEffect(user?.text("id")) {
            if (user != null && Build.VERSION.SDK_INT >= 33 && !settings.getBoolean("notification_asked", false)) {
                settings.edit().putBoolean("notification_asked", true).apply()
                notifications.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }
        if (starting) {
            Scaffold(snackbarHost = { SnackbarHost(snackbar) }) { p ->
                Box(Modifier.padding(p).fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
            }
        } else if (user == null) {
            Scaffold(snackbarHost = { SnackbarHost(snackbar) }) { p ->
                AuthScreen(vm, Modifier.padding(p), busy)
            }
        } else key(user!!.text("id")) {
            val nav = rememberNavController()
            val entry by nav.currentBackStackEntryAsState()
            val route = entry?.destination?.route ?: "home"
            fun go(target: String) { nav.navigate(target) { launchSingleTop = true } }
            val title = when {
                route.startsWith("file/") -> "File details"
                route.startsWith("folder/") -> "Folder"
                route.startsWith("browse/") -> "Cloud files"
                else -> route.replaceFirstChar { it.uppercase() }.replace('-', ' ')
            }
            Scaffold(
                topBar = { TopAppBar(title = { Text(if (route == "home") "CloudGather" else title, fontWeight = FontWeight.Bold) },
                    navigationIcon = { if (nav.previousBackStackEntry != null) IconButton(onClick = { nav.popBackStack() }) { Icon(Icons.AutoMirrored.Outlined.ArrowBack, "Go back") } },
                    actions = {
                        IconButton(onClick = vm::refresh) { Icon(Icons.Outlined.Refresh, "Refresh") }
                        IconButton(onClick = { go("transfers") }) { Icon(Icons.Outlined.Sync, "Transfers") }
                    }) },
                bottomBar = { NavigationBar {
                    listOf(Triple("home", "Home", Icons.Outlined.Home), Triple("files", "Files", Icons.Outlined.Folder),
                        Triple("providers", "Clouds", Icons.Outlined.CloudQueue), Triple("account", "Account", Icons.Outlined.Person)).forEach { (target, label, icon) ->
                        NavigationBarItem(selected = route == target, onClick = {
                            nav.navigate(target) { popUpTo(nav.graph.startDestinationId) { saveState = true }; launchSingleTop = true; restoreState = true }
                        }, icon = { Icon(icon, label) }, label = { Text(label) })
                    }
                } }, snackbarHost = { SnackbarHost(snackbar) }
            ) { padding ->
                Column(Modifier.fillMaxSize().padding(padding)) {
                    if (busy) LinearProgressIndicator(Modifier.fillMaxWidth())
                    NavHost(navController = nav, startDestination = "home", modifier = Modifier.weight(1f)) {
                        composable("home") { HomeScreen(vm, ::go) }
                        composable("files") { FilesScreen(vm, ::go) }
                        composable("folder/{id}") { FilesScreen(vm, ::go, folder = it.arguments?.getString("id")) }
                        composable("search/{query}") { FilesScreen(vm, ::go, initialQuery = it.arguments?.getString("query") ?: "") }
                        composable("recents") { FilesScreen(vm, ::go, mode = "recents") }
                        composable("starred") { FilesScreen(vm, ::go, mode = "starred") }
                        composable("trash") { FilesScreen(vm, ::go, mode = "trash") }
                        composable("file/{id}") { FileDetailScreen(vm, it.arguments!!.getString("id")!!, ::go) }
                        composable("providers") { ProvidersScreen(vm, ::go) }
                        composable("browse/{id}") { ProviderBrowseScreen(vm, it.arguments!!.getString("id")!!) }
                        composable("storage") { StorageScreen(vm) }
                        composable("account") { AccountScreen(vm, ::go, theme) {
                            theme = it; settings.edit().putString("theme", it).apply()
                        } }
                        composable("transfers") { TransfersScreen(vm) }
                        composable("security") { SecurityScreen(vm) }
                        composable("billing") { BillingScreen(vm) }
                        composable("public-link") { PublicLinkScreen(vm) }
                        listOf("shared", "sent-shares", "links", "notifications", "activity", "api-keys", "webhooks", "saved-searches", "support", "admin", "admin-users", "admin-audit", "admin-contact", "admin-announcements", "admin-blog", "admin-outbox", "admin-settings").forEach { name ->
                            composable(name) { ResourceScreen(vm, name, ::go) }
                        }
                    }
                }
            }
            if (incoming.isNotEmpty()) AlertDialog(onDismissRequest = vm::dismissIncoming,
                title = { Text("Upload ${incoming.size} shared file(s)?") },
                text = { Text("Files will be added to the root of your CloudGather storage. Keep the sending app open until the upload is queued.") },
                confirmButton = { TextButton(onClick = {
                    incoming.forEach { uri ->
                        // Incoming grants may be transient. Persist only when supported; copy to app-private
                        // staging when not, so WorkManager remains reliable after the sending activity closes.
                        vm.task {
                            val staged = stageSharedFile(context, uri)
                            TransferWorker.enqueue(context, staged, "upload", "Shared file")
                        }
                    }; vm.dismissIncoming(); go("transfers")
                }) { Text("Upload") } }, dismissButton = { TextButton(onClick = vm::dismissIncoming) { Text("Cancel") } })
        }
    }
}

@Composable
private fun AuthScreen(vm: AppViewModel, modifier: Modifier, busy: Boolean) {
    val context = LocalContext.current
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var name by remember { mutableStateOf("") }
    var code by remember { mutableStateOf("") }
    var register by remember { mutableStateOf(false) }
    var form by remember { mutableStateOf<Form?>(null) }
    var notice by remember { mutableStateOf<String?>(null) }
    val challenge by vm.challenge.collectAsStateWithLifecycle()
    Column(modifier.fillMaxSize().imePadding().verticalScroll(rememberScrollState()).padding(28.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Spacer(Modifier.height(32.dp))
        Icon(Icons.Outlined.CloudDone, null, Modifier.size(56.dp), tint = MaterialTheme.colorScheme.primary)
        Text("Every cloud.\nOne calm place.", style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold)
        Text("Your files, connected. Built for Android.", color = MaterialTheme.colorScheme.onSurfaceVariant)
        if (challenge != null) {
            SectionTitle("Verify it’s you", "Enter an authenticator code or an unused recovery code.")
            OutlinedTextField(code, { code = it }, label = { Text("Verification code") }, modifier = Modifier.fillMaxWidth())
        } else {
            if (register) OutlinedTextField(name, { name = it }, label = { Text("Your name") }, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(email, { email = it }, label = { Text("Email") }, singleLine = true, modifier = Modifier.fillMaxWidth(),
                keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = androidx.compose.ui.text.input.KeyboardType.Email))
            OutlinedTextField(password, { password = it }, label = { Text("Password") }, visualTransformation = PasswordVisualTransformation(), singleLine = true, modifier = Modifier.fillMaxWidth())
            if (register) Text("By creating an account you agree to the Terms and Privacy policy. Password requirements are enforced by your server.", style = MaterialTheme.typography.bodySmall)
        }
        Button(onClick = { vm.authenticate(email, password, if (register) name else null, code) }, enabled = !busy,
            modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp)) { Text(if (challenge != null) "Verify" else if (register) "Create account" else "Sign in") }
        TextButton(onClick = { register = !register; vm.resetChallenge() }) { Text(if (register || challenge != null) "Back to sign in" else "Create an account") }
        if (challenge == null) {
            TextButton(onClick = {
                form = Form("Reset password", listOf(Field("email", "Email", email, "email")), confirm = "Send reset email") { body -> vm.task {
                    vm.api.call("/auth/password/reset", "POST", body, false); notice = "If this account exists, a reset email is on its way."
                } }
            }) { Text("Forgot password?") }
            TextButton(onClick = {
                form = Form("Set a new password", listOf(Field("token", "Token from reset email"), Field("password", "New password", type = "password"))) { body -> vm.task {
                    vm.api.call("/auth/password/confirm", "POST", body, false); notice = "Password reset. You can now sign in."
                } }
            }) { Text("Already have a reset token?") }
            vm.config.optJSONObject("capabilities")?.optJSONObject("social")?.let { social ->
                listOf("google", "github", "microsoft").filter { social.optBoolean(it) }.forEach { provider ->
                    OutlinedButton(onClick = { vm.social(provider) { browser(context, it) } }, modifier = Modifier.fillMaxWidth(), enabled = !busy) {
                        Text("Continue with ${provider.replaceFirstChar { it.uppercase() }}")
                    }
                }
            }
        }
        Row { TextButton(onClick = { browser(context, "https://cloud.freegameplay.site/privacy") }) { Text("Privacy") }
            TextButton(onClick = { browser(context, "https://cloud.freegameplay.site/terms") }) { Text("Terms") } }
        notice?.let { Text(it, color = MaterialTheme.colorScheme.primary) }
        if (busy) LinearProgressIndicator(Modifier.fillMaxWidth())
    }
    form?.let { FormDialog(it) { form = null } }
}
