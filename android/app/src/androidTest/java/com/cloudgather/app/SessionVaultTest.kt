package com.cloudgather.app

import androidx.test.platform.app.InstrumentationRegistry
import com.cloudgather.app.data.SessionVault
import org.junit.Assert.*
import org.junit.Test

class SessionVaultTest {
    @Test fun encryptedSessionRoundTripAndClear() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val vault = SessionVault(context)
        vault.put("test-token", "not-plaintext")
        assertEquals("not-plaintext", vault.get("test-token"))
        val stored = context.getSharedPreferences("secure_session", 0).getString("test-token", null)
        assertNotNull(stored); assertFalse(stored!!.contains("not-plaintext"))
        vault.remove("test-token")
        assertNull(vault.get("test-token"))
    }
}
