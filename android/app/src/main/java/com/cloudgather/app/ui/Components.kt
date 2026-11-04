package com.cloudgather.app.ui

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.clickable
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.cloudgather.app.data.*
import kotlinx.coroutines.CancellationException
import org.json.JSONObject

fun browser(context: Context, url: String) {
    val uri = Uri.parse(url)
    require(uri.scheme == "https") { "This link is not secure." }
    CustomTabsIntent.Builder().setShowTitle(true).build().launchUrl(context, uri)
}
fun shareText(context: Context, text: String) {
    context.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text), "Share with"))
}

class RemoteState {
    var data by mutableStateOf<JSONObject?>(null)
    var loading by mutableStateOf(true)
    var error by mutableStateOf<String?>(null)
    var retry by mutableIntStateOf(0)
}
@Composable
fun remote(vm: AppViewModel, path: String): RemoteState {
    val result = remember(path) { RemoteState() }
    val revision by vm.revision.collectAsStateWithLifecycle()
    val owner by vm.user.collectAsStateWithLifecycle()
    LaunchedEffect(path, revision, result.retry, owner?.text("id")) {
        result.loading = true; result.error = null
        try { result.data = vm.api.call(path) } catch (e: CancellationException) { throw e } catch (e: Exception) {
            result.error = e.message ?: "Unable to connect. Try again."
            if (e is ApiException && e.status == 401) vm.clearSession()
        } finally { result.loading = false }
    }
    return result
}
@Composable
fun RemoteContent(state: RemoteState, content: @Composable (JSONObject) -> Unit) {
    if (state.loading && state.data == null) Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
    else if (state.error != null) Column(Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Icon(Icons.Outlined.CloudOff, contentDescription = null)
        Text("Couldn’t refresh", style = MaterialTheme.typography.titleLarge)
        Text(state.error!!)
        Button(onClick = { state.retry++ }) { Text("Try again") }
        // Never silently show stale data as current data.
    } else state.data?.let { content(it) }
}
@Composable
fun EmptyState(title: String = "Nothing here yet", description: String = "Your files will appear here.") {
    Column(Modifier.fillMaxWidth().padding(32.dp), horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Icon(Icons.Outlined.CloudQueue, null, Modifier.size(48.dp), tint = MaterialTheme.colorScheme.primary)
        Text(title, style = MaterialTheme.typography.titleLarge)
        Text(description, style = MaterialTheme.typography.bodyMedium)
    }
}
@Composable
fun SectionTitle(title: String, description: String? = null) {
    Column(Modifier.padding(vertical = 8.dp)) {
        Text(title, style = MaterialTheme.typography.headlineSmall)
        description?.let { Text(it, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant) }
    }
}
@Composable
fun FileRow(file: CloudFile, onClick: () -> Unit, onMenu: (() -> Unit)? = null, selected: Boolean? = null) {
    ListItem(
        headlineContent = { Text(file.name, maxLines = 2) },
        supportingContent = { Text(if (file.folder) "Folder · ${file.provider}" else "${formatBytes(file.size)} · ${file.provider}") },
        leadingContent = {
            if (selected != null) Checkbox(checked = selected, onCheckedChange = { onClick() })
            else Icon(if (file.folder) Icons.Outlined.Folder else Icons.Outlined.Description,
                null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(32.dp))
        },
        trailingContent = { Row(verticalAlignment = Alignment.CenterVertically) {
            if (file.starred) Icon(Icons.Outlined.Star, "Starred", tint = MaterialTheme.colorScheme.tertiary, modifier = Modifier.size(20.dp))
            if (onMenu != null) IconButton(onClick = onMenu) { Icon(Icons.Outlined.MoreVert, "File actions") }
        } },
        modifier = Modifier.fillMaxWidth().then(Modifier.nativeClick(onClick))
    )
}
fun Modifier.nativeClick(onClick: () -> Unit): Modifier = this.clickable(onClick = onClick)

/** Explicit typed native fields: API payloads are never entered as raw JSON. */
data class Field(val key: String, val label: String, val value: String = "", val type: String = "text", val required: Boolean = true)
data class Form(val title: String, val fields: List<Field>, val message: String? = null,
    val confirm: String = "Save", val submit: (JSONObject) -> Unit)
@Composable
fun FormDialog(form: Form, onDismiss: () -> Unit) {
    val values = remember(form) { form.fields.associate { it.key to mutableStateOf(it.value) } }
    var validation by remember(form) { mutableStateOf<String?>(null) }
    AlertDialog(onDismissRequest = onDismiss,
        title = { Text(form.title) },
        text = {
            Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                form.message?.let { Text(it) }
                form.fields.forEach { field ->
                    val value = values.getValue(field.key)
                    if (field.type == "boolean") Row(verticalAlignment = Alignment.CenterVertically) {
                        Checkbox(value.value == "true", { value.value = it.toString() }); Text(field.label)
                    } else OutlinedTextField(value.value, { value.value = it }, label = { Text(field.label) },
                        modifier = Modifier.fillMaxWidth(), singleLine = field.type != "multiline",
                        visualTransformation = if (field.type == "password") PasswordVisualTransformation() else VisualTransformation.None,
                        keyboardOptions = KeyboardOptions(keyboardType = when (field.type) {
                            "password" -> KeyboardType.Password; "number" -> KeyboardType.Number; "email" -> KeyboardType.Email; else -> KeyboardType.Text
                        }))
                }
                validation?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            }
        },
        confirmButton = { TextButton(onClick = {
            try {
                val body = JSONObject()
                form.fields.forEach { field ->
                    val value = values.getValue(field.key).value
                    require(!field.required || value.isNotBlank()) { "${field.label} is required." }
                    if (value.isNotBlank() || field.required || field.type == "list" || field.type == "multiline") body.put(field.key, when (field.type) {
                        "number" -> value.toLongOrNull() ?: error("${field.label} must be a whole number.")
                        "boolean" -> value == "true"
                        "list" -> org.json.JSONArray(value.split(',').map { it.trim() }.filter { it.isNotEmpty() })
                        else -> value
                    })
                }
                form.submit(body); onDismiss()
            } catch (e: Exception) { validation = e.message }
        }) { Text(form.confirm) } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } })
}
@Composable
fun InfoCard(title: String, subtitle: String, onClick: (() -> Unit)? = null) {
    Card(Modifier.fillMaxWidth().then(if (onClick != null) Modifier.nativeClick(onClick) else Modifier)) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(title, style = MaterialTheme.typography.titleMedium)
            Text(subtitle, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}
