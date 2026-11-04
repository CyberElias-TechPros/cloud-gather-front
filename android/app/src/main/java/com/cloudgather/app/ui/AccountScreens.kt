package com.cloudgather.app.ui

import android.content.Intent
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.cloudgather.app.data.*
import com.cloudgather.app.transfer.TransferWorker
import org.json.JSONObject

@Composable
fun AccountScreen(vm: AppViewModel, go: (String) -> Unit, theme: String, setTheme: (String) -> Unit) {
    val user by vm.user.collectAsStateWithLifecycle()
    val context = LocalContext.current
    var form by remember { mutableStateOf<Form?>(null) }
    val export = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/json")) { uri ->
        uri?.let {
            runCatching { context.contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_WRITE_URI_PERMISSION) }
            TransferWorker.enqueue(context, it, "download", "Account export", path = "/export"); go("transfers")
        }
    }
    Column(Modifier.verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        SectionTitle(user?.text("display_name") ?: "Your account", user?.text("email"))
        TextButton(onClick = { form = Form("Edit profile", listOf(Field("display_name", "Display name", user?.text("display_name") ?: ""), Field("timezone", "Timezone", user?.optJSONObject("settings")?.text("timezone") ?: java.util.TimeZone.getDefault().id))) { body -> vm.task {
            vm.api.call("/profile", "PATCH", body); vm.refreshProfile()
        } } }) { Text("Edit profile") }
        Text("Appearance", style = MaterialTheme.typography.titleMedium)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf("system", "light", "dark").forEach { t -> FilterChip(theme == t, { setTheme(t) }, label = { Text(t.replaceFirstChar { it.uppercase() }) }) }
        }
        listOf("security" to "Password & security", "notifications" to "Notifications", "storage" to "Storage usage", "billing" to "Plan & invoices",
            "shared" to "Shared with me", "sent-shares" to "Shared by me", "links" to "Public links", "trash" to "Trash", "activity" to "Account activity",
            "saved-searches" to "Saved searches", "api-keys" to "Developer API keys", "webhooks" to "Webhooks", "public-link" to "Open a public link",
            "support" to "Help & support").forEach { (route, title) -> InfoCard(title, "Open ${title.lowercase()}") { go(route) } }
        if (user?.text("role") == "admin") InfoCard("Administration", "Manage users, settings and operations") { go("admin") }
        OutlinedButton(onClick = { export.launch("cloudgather-export.json") }, modifier = Modifier.fillMaxWidth()) { Text("Export account data") }
        OutlinedButton(onClick = { form = Form("Delete your account?", listOf(Field("password", "Confirm password", type = "password")),
            "This schedules deletion after the server’s grace period. You can cancel before the purge.", "Request deletion") { body -> vm.task {
            vm.api.call("/account", "DELETE", body); vm.refreshProfile()
        } } }, modifier = Modifier.fillMaxWidth()) { Text("Request account deletion") }
        if (user?.text("status") == "pending_deletion") Button(onClick = { vm.task { vm.api.call("/account/restore", "POST"); vm.refreshProfile() } }) { Text("Cancel account deletion") }
        Button(onClick = { form = Form("Sign out?", emptyList(), "Active transfers will be cancelled and this device’s session cleared.", "Sign out") { vm.signOut() } }, modifier = Modifier.fillMaxWidth()) { Text("Sign out") }
        Text("CloudGather for Android · 1.0.0", style = MaterialTheme.typography.bodySmall)
    }
    form?.let { FormDialog(it) { form = null } }
}

@Composable
fun SecurityScreen(vm: AppViewModel) {
    val sessions = remote(vm, "/auth/sessions")
    val identities = remote(vm, "/auth/identities")
    val user by vm.user.collectAsStateWithLifecycle()
    var form by remember { mutableStateOf<Form?>(null) }
    var secret by remember { mutableStateOf<String?>(null) }
    var codes by remember { mutableStateOf<List<String>?>(null) }
    Column(Modifier.verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        SectionTitle("Keep your account safe")
        OutlinedButton(onClick = { form = Form("Change password", listOf(Field("currentPassword", "Current password", type = "password"), Field("password", "New password", type = "password"))) { body -> vm.task { vm.api.call("/auth/password", "PATCH", body); vm.refresh() } } }) { Text("Change password") }
        if (user?.flag("email_verified") != true) {
            Button(onClick = { vm.task { vm.api.call("/auth/email/verify/send", "POST") } }) { Text("Send verification email") }
            TextButton(onClick = { form = Form("Verify email", listOf(Field("token", "Token from verification email"))) { body -> vm.task { vm.api.call("/auth/email/verify/confirm", "POST", body); vm.refreshProfile() } } }) { Text("Enter verification token") }
        } else Text("Email verified")
        SectionTitle("Two-factor authentication", if (user?.flag("two_factor_enabled") == true) "Enabled" else "Add a second layer of protection")
        if (user?.flag("two_factor_enabled") == true) {
            OutlinedButton(onClick = { form = Form("Disable two-factor authentication", listOf(Field("password", "Confirm password", type = "password"))) { body -> vm.task { vm.api.call("/auth/2fa/disable", "POST", body); vm.refreshProfile() } } }) { Text("Disable 2FA") }
            OutlinedButton(onClick = { form = Form("Replace recovery codes?", emptyList(), "Your old recovery codes will stop working.") { vm.task { codes = vm.api.call("/auth/2fa/recovery-codes", "POST").strings("recovery_codes") } } }) { Text("New recovery codes") }
        } else Button(onClick = { vm.task { secret = vm.api.call("/auth/2fa/setup", "POST").getString("secret") } }) { Text("Set up authenticator") }
        secret?.let { value ->
            Text("Add this key to your authenticator, then enter the six-digit code.")
            androidx.compose.foundation.text.selection.SelectionContainer { Text(value) }
            Button(onClick = { form = Form("Confirm authenticator", listOf(Field("code", "Six-digit code"))) { body -> vm.task {
                codes = vm.api.call("/auth/2fa/enable", "POST", body).strings("recovery_codes"); secret = null; vm.refreshProfile()
            } } }) { Text("Enter authenticator code") }
        }
        codes?.let { recovery ->
            InfoCard("Save these recovery codes somewhere safe", "Each code works once. These are not stored on your phone.")
            androidx.compose.foundation.text.selection.SelectionContainer { Text(recovery.joinToString("\n")) }
            TextButton(onClick = { codes = null }) { Text("I have saved my codes") }
        }
        SectionTitle("Signed-in devices")
        RemoteContent(sessions) { it.rows("sessions").forEach { session ->
            InfoCard(session.text("user_agent", "Device"), "${session.text("ip_address")} · ${session.text("last_seen_at")}")
            TextButton(onClick = { form = Form("Revoke device session?", emptyList()) { vm.task { vm.api.call("/auth/sessions/${session.text("id")}", "DELETE"); vm.refresh() } } }) { Text("Revoke session") }
        } }
        TextButton(onClick = { form = Form("Sign out every device?", emptyList(), confirm = "Sign out everywhere") { vm.task { vm.api.call("/auth/logout-all", "POST"); vm.clearSession() } } }) { Text("Sign out everywhere") }
        SectionTitle("Linked identities")
        RemoteContent(identities) { it.rows("identities").forEach { identity ->
            InfoCard(identity.text("provider"), identity.text("email"))
            TextButton(onClick = { form = Form("Unlink identity?", emptyList()) { vm.task { vm.api.call("/auth/identities/${identity.text("id")}", "DELETE"); vm.refresh() } } }) { Text("Unlink") }
        } }
    }
    form?.let { FormDialog(it) { form = null } }
}

@Composable
fun BillingScreen(vm: AppViewModel) {
    val state = remote(vm, "/billing/subscription")
    RemoteContent(state) { data -> Column(Modifier.verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        SectionTitle("Your plan", data.optJSONObject("plan")?.text("name"))
        val usage = data.optJSONObject("usage") ?: JSONObject()
        InfoCard("Your usage", "${formatBytes(usage.optLong("storageBytes"))} stored · ${usage.optInt("providerCount")} clouds connected")
        Text("Purchases and plan changes are not enabled in this Android build. Existing subscriptions and entitlements remain available. Google Play Billing or an eligible distribution-specific billing flow must be integrated before publishing paid upgrades.")
        // Do not route Play users into the web Stripe checkout for digital cloud-storage upgrades.
        data.optJSONObject("subscription")?.let { InfoCard("Subscription", "${it.text("status")} · Renews ${it.text("current_period_end")}") }
        SectionTitle("Invoices")
        data.rows("invoices").forEach { invoice ->
            InfoCard(invoice.text("number", "Invoice"), "${invoice.optLong("amount_paid") / 100.0} ${invoice.text("currency").uppercase()} · ${invoice.text("status")}")
        }
        if (data.rows("invoices").isEmpty()) Text("No invoices yet.")
    } }
}
