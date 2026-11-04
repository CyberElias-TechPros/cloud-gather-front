package com.cloudgather.app.transfer

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.net.Uri
import android.provider.OpenableColumns
import androidx.core.app.NotificationCompat
import androidx.work.*
import com.cloudgather.app.CloudGatherApplication
import com.cloudgather.app.MainActivity
import com.cloudgather.app.R
import com.cloudgather.app.data.ApiClient
import com.cloudgather.app.data.ApiException
import com.cloudgather.app.data.json
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import okio.BufferedSink
import java.io.IOException
import java.util.concurrent.TimeUnit

/** Persisted URI grants, not file paths or credentials, cross the WorkManager boundary. */
class TransferWorker(context: Context, parameters: WorkerParameters) : CoroutineWorker(context, parameters) {
    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val app = applicationContext as CloudGatherApplication
        val owner = inputData.getString("owner")
        if (owner == null || owner != app.vault.owner || app.vault.token == null) return@withContext Result.failure(workDataOf("error" to "Sign in again before transferring files."))
        // Capture this session. A queued transfer can never adopt another account's credentials.
        val sessionToken = app.vault.token
        val api = ApiClient({ sessionToken?.takeIf { app.vault.owner == owner } })
        try {
            setForeground(foreground())
            val uri = Uri.parse(inputData.getString("uri") ?: error("Document is unavailable"))
            if (inputData.getString("kind") == "upload") {
                val resolver = app.contentResolver
                var name = "upload"
                var size = -1L
                resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE), null, null, null)?.use {
                    if (it.moveToFirst()) { name = it.getString(0) ?: name; if (!it.isNull(1)) size = it.getLong(1) }
                }
                if (size > 8L * 1024 * 1024) {
                    val created = api.call("/uploads", "POST", json("filename" to name, "size" to size,
                        "mime_type" to (resolver.getType(uri) ?: "application/octet-stream"),
                        "parent_folder_id" to inputData.getString("parent"), "replace_file_id" to inputData.getString("replace")))
                    val session = created.getJSONObject("upload")
                    val uploadId = session.getString("id")
                    val partSize = session.getInt("part_size")
                    require(partSize in 1..(16 * 1024 * 1024)) { "Server returned an unsupported part size" }
                    var completing = false
                    try {
                        resolver.openInputStream(uri)?.use { input ->
                            val buffer = ByteArray(partSize); var sent = 0L; var part = 1
                            while (sent < size) {
                                if (isStopped) throw IOException("Upload cancelled")
                                val expected = minOf(partSize.toLong(), size - sent).toInt()
                                var used = 0
                                while (used < expected) {
                                    val read = input.read(buffer, used, expected - used)
                                    if (read < 0) throw IOException("The selected file changed. Select it again.")
                                    used += read
                                }
                                api.execute(api.request("/uploads/$uploadId/parts/$part", "PUT",
                                    buffer.toRequestBody("application/octet-stream".toMediaTypeOrNull(), 0, used))).use { api.check(it) }
                                sent += used; part++
                                setProgress(workDataOf("percent" to (sent * 100 / size).toInt()))
                            }
                            require(input.read() == -1) { "The selected file changed during upload." }
                        } ?: throw IOException("Cannot read the selected file")
                        completing = true
                        api.call("/uploads/$uploadId/complete", "POST")
                    } catch (e: Exception) {
                        // Never abort after completion may have committed. A lost response is
                        // ambiguous; automatic retry could create duplicates or delete good data.
                        if (!completing) runCatching { api.call("/uploads/$uploadId", "DELETE") }
                        throw e
                    }
                } else {
                val source = object : RequestBody() {
                    override fun contentType() = (resolver.getType(uri) ?: "application/octet-stream").toMediaTypeOrNull()
                    override fun contentLength() = size
                    override fun writeTo(sink: BufferedSink) {
                        resolver.openInputStream(uri)?.use { input ->
                            val bytes = ByteArray(64 * 1024); var total = 0L
                            var last = -1
                            while (true) {
                                if (isStopped) throw IOException("Upload cancelled")
                                val read = input.read(bytes); if (read == -1) break
                                sink.write(bytes, 0, read); total += read
                                val percent = if (size > 0) (total * 100 / size).toInt() else 0
                                if (percent != last) { last = percent; setProgressAsync(workDataOf("percent" to percent)) }
                            }
                        } ?: throw IOException("File permission expired. Select the file again.")
                    }
                }
                val body = MultipartBody.Builder().setType(MultipartBody.FORM).addFormDataPart("file", name, source)
                inputData.getString("parent")?.let { body.addFormDataPart("parent_folder_id", it) }
                inputData.getString("replace")?.let { body.addFormDataPart("replace_file_id", it) }
                api.execute(api.request("/files/upload", "POST", body.build())).use { api.check(it) }
                }
            } else {
                val storedPath = inputData.getString("path") ?: error("Missing download")
                val path = if (storedPath.startsWith("vault:")) app.vault.get("download:${storedPath.removePrefix("vault:")}") ?: error("Link permission expired. Open the link again.") else storedPath
                api.execute(api.request(path)).use { response ->
                    api.check(response)
                    val body = response.body ?: error("Empty download")
                    // SAF owns the destination. No MANAGE_EXTERNAL_STORAGE / broad media permission.
                    app.contentResolver.openOutputStream(uri, "wt")?.use { output ->
                        body.byteStream().use { input ->
                            val buffer = ByteArray(64 * 1024); var total = 0L; var last = -1
                            while (true) {
                                if (isStopped) throw IOException("Download cancelled")
                                val count = input.read(buffer); if (count == -1) break
                                output.write(buffer, 0, count); total += count
                                val percent = if (body.contentLength() > 0) (total * 100 / body.contentLength()).toInt() else 0
                                if (last != percent) { last = percent; setProgress(workDataOf("percent" to percent)) }
                            }
                        }
                    } ?: error("Could not open the selected destination")
                }
            }
            inputData.getString("path")?.takeIf { it.startsWith("vault:") }?.let { app.vault.remove("download:${it.removePrefix("vault:")}") }
            if (uri.authority == "${app.packageName}.files") {
                // Staged shares are owned by us. Persisted SAF documents are never deleted.
                runCatching { app.contentResolver.delete(uri, null, null) }
            }
            Result.success(workDataOf("percent" to 100, "name" to inputData.getString("name")))
        } catch (e: CancellationException) { throw e } catch (e: Exception) {
            // POST upload is not idempotent. Never silently retry and create duplicate files.
            Result.failure(workDataOf("error" to (e.message ?: "Transfer failed. Select the file again to retry.")))
        }
    }
    private fun foreground(): ForegroundInfo {
        val manager = applicationContext.getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(NotificationChannel("transfers", "File transfers", NotificationManager.IMPORTANCE_LOW))
        val intent = PendingIntent.getActivity(applicationContext, 0, Intent(applicationContext, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE)
        val notification = NotificationCompat.Builder(applicationContext, "transfers")
            .setSmallIcon(R.drawable.ic_cloudgather).setContentTitle("CloudGather transfer")
            .setContentText(inputData.getString("name") ?: "Transferring file")
            .setContentIntent(intent).setOngoing(true).setProgress(0, 0, true)
            .addAction(0, "Cancel", WorkManager.getInstance(applicationContext).createCancelPendingIntent(id)).build()
        return ForegroundInfo(id.hashCode(), notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
    }
    companion object {
        fun enqueue(context: Context, uri: Uri, kind: String, name: String, path: String? = null, parent: String? = null, replace: String? = null) {
            val owner = (context.applicationContext as CloudGatherApplication).vault.owner ?: return
            val request = OneTimeWorkRequestBuilder<TransferWorker>()
                .setInputData(workDataOf("uri" to uri.toString(), "kind" to kind, "name" to name,
                    "path" to path, "parent" to parent, "replace" to replace, "owner" to owner))
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .addTag("transfer").addTag("owner:$owner").keepResultsForAtLeast(1, TimeUnit.DAYS).build()
            WorkManager.getInstance(context).enqueue(request)
        }
    }
}
