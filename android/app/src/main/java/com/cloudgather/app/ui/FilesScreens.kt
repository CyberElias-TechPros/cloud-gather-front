package com.cloudgather.app.ui

import android.content.Intent
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.cloudgather.app.data.*
import com.cloudgather.app.transfer.TransferWorker
import org.json.JSONObject

@Composable
fun HomeScreen(vm: AppViewModel, go: (String) -> Unit) {
    val state = remote(vm, "/dashboard")
    RemoteContent(state) { data ->
        LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            item {
                SectionTitle("Hello, ${data.optJSONObject("user")?.text("display_name")?.substringBefore(' ') ?: "there"}", "Everything you need. All together.")
            }
            data.optJSONObject("announcement")?.let { a -> item { InfoCard(a.text("title"), a.text("body")) } }
            item {
                val entitlements = data.optJSONObject("entitlements") ?: JSONObject()
                val usage = entitlements.optJSONObject("usage") ?: JSONObject()
                val limit = entitlements.optJSONObject("limits")?.optLong("storageBytes") ?: 0
                Card(Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)) {
                    Column(Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Text("Your cloud, at a glance", style = MaterialTheme.typography.titleLarge)
                        Text("${formatBytes(usage.optLong("storageBytes"))} of ${formatBytes(limit)} used")
                        LinearProgressIndicator(progress = { (entitlements.optDouble("storage_percent", 0.0) / 100).toFloat().coerceIn(0f, 1f) }, modifier = Modifier.fillMaxWidth())
                        Text("${usage.optInt("fileCount")} files · ${usage.optInt("providerCount")} connected clouds")
                        TextButton(onClick = { go("storage") }) { Text("Storage details") }
                    }
                }
            }
            item { Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilledTonalButton(onClick = { go("starred") }) { Text("Starred") }
                FilledTonalButton(onClick = { go("shared") }) { Text("Shared") }
                FilledTonalButton(onClick = { go("recents") }) { Text("Recent") }
            } }
            item { InfoCard("Stay in the loop", "${data.optInt("unread_notifications")} unread notifications") { go("notifications") } }
            item { SectionTitle("Pick up where you left off") }
            val files = data.rows("recent_files").map(CloudFile::from)
            if (files.isEmpty()) item { EmptyState("A fresh start", "Upload a file or connect a cloud to get started.") }
            items(files, key = { it.id }) { file -> FileRow(file, { go(if (file.folder) "folder/${file.id}" else "file/${file.id}") }) }
            item { InfoCard("A place for every cloud", "Connect your existing storage accounts without moving your files.") { go("providers") } }
        }
    }
}

@Composable
fun FilesScreen(vm: AppViewModel, go: (String) -> Unit, folder: String? = null, mode: String = "files", initialQuery: String = "") {
    val context = LocalContext.current
    var query by remember(initialQuery) { mutableStateOf(initialQuery) }
    var submitted by remember(initialQuery) { mutableStateOf(initialQuery) }
    var page by remember(folder, mode, submitted) { mutableIntStateOf(1) }
    var sort by remember { mutableStateOf("name") }
    var selected by remember(folder, mode) { mutableStateOf(setOf<String>()) }
    var selectionMode by remember { mutableStateOf(false) }
    var form by remember { mutableStateOf<Form?>(null) }
    val path = when {
        submitted.isNotBlank() -> "/search?q=${Uri.encode(submitted)}&limit=200"
        mode == "trash" -> "/trash"
        mode == "recents" -> "/files/recents?limit=100"
        else -> "/files?limit=50&page=$page&sort=$sort&direction=asc" + (folder?.let { "&parent=${Uri.encode(it)}" } ?: "") + if (mode == "starred") "&filter=starred" else ""
    }
    val state = remote(vm, path)
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.OpenMultipleDocuments()) { uris ->
        uris.forEach { uri ->
            runCatching { context.contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION) }
            TransferWorker.enqueue(context, uri, "upload", "Selected file", parent = folder)
        }
        if (uris.isNotEmpty()) go("transfers")
    }
    fun action(title: String, endpoint: String, method: String = "POST", body: JSONObject? = null) {
        form = Form(title, emptyList(), "This action applies to ${selected.size} selected item(s).", "Confirm") {
            vm.task {
                val result = vm.api.call(endpoint, method, body)
                if (result.rows("errors").isNotEmpty()) error(result.rows("errors").joinToString("\n") { it.text("message") })
                selected = emptySet(); selectionMode = false; vm.refresh()
            }
        }
    }
    Column(Modifier.fillMaxSize()) {
        if (mode != "trash") Row(Modifier.padding(horizontal = 16.dp), verticalAlignment = Alignment.CenterVertically) {
            OutlinedTextField(query, { query = it }, label = { Text("Search all clouds") }, modifier = Modifier.weight(1f), singleLine = true,
                trailingIcon = { IconButton(onClick = { submitted = query; page = 1 }) { Icon(Icons.Outlined.Search, "Search") } })
            if (submitted.isNotBlank()) IconButton(onClick = { query = ""; submitted = "" }) { Icon(Icons.Outlined.Close, "Clear search") }
        }
        Row(Modifier.padding(horizontal = 16.dp).fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            if (mode == "files" && submitted.isBlank()) {
                FilledTonalButton(onClick = { picker.launch(arrayOf("*/*")) }) { Text("Upload") }
                TextButton(onClick = { form = Form("New folder", listOf(Field("name", "Folder name"))) { body -> vm.task {
                    body.put("parent_folder_id", folder ?: JSONObject.NULL); vm.api.call("/folders", "POST", body); vm.refresh()
                } } }) { Text("New folder") }
            }
            if (mode == "trash") TextButton(onClick = { action("Empty trash permanently?", "/trash/empty") }) { Text("Empty trash") }
            TextButton(onClick = { selectionMode = !selectionMode; selected = emptySet() }) { Text(if (selectionMode) "Done" else "Select") }
        }
        if (mode == "files" && submitted.isBlank()) Row(Modifier.padding(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf("name", "date", "size", "type").forEach { key -> FilterChip(selected = sort == key, onClick = { sort = key; page = 1 }, label = { Text(key.replaceFirstChar { it.uppercase() }) }) }
        }
        if (submitted.isNotBlank()) TextButton(onClick = { form = Form("Save search", listOf(Field("name", "Search name", submitted))) { body -> vm.task {
            body.put("query", submitted); vm.api.call("/saved-searches", "POST", body); vm.refresh()
        } } }) { Text("Save this search") }
        if (selected.isNotEmpty()) Row(Modifier.padding(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            TextButton(onClick = { action(if (mode == "trash") "Permanently delete?" else "Move to trash?", "/files/bulk", body = json("action" to if (mode == "trash") "purge" else "delete", "ids" to selected.toList())) }) { Text("Delete (${selected.size})") }
            TextButton(onClick = { action(if (mode == "trash") "Restore files?" else "Star files?", "/files/bulk", body = json("action" to if (mode == "trash") "restore" else "star", "ids" to selected.toList())) }) { Text(if (mode == "trash") "Restore" else "Star") }
        }
        RemoteContent(state) { data ->
            val files = data.rows("files").map(CloudFile::from)
            LazyColumn(Modifier.weight(1f)) {
                if (files.isEmpty()) item { EmptyState(if (submitted.isBlank()) "No files here yet" else "No matching files", if (mode == "trash") "Deleted files will appear here until their retention period ends." else "Upload a file, connect a cloud, or try another search.") }
                items(files, key = { it.id }) { file ->
                    FileRow(file, onClick = {
                        if (selectionMode || mode == "trash") {
                            selectionMode = true; selected = if (file.id in selected) selected - file.id else selected + file.id
                        } else go(if (file.folder) "folder/${file.id}" else "file/${file.id}")
                    }, selected = if (selectionMode) file.id in selected else null,
                        onMenu = if (mode == "trash") null else ({ go("file/${file.id}") }))
                }
                item { Row(Modifier.fillMaxWidth().padding(16.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                    if (page > 1) TextButton(onClick = { page-- }) { Text("Previous") }
                    Text("Page $page")
                    if (data.flag("hasMore")) TextButton(onClick = { page++ }) { Text("Next") }
                } }
                if (submitted.isNotBlank()) item { Text("Search shows up to 200 matches. Refine your search for more specific results.", Modifier.padding(16.dp), style = MaterialTheme.typography.bodySmall) }
            }
        }
    }
    form?.let { FormDialog(it) { form = null } }
}

@Composable
fun FileDetailScreen(vm: AppViewModel, id: String, go: (String) -> Unit) {
    val context = LocalContext.current
    val state = remote(vm, "/files/${Uri.encode(id)}")
    var form by remember { mutableStateOf<Form?>(null) }
    var reveal by remember { mutableStateOf<String?>(null) }
    var section by remember { mutableStateOf("details") }
    var folderChoices by remember { mutableStateOf<List<JSONObject>?>(null) }
    var exportChoices by remember { mutableStateOf<List<JSONObject>?>(null) }
    val destination = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("*/*")) { uri ->
        if (uri != null) {
            runCatching { context.contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_WRITE_URI_PERMISSION) }
            TransferWorker.enqueue(context, uri, "download", state.data?.optJSONObject("file")?.text("filename") ?: "File", path = "/files/${Uri.encode(id)}/download")
            go("transfers")
        }
    }
    val replace = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) {
            runCatching { context.contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION) }
            TransferWorker.enqueue(context, uri, "upload", "New file version", replace = id); go("transfers")
        }
    }
    fun mutate(title: String, path: String, method: String = "POST", fields: List<Field> = emptyList(), message: String? = null) {
        form = Form(title, fields, message) { body -> vm.task { vm.api.call(path, method, body); if (method == "DELETE") go("trash") else vm.refresh() } }
    }
    RemoteContent(state) { payload ->
        val file = CloudFile.from(payload.getJSONObject("file"))
        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Icon(if (file.folder) Icons.Outlined.Folder else Icons.Outlined.Description, null, Modifier.size(64.dp), tint = MaterialTheme.colorScheme.primary)
            SectionTitle(file.name, "${formatBytes(file.size)} · ${file.provider}")
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = { if (file.folder) go("folder/$id") else destination.launch(file.name) }) { Text(if (file.folder) "Open folder" else "Save to device") }
                FilledTonalButton(onClick = { vm.task { vm.api.call("/files/$id", "PATCH", json("is_starred" to !file.starred)); vm.refresh() } }) { Text(if (file.starred) "Unstar" else "Star") }
            }
            if (!file.folder) TextButton(onClick = { vm.task { preview(context, vm.api, file) } }) { Text("Open in native viewer") }
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                listOf("details", "sharing", "versions").forEach { tab -> FilterChip(section == tab, { section = tab }, label = { Text(tab.replaceFirstChar { it.uppercase() }) }) }
            }
            when (section) {
                "details" -> {
                    InfoCard("File information", "Type: ${file.mime}\nModified: ${file.updated}\nVersion: ${file.raw.optInt("version", 1)}\n${file.raw.text("description")}")
                    OutlinedButton(onClick = { mutate("Rename", "/files/$id", "PATCH", listOf(Field("filename", "Name", file.name))) }, modifier = Modifier.fillMaxWidth()) { Text("Rename") }
                    OutlinedButton(onClick = { mutate("Edit details", "/files/$id", "PATCH", listOf(Field("description", "Description", file.raw.text("description"), "multiline", false), Field("tags", "Tags, comma separated", file.raw.strings("tags").joinToString(", "), "list", false))) }, modifier = Modifier.fillMaxWidth()) { Text("Description & tags") }
                    OutlinedButton(onClick = { vm.task {
                        folderChoices = vm.api.call("/files/tree").rows("folders").filter { it.text("id") != id }
                    } }, modifier = Modifier.fillMaxWidth()) { Text("Move to folder") }
                    if (!file.folder) OutlinedButton(onClick = { vm.task {
                        exportChoices = vm.api.call("/providers").rows("providers")
                    } }, modifier = Modifier.fillMaxWidth()) { Text("Copy to a connected cloud") }
                    OutlinedButton(onClick = { mutate("Make a copy?", "/files/$id/copy", message = "The copy will be created in the same folder.") }, modifier = Modifier.fillMaxWidth()) { Text("Make a copy") }
                    if (!file.folder) OutlinedButton(onClick = { replace.launch(arrayOf("*/*")) }, modifier = Modifier.fillMaxWidth()) { Text("Upload a new version") }
                    OutlinedButton(onClick = { mutate("Move to trash?", "/files/$id", "DELETE", message = "You can restore this item from Trash during its retention period.") }, modifier = Modifier.fillMaxWidth()) { Text("Move to trash") }
                }
                "sharing" -> {
                    Button(onClick = { mutate("Share with someone", "/files/$id/shares", fields = listOf(Field("email", "Email", type = "email"), Field("permission_level", "Permission: view or edit", "view"), Field("message", "Message", type = "multiline", required = false))) }) { Text("Invite by email") }
                    Button(onClick = { form = Form("Create public link", listOf(Field("expires_in_days", "Expires in days", "7", "number"), Field("password", "Password (optional)", type = "password", required = false), Field("max_downloads", "Download limit (optional)", type = "number", required = false), Field("allow_download", "Allow downloads", "true", "boolean"))) { body -> vm.task {
                        val result = vm.api.call("/files/$id/links", "POST", body)
                        val link = result.getJSONObject("link")
                        reveal = link.text("url", result.text("url")); vm.refresh()
                    } } }) { Text("Create secure link") }
                    val shares = remote(vm, "/files/$id/shares")
                    RemoteContent(shares) { it.rows("shares").forEach { share ->
                        InfoCard(share.text("shared_with_email"), share.text("permission_level"))
                        TextButton(onClick = { mutate("Revoke share?", "/shares/${share.text("id")}", "DELETE") }) { Text("Revoke access") }
                    } }
                    val links = remote(vm, "/files/$id/links")
                    RemoteContent(links) { it.rows("links").forEach { link ->
                        InfoCard("Link ${link.text("token_prefix")}", "${link.optInt("download_count")} downloads · Expires ${link.text("expires_at", "never")}")
                        TextButton(onClick = { mutate("Revoke link?", "/links/${link.text("id")}", "DELETE") }) { Text("Revoke link") }
                    } }
                }
                "versions" -> {
                    val versions = remote(vm, "/files/$id/versions")
                    RemoteContent(versions) { data ->
                        if (data.rows("versions").isEmpty()) EmptyState("No earlier versions", "Upload a replacement to keep version history, subject to your plan.")
                        data.rows("versions").forEach { v ->
                            InfoCard("Version ${v.optInt("version")}", "${formatBytes(v.optLong("size"))} · ${v.text("created_at")}")
                            TextButton(onClick = { mutate("Restore this version?", "/files/$id/versions/${v.text("id")}/restore") }) { Text("Restore version") }
                        }
                    }
                }
            }
        }
    }
    folderChoices?.let { folders -> AlertDialog(onDismissRequest = { folderChoices = null }, title = { Text("Choose destination") },
        text = { Column(Modifier.verticalScroll(rememberScrollState())) {
            TextButton(onClick = { vm.task { vm.api.call("/files/$id", "PATCH", json("parent_folder_id" to null)); vm.refresh() }; folderChoices = null }) { Text("CloudGather root") }
            folders.forEach { folder -> TextButton(onClick = { vm.task {
                vm.api.call("/files/$id", "PATCH", json("parent_folder_id" to folder.text("id"))); vm.refresh()
            }; folderChoices = null }) { Text(folder.text("path", folder.text("filename"))) } }
        } }, confirmButton = { TextButton(onClick = { folderChoices = null }) { Text("Cancel") } }) }
    exportChoices?.let { providers -> AlertDialog(onDismissRequest = { exportChoices = null }, title = { Text("Copy to cloud root") },
        text = { Column(Modifier.verticalScroll(rememberScrollState())) {
            if (providers.isEmpty()) Text("Connect a cloud account first.")
            providers.forEach { provider -> TextButton(onClick = { vm.task {
                vm.api.call("/providers/${provider.text("id")}/export", "POST", json("file_id" to id)); vm.refresh()
            }; exportChoices = null }) { Text(provider.text("display_name", provider.text("provider_name"))) } }
        } }, confirmButton = { TextButton(onClick = { exportChoices = null }) { Text("Cancel") } }) }
    form?.let { FormDialog(it) { form = null } }
    reveal?.let { value -> AlertDialog(onDismissRequest = { reveal = null }, title = { Text("Your new link") },
        text = { androidx.compose.foundation.text.selection.SelectionContainer { Text(value.ifBlank { "The server did not return a share URL." }) } },
        confirmButton = { TextButton(onClick = { shareText(context, value) }) { Text("Share link") } },
        dismissButton = { TextButton(onClick = { reveal = null }) { Text("Done") } }) }
}
