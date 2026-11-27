package com.mxrvs.steptracker

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import org.json.JSONObject
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
class SleepWidgetStoreTest {
  private val context: Context = ApplicationProvider.getApplicationContext()
  private val hour = 3_600_000L

  @Before
  fun reset() {
    context.getSharedPreferences("mxrvs_sleep_widget", Context.MODE_PRIVATE).edit().clear().commit()
  }

  @Test
  fun `records taps and keeps the last wake time when finished while awake`() {
    SleepWidgetStore.setOwner(context, "owner", null)
    SleepWidgetStore.record(context, "start", hour)
    SleepWidgetStore.record(context, "wake", 3 * hour)
    SleepWidgetStore.record(context, "resume", 4 * hour)
    SleepWidgetStore.record(context, "wake", 8 * hour)
    SleepWidgetStore.record(context, "finish", 9 * hour)

    val recording = JSONObject(SleepWidgetStore.read(context, "owner")!!)
    assertEquals("1970-01-01T01:00:00.000Z", recording.getString("startedAt"))
    assertEquals("1970-01-01T08:00:00.000Z", recording.getString("finishedAt"))
    val awakenings = recording.getJSONArray("awakenings")
    assertEquals(1, awakenings.length())
    assertEquals("1970-01-01T03:00:00.000Z", awakenings.getJSONObject(0).getString("wokeAt"))
    assertEquals("1970-01-01T04:00:00.000Z", awakenings.getJSONObject(0).getString("resumedAt"))
  }

  @Test
  fun `protects the current recording from stale saves and account changes`() {
    SleepWidgetStore.record(context, "start", hour)
    assertNull(SleepWidgetStore.read(context, "first"))

    SleepWidgetStore.setOwner(context, "first", null)
    SleepWidgetStore.record(context, "start", hour)
    val started = SleepWidgetStore.read(context, "first")
    SleepWidgetStore.record(context, "finish", 8 * hour)
    val finished = SleepWidgetStore.read(context, "first")
    assertFalse(SleepWidgetStore.replace(context, "first", started, null))

    SleepWidgetStore.setOwner(context, "second", null)
    assertNull(SleepWidgetStore.widgetState(context).second)
    assertFalse(SleepWidgetStore.replace(context, "first", finished, null))
    SleepWidgetStore.setOwner(context, "first", started)
    assertEquals(finished, SleepWidgetStore.read(context, "first"))
    assertTrue(SleepWidgetStore.replace(context, "first", finished, null))
    assertNull(SleepWidgetStore.widgetState(context).second)
  }
}
