package com.cloudgather.app.ui

import android.net.Uri
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.cloudgather.app.data.*
import org.json.JSONObject

@Composable
fun ProvidersScreen(vm: AppViewModel, go: (String) -> Unit) {
    val context = LocalContext.current
    val connections = remote(vm, "/providers")
    val catalogue = remote(vm, "/providers/catalogue")
    var form by remember { mutableStateOf<Form?>(null) }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        SectionTitle("Your connected clouds", "One workspace. Your accounts stay yours.")
        RemoteContent(connections) { data ->
            if (data.rows("providers").isEmpty()) EmptyState("Connect your first cloud", "Choose a provider below. Credentials are sent securely to your server, never stored on your phone.")
            data.rows("providers").forEach { p ->
                val id = p.text("id")
                InfoCard(p.text("display_name", p.text("provider_name")), "${p.text("status")} · ${p.text("provider_user_email")}\n${formatBytes(p.optLong("used_space"))} used\n${p.text("last_error")}") { go("browse/$id") }
                Row {
                    TextButton(onClick = { go("browse/$id") }) { Text("Browse") }
                    TextButton(onClick = { vm.task { vm.api.call("/providers/$id/sync", "POST"); vm.refresh() } }) { Text("Sync") }
                    TextButton(onClick = { form = Form("Disconnect cloud?", emptyList(), "Your files at the provider are not deleted.", "Disconnect") { vm.task { vm.api.call("/providers/$id", "DELETE"); vm.refresh() } } }) { Text("Disconnect") }
                }
            }
        }
        SectionTitle("Add a cloud")
        RemoteContent(catalogue) { data -> data.rows("providers").forEach { provider ->
            val configured = provider.flag("configured")
            InfoCard(provider.text("name"), provider.text("description"))
            if (!configured) Text(provider.text("setupHint", "This integration has not been configured by the server administrator."), style = MaterialTheme.typography.bodySmall)
            Button(enabled = configured, onClick = {
                if (provider.text("kind") == "oauth") vm.connectOAuth(provider.text("id")) { browser(context, it) }
                else {
                    val fields = provider.rows("credentialFields").map { Field(it.text("key"), it.text("label"), type = it.text("type", "text"), required = it.flag("required")) }
                    form = Form("Connect ${provider.text("name")}", listOf(Field("display_name", "Account label", required = false)) + fields) { body -> vm.task {
                        val credentials = JSONObject(body.toString()).apply { remove("display_name") }
                        vm.api.call("/providers/connect", "POST", json("provider" to provider.text("id"), "display_name" to body.text("display_name"), "credentials" to credentials)); vm.refresh()
                    } }
                }
            }) { Text(if (configured) "Connect ${provider.text("name")}" else "Not configured") }
        } }
    }
    form?.let { FormDialog(it) { form = null } }
}

@Composable
fun ProviderBrowseScreen(vm: AppViewModel, id: String) {
    var folders by remember { mutableStateOf(listOf<Pair<String, String>>()) }
    var search by remember { mutableStateOf("") }
    var submitted by remember { mutableStateOf("") }
    val path = "/providers/${Uri.encode(id)}/browse?" + (folders.lastOrNull()?.first?.let { "folder=${Uri.encode(it)}&" } ?: "") + "q=${Uri.encode(submitted)}"
    val state = remote(vm, path)
    var form by remember { mutableStateOf<Form?>(null) }
    Column(Modifier.fillMaxSize().padding(16.dp)) {
        if (folders.isNotEmpty()) TextButton(onClick = { folders = folders.dropLast(1) }) { Text("Back · ${folders.last().second}") }
        OutlinedTextField(search, { search = it }, modifier = Modifier.fillMaxWidth(), label = { Text("Search this cloud") }, trailingIcon = {
            TextButton(onClick = { submitted = search }) { Text("Find") }
        })
        RemoteContent(state) { data ->
            LazyColumn {
                if (data.rows("entries").isEmpty()) item { EmptyState() }
                items(data.rows("entries"), key = { it.text("id") }) { e ->
                    ListItem(headlineContent = { Text(e.text("name")) }, supportingContent = { Text(if (e.flag("isFolder")) "Folder" else formatBytes(e.optLong("size"))) },
                        modifier = Modifier.nativeClick {
                            if (e.flag("isFolder")) folders = folders + (e.text("id") to e.text("name"))
                            else form = Form("Import ${e.text("name")}?", listOf(Field("copy", "Copy into managed CloudGather storage", "false", "boolean")),
                                "Leave copy off to index the file in place without duplicating its bytes.", "Import") { body -> vm.task {
                                body.put("file_id", e.text("id")).put("name", e.text("name")); vm.api.call("/providers/$id/import", "POST", body); vm.refresh()
                            } }
                        })
                }
                data.text("cursor").takeIf { it.isNotBlank() }?.let { item { Text("More results exist at this provider. Use search to narrow your results.", Modifier.padding(16.dp)) } }
            }
        }
    }
    form?.let { FormDialog(it) { form = null } }
}

@Composable
fun StorageScreen(vm: AppViewModel) {
    val state = remote(vm, "/files/stats")
    RemoteContent(state) { data ->
        Column(Modifier.verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            val usage = data.optJSONObject("usage") ?: JSONObject()
            val limits = data.optJSONObject("limits") ?: JSONObject()
            SectionTitle("Space to do more", "${data.optJSONObject("plan")?.text("name")} plan")
            InfoCard("${formatBytes(usage.optLong("storageBytes"))} used", "of ${formatBytes(limits.optLong("storageBytes"))} managed storage")
            LinearProgressIndicator(progress = { (data.optDouble("storage_percent", 0.0) / 100).toFloat().coerceIn(0f, 1f) }, modifier = Modifier.fillMaxWidth())
            Text("${usage.optInt("fileCount")} files · ${usage.optInt("folderCount")} folders · ${formatBytes(usage.optLong("trashBytes"))} in trash")
            SectionTitle("By file type")
            data.rows("by_category").forEach { InfoCard(it.text("category"), "${it.optInt("files")} files · ${formatBytes(it.optLong("bytes"))}") }
            SectionTitle("By cloud")
            data.rows("by_provider").forEach { InfoCard(it.text("provider_name", "CloudGather"), "${it.optInt("items")} items · ${formatBytes(it.optLong("bytes"))}") }
        }
    }
}
