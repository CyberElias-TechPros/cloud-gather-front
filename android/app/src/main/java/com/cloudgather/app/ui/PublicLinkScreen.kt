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
import com.cloudgather.app.data.*
import com.cloudgather.app.transfer.TransferWorker
import org.json.JSONObject

@Composable
fun PublicLinkScreen(vm: AppViewModel) {
    val context = LocalContext.current
    var value by remember { mutableStateOf("") }
    var token by remember { mutableStateOf("") }
    var data by remember { mutableStateOf<JSONObject?>(null) }
    var access by remember { mutableStateOf<String?>(null) }
    var password by remember { mutableStateOf("") }
    val save = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("*/*")) { uri ->
        if (uri != null) {
            runCatching { context.contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_WRITE_URI_PERMISSION) }
            val path = "/public/links/${Uri.encode(token)}/download" + (access?.let { "?access=${Uri.encode(it)}" } ?: "")
            // A short-lived public-link access token goes in encrypted vault, not WorkManager's input DB.
            val ref = java.util.UUID.randomUUID().toString()
            vm.vault.put("download:$ref", path)
            TransferWorker.enqueue(context, uri, "public-download", "Public shared file", path = "vault:$ref")
        }
    }
    Column(Modifier.verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        SectionTitle("Open a shared link", "View and save files shared through CloudGather.")
        OutlinedTextField(value, { value = it }, label = { Text("CloudGather link or token") }, modifier = Modifier.fillMaxWidth())
        Button(onClick = { vm.task {
            val candidate = if (value.startsWith("https://")) Uri.parse(value).lastPathSegment.orEmpty() else value.trim()
            require(candidate.matches(Regex("[A-Za-z0-9_-]{20,200}"))) { "Enter a valid link or token." }
            data = null; access = null; token = candidate
            data = vm.api.call("/public/links/${Uri.encode(token)}", authenticated = false)
        } }) { Text("Open link") }
        data?.let { payload ->
            val link = payload.getJSONObject("link")
            InfoCard(payload.optJSONObject("file")?.text("filename") ?: "Shared file", "Shared by ${payload.optJSONObject("owner")?.text("display_name")}\n${link.text("note")}")
            if (link.flag("requires_password") && access == null) {
                OutlinedTextField(password, { password = it }, label = { Text("Link password") }, visualTransformation = androidx.compose.ui.text.input.PasswordVisualTransformation(), modifier = Modifier.fillMaxWidth())
                Button(onClick = { vm.task {
                    val result = vm.api.call("/public/links/${Uri.encode(token)}/unlock", "POST", json("password" to password), false)
                    access = result.getString("access_token"); password = ""
                } }) { Text("Unlock") }
            } else Button(onClick = { save.launch(payload.optJSONObject("file")?.text("filename") ?: "Shared file") }, enabled = link.flag("allow_download") && payload.optJSONObject("file")?.flag("is_folder") != true) { Text("Save to device") }
            if (!link.flag("allow_download")) Text("The owner has disabled downloads.")
        }
    }
}
