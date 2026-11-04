package com.cloudgather.app.data

import com.cloudgather.app.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import okhttp3.Call
import okhttp3.Callback
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

class ApiException(val status: Int, val code: String, message: String) : IOException(message)

class ApiClient(private val token: () -> String?, base: String = BuildConfig.API_URL) {
    val baseUrl = base.trimEnd('/').toHttpUrl()
    // Never send bearer credentials through an unexpected redirect.
    val http = OkHttpClient.Builder().connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(90, TimeUnit.SECONDS).writeTimeout(90, TimeUnit.SECONDS)
        .followRedirects(false).followSslRedirects(false).retryOnConnectionFailure(false).build()

    fun url(path: String): String {
        require(path.startsWith("/") && !path.startsWith("//") && !path.contains('\\'))
        require(path.substringBefore('?').split('/').none { it == ".." || it == "." })
        val resolved = (baseUrl.toString().trimEnd('/') + path).toHttpUrl()
        require(resolved.host == baseUrl.host && resolved.port == baseUrl.port && resolved.scheme == baseUrl.scheme)
        require(resolved.encodedPath.startsWith(baseUrl.encodedPath.trimEnd('/') + "/"))
        return resolved.toString()
    }
    fun request(path: String, method: String = "GET", body: RequestBody? = null, authenticated: Boolean = true): Request {
        return Request.Builder().url(url(path)).header("X-CloudGather-Client", "android/1.0")
            .apply { if (authenticated) token()?.let { header("Authorization", "Bearer $it") } }
            .method(method, if (method in listOf("POST", "PUT", "PATCH") && body == null) ByteArray(0).toRequestBody() else body)
            .build()
    }
    suspend fun execute(request: Request): Response = suspendCancellableCoroutine { continuation ->
        val call = http.newCall(request)
        continuation.invokeOnCancellation { call.cancel() }
        call.enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) { if (continuation.isActive) continuation.resumeWithException(e) }
            override fun onResponse(call: Call, response: Response) {
                continuation.resume(response) { _, resource, _ -> resource.close() }
            }
        })
    }
    fun check(response: Response) {
        if (response.isSuccessful) return
        val error = runCatching { JSONObject(response.body?.string().orEmpty()).optJSONObject("error") }.getOrNull()
        val retry = response.header("Retry-After")?.let { " Try again in $it seconds." }.orEmpty()
        throw ApiException(response.code, error?.text("code") ?: "http_error",
            (error?.text("message") ?: "Request failed (${response.code}).") + retry)
    }
    suspend fun call(path: String, method: String = "GET", body: JSONObject? = null, authenticated: Boolean = true): JSONObject =
        withContext(Dispatchers.IO) {
            execute(request(path, method, body?.toString()?.toRequestBody("application/json".toMediaType()), authenticated)).use { response ->
                check(response)
                val raw = response.body?.string().orEmpty()
                if (raw.isBlank()) JSONObject() else JSONObject(raw)
            }
        }
}
