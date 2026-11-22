package com.mxrvs.steptracker

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
class StepTrackerStoreTest {
  private lateinit var context: Context

  @Before
  fun setUp() {
    context = ApplicationProvider.getApplicationContext()
    clearPreferences()
  }

  @After
  fun tearDown() {
    clearPreferences()
  }

  @Test
  fun `records sensor deltas and survives a hardware counter reset`() {
    assertEquals(0, StepTrackerStore.recordSensorTotal(context, 100))
    assertEquals(7, StepTrackerStore.recordSensorTotal(context, 107))
    assertEquals(7, StepTrackerStore.getSteps(context))

    assertEquals(0, StepTrackerStore.recordSensorTotal(context, 3))
    assertEquals(5, StepTrackerStore.recordSensorTotal(context, 8))
    assertEquals(12, StepTrackerStore.getSteps(context))
  }

  @Test
  fun `updates the sensor baseline without counting vehicle steps`() {
    StepTrackerStore.recordSensorTotal(context, 100)
    assertEquals(
      0,
      StepTrackerStore.recordSensorTotal(context, 120, countSteps = false)
    )
    assertEquals(5, StepTrackerStore.recordSensorTotal(context, 125))
    assertEquals(5, StepTrackerStore.getSteps(context))
  }

  @Test
  fun `snapshot applies body metrics and tracking state`() {
    StepTrackerStore.setEnabled(context, true)
    StepTrackerStore.setBodyMetrics(context, 70.0, 180.0)
    StepTrackerStore.recordSensorTotal(context, 100)
    StepTrackerStore.recordSensorTotal(context, 110)

    val snapshot = StepTrackerStore.snapshot(context)
    assertEquals(10, snapshot["steps"])
    assertEquals(6, snapshot["movingSeconds"])
    assertEquals(70.0, snapshot["weightKg"] as Double, 0.001)
    assertEquals(180.0, snapshot["heightCm"] as Double, 0.001)
    assertTrue(snapshot["trackingEnabled"] as Boolean)
    assertTrue((snapshot["distanceKm"] as Double) > 0.0)
    assertTrue((snapshot["caloriesBurned"] as Int) >= 0)
  }

  @Test
  fun `invalid body metrics are removed from the snapshot`() {
    StepTrackerStore.setBodyMetrics(context, 70.0, 180.0)
    StepTrackerStore.setBodyMetrics(context, 0.0, null)

    val snapshot = StepTrackerStore.snapshot(context)
    assertNull(snapshot["weightKg"])
    assertNull(snapshot["heightCm"])
  }

  @Test
  fun `re-archiving a date replaces its checkpoint and removal respects newer steps`() {
    StepTrackerStore.setBodyMetrics(context, 70.0, 180.0)
    StepTrackerStore.recordSensorTotal(context, 100)
    StepTrackerStore.recordSensorTotal(context, 110)
    StepTrackerStore.archiveCurrentActivity(context)

    StepTrackerStore.recordSensorTotal(context, 115)
    StepTrackerStore.archiveCurrentActivity(context)

    val archived = StepTrackerStore.getArchivedActivities(context)
    assertEquals(1, archived.size)
    assertEquals(StepTrackerStore.todayKey(), archived[0]["activityDate"])
    assertEquals(15, archived[0]["steps"])
    assertTrue((archived[0]["durationSeconds"] as Int) > 0)
    assertTrue((archived[0]["caloriesBurned"] as Double) > 0.0)

    StepTrackerStore.removeArchivedActivity(
      context,
      StepTrackerStore.todayKey(),
      syncedSteps = 10
    )
    assertEquals(1, StepTrackerStore.getArchivedActivities(context).size)

    StepTrackerStore.removeArchivedActivity(
      context,
      StepTrackerStore.todayKey(),
      syncedSteps = 15
    )
    assertTrue(StepTrackerStore.getArchivedActivities(context).isEmpty())
  }

  @Test
  fun `stores vehicle state and update timestamp`() {
    StepTrackerStore.setInVehicle(context, true, 1234L)
    assertTrue(StepTrackerStore.isInVehicle(context))
    assertEquals(1234L, StepTrackerStore.snapshot(context)["vehicleActivityUpdatedAt"])

    StepTrackerStore.setInVehicle(context, false, 5678L)
    assertFalse(StepTrackerStore.isInVehicle(context))
  }

  @Test
  fun `widget refreshes for first render step changes or elapsed time`() {
    assertTrue(StepTrackerStore.shouldRefreshWidget(context, steps = 0, nowMs = 1_000L))
    StepTrackerStore.markWidgetRefreshed(context, steps = 10, nowMs = 1_000L)

    assertFalse(StepTrackerStore.shouldRefreshWidget(context, steps = 14, nowMs = 20_000L))
    assertTrue(StepTrackerStore.shouldRefreshWidget(context, steps = 15, nowMs = 20_000L))
    assertTrue(StepTrackerStore.shouldRefreshWidget(context, steps = 10, nowMs = 31_000L))
  }

  private fun clearPreferences() {
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .edit().clear().commit()
    context.createDeviceProtectedStorageContext()
      .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .edit().clear().commit()
  }

  companion object {
    private const val PREFS_NAME = "mxrvs_native_step_tracker"
  }
}
