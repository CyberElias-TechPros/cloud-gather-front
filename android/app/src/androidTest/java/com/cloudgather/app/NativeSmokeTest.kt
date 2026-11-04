package com.cloudgather.app

import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.cloudgather.app.data.CloudFile
import com.cloudgather.app.data.json
import com.cloudgather.app.ui.*
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class NativeSmokeTest {
    @get:Rule val compose = createComposeRule()
    @Test fun nativeFileRowOpensAndAnnouncesName() {
        var opened = false
        val file = CloudFile.from(json("id" to "a", "filename" to "Welcome.pdf", "size" to 1024))
        compose.setContent { MaterialTheme { FileRow(file, { opened = true }) } }
        compose.onNodeWithText("Welcome.pdf").assertIsDisplayed().performClick()
        assertTrue(opened)
    }
    @Test fun formRequiresANameBeforeSubmitting() {
        var submitted = false
        compose.setContent { MaterialTheme { FormDialog(Form("New folder", listOf(Field("name", "Folder name")), submit = { submitted = true }), {}) } }
        compose.onNodeWithText("Save").performClick()
        assertFalse(submitted)
        compose.onNodeWithText("Folder name is required.").assertIsDisplayed()
        compose.onNodeWithText("Folder name").performTextInput("Documents")
        compose.onNodeWithText("Save").performClick()
        assertTrue(submitted)
    }
}
