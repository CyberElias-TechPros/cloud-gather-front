package com.cloudgather.app.data

import android.app.Application
import android.net.Uri
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import androidx.work.WorkManager
import com.cloudgather.app.CloudGatherApplication
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.security.MessageDigest
import java.security.SecureRandom
import android.util.Base64

/** Activity-scoped session; resource screens keep their own data and cancellation. */
class AppViewModel(application: Application) : AndroidViewModel(application) {
    private val app = application as CloudGatherApplication
    val api = app.api
    val vault = app.vault
    private val _user = MutableStateFlow<JSONObject?>(null)
    val user = _user.asStateFlow()
    private val _starting = MutableStateFlow(true)
    val starting = _starting.asStateFlow()
    private val _error = MutableStateFlow<String?>(null)
    val error = _error.asStateFlow()
    private val _challenge = MutableStateFlow<String?>(null)
    val challenge = _challenge.asStateFlow()
    private val _busy = MutableStateFlow(false)
    val busy = _busy.asStateFlow()
    private val _incoming = MutableStateFlow<List<Uri>>(emptyList())
    val incoming = _incoming.asStateFlow()
    private val _revision = MutableStateFlow(0)
    val revision = _revision.asStateFlow()
    var config = JSONObject()
        private set

    init { restore() }
    fun restore() = task {
        _starting.value = true
        try {
            config = api.call("/config", authenticated = false)
            if (vault.token != null) _user.value = api.call("/auth/me").getJSONObject("user")
        } catch (e: ApiException) {
            if (e.status == 401) clearSession() else throw e
        } finally { _starting.value = false }
    }
    fun clearError() { _error.value = null }
    fun refresh() { _revision.value++ }
    fun incoming(uris: List<Uri>) { _incoming.value = uris }
    fun dismissIncoming() { _incoming.value = emptyList() }
    fun task(block: suspend () -> Unit) = viewModelScope.launch {
        _busy.value = true
        try { block() } catch (e: CancellationException) { throw e } catch (e: Exception) {
            if (e is ApiException && e.status == 401 && vault.token != null && e.code in setOf("session_expired", "unauthorized")) clearSession()
            _error.value = e.message ?: "Something went wrong. Please try again."
        } finally { _busy.value = false }
    }
    private fun adopt(payload: JSONObject) {
        if (payload.flag("mfa_required")) { _challenge.value = payload.getString("challenge"); return }
        vault.put("owner", payload.getJSONObject("user").getString("id"))
        vault.put("token", payload.getString("token"))
        _user.value = payload.getJSONObject("user")
        _challenge.value = null
    }
    fun authenticate(email: String, password: String, name: String?, code: String?) = task {
        val pending = _challenge.value
        if (pending != null) adopt(api.call("/auth/mfa/verify", "POST", json("challenge" to pending, "code" to code), false))
        else {
            require(email.contains('@') && password.isNotEmpty()) { "Enter your email and password." }
            adopt(api.call(if (name == null) "/auth/login" else "/auth/register", "POST",
                json("email" to email.trim(), "password" to password, "displayName" to name,
                    "timezone" to java.util.TimeZone.getDefault().id), false))
        }
    }
    fun resetChallenge() { _challenge.value = null }
    fun signOut() = task {
        try { api.call("/auth/logout", "POST") } finally { clearSession() }
    }
    fun clearSession() {
        WorkManager.getInstance(app).cancelAllWorkByTag("transfer")
        vault.clear()
        _user.value = null
        _challenge.value = null
        app.cacheDir.resolve("catalogue").deleteRecursively()
        app.cacheDir.resolve("previews").deleteRecursively()
        app.filesDir.resolve("transfers").deleteRecursively()
    }
    fun refreshProfile() = task { _user.value = api.call("/auth/me").getJSONObject("user"); refresh() }
    private fun random() = ByteArray(32).also { SecureRandom().nextBytes(it) }.let {
        Base64.encodeToString(it, Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP)
    }
    fun social(provider: String, launch: (String) -> Unit) = task {
        val verifier = random()
        val state = random()
        val challenge = Base64.encodeToString(MessageDigest.getInstance("SHA-256").digest(verifier.toByteArray()),
            Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING)
        vault.put("oauth_verifier", verifier); vault.put("oauth_state", state)
        val start = api.call("/mobile/oauth/start", "POST", json("challenge" to challenge, "state" to state), false)
        val target = Uri.encode(start.getString("redirect"))
        launch(api.call("/auth/oauth/$provider?redirect=$target", authenticated = false).getString("url"))
    }
    fun connectOAuth(provider: String, launch: (String) -> Unit) = task {
        val state = random(); vault.put("provider_state", state)
        val target = Uri.encode("cloudgather://providers?state=$state")
        launch(api.call("/providers/${Uri.encode(provider)}/oauth?redirect=$target").getString("url"))
    }
    fun callback(uri: Uri) = task {
        require(uri.scheme == "cloudgather") { "Unrecognized return link." }
        when (uri.host) {
            "oauth" -> {
                val state = vault.get("oauth_state")
                require(state != null && uri.getQueryParameter("state") == state) { "This sign-in request is not yours. Start sign-in again." }
                val verifier = vault.get("oauth_verifier") ?: error("Sign-in expired. Please try again.")
                val payload = api.call("/mobile/oauth/exchange", "POST",
                    json("code" to uri.getQueryParameter("code"), "verifier" to verifier), false)
                vault.remove("oauth_state"); vault.remove("oauth_verifier")
                adopt(payload)
            }
            "providers" -> {
                val state = vault.get("provider_state")
                require(state != null && uri.getQueryParameter("state") == state) { "Connection request expired." }
                vault.remove("provider_state")
                require(uri.getQueryParameter("connect") == "success") { uri.getQueryParameter("message") ?: "Provider connection failed." }
                refresh()
            }
        }
    }
}
