package com.cloudgather.app

import com.cloudgather.app.data.*
import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

class ApiClientTest {
    private lateinit var server: MockWebServer
    private lateinit var api: ApiClient
    @Before fun setup() {
        server = MockWebServer(); server.start()
        api = ApiClient({ "private-token" }, server.url("/api").toString())
    }
    @After fun tearDown() { server.shutdown() }
    @Test fun sendsBearerToApiOnly() = runTest {
        server.enqueue(MockResponse().setBody("{\"files\":[]}"))
        api.call("/files")
        val request = server.takeRequest()
        assertEquals("/api/files", request.path)
        assertEquals("Bearer private-token", request.getHeader("Authorization"))
    }
    @Test fun publicRequestsHaveNoBearer() = runTest {
        server.enqueue(MockResponse().setBody("{}"))
        api.call("/config", authenticated = false)
        assertNull(server.takeRequest().getHeader("Authorization"))
    }
    @Test fun respectsErrorsAndRetryAfter() = runTest {
        server.enqueue(MockResponse().setResponseCode(429).setHeader("Retry-After", "60")
            .setBody("{\"error\":{\"message\":\"Slow down\",\"code\":\"rate_limited\"}}"))
        try { api.call("/files"); fail("Expected API exception") } catch (e: ApiException) { assertEquals(429, e.status); assertEquals("rate_limited", e.code); assertTrue(e.message!!.contains("60")) }
    }
    @Test fun noRedirectFollowsWithCredentials() = runTest {
        server.enqueue(MockResponse().setResponseCode(302).setHeader("Location", "https://example.com/stolen"))
        try { api.call("/files"); fail("Redirect must not be followed") } catch (e: ApiException) { assertEquals(302, e.status); assertEquals(1, server.requestCount) }
    }
    @Test fun noContentIsSuccessful() = runTest {
        server.enqueue(MockResponse().setResponseCode(204))
        assertEquals(0, api.call("/auth/logout", "POST").length())
    }
    @Test fun rejectsAbsoluteOrTraversalPaths() {
        listOf("https://example.com", "//example.com", "/../secrets").forEach { path ->
            try { api.url(path); fail("Unexpected path allowed: $path") } catch (_: IllegalArgumentException) { }
        }
    }
    @Test fun booleanFieldsAcceptWorkerSqlValues() {
        val f = CloudFile.from(json("id" to "a", "filename" to "test", "is_folder" to 1, "is_starred" to true))
        assertTrue(f.folder); assertTrue(f.starred)
        assertFalse(json("is_folder" to 0).flag("is_folder"))
    }
    @Test fun nullValuesAreNotDisplayedAsNull() { assertEquals("CloudGather", json("provider" to null).text("provider", "CloudGather")) }
}
