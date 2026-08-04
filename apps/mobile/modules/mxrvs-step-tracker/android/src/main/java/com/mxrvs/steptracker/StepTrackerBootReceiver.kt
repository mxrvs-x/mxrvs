package com.mxrvs.steptracker

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class StepTrackerBootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (
      intent.action == Intent.ACTION_BOOT_COMPLETED ||
      intent.action == Intent.ACTION_LOCKED_BOOT_COMPLETED ||
      intent.action == Intent.ACTION_MY_PACKAGE_REPLACED
    ) {
      if (StepTrackerStore.isEnabled(context)) {
        StepCounterService.startIfPermitted(context)
      }
    }
  }
}
