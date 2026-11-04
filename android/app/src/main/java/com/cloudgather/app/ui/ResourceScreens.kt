@file:OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)

package com.cloudgather.app.ui

import android.content.Intent
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.cloudgather.app.data.*
import com.cloudgather.app.transfer.TransferWorker
import org.json.JSONArray
import org.json.JSONObject

private data class Resource(val path: String, val key: String, val title: String)
private val resources = mapOf(
    "shared" to Resource("/shares/received", "shares", "Shared with me"),
    "sent-shares" to Resource("/shares/sent", "shares", "Shared by me"),
    "links" to Resource("/links", "links", "Public links"),
    "notifications" to Resource("/notifications?limit=100", "notifications", "Notifications"),
    "activity" to Resource("/activity", "activity", "Account activity"),
    "api-keys" to Resource("/api-keys", "keys", "Developer API keys"),
    "webhooks" to Resource("/webhooks", "endpoints", "Webhooks"),
    "saved-searches" to Resource("/saved-searches", "searches", "Saved searches"),
    "support" to Resource("/contact/mine", "messages", "Help & support"),
    "admin" to Resource("/admin/stats", "", "Administration"),
    "admin-users" to Resource("/admin/users", "users", "Users"),
    "admin-audit" to Resource("/admin/audit", "items", "Audit log"),
    "admin-contact" to Resource("/admin/contact", "items", "Support inbox"),
    "admin-announcements" to Resource("/admin/announcements", "announcements", "Announcements"),
    "admin-blog" to Resource("/admin/blog", "items", "Blog posts"),
    "admin-settings" to Resource("/admin/settings", "settings", "Server settings"),
    "admin-outbox" to Resource("/admin/email-outbox?status=pending", "items", "Email outbox")
)
@Composable
fun ResourceScreen(vm: AppViewModel, name: String, go: (String) -> Unit) {
    val definition = resources.getValue(name)
    val user by vm.user.collectAsStateWithLifecycle()
    if (name.startsWith("admin") && user?.text("role") != "admin") { EmptyState("Access denied", "Administrator access is required."); return }
    var page by remember(name) { mutableIntStateOf(1) }
    val state = remote(vm, definition.path + (if ('?' in definition.path) "&" else "?") + "page=$page")
    var form by remember(name) { mutableStateOf<Form?>(null) }
    var reveal by remember(name) { mutableStateOf<String?>(null) }
    val context = LocalContext.current
    var downloadPath by remember { mutableStateOf("") }
    val download = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("*/*")) { uri ->
        uri?.let {
            runCatching { context.contentResolver.takePersistableUriPermission(it, Intent.FLAG_GRANT_WRITE_URI_PERMISSION) }
            TransferWorker.enqueue(context, it, "download", "Shared file", path = downloadPath); go("transfers")
        }
    }
    fun mutation(title: String, path: String, method: String = "POST", fields: List<Field> = emptyList(), message: String? = null,
        transform: (JSONObject) -> JSONObject = { it }) {
        form = Form(title, fields, message) { body -> vm.task {
            val result = vm.api.call(path, method, transform(body))
            result.optJSONObject("key")?.text("key")?.takeIf { it.isNotBlank() }?.let { reveal = "Copy this key now. It will not be shown again.\n\n$it" }
            result.text("secret").takeIf { it.isNotBlank() }?.let { reveal = "Store this signing secret securely.\n\n$it" }
            vm.refresh()
        } }
    }
    RemoteContent(state) { data ->
        LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            item { SectionTitle(definition.title) }
            item {
                when (name) {
                    "notifications" -> {
                        TextButton(onClick = { mutation("Mark all notifications read?", "/notifications/read-all") }) { Text("Mark all read") }
                        TextButton(onClick = { mutation("Notification preferences", "/notifications/preferences", "PATCH", listOf(
                            Field("emailSharing", "Sharing email", "true", "boolean"), Field("inAppAll", "In-app notifications", "true", "boolean"),
                            Field("emailWeeklyDigest", "Weekly digest", "false", "boolean"))) }) { Text("Notification preferences") }
                    }
                    "api-keys" -> Button(onClick = { mutation("Create API key", "/api-keys", fields = listOf(Field("name", "Key name"),
                        Field("permissions", "Scopes, comma separated", "read", "list"), Field("description", "Description", required = false)), message = "Available scopes: ${data.strings("scopes").joinToString()}. Choose the minimum permissions needed.") }) { Text("Create key") }
                    "webhooks" -> if (data.flag("available")) Button(onClick = { mutation("Add webhook", "/webhooks", fields = listOf(
                        Field("url", "HTTPS endpoint URL"), Field("events", "Events, comma separated", "file.uploaded", "list"), Field("description", "Description", required = false)), message = "Available events: ${data.strings("events").joinToString()}") }) { Text("Add endpoint") }
                        else Text("Webhooks are unavailable for this server or plan.")
                    "support" -> Button(onClick = { mutation("Contact support", "/contact/mine", fields = listOf(Field("name", "Name", user?.text("display_name") ?: ""),
                        Field("email", "Email", user?.text("email") ?: "", "email"), Field("subject", "Subject"), Field("message", "Message", type = "multiline"))) }) { Text("New enquiry") }
                    "admin-announcements" -> Button(onClick = { mutation("New announcement", "/admin/announcements", fields = listOf(Field("title", "Title"), Field("body", "Message", type = "multiline"), Field("level", "Level: info, success, warning, critical", "info"), Field("published", "Published", "true", "boolean"))) }) { Text("New announcement") }
                    "admin-blog" -> Button(onClick = { mutation("Create blog post", "/admin/blog", fields = listOf(Field("title", "Title"), Field("content", "Markdown content", type = "multiline"), Field("excerpt", "Excerpt"), Field("author", "Author", user?.text("display_name") ?: "CloudGather"), Field("category", "Category", "Product"), Field("published", "Publish now", "false", "boolean"))) }) { Text("New post") }
                    "admin-outbox" -> Button(onClick = { mutation("Flush pending email?", "/admin/email-outbox/flush") }) { Text("Flush email queue") }
                    "admin" -> {
                        InfoCard("Platform overview", "${data.optInt("userCount")} users · ${data.optInt("fileCount")} files · ${data.optInt("providerCount")} clouds")
                        data.optJSONObject("metrics")?.let { InfoCard("Operations", "${it.optInt("pending_emails")} pending emails · ${it.optInt("open_tickets")} open tickets\n${formatBytes(it.optLong("managed_storage_bytes"))} managed storage") }
                        listOf("admin-users" to "Users", "admin-settings" to "Server settings", "admin-audit" to "Audit log", "admin-contact" to "Support inbox",
                            "admin-announcements" to "Announcements", "admin-blog" to "Blog posts", "admin-outbox" to "Email outbox").forEach { (route, title) -> TextButton(onClick = { go(route) }) { Text(title) } }
                        TextButton(onClick = { mutation("Maintenance mode", "/admin/maintenance", fields = listOf(Field("enabled", "Enable maintenance mode", "false", "boolean"), Field("message", "User-facing message", "We’ll be back soon."))) }) { Text("Maintenance mode") }
                        TextButton(onClick = { mutation("Run maintenance task?", "/admin/cron/run", fields = listOf(Field("task", "Task", "all")), message = "Runs backend maintenance now. Use only when needed.") }) { Text("Run scheduled tasks now") }
                    }
                }
            }
            val rows = data.rows(definition.key)
            if (rows.isEmpty() && name != "admin") item { EmptyState("All clear", "There are no ${definition.title.lowercase()} to show.") }
            items(rows, key = { it.text("id", it.text("setting_key")) }) { row ->
                val id = Uri.encode(row.text("id"))
                val title = when (name) {
                    "shared", "sent-shares", "links" -> row.text("filename", "Shared file")
                    "activity", "admin-audit" -> row.text("action")
                    "api-keys", "saved-searches" -> row.text("name")
                    "webhooks" -> row.text("url")
                    "support", "admin-contact", "admin-outbox" -> row.text("subject")
                    "admin-users" -> row.text("display_name", row.text("email"))
                    "admin-settings" -> row.text("setting_key")
                    else -> row.text("title")
                }
                val subtitle = when (name) {
                    "notifications" -> row.text("body") + "\n" + row.text("created_at")
                    "shared", "sent-shares" -> "${row.text("owner_email", row.text("shared_with_email"))} · ${row.text("permission_level")}${row.text("revoked_at").takeIf { it.isNotBlank() }?.let { " · Revoked" } ?: ""}"
                    "links" -> "${row.optInt("download_count")} downloads · Expires ${row.text("expires_at", "never")}"
                    "api-keys" -> "${row.text("key_prefix")} · ${row.text("description")}"
                    "webhooks" -> "${if (row.flag("enabled")) "Enabled" else "Disabled"} · ${row.text("description")}"
                    "saved-searches" -> row.text("query")
                    "support", "admin-contact" -> "${row.text("status")}\n${row.text("message")}\n${row.text("reply")}"
                    "admin-users" -> "${row.text("email")} · ${row.text("role")} · ${row.text("plan")} · ${row.text("status")}"
                    "admin-settings" -> "${row.opt("setting_value")}\n${row.text("description")}"
                    "admin-outbox" -> "${row.text("to_email")} · ${row.optInt("attempts")} attempts\n${row.text("last_error")}"
                    else -> row.text("created_at", row.text("excerpt"))
                }
                InfoCard(title, subtitle)
                FlowRowActions {
                    when (name) {
                        "shared" -> TextButton(onClick = { downloadPath = "/shares/$id/download"; download.launch(row.text("filename", "Shared file")) }) { Text("Save file") }
                        "sent-shares" -> {
                            TextButton(onClick = { mutation("Update share", "/shares/$id", "PATCH", listOf(Field("permission_level", "Permission: view or edit", row.text("permission_level")))) }) { Text("Edit access") }
                            TextButton(onClick = { mutation("Revoke shared access?", "/shares/$id", "DELETE") }) { Text("Revoke") }
                        }
                        "links" -> {
                            TextButton(onClick = { vm.task { val visits = vm.api.call("/links/$id/visits").rows("visits"); reveal = visits.joinToString("\n") { "${it.text("created_at")} · ${it.text("action")}" }.ifBlank { "No visits yet." } } }) { Text("Visits") }
                            TextButton(onClick = { mutation("Revoke public link?", "/links/$id", "DELETE") }) { Text("Revoke") }
                        }
                        "notifications" -> {
                            if (row.text("read_at").isBlank()) TextButton(onClick = { vm.task { vm.api.call("/notifications/$id/read", "POST"); vm.refresh() } }) { Text("Mark read") }
                            TextButton(onClick = { mutation("Delete notification?", "/notifications/$id", "DELETE") }) { Text("Delete") }
                        }
                        "api-keys" -> {
                            TextButton(onClick = { mutation("Rotate API key?", "/api-keys/$id/rotate", message = "The old key stops working immediately.") }) { Text("Rotate") }
                            TextButton(onClick = { mutation("Revoke API key?", "/api-keys/$id", "DELETE") }) { Text("Revoke") }
                        }
                        "webhooks" -> {
                            TextButton(onClick = { vm.task { val result = vm.api.call("/webhooks/$id/test", "POST"); reveal = "Delivery ${if (result.flag("ok")) "succeeded" else "failed"}: HTTP ${result.optInt("status")}" } }) { Text("Test") }
                            TextButton(onClick = { vm.task { val deliveries = vm.api.call("/webhooks/$id/deliveries").rows("deliveries"); reveal = deliveries.joinToString("\n") { "${it.text("event_type")} · ${it.text("status")} · ${it.text("created_at")}" }.ifBlank { "No deliveries yet." } } }) { Text("Deliveries") }
                            TextButton(onClick = { mutation("Edit webhook", "/webhooks/$id", "PATCH", listOf(Field("url", "Endpoint URL", row.text("url")), Field("enabled", "Enabled", row.flag("enabled").toString(), "boolean"))) }) { Text("Edit") }
                            TextButton(onClick = { mutation("Delete webhook?", "/webhooks/$id", "DELETE") }) { Text("Delete") }
                        }
                        "saved-searches" -> {
                            TextButton(onClick = { go("search/${Uri.encode(row.text("query"))}") }) { Text("Run search") }
                            TextButton(onClick = { mutation("Delete saved search?", "/saved-searches/$id", "DELETE") }) { Text("Delete") }
                        }
                        "admin-users" -> {
                            TextButton(onClick = { mutation("Update user", "/admin/users/$id", "PATCH", listOf(Field("display_name", "Name", row.text("display_name")), Field("role", "Role: user or admin", row.text("role")), Field("status", "Status: active or suspended", row.text("status")), Field("plan", "Plan: free, pro, team, enterprise", row.text("plan")))) }) { Text("Edit") }
                            TextButton(onClick = { mutation("Send password reset?", "/admin/users/$id/password-reset") }) { Text("Reset password") }
                            TextButton(onClick = { mutation("Revoke user sessions?", "/admin/users/$id/sessions/revoke") }) { Text("Revoke sessions") }
                            TextButton(onClick = { mutation("Schedule user deletion?", "/admin/users/$id", "DELETE") }) { Text("Delete user") }
                        }
                        "admin-contact" -> TextButton(onClick = { mutation("Reply to enquiry", "/admin/contact/$id", "PATCH", listOf(Field("reply", "Reply", type = "multiline"), Field("status", "Status", "resolved"))) }) { Text("Reply") }
                        "admin-announcements" -> {
                            TextButton(onClick = { mutation("Edit announcement", "/admin/announcements/$id", "PATCH", listOf(Field("title", "Title", row.text("title")), Field("body", "Message", row.text("body"), "multiline"), Field("published", "Published", row.flag("published").toString(), "boolean"))) }) { Text("Edit") }
                            TextButton(onClick = { mutation("Broadcast to all users?", "/admin/announcements/$id/broadcast") }) { Text("Broadcast") }
                            TextButton(onClick = { mutation("Delete announcement?", "/admin/announcements/$id", "DELETE") }) { Text("Delete") }
                        }
                        "admin-blog" -> {
                            TextButton(onClick = { mutation("Edit post", "/admin/blog/$id", "PATCH", listOf(Field("title", "Title", row.text("title")), Field("content", "Content", row.text("content"), "multiline"), Field("published", "Published", row.flag("published").toString(), "boolean"))) }) { Text("Edit") }
                            TextButton(onClick = { mutation("Duplicate post?", "/admin/blog/$id/duplicate") }) { Text("Duplicate") }
                            TextButton(onClick = { mutation("Delete post?", "/admin/blog/$id", "DELETE") }) { Text("Delete") }
                        }
                        "admin-settings" -> {
                            val current = row.opt("setting_value")
                            TextButton(onClick = { mutation("Update ${row.text("setting_key")}", "/admin/settings", "PATCH", listOf(Field("value", "Value", current.toString(), if (current is Boolean) "boolean" else if (current is Number) "number" else "text")),
                                transform = { body -> json("changes" to JSONArray().put(json("key" to row.text("setting_key"), "value" to body.get("value")))) }) }) { Text("Edit setting") }
                        }
                    }
                }
            }
            item { Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                if (page > 1) TextButton(onClick = { page-- }) { Text("Previous") }
                if (data.flag("hasMore")) TextButton(onClick = { page++ }) { Text("Next") }
            } }
        }
    }
    form?.let { FormDialog(it) { form = null } }
    reveal?.let { text -> AlertDialog(onDismissRequest = { reveal = null }, title = { Text("Result") },
        text = { androidx.compose.foundation.text.selection.SelectionContainer { Text(text) } }, confirmButton = { TextButton(onClick = { reveal = null }) { Text("Done") } }) }
}
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun FlowRowActions(content: @Composable FlowRowScope.() -> Unit) {
    FlowRow(horizontalArrangement = Arrangement.spacedBy(4.dp), content = content)
}
