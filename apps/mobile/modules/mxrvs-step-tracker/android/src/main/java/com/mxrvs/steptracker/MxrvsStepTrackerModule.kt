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

    AsyncFunction("isAvailableAsync") {
      StepCounterService.isSensorAvailable(context)
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
  }
}
