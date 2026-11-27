package com.mxrvs.steptracker

import android.content.Context
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class MxrvsStepTrackerModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("MxrvsStepTracker")

    AsyncFunction("setSleepWidgetOwnerAsync") { owner: String?, legacy: String? ->
      SleepWidgetStore.setOwner(context, owner, legacy)
      SleepWidgetProvider.updateAll(context)
    }

    AsyncFunction("getSleepRecordingAsync") { owner: String ->
      SleepWidgetStore.read(context, owner)
    }

    AsyncFunction("replaceSleepRecordingAsync") { owner: String, expected: String?, next: String? ->
      val saved = SleepWidgetStore.replace(context, owner, expected, next)
      if (saved) SleepWidgetProvider.updateAll(context)
      saved
    }

    AsyncFunction("isAvailableAsync") {
      StepCounterService.isSensorAvailable(context)
    }

    AsyncFunction("hasActivityPermissionAsync") {
      StepCounterService.hasActivityPermission(context)
    }

    AsyncFunction("getSnapshotAsync") {
      StepTrackerStore.snapshot(context)
    }

    AsyncFunction("startAsync") {
      StepCounterService.start(context)
      StepTrackerStore.snapshot(context)
    }

    AsyncFunction("stopAsync") {
      StepCounterService.stop(context)
      StepTrackerStore.snapshot(context)
    }

    AsyncFunction("setBodyMetricsAsync") { weightKg: Double?, heightCm: Double? ->
      StepTrackerStore.setBodyMetrics(context, weightKg, heightCm)
      ActivityWidgetProvider.updateAll(context)
      StepTrackerStore.snapshot(context)
    }

    AsyncFunction("archiveCurrentActivityAsync") {
      StepTrackerStore.archiveCurrentActivity(context)
      StepTrackerStore.getArchivedActivities(context)
    }

    AsyncFunction("getArchivedActivitiesAsync") {
      StepTrackerStore.getArchivedActivities(context)
    }

    AsyncFunction("removeArchivedActivityAsync") { activityDate: String, syncedSteps: Int ->
      StepTrackerStore.removeArchivedActivity(context, activityDate, syncedSteps)
    }
  }
}
