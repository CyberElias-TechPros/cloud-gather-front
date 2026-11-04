package com.cloudgather.app.data

import org.json.JSONArray
import org.json.JSONObject
import java.util.Locale

fun json(vararg entries: Pair<String, Any?>) = JSONObject().apply {
    entries.forEach { (key, value) -> put(key, when (value) {
        null -> JSONObject.NULL
        is List<*> -> JSONArray(value)
        else -> value
    }) }
}
fun JSONObject.text(key: String, fallback: String = ""): String =
    if (isNull(key)) fallback else optString(key, fallback)
fun JSONObject.flag(key: String): Boolean = opt(key) == true || opt(key) == 1 || opt(key) == 1L
fun JSONObject.rows(key: String): List<JSONObject> = optJSONArray(key)?.let { a ->
    (0 until a.length()).mapNotNull { a.optJSONObject(it) }
} ?: emptyList()
fun JSONObject.strings(key: String): List<String> = optJSONArray(key)?.let { a ->
    (0 until a.length()).map { a.getString(it) }
} ?: emptyList()

data class CloudFile(val id: String, val name: String, val size: Long, val folder: Boolean,
    val starred: Boolean, val mime: String, val provider: String, val updated: String,
    val raw: JSONObject) {
    companion object {
        fun from(o: JSONObject) = CloudFile(o.text("id"), o.text("filename"), o.optLong("size"),
            o.flag("is_folder"), o.flag("is_starred"), o.text("mime_type", "application/octet-stream"),
            o.text("provider_name", "CloudGather"), o.text("updated_at"), o)
    }
}
fun formatBytes(value: Long): String {
    if (value < 1024) return "$value B"
    val units = listOf("KB", "MB", "GB", "TB")
    var size = value.toDouble() / 1024
    var unit = 0
    while (size >= 1024 && unit < units.lastIndex) { size /= 1024; unit++ }
    return String.format(Locale.getDefault(), "%.1f %s", size, units[unit])
}
