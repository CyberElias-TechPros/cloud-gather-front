package com.cloudgather.app.ui

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.OpenableColumns
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.work.WorkInfo
import androidx.work.WorkManager
import com.cloudgather.app.data.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.util.UUID

/** Transient shares need a private staging copy before their grant disappears. */
suspend fun stageSharedFile(context: Context, uri: Uri): Uri = withContext(Dispatchers.IO) {
    var name = "shared-file"
    context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use {
        if (it.moveToFirst()) name = it.getString(0)?.replace(Regex("[^\\p{L}\\p{N}._ -]"), "_")?.take(150) ?: name
    }
    val root = File(context.filesDir, "transfers")
    // Reclaim staging files abandoned after process death, but not active recent work.
    root.listFiles()?.filter { System.currentTimeMillis() - it.lastModified() > 7L * 24 * 3600 * 1000 }?.forEach { it.deleteRecursively() }
    val folder = File(root, UUID.randomUUID().toString()).apply { mkdirs() }
    val file = File(folder, name.ifBlank { "shared-file" })
    try {
        context.contentResolver.openInputStream(uri)?.use { input ->
            file.outputStream().use { out ->
                val buffer = ByteArray(64 * 1024); var total = 0L
                while (true) {
                    val count = input.read(buffer); if (count == -1) break
                    total += count
                    require(total <= 128L * 1024 * 1024) { "Shared file exceeds the 128 MB staging limit. Upload it using the file picker instead." }
                    out.write(buffer, 0, count)
                }
            }
        } ?: error("The shared file is no longer available.")
        FileProvider.getUriForFile(context, "${context.packageName}.files", file)
    } catch (e: Exception) { folder.deleteRecursively(); throw e }
}

@Composable
fun TransfersScreen(vm: AppViewModel) {
    val context = LocalContext.current
    val manager = remember { WorkManager.getInstance(context) }
    val flow = remember(vm.vault.owner) { manager.getWorkInfosByTagFlow("owner:${vm.vault.owner}") }
    val jobs by flow.collectAsStateWithLifecycle(initialValue = emptyList())
    LaunchedEffect(jobs.count { it.state == WorkInfo.State.SUCCEEDED }) { vm.refresh() }
    LazyColumn(contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item { SectionTitle("File transfers", "Transfers wait for a network connection and continue outside the app. Battery restrictions may delay background work.") }
        if (jobs.isEmpty()) item { EmptyState("No transfers yet", "Upload a file or save one to your device to see progress here.") }
        items(jobs.sortedByDescending { it.id.toString() }, key = { it.id }) { job ->
            val percent = job.progress.getInt("percent", if (job.state == WorkInfo.State.SUCCEEDED) 100 else 0)
            val name = job.outputData.getString("name") ?: "File transfer"
            Card(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(name, style = MaterialTheme.typography.titleMedium)
                    Text("${job.state.name.lowercase().replaceFirstChar { it.uppercase() }} · $percent%")
                    if (!job.state.isFinished) LinearProgressIndicator(progress = { percent / 100f }, modifier = Modifier.fillMaxWidth())
                    job.outputData.getString("error")?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                    if (!job.state.isFinished) TextButton(onClick = { manager.cancelWorkById(job.id) }) { Text("Cancel transfer") }
                    if (job.state == WorkInfo.State.FAILED) Text("To retry safely, return to the file and select Upload or Save to device again. Uploads are not retried automatically to avoid duplicates.", style = MaterialTheme.typography.bodySmall)
                }
            }
        }
    }
}
