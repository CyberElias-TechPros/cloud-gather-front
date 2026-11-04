package com.cloudgather.app

import android.app.Application
import com.cloudgather.app.data.ApiClient
import com.cloudgather.app.data.SessionVault

class CloudGatherApplication : Application() {
    val vault by lazy { SessionVault(this) }
    val api by lazy { ApiClient({ vault.token }) }
}
