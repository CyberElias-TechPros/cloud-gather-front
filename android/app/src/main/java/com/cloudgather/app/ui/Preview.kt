package com.cloudgather.app.ui

import android.content.Context
import android.content.Intent
import androidx.core.content.FileProvider
import com.cloudgather.app.data.ApiClient
import com.cloudgather.app.data.CloudFile
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.util.UUID

/** Use Android's installed document/media viewers, not HTML or an embedded browser. */
suspend fun preview(context: Context, api: ApiClient, file: CloudFile) {
    val safeType = file.mime == "application/pdf" || file.mime.startsWith("image/") || file.mime.startsWith("audio/") || file.mime.startsWith("video/") || file.mime == "text/plain"
    require(safeType) { "Save this file to your device to open it with a compatible application." }
    val local = withContext(Dispatchers.IO) {
        val folder = File(context.cacheDir, "previews").apply { mkdirs() }
        folder.listFiles()?.filter { System.currentTimeMillis() - it.lastModified() > 24L * 3600 * 1000 }?.forEach { it.delete() }
        val target = File(folder, "${UUID.randomUUID()}.${file.name.substringAfterLast('.', "bin").filter { it.isLetterOrDigit() }.take(8)}")
        try {
            api.execute(api.request("/files/${android.net.Uri.encode(file.id)}/download?inline=1")).use { response ->
                api.check(response)
                val body = response.body ?: error("No preview data")
                require(body.contentLength() <= 50L * 1024 * 1024) { "Preview is limited to 50 MB. Save the file to your device instead." }
                body.byteStream().use { input -> target.outputStream().use { output ->
                    val buffer = ByteArray(64 * 1024); var total = 0L
                    while (true) {
                        val read = input.read(buffer); if (read == -1) break
                        total += read; require(total <= 50L * 1024 * 1024) { "File exceeds the preview size limit." }
                        output.write(buffer, 0, read)
                    }
                } }
            }
            target
        } catch (e: Exception) { target.delete(); throw e }
    }
    val uri = FileProvider.getUriForFile(context, "${context.packageName}.files", local)
    val intent = Intent(Intent.ACTION_VIEW).setDataAndType(uri, file.mime)
        .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    try { context.startActivity(Intent.createChooser(intent, "Open with")) }
    catch (_: android.content.ActivityNotFoundException) { error("No compatible viewer is installed. Save this file and install an appropriate viewer.") }
}
